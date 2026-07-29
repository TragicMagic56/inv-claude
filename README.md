# inv-claude

A local tool that pulls billable time from Toggl Track for a chosen client and date range, shows a preview, and creates a matching draft invoice in Wave Apps. It never sends an invoice to a client. This runs only on your own machine.

## What it does

1. You pick a client and a date range in the browser.
2. It matches your Toggl clients and projects to your Wave customers and products automatically, by name. There is no mapping file to maintain by hand.
3. It pulls your Toggl time entries for that range, keeps only entries under that client's projects, excludes anything already billed and any timer still running.
4. It groups the remaining time by Toggl project and shows you the hours, rate, and amount per project, plus a total.
5. If everything looks right, you click Create Draft Invoice. It creates a DRAFT invoice in Wave with one line item per project (creating a matching Wave product automatically for any project that doesn't have one yet), then records the Toggl entry IDs it billed so they are never billed again.
6. You open the invoice in Wave yourself to review and send it. This tool never sends anything.

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

### 4. Copy `.env.example` to `.env` and fill in the values above

```
cp .env.example .env
```

`.env` is gitignored. Never commit it. Leave `WAVE_INCOME_ACCOUNT_ID` blank unless you have more than one active income account in Wave and want a specific one used for automatically created products.

### 5. Make sure your Toggl client and project names match your Wave customer and product names

There is no config file to maintain. Instead, on every request the app fetches your Toggl clients/projects and your Wave customers/products live, and matches them by name (case and punctuation insensitive). For this to work:

- Each Toggl client's name should match a Wave customer's name exactly (after lowercasing and trimming).
- Each Toggl project's name should match a Wave product's name, if you already have one. If you don't have a matching product yet, the app creates one automatically the first time you bill that project, named exactly after the Toggl project.

If a Toggl client has no matching Wave customer, or matches more than one, it will not appear in the client dropdown. Instead it shows up under "Needs setup" in the app with the reason, so you always know what's blocking it rather than getting a silent wrong match.

### 6. Set your rate per client

Neither Toggl nor Wave has a concept of your hourly billing rate. Once a Toggl client is matched to a Wave customer, it appears under "Needs setup" asking for a rate. Enter it there. It's saved automatically to a local `rates.json` file, which you never need to open or edit by hand.

### 7. Run it

```
npm start
```

Open `http://localhost:3000` (or whatever `PORT` you set in `.env`).

## Preview vs Create Draft Invoice

- **Preview** is read only. It calls Toggl and Wave to discover and match clients/projects, and reads your local ledger, but writes nothing anywhere, not even a new Wave product. Run it as many times as you like. If a project has no matching Wave product yet, Preview shows a note that one will be created, without creating it.
- **Create Draft Invoice** re-checks everything fresh (it does not trust the browser's copy of the preview), creates any missing Wave products, calls Wave to create the invoice, and then updates `invoiced_entries.json` with the Toggl entry IDs it just billed. This is the only step that writes anything.

## Assumptions built into this tool

These were confirmed before building and can be changed if your setup changes:

- **Rate**: one hourly rate per client, applied to every project under that client, set through the "Needs setup" panel and stored in `rates.json`. Different rates per project are not supported.
- **Client and project mapping**: fully automatic, matched live by name between Toggl and Wave on every request. If a match is missing or ambiguous, that client or project is excluded and flagged rather than guessed, since invoices are always drafts you review before sending, a bad match is cheap to catch but still worth avoiding by default.
- **Missing Wave products**: created automatically when creating a draft invoice, named after the Toggl project, assigned to your first active income account (or `WAVE_INCOME_ACCOUNT_ID` if set).
- **GST**: not charged. No tax line is added to invoices and no tax rate is looked up in Wave.
- **Rounding**: each project's total tracked time for the selected range is summed in seconds, then rounded to the nearest minute before being converted to decimal hours. Rounding is not applied per individual time entry, only to each project's total, to avoid small errors compounding across many entries.
- **Duplicate prevention**: a local file, `invoiced_entries.json`, lists every Toggl entry ID that has already been billed. It is checked before every preview and updated after every successful draft invoice creation. If you delete this file, previously billed time will show up again as billable.
- **Review step**: this tool only ever creates DRAFT invoices. There is no code path that sends or finalizes an invoice. You always do that manually in Wave.
- **Timezone**: date ranges are interpreted using a fixed Adelaide standard time offset (+09:30). It does not adjust for daylight saving, so entries within about an hour of midnight on a DST change date could land on the wrong side of a range.

## Known limitations

- Wave product matching is global across your whole business, not scoped per customer. If you ever have two unrelated products that happen to share a normalized name with two different Toggl projects, matching could pick the wrong one. Keep Wave product names matching Toggl project names 1:1.
- Renaming a Toggl client or project, or its Wave counterpart, breaks the match until the names agree again. The "Needs setup" panel is how you find out.

## If something goes wrong

- If Wave's API returns an error when creating an invoice or a product, the raw error message is shown in the browser rather than a generic failure message. Nothing is written to the local ledger in that case.
- If a draft invoice is successfully created in Wave but writing to `invoiced_entries.json` fails afterwards, the server logs this loudly to the console and the browser shows a warning telling you to update the ledger by hand. This is the one case where you need to intervene manually, otherwise the same time could be billed twice next time.
- Wave's GraphQL schema is not versioned and can change. If invoice or product creation in `lib/wave.js` starts failing after a Wave update, run an introspection query against `InvoiceCreateInput` or `ProductCreateInput` (there is a helper, `introspectInputType`, exported from `lib/wave.js`) to check the current field names before changing the mutation.

## Project layout

```
server.js                    Express app and route handlers
lib/toggl.js                 Toggl Track API v9 client
lib/wave.js                  Wave GraphQL client
lib/matching.js               Name normalization and matching, shared by client/customer and project/product matching
lib/rates.js                    Reads and writes rates.json
lib/ledger.js                     Reads and appends invoiced_entries.json
public/index.html                   The entire frontend, plain HTML and vanilla JS, no build step
.env.example                          Required environment variables, no real values
```
