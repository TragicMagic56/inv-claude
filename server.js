require('dotenv').config();
const path = require('path');
const express = require('express');

const { loadClientConfig, getClientById } = require('./lib/config');
const { getTimeEntries, getProjects } = require('./lib/toggl');
const { createDraftInvoice } = require('./lib/wave');
const { getInvoicedEntryIdSet, appendInvoicedEntries } = require('./lib/ledger');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/clients', handleGetClients);
app.post('/api/preview', handlePreview);
app.post('/api/create-draft-invoice', handleCreateDraftInvoice);

async function handleGetClients(req, res) {
  try {
    const clients = loadClientConfig();
    res.json(clients.map((client) => ({ id: client.id, display_name: client.display_name })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function handlePreview(req, res) {
  try {
    const { client_id, start_date, end_date } = req.body;
    const result = await computeBilling(client_id, start_date, end_date);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

async function handleCreateDraftInvoice(req, res) {
  try {
    const { client_id, start_date, end_date } = req.body;
    const client = getClientById(client_id);
    if (!client) {
      return res.status(400).json({ error: `Unknown client_id "${client_id}".` });
    }

    // Recompute fresh right before creating, never trust client-supplied
    // line items, so what's billed always matches current ledger/Toggl state.
    const billing = await computeBilling(client_id, start_date, end_date);

    if (billing.line_items.length === 0) {
      return res.status(400).json({ error: 'Nothing to bill for this client and date range.' });
    }

    const wave_items = billing.line_items.map((item) => ({
      productId: item.wave_product_id,
      description: item.description,
      quantity: item.hours,
      unitPrice: client.rate_per_hour,
    }));

    const invoice = await createDraftInvoice(process.env.WAVE_BUSINESS_ID, client.wave_customer_id, wave_items);

    try {
      appendInvoicedEntries(client_id, invoice.id, billing.included_entry_ids);
    } catch (ledgerError) {
      console.error('=====================================================');
      console.error('LEDGER WRITE FAILED AFTER A SUCCESSFUL WAVE INVOICE.');
      console.error(`Wave invoice ${invoice.id} was created for client "${client_id}".`);
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

async function computeBilling(clientId, startDate, endDate) {
  if (!startDate || !endDate) {
    throw new Error('start_date and end_date are required.');
  }

  const client = getClientById(clientId);
  if (!client) {
    throw new Error(`Unknown client_id "${clientId}".`);
  }

  const [timeEntries, projects] = await Promise.all([
    getTimeEntries(startDate, endDate),
    getProjects(client.toggl_workspace_id),
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
    const prior = secondsByProject.get(entry.project_id) || 0;
    secondsByProject.set(entry.project_id, prior + entry.duration);

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
    const wave_product_id = client.projects[String(projectId)];

    if (!wave_product_id) {
      unmapped_warnings.push({
        toggl_project_id: projectId,
        project_name: projectName,
        hours,
      });
      continue;
    }

    line_items.push({
      toggl_project_id: projectId,
      project_name: projectName,
      hours,
      rate_per_hour: client.rate_per_hour,
      amount: round2(hours * client.rate_per_hour),
      wave_product_id,
      description: `${projectName}, ${dateRangeLabel}, ${hours} hrs at $${client.rate_per_hour}/hr`,
    });

    included_entry_ids.push(...entryIdsByProject.get(projectId));
  }

  const subtotal = round2(line_items.reduce((sum, item) => sum + item.amount, 0));

  return {
    client_id: clientId,
    client_display_name: client.display_name,
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
