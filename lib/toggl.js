const TOGGL_API_BASE = 'https://api.track.toggl.com/api/v9';

// Fixed Adelaide standard time offset (+09:30). This does not adjust for
// daylight saving, so entries within an hour of a DST boundary date could
// land on the wrong side of the range. Acceptable for a personal local tool.
const ADELAIDE_OFFSET = '+09:30';

function authHeader() {
  const token = process.env.TOGGL_API_TOKEN;
  if (!token) {
    throw new Error('TOGGL_API_TOKEN is not set. Check your .env file.');
  }
  const encoded = Buffer.from(`${token}:api_token`).toString('base64');
  return `Basic ${encoded}`;
}

async function togglGet(pathSuffix) {
  const response = await fetch(`${TOGGL_API_BASE}${pathSuffix}`, {
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Toggl API request to ${pathSuffix} failed (${response.status}): ${body}`);
  }

  return response.json();
}

async function getTimeEntries(startDate, endDate) {
  const start = `${startDate}T00:00:00${ADELAIDE_OFFSET}`;
  const end = `${endDate}T23:59:59${ADELAIDE_OFFSET}`;
  const query = `?start_date=${encodeURIComponent(start)}&end_date=${encodeURIComponent(end)}`;
  return togglGet(`/me/time_entries${query}`);
}

async function getProjects(workspaceId) {
  // Toggl defaults "active" to true, which silently excludes archived or
  // completed projects. Past billable time still needs those, so ask for both.
  return togglGet(`/workspaces/${workspaceId}/projects?active=both`);
}

async function getWorkspaces() {
  return togglGet('/workspaces');
}

async function getClients(workspaceId) {
  return togglGet(`/workspaces/${workspaceId}/clients`);
}

module.exports = { getTimeEntries, getProjects, getWorkspaces, getClients };
