# My Finance — Personal Finance Dashboard

A single-user personal finance web app.

## Architecture

- React + TypeScript + Vite, Material UI, Recharts
- Firebase Authentication (email/password) for login only
- Neon Postgres for all data, accessed through one Vercel serverless function
  (`api/[...path].ts`) that verifies the Firebase ID token and scopes every query to that user
- Vercel for hosting (static frontend + `/api`)
- GitHub Actions CI; Vercel's GitHub integration deploys previews per PR and production from `main`
- Frankfurter daily FX reference-rate API (fetched from the browser, cached 12 hours)

```text
browser ──(Firebase ID token)──▶ /api/*  ──▶ Neon Postgres
   └── Firebase Auth (login)
```

## Features

- Private login, no public registration
- Primary and secondary income/debt grouping
- Recurring salary profiles with an effective date and up to two monthly pay days
- Manual credit/debit transactions
- Debt tracking (credit cards, loans, misc) with atomic payments that reduce the balance and
  create a linked ledger debit
- Multiple currencies (USD/INR/CAD/EUR/GBP) converted to a selectable base currency
- Overview with totals, category and primary-vs-secondary charts
- Per-user isolation enforced server-side

## Salary auto-credit behavior

There is no scheduled job. Whenever the app loads data, the API (in the same database
transaction as the reads) creates any missing salary credits:

1. For each active profile, compute every expected pay date from `effectiveDate` through today.
   A pay day beyond a month's end uses that month's last day. Future dates are never created.
2. Each credit has a deterministic id and occurrence key; inserts use `ON CONFLICT DO NOTHING`,
   so it is idempotent.

If the app isn't opened on the 15th, the salary appears the next time you sign in.

## Local development

```bash
cp .env.example .env.local     # fill in VITE_FIREBASE_* and DATABASE_URL
npm install
npm run db:migrate             # create tables in your Neon database (idempotent)
npx vercel dev                 # frontend + /api together
```

`npm run dev` runs the frontend only (no `/api`), so use `vercel dev` for anything that loads data.
`localhost` is an allowed Firebase Auth domain by default.

## Database

Schema: `db/schema.sql` (tables: `users`, `entries`, `debts`, `salary_profiles`).
`users` also holds the base currency and display name.

To copy data from an old Firestore project (one-off, idempotent):

```bash
export DATABASE_URL='postgres://…neon.tech/neondb?sslmode=require'
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
npm run import:firestore -- --dry-run
npm run import:firestore
```

Delete the service-account key afterwards.

## Deployment

- **Production:** every merge to `main` deploys automatically on Vercel.
- **Previews:** every PR gets a preview URL. Firebase Auth only allows listed domains, so add a
  preview URL under Authentication → Settings → Authorized domains before logging in there.
- **Vercel environment variables:** all `VITE_FIREBASE_*`, `VITE_BASE_CURRENCY`, and `DATABASE_URL`
  (secret; never give it a `VITE_` prefix).
- **CI** (`.github/workflows/ci.yml`): type-checks the app, API and scripts, builds the frontend,
  and applies the schema to a clean Postgres twice.

## Security notes

- Firebase web config is not a secret; data protection comes from server-side token verification
  and per-uid query filtering in the API.
- The UI has no signup route. Create your single user in Firebase Console → Authentication → Users.
- Keep `DATABASE_URL` and any service-account keys out of git.

## Exchange rates

Rates are reference rates, not intraday quotes. If the API is unavailable, the last cached rate
is used when possible.
