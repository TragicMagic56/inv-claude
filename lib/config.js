const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'client-config.json');

function loadClientConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(
      'client-config.json not found. Copy client-config.example.json to client-config.json and fill in your real client mapping.'
    );
  }

  const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed.clients)) {
    throw new Error('client-config.json must have a top level "clients" array.');
  }

  for (const client of parsed.clients) {
    const required = ['id', 'display_name', 'toggl_client_id', 'toggl_workspace_id', 'wave_customer_id', 'rate_per_hour', 'projects'];
    for (const field of required) {
      if (client[field] === undefined) {
        throw new Error(`Client "${client.id || client.display_name || '?'}" is missing required field "${field}" in client-config.json.`);
      }
    }
  }

  return parsed.clients;
}

function getClientById(clientId) {
  const clients = loadClientConfig();
  return clients.find((client) => client.id === clientId);
}

module.exports = { loadClientConfig, getClientById };
