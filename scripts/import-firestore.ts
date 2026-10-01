/**
 * One-off migration: copies every user's data from Firestore into Neon Postgres.
 * Idempotent — safe to re-run; existing rows are updated in place.
 *
 *   DATABASE_URL=postgres://... \
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
 *   npm run import:firestore            # add -- --dry-run to preview counts only
 */
import { neon } from "@neondatabase/serverless";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore, type DocumentData, Timestamp } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";

const dryRun = process.argv.includes("--dry-run");
const databaseUrl = process.env.DATABASE_URL;
const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!databaseUrl || !keyPath) {
  throw new Error("Set DATABASE_URL and GOOGLE_APPLICATION_CREDENTIALS first.");
}

initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, "utf8"))) });
const firestore = getFirestore();
const sql = neon(databaseUrl);

const ts = (v: unknown): string | null =>
  v instanceof Timestamp ? v.toDate().toISOString() : null;
const text = (v: unknown, fallback: string | null = null) =>
  typeof v === "string" && v !== "" ? v : fallback;
const money = (v: unknown) => {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`Bad amount: ${String(v)}`);
  return n;
};

async function main() {
  console.log(dryRun ? "DRY RUN — nothing will be written.\n" : "Importing…\n");
  await sql.transaction([sql`SELECT 1`]); // fail fast on a bad DATABASE_URL

  const totals = { users: 0, entries: 0, debts: 0, salaryProfiles: 0, settings: 0 };
  const userRefs = await firestore.collection("users").listDocuments();

  for (const userRef of userRefs) {
    const uid = userRef.id;
    const [userDoc, entries, debts, profiles, prefs] = await Promise.all([
      userRef.get(),
      userRef.collection("entries").get(),
      userRef.collection("debts").get(),
      userRef.collection("salaryProfiles").get(),
      userRef.collection("settings").doc("preferences").get(),
    ]);

    const stmts = [
      sql`INSERT INTO users (uid, email, last_login_at)
          VALUES (${uid}, ${text(userDoc.data()?.email)}, ${ts(userDoc.data()?.lastLoginAt) ?? new Date().toISOString()})
          ON CONFLICT (uid) DO UPDATE SET email = EXCLUDED.email`,
    ];

    if (prefs.exists) {
      const p = prefs.data() as DocumentData;
      stmts.push(sql`
        INSERT INTO settings (uid, base_currency, display_name)
        VALUES (${uid}, ${text(p.baseCurrency, "USD")}, ${text(p.displayName)})
        ON CONFLICT (uid) DO UPDATE SET base_currency = EXCLUDED.base_currency,
          display_name = EXCLUDED.display_name`);
    }

    for (const d of entries.docs) {
      const e = d.data();
      stmts.push(sql`
        INSERT INTO entries (id, uid, type, ledger_group, category, description, amount, currency,
          date, source, debt_id, salary_profile_id, salary_occurrence_key, created_at, updated_at)
        VALUES (${d.id}, ${uid}, ${e.type}, ${text(e.group, "primary")}, ${text(e.category, "Other")},
          ${text(e.description, "")}, ${money(e.amount)}, ${e.currency}, ${e.date}, ${text(e.source)},
          ${text(e.debtId)}, ${text(e.salaryProfileId)}, ${text(e.salaryOccurrenceKey)},
          ${ts(e.createdAt) ?? new Date().toISOString()}, ${ts(e.updatedAt) ?? new Date().toISOString()})
        ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, ledger_group = EXCLUDED.ledger_group,
          category = EXCLUDED.category, description = EXCLUDED.description, amount = EXCLUDED.amount,
          currency = EXCLUDED.currency, date = EXCLUDED.date, source = EXCLUDED.source,
          debt_id = EXCLUDED.debt_id, salary_profile_id = EXCLUDED.salary_profile_id,
          salary_occurrence_key = EXCLUDED.salary_occurrence_key, updated_at = EXCLUDED.updated_at`);
    }

    for (const d of debts.docs) {
      const x = d.data();
      stmts.push(sql`
        INSERT INTO debts (id, uid, ledger_group, name, category, kind, balance, currency, notes, updated_at)
        VALUES (${d.id}, ${uid}, ${text(x.group, "primary")}, ${x.name}, ${text(x.category, "")},
          ${text(x.kind, "misc")}, ${money(x.balance)}, ${x.currency}, ${text(x.notes)},
          ${ts(x.updatedAt) ?? new Date().toISOString()})
        ON CONFLICT (id) DO UPDATE SET ledger_group = EXCLUDED.ledger_group, name = EXCLUDED.name,
          category = EXCLUDED.category, kind = EXCLUDED.kind, balance = EXCLUDED.balance,
          currency = EXCLUDED.currency, notes = EXCLUDED.notes, updated_at = EXCLUDED.updated_at`);
    }

    for (const d of profiles.docs) {
      const x = d.data();
      const days: number[] | null = Array.isArray(x.payDays) ? x.payDays : null;
      stmts.push(sql`
        INSERT INTO salary_profiles (id, uid, name, ledger_group, amount, currency, effective_date,
          pay_days, pay_day, active, updated_at)
        VALUES (${d.id}, ${uid}, ${x.name}, ${text(x.group, "primary")}, ${money(x.amount)}, ${x.currency},
          ${x.effectiveDate}, ${days}, ${Number.isInteger(x.payDay) ? x.payDay : null}, ${x.active !== false},
          ${ts(x.updatedAt) ?? new Date().toISOString()})
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, ledger_group = EXCLUDED.ledger_group,
          amount = EXCLUDED.amount, currency = EXCLUDED.currency, effective_date = EXCLUDED.effective_date,
          pay_days = EXCLUDED.pay_days, pay_day = EXCLUDED.pay_day, active = EXCLUDED.active,
          updated_at = EXCLUDED.updated_at`);
    }

    if (!dryRun) await sql.transaction(stmts); // per user: all or nothing

    totals.users += 1;
    totals.entries += entries.size;
    totals.debts += debts.size;
    totals.salaryProfiles += profiles.size;
    totals.settings += prefs.exists ? 1 : 0;
    console.log(
      `  ${uid}: ${entries.size} entries, ${debts.size} debts, ${profiles.size} salary profiles`,
    );
  }

  console.log("\nFirestore totals:", totals);

  if (!dryRun) {
    const [c] = await sql`
      SELECT (SELECT count(*) FROM users)::int AS users,
             (SELECT count(*) FROM entries)::int AS entries,
             (SELECT count(*) FROM debts)::int AS debts,
             (SELECT count(*) FROM salary_profiles)::int AS salary_profiles,
             (SELECT count(*) FROM settings)::int AS settings`;
    console.log("Neon row counts: ", c);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
