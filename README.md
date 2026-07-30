# Invoicing

Self hosted invoicing app, replacing the invoicing side of Wave. Single user
(owner only). Track time against client projects, generate invoices from
unbilled time, mark them paid by hand. No payment processor.

## Stack

- Laravel 11, PHP 8.2+, MySQL
- Laravel Breeze for session based auth
- Blade + Tailwind, Alpine.js for the timer and dynamic line items
- Dompdf for PDF export (pure PHP, so it works on shared or cPanel hosting)

Because Dompdf will be doing the rendering, invoice templates use simple table
based CSS. No flexbox, no grid.

## Local setup

Requires PHP 8.2+, Composer, Node and a MySQL or MariaDB server.

```bash
composer install
npm install
cp .env.example .env
php artisan key:generate
```

Create the database:

```sql
CREATE DATABASE invoicing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'invoicing'@'localhost' IDENTIFIED BY 'your-password';
GRANT ALL PRIVILEGES ON invoicing.* TO 'invoicing'@'localhost';
```

Set `DB_DATABASE`, `DB_USERNAME` and `DB_PASSWORD` in `.env`, then set the owner
account that gets seeded:

```
OWNER_NAME="Your Name"
OWNER_EMAIL=you@example.com
OWNER_PASSWORD=pick-something
```

Then migrate, seed the owner and build the assets:

```bash
php artisan migrate
php artisan db:seed
npm run build      # or: npm run dev
php artisan serve
```

Log in at `/login` with the `OWNER_*` credentials.

### A note on registration

Public registration is switched off. Records are not scoped per user, so any
account that could register would see every client, time entry and invoice. The
owner is created by the seeder instead. `RegisteredUserController` is still
present, and the two commented routes at the top of `routes/auth.php` are all
that need re-enabling if more users are ever wanted.

## Tests

```bash
php artisan test
```

Tests run against sqlite in memory, configured in `phpunit.xml`, so they never
touch the development database.

## Build phases

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Foundation: auth, migrations, dashboard shell | Done |
| 2 | Clients and projects CRUD | To do |
| 3 | Time tracking, timer and manual entry | To do |
| 4 | Invoice creation from unbilled time | To do |
| 5 | Templates, branding, PDF export | To do |
| 6 | Status, payments, dashboard figures | To do |

## Out of scope for v1

Payment gateways, multi user roles, recurring invoices, multi currency, a client
facing portal, automatic emails or reminders, and a drag and drop template
builder. v1 ships a few preset invoice layouts only.
