# My Finance — Firebase Personal Finance Dashboard

A frontend-first, single-user personal finance web app.

## Architecture

- React + TypeScript + Vite
- Material UI
- Recharts
- Firebase Authentication (email/password)
- Cloud Firestore
- Firebase Hosting
- GitHub Actions
- Frankfurter daily FX reference-rate API
- No custom API/server/Cloud Functions

## Features

- Private login
- No public registration screen
- Primary and secondary income/debt grouping
- Recurring salary profile with effective date and up to two monthly pay days
- Automatic missing salary-credit creation when the signed-in app starts/refreshes
- Manual credit/debit transactions
- Debt tracking for credit cards, loans and miscellaneous balances
- Atomic debt payments that reduce a balance and create a linked ledger debit
- Multiple currencies including USD/INR/CAD
- Dashboard totals converted into a selectable base currency
- Category expense chart
- Primary vs secondary chart
- Edit/delete support
- Firestore per-user security rules
- Browser offline Firestore cache
- FX cache with stale-data fallback
- Error boundary and user-facing exception handling

## Salary auto-credit behavior

This app deliberately uses no Cloud Functions or scheduled backend.

When data loads:

1. Read active salary profiles.
2. Calculate every expected occurrence for one or two configured pay days from
   `effectiveDate` through today. A day beyond the end of a month uses that month's
   last valid day.
3. Build a unique occurrence key.
4. Skip occurrences already present.
5. Atomically create each missing salary credit.

Therefore, if the app is not opened on the 15th, the salary appears automatically next time you sign in.
Future pay dates are never materialized early.

## Firebase setup

### 1. Create a Firebase project

Use the Spark/no-cost plan.

### 2. Add a Web App

Copy the Firebase web configuration values.

### 3. Enable Authentication

Authentication -> Sign-in method -> Email/Password -> Enable.

Do not add a public registration page. Instead create your single user manually in:
Authentication -> Users -> Add user.

### 4. Create Firestore

Create a Cloud Firestore database in Native mode.

Deploy the included rules:

```bash
npm install -g firebase-tools
firebase login
firebase use YOUR_PROJECT_ID
firebase deploy --only firestore:rules
```

### 5. Local environment

Copy:

```bash
cp .env.example .env.local
```

Populate every `VITE_FIREBASE_*` value.

### 6. Install and run

```bash
npm install
npm run dev
```

### 7. Production build

```bash
npm run build
```

## Firebase Hosting setup

```bash
firebase login
firebase use YOUR_PROJECT_ID
firebase deploy --only hosting
```

`firebase.json` already rewrites all routes to `index.html`.

## GitHub deployment

The workflow is:

`.github/workflows/firebase-hosting.yml`

Add these GitHub repository secrets:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `FIREBASE_SERVICE_ACCOUNT`

Optional repository variable:

- `VITE_BASE_CURRENCY=USD`

The easiest way to generate the official Firebase Hosting GitHub integration and service-account secret is also:

```bash
firebase init hosting:github
```

You can compare the generated workflow with the included one and keep only one.

## Firestore shape

```text
users/{uid}
  entries/{entryId}
  debts/{debtId}
  salaryProfiles/{profileId}
  settings/preferences
```

All subcollections are restricted to the authenticated user's own UID.

Salary profiles use `payDays` for the current one-or-two-day schedule and retain
`payDay` as a compatibility field. Existing documents that contain only `payDay`
continue to materialize normally without a migration.

Debt-payment entries use `source: "debt_payment"` and store the linked `debtId`.
The debt balance update and entry creation are committed in one Firestore transaction.

## Notes about exchange rates

FX rates are fetched directly from the public Frankfurter API from the browser and cached locally for 12 hours.

They are reference rates, not intraday trading quotes. If the API is temporarily unavailable, the app uses the last locally cached rate when possible.

## Suggested first data

1. Settings -> choose base currency.
2. Earnings -> create `Primary Salary`.
3. Set amount, currency, effective date, and pay day `15`.
4. Debts -> add each INR/CAD/USD credit-card balance.
5. Transactions -> add expenses and secondary earnings.
6. Summary -> review total and category charts.

## Security notes

Firebase web configuration is not treated as a secret. Data protection is enforced by Authentication plus Firestore Security Rules.

The UI contains no signup route. For a one-person app, create exactly one Authentication user in Firebase Console.

Never change the Firestore rules to `allow read, write: if true`.

## v1.0.1 fixes

- Added `@emotion/react` and `@emotion/styled` required by Material UI.
- Added `vite.config.ts`.
- Added TypeScript project configuration files.
- Enabled the modern React JSX runtime.
- Kept `.env.example` as a safe template; use `.env.local` for your real Firebase values.

## v1.0.2 fixes

- Corrected React Hook Form + Zod 4 input/output generics for Transactions, Debts, and Earnings forms.
- Resolves the production TypeScript `handleSubmit` / resolver incompatibility errors.
- Keeps numeric coercion and runtime validation intact.

## Enterprise UI refresh — v2.1.0

This version preserves the existing Firebase Authentication, Firestore, salary materialization,
multi-currency conversion, debt tracking, and transaction behavior while replacing the original
starter-style interface with a production-oriented application experience.

### UI/UX upgrades

- Dark enterprise navigation rail with responsive mobile drawer
- Professional sticky account header and secured-workspace treatment
- Redesigned login experience with a private-finance product presentation
- Executive-style financial overview hero with net financial position
- KPI cards for credits, debt portfolio, recorded expenses, and net position
- Financial coverage indicator
- Primary-vs-secondary portfolio chart
- Refined category-spend visualization
- Recent-activity panel
- Portfolio snapshot cards
- Centralized MUI enterprise theme for typography, controls, cards, dialogs, and spacing
- Responsive desktop/tablet/mobile behavior
- Existing functional pages automatically inherit the new theme and application shell

### Merge notes

Keep your existing `.env.local` locally. It is intentionally not included in this package.
The Firebase configuration, Firestore rules, and GitHub workflows from the supplied project are retained.
