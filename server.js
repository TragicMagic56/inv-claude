require('dotenv').config();
const path = require('path');
const express = require('express');

const { getTimeEntries, getProjects, getWorkspaces, getClients } = require('./lib/toggl');
const { createDraftInvoice, getCustomers, getProducts, getIncomeAccounts, createProduct } = require('./lib/wave');
const { getInvoicedEntryIdSet, appendInvoicedEntries } = require('./lib/ledger');
const { getRate, setRate } = require('./lib/rates');
const { matchByName } = require('./lib/matching');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/clients', handleGetClients);
app.post('/api/rates', handleSetRate);
app.post('/api/preview', handlePreview);
app.post('/api/create-draft-invoice', handleCreateDraftInvoice);

async function handleGetClients(req, res) {
  try {
    const discovery = await discoverClients();
    res.json(discovery);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function handleSetRate(req, res) {
  try {
    const { toggl_client_id, rate } = req.body;
    const numericRate = Number(rate);
    if (!toggl_client_id || !Number.isFinite(numericRate) || numericRate <= 0) {
      return res.status(400).json({ error: 'toggl_client_id and a positive rate are required.' });
    }
    setRate(toggl_client_id, numericRate);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function handlePreview(req, res) {
  try {
    const { toggl_client_id, start_date, end_date } = req.body;
    const result = await computeBilling(toggl_client_id, start_date, end_date);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

async function handleCreateDraftInvoice(req, res) {
  try {
    const { toggl_client_id, start_date, end_date } = req.body;

    // Recompute fresh right before creating, never trust client-supplied
    // line items, so what's billed always matches current ledger/Toggl/Wave state.
    const billing = await computeBilling(toggl_client_id, start_date, end_date);

    if (billing.line_items.length === 0) {
      return res.status(400).json({ error: 'Nothing to bill for this client and date range.' });
    }

    const itemsNeedingNewProduct = billing.line_items.filter((item) => item.will_create_product);
    if (itemsNeedingNewProduct.length > 0) {
      const incomeAccountId = await resolveIncomeAccountId();
      for (const item of itemsNeedingNewProduct) {
        const product = await createProduct({
          businessId: process.env.WAVE_BUSINESS_ID,
          name: item.project_name,
          incomeAccountId,
        });
        item.wave_product_id = product.id;
      }
    }

    const wave_items = billing.line_items.map((item) => ({
      productId: item.wave_product_id,
      description: item.description,
      quantity: item.hours,
      unitPrice: item.rate_per_hour,
    }));

    const invoice = await createDraftInvoice(process.env.WAVE_BUSINESS_ID, billing.wave_customer_id, wave_items);

    try {
      appendInvoicedEntries(billing.client_id, invoice.id, billing.included_entry_ids);
    } catch (ledgerError) {
      console.error('=====================================================');
      console.error('LEDGER WRITE FAILED AFTER A SUCCESSFUL WAVE INVOICE.');
      console.error(`Wave invoice ${invoice.id} was created for toggl_client_id "${billing.client_id}".`);
      console.error('The following Toggl entry IDs were NOT recorded and must be added to invoiced_entries.json by hand to avoid double billing:');
      console.error(JSON.stringify(billing.included_entry_ids));
      console.error(ledgerError);
      console.error('=====================================================');
      return res.json({
        wave_invoice_id: invoice.id,
        wave_invoice_number: invoice.invoiceNumber,
        wave_invoice_url: invoice.viewUrl || null,
        ledger_warning: 'Invoice was created in Wave, but the local ledger failed to update. Check the server console and update invoiced_entries.json manually before billing this range again.',
      });
    }

    res.json({
      wave_invoice_id: invoice.id,
      wave_invoice_number: invoice.invoiceNumber,
      wave_invoice_url: invoice.viewUrl || null,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

// Fetches Toggl clients and Wave customers live, matches them by name, and
// merges in any locally saved rate. No mapping is ever hand maintained.
async function discoverClients() {
  const businessId = process.env.WAVE_BUSINESS_ID;
  const workspaces = await getWorkspaces();

  const togglClients = [];
  for (const workspace of workspaces) {
    const clients = await getClients(workspace.id);
    for (const client of clients) {
      togglClients.push({ id: client.id, name: client.name, workspace_id: workspace.id });
    }
  }

  const waveCustomers = await getCustomers(businessId);

  const ready = [];
  const needs_setup = [];

  for (const client of togglClients) {
    const { match, reason } = matchByName(client.name, waveCustomers);

    if (!match) {
      needs_setup.push({
        toggl_client_id: client.id,
        display_name: client.name,
        issue: reason === 'ambiguous_match' ? 'ambiguous_wave_customer_match' : 'no_wave_customer_match',
      });
      continue;
    }

    const rate = getRate(client.id);
    if (rate === undefined) {
      needs_setup.push({ toggl_client_id: client.id, display_name: client.name, issue: 'rate_not_set' });
      continue;
    }

    ready.push({
      toggl_client_id: client.id,
      workspace_id: client.workspace_id,
      display_name: client.name,
      wave_customer_id: match.id,
      rate,
    });
  }

  return { ready, needs_setup };
}

function resolveClient(togglClientId, discovery) {
  const id = Number(togglClientId);
  const ready = discovery.ready.find((client) => client.toggl_client_id === id);
  if (ready) return ready;

  const blocked = discovery.needs_setup.find((client) => client.toggl_client_id === id);
  if (blocked) {
    const messages = {
      no_wave_customer_match: 'no Wave customer matches this Toggl client\'s name',
      ambiguous_wave_customer_match: 'more than one Wave customer matches this Toggl client\'s name',
      rate_not_set: 'no rate is set for this client yet, set one on the Rates panel',
    };
    throw new Error(`Cannot bill "${blocked.display_name}": ${messages[blocked.issue]}.`);
  }

  throw new Error(`Unknown toggl_client_id "${togglClientId}".`);
}

async function resolveIncomeAccountId() {
  if (process.env.WAVE_INCOME_ACCOUNT_ID) {
    return process.env.WAVE_INCOME_ACCOUNT_ID;
  }
  const incomeAccounts = await getIncomeAccounts(process.env.WAVE_BUSINESS_ID);
  if (incomeAccounts.length === 0) {
    throw new Error('No active income account found in Wave to assign a new product to. Set WAVE_INCOME_ACCOUNT_ID in .env.');
  }
  return incomeAccounts[0].id;
}

async function computeBilling(togglClientId, startDate, endDate) {
  if (!togglClientId || !startDate || !endDate) {
    throw new Error('toggl_client_id, start_date and end_date are required.');
  }

  const discovery = await discoverClients();
  const client = resolveClient(togglClientId, discovery);

  const [timeEntries, projects, products] = await Promise.all([
    getTimeEntries(startDate, endDate),
    getProjects(client.workspace_id),
    getProducts(process.env.WAVE_BUSINESS_ID),
  ]);

  const clientProjects = projects.filter((project) => project.client_id === client.toggl_client_id);
  const clientProjectIds = new Set(clientProjects.map((project) => project.id));
  const projectNameById = new Map(clientProjects.map((project) => [project.id, project.name]));

  const alreadyInvoiced = getInvoicedEntryIdSet();

  const matchingEntries = timeEntries.filter((entry) => {
    if (!clientProjectIds.has(entry.project_id)) return false;
    if (entry.duration < 0) return false; // currently running
    if (alreadyInvoiced.has(entry.id)) return false;
    return true;
  });

  const secondsByProject = new Map();
  const entryIdsByProject = new Map();
  for (const entry of matchingEntries) {
    secondsByProject.set(entry.project_id, (secondsByProject.get(entry.project_id) || 0) + entry.duration);

    const priorIds = entryIdsByProject.get(entry.project_id) || [];
    priorIds.push(entry.id);
    entryIdsByProject.set(entry.project_id, priorIds);
  }

  const dateRangeLabel = formatDateRange(startDate, endDate);

  const line_items = [];
  const unmapped_warnings = [];
  const included_entry_ids = [];

  for (const [projectId, totalSeconds] of secondsByProject.entries()) {
    const hours = roundToNearestMinuteAsHours(totalSeconds);
    const projectName = projectNameById.get(projectId) || `Project ${projectId}`;

    const { match, reason } = matchByName(projectName, products);

    if (reason === 'ambiguous_match') {
      unmapped_warnings.push({ toggl_project_id: projectId, project_name: projectName, hours, reason });
      continue;
    }

    line_items.push({
      toggl_project_id: projectId,
      project_name: projectName,
      hours,
      rate_per_hour: client.rate,
      amount: round2(hours * client.rate),
      wave_product_id: match ? match.id : null,
      will_create_product: !match,
      description: `${projectName}, ${dateRangeLabel}, ${hours} hrs at $${client.rate}/hr`,
    });

    included_entry_ids.push(...entryIdsByProject.get(projectId));
  }

  const subtotal = round2(line_items.reduce((sum, item) => sum + item.amount, 0));

  return {
    client_id: client.toggl_client_id,
    client_display_name: client.display_name,
    wave_customer_id: client.wave_customer_id,
    line_items,
    unmapped_warnings,
    subtotal,
    total: subtotal,
    entry_count: matchingEntries.length,
    included_entry_ids,
  };
}

function roundToNearestMinuteAsHours(totalSeconds) {
  const minutes = Math.round(totalSeconds / 60);
  return round2(minutes / 60);
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function formatDateRange(startDate, endDate) {
  const format = (isoDate) => {
    const [year, month, day] = isoDate.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${parseInt(day, 10)} ${months[parseInt(month, 10) - 1]} ${year}`;
  };
  return `${format(startDate)} to ${format(endDate)}`;
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Invoice generator running at http://localhost:${port}`);
});
