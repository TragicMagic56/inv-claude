# inv-claude

A local tool that pulls billable time from Toggl Track for a chosen client and date range, shows a preview, and creates a matching draft invoice in Wave Apps. It never sends an invoice to a client. This runs only on your own machine.

## What it does

1. You pick a client and a date range in the browser.
2. It pulls your Toggl time entries for that range, keeps only entries under that client's projects, excludes anything already billed and any timer still running.
3. It groups the remaining time by Toggl project and shows you the hours, rate, and amount per project, plus a total.
4. If everything looks right, you click Create Draft Invoice. It creates a DRAFT invoice in Wave with one line item per project, then records the Toggl entry IDs it billed so they are never billed again.
5. You open the invoice in Wave yourself to review and send it. This tool never sends anything.

## One time setup

### 1. Install

```
npm install
```

### 2. Get a Toggl API token

Toggl Track, Profile, at the bottom, API Token. This is your `TOGGL_API_TOKEN`.

### 3. Get a Wave Full Access Token

In the Wave Business Portal, open the developer section for your business, create an app, and generate a Full Access Token scoped to that one business. This is your `WAVE_FULL_ACCESS_TOKEN`. No OAuth flow is needed here since this is single business, personal use, not a published app for other users.

You also need your `WAVE_BUSINESS_ID`, shown in the same developer section.

### 4. Copy `.env.example` to `.env` and fill in the three values above

```
cp .env.example .env
```

`.env` is gitignored. Never commit it.

### 5. Build your client mapping

Copy `client-config.example.json` to `client-config.json` and fill in your real clients. `client-config.json` is also gitignored since it contains your business's real customer and product IDs.

For each client you need:

- `toggl_client_id` and `toggl_workspace_id`: found by calling Toggl's API directly, for example `GET https://api.track.toggl.com/api/v9/workspaces/{workspace_id}/clients` with your token, or by inspecting network requests in the Toggl web app.
- `wave_customer_id`: found via Wave's GraphQL API (a `customers` query against your business) or by inspecting the customer in Wave.
- `rate_per_hour`: your hourly rate for that client.
- `projects`: a map of `toggl_project_id` to `wave_product_id`. **For every Toggl project under that client, create a matching Product or Service in Wave first**, then put its ID here. Wave builds invoice line items from a Product/Service record, not free text, so this step is required before a project's time can be billed. A project with tracked time but no entry here still shows up in the preview as a warning, it is just excluded from the total until you map it.

### 6. Run it

```
npm start
```

Open `http://localhost:3000` (or whatever `PORT` you set in `.env`).

## Preview vs Create Draft Invoice

- **Preview** is read only. It calls Toggl and reads your local ledger, but writes nothing anywhere. Run it as many times as you like.
- **Create Draft Invoice** re-checks everything fresh (it does not trust the browser's copy of the preview), calls Wave to create the invoice, and then updates `invoiced_entries.json` with the Toggl entry IDs it just billed. This is the only step that writes anything.

## Assumptions built into this tool

These were confirmed before building and can be changed if your setup changes:

- **Rate**: one hourly rate per client, applied to every project under that client. Different rates per project are not supported.
- **Client and project mapping**: entirely manual, maintained by hand in `client-config.json`. There is no automatic matching between Toggl and Wave.
- **GST**: not charged. No tax line is added to invoices and no tax rate is looked up in Wave.
- **Rounding**: each project's total tracked time for the selected range is summed in seconds, then rounded to the nearest minute before being converted to decimal hours. Rounding is not applied per individual time entry, only to each project's total, to avoid small errors compounding across many entries.
- **Duplicate prevention**: a local file, `invoiced_entries.json`, lists every Toggl entry ID that has already been billed. It is checked before every preview and updated after every successful draft invoice creation. If you delete this file, previously billed time will show up again as billable.
- **Review step**: this tool only ever creates DRAFT invoices. There is no code path that sends or finalizes an invoice. You always do that manually in Wave.
- **Timezone**: date ranges are interpreted using a fixed Adelaide standard time offset (+09:30). It does not adjust for daylight saving, so entries within about an hour of midnight on a DST change date could land on the wrong side of a range.

## If something goes wrong

- If Wave's API returns an error when creating an invoice, the raw error message is shown in the browser rather than a generic failure message. Nothing is written to the local ledger in that case.
- If a draft invoice is successfully created in Wave but writing to `invoiced_entries.json` fails afterwards, the server logs this loudly to the console and the browser shows a warning telling you to update the ledger by hand. This is the one case where you need to intervene manually, otherwise the same time could be billed twice next time.
- Wave's GraphQL schema is not versioned and can change. If the invoice creation mutation in `lib/wave.js` starts failing after a Wave update, run an introspection query against `InvoiceCreateInput` (there is a helper, `introspectInputType`, exported from `lib/wave.js`) to check the current field names before changing the mutation.

## Project layout

```
server.js                    Express app and route handlers
lib/toggl.js                 Toggl Track API v9 client
lib/wave.js                  Wave GraphQL client
lib/config.js                Loads and validates client-config.json
lib/ledger.js                Reads and appends invoiced_entries.json
public/index.html            The entire frontend, plain HTML and vanilla JS, no build step
client-config.example.json   Example client mapping shape
.env.example                 Required environment variables, no real values
```
