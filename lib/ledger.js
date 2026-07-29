const fs = require('fs');
const path = require('path');

const LEDGER_PATH = path.join(__dirname, '..', 'invoiced_entries.json');

function loadLedger() {
  if (!fs.existsSync(LEDGER_PATH)) {
    return [];
  }
  const raw = fs.readFileSync(LEDGER_PATH, 'utf8');
  if (!raw.trim()) {
    return [];
  }
  return JSON.parse(raw);
}

function getInvoicedEntryIdSet() {
  const records = loadLedger();
  return new Set(records.map((record) => record.toggl_entry_id));
}

function appendInvoicedEntries(clientId, waveInvoiceId, entryIds) {
  const records = loadLedger();
  const invoicedAt = new Date().toISOString();

  for (const entryId of entryIds) {
    records.push({
      toggl_entry_id: entryId,
      client_id: clientId,
      wave_invoice_id: waveInvoiceId,
      invoiced_at: invoicedAt,
    });
  }

  fs.writeFileSync(LEDGER_PATH, JSON.stringify(records, null, 2));
}

module.exports = { loadLedger, getInvoicedEntryIdSet, appendInvoicedEntries };
