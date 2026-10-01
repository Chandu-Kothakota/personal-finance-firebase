import type { VercelRequest, VercelResponse } from "@vercel/node";
import { randomUUID } from "node:crypto";
import { authenticate, HttpError } from "./_lib/auth.js";
import { sql } from "./_lib/db.js";
import { materializeSalaryCreditsStatement } from "./_lib/salary.js";
import { asBody, currency, group, isoDate, num, oneOf, payDays, str } from "./_lib/validate.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : (v ?? undefined));

const toEntry = (r: Row) => ({
  id: r.id,
  type: r.type,
  group: r.ledger_group,
  category: r.category,
  description: r.description,
  amount: Number(r.amount),
  currency: r.currency,
  date: r.date,
  source: r.source ?? undefined,
  debtId: r.debt_id ?? undefined,
  salaryProfileId: r.salary_profile_id ?? undefined,
  salaryOccurrenceKey: r.salary_occurrence_key ?? undefined,
  createdAt: iso(r.created_at),
  updatedAt: iso(r.updated_at),
});

const toDebt = (r: Row) => ({
  id: r.id,
  group: r.ledger_group,
  name: r.name,
  category: r.category,
  kind: r.kind,
  balance: Number(r.balance),
  currency: r.currency,
  notes: r.notes ?? undefined,
  updatedAt: iso(r.updated_at),
});

const toProfile = (r: Row) => ({
  id: r.id,
  name: r.name,
  group: r.ledger_group,
  amount: Number(r.amount),
  currency: r.currency,
  effectiveDate: r.effective_date,
  payDays: r.pay_days ?? undefined,
  payDay: r.pay_day ?? undefined,
  active: r.active,
  updatedAt: iso(r.updated_at),
});

async function route(req: VercelRequest, uid: string, email: string | null) {
  const method = req.method ?? "GET";
  // vercel.json rewrites /api/<route> to /api?route=<route> (Vercel's file routing can't
  // match nested paths like debts/<id>/payment for a non-Next app).
  const route = typeof req.query.route === "string"
    ? req.query.route
    : new URL(req.url ?? "", "http://x").pathname.replace(/^\/api\/?/, "");
  const segments = route.split("/").filter(Boolean);
  const [resource, id, action] = segments;

  // GET /api/data — everything the app needs, in one round trip.
  if (resource === "data" && method === "GET") {
    const today = isoDate(req.query.today, "today");
    const defaultBase = process.env.VITE_BASE_CURRENCY ?? "USD";

    // One round trip, one transaction: touch the user row (only when stale), create missing
    // salary credits, then read everything.
    const [, , users, entries, debts, profiles] = await sql.transaction([
      sql`INSERT INTO users (uid, email, base_currency) VALUES (${uid}, ${email}, ${defaultBase})
          ON CONFLICT (uid) DO UPDATE SET email = EXCLUDED.email, last_login_at = now()
          WHERE users.last_login_at < now() - interval '1 hour'
             OR users.email IS DISTINCT FROM EXCLUDED.email`,
      materializeSalaryCreditsStatement(uid, today),
      sql`SELECT base_currency, display_name FROM users WHERE uid = ${uid}`,
      sql`SELECT id, type, ledger_group, category, description, amount, currency,
                 to_char(date, 'YYYY-MM-DD') AS date, source, debt_id, salary_profile_id,
                 salary_occurrence_key, created_at, updated_at
          FROM entries WHERE uid = ${uid} ORDER BY date DESC, created_at DESC`,
      sql`SELECT * FROM debts WHERE uid = ${uid}`,
      sql`SELECT id, name, ledger_group, amount, currency,
                 to_char(effective_date, 'YYYY-MM-DD') AS effective_date,
                 pay_days, pay_day, active, updated_at
          FROM salary_profiles WHERE uid = ${uid}`,
    ]);

    return {
      settings: {
        baseCurrency: users[0].base_currency,
        displayName: users[0].display_name ?? undefined,
      },
      entries: entries.map(toEntry),
      debts: debts.map(toDebt),
      salaryProfiles: profiles.map(toProfile),
    };
  }

  if (resource === "settings" && method === "PUT") {
    const body = asBody(req.body);
    const base = oneOf(body, "baseCurrency", ["USD", "INR", "CAD", "EUR", "GBP"]);
    const displayName = str(body, "displayName", { optional: true, max: 100 });
    await sql`
      INSERT INTO users (uid, email, base_currency, display_name)
      VALUES (${uid}, ${email}, ${base}, ${displayName})
      ON CONFLICT (uid) DO UPDATE SET base_currency = EXCLUDED.base_currency,
        display_name = EXCLUDED.display_name`;
    return { ok: true };
  }

  if (resource === "entries") {
    if (method === "DELETE" && id) {
      await sql`DELETE FROM entries WHERE id = ${id} AND uid = ${uid}`;
      return { ok: true };
    }
    if (method === "POST" || (method === "PUT" && id)) {
      const b = asBody(req.body);
      const v = {
        type: oneOf(b, "type", ["credit", "debit"]),
        group: group(b),
        category: str(b, "category", { max: 100 }),
        description: str(b, "description", { optional: true, max: 500 }) ?? "",
        amount: num(b, "amount"),
        currency: currency(b),
        date: isoDate(b.date, "date"),
        source: str(b, "source", { optional: true, max: 30 }),
      };
      if (method === "POST") {
        await sql`
          INSERT INTO entries (id, uid, type, ledger_group, category, description, amount, currency, date, source)
          VALUES (${randomUUID()}, ${uid}, ${v.type}, ${v.group}, ${v.category}, ${v.description},
                  ${v.amount}, ${v.currency}, ${v.date}, ${v.source})`;
      } else {
        await sql`
          UPDATE entries SET type = ${v.type}, ledger_group = ${v.group}, category = ${v.category},
            description = ${v.description}, amount = ${v.amount}, currency = ${v.currency},
            date = ${v.date}, source = ${v.source}, updated_at = now()
          WHERE id = ${id} AND uid = ${uid}`;
      }
      return { ok: true };
    }
  }

  if (resource === "debts") {
    if (method === "DELETE" && id) {
      await sql`DELETE FROM debts WHERE id = ${id} AND uid = ${uid}`;
      return { ok: true };
    }

    if (method === "POST" && id && action === "payment") {
      const b = asBody(req.body);
      const amount = num(b, "amount");
      const date = isoDate(b.date, "date");
      const cents = Math.round(amount * 100);
      if (amount <= 0) throw new HttpError(400, "Payment amount must be greater than zero.");
      if (Math.abs(amount * 100 - cents) > 1e-7) {
        throw new HttpError(400, "Payment amount cannot have more than two decimal places.");
      }
      const paid = cents / 100;

      // One atomic statement: reduce the balance and create the linked ledger debit.
      const result = await sql`
        WITH updated AS (
          UPDATE debts SET balance = balance - ${paid}, updated_at = now()
          WHERE id = ${id} AND uid = ${uid} AND balance > 0 AND balance >= ${paid}
          RETURNING id, name, ledger_group, currency
        ), inserted AS (
          INSERT INTO entries (id, uid, type, ledger_group, category, description, amount,
                               currency, date, source, debt_id)
          SELECT ${randomUUID()}::text, ${uid}::text, 'debit', ledger_group, 'Debt Payment',
                 'Payment to ' || name, ${paid}::numeric, currency, ${date}::date, 'debt_payment', id
          FROM updated RETURNING id
        )
        SELECT count(*)::int AS n FROM inserted`;

      if (result[0].n === 0) {
        const debt = (await sql`SELECT balance FROM debts WHERE id = ${id} AND uid = ${uid}`)[0];
        if (!debt) throw new HttpError(404, "This debt no longer exists.");
        if (Number(debt.balance) <= 0) {
          throw new HttpError(400, "A payment cannot be made against a zero-balance debt.");
        }
        throw new HttpError(400, "Payment amount cannot exceed the current debt balance.");
      }
      return { ok: true };
    }

    if (method === "POST" || (method === "PUT" && id)) {
      const b = asBody(req.body);
      const v = {
        group: group(b),
        name: str(b, "name", { max: 200 }),
        category: str(b, "category", { optional: true, max: 100 }) ?? "",
        kind: oneOf(b, "kind", ["credit_card", "loan", "misc"]),
        balance: num(b, "balance"),
        currency: currency(b),
        notes: str(b, "notes", { optional: true, max: 2000 }),
      };
      if (method === "POST") {
        await sql`
          INSERT INTO debts (id, uid, ledger_group, name, category, kind, balance, currency, notes)
          VALUES (${randomUUID()}, ${uid}, ${v.group}, ${v.name}, ${v.category}, ${v.kind},
                  ${v.balance}, ${v.currency}, ${v.notes})`;
      } else {
        await sql`
          UPDATE debts SET ledger_group = ${v.group}, name = ${v.name}, category = ${v.category},
            kind = ${v.kind}, balance = ${v.balance}, currency = ${v.currency},
            notes = ${v.notes}, updated_at = now()
          WHERE id = ${id} AND uid = ${uid}`;
      }
      return { ok: true };
    }
  }

  if (resource === "salary-profiles" && method === "DELETE" && id) {
    // Salary credits already recorded stay in the ledger.
    await sql`DELETE FROM salary_profiles WHERE id = ${id} AND uid = ${uid}`;
    return { ok: true };
  }

  if (resource === "salary-profiles" && (method === "POST" || (method === "PUT" && id))) {
    const b = asBody(req.body);
    const days = payDays(b);
    const v = {
      name: str(b, "name", { max: 200 }),
      group: group(b),
      amount: num(b, "amount"),
      currency: currency(b),
      effectiveDate: isoDate(b.effectiveDate, "effectiveDate"),
      payDay: Number.isInteger(b.payDay) ? (b.payDay as number) : (days?.[0] ?? null),
      active: b.active !== false,
    };
    if (method === "POST") {
      await sql`
        INSERT INTO salary_profiles (id, uid, name, ledger_group, amount, currency, effective_date,
                                     pay_days, pay_day, active)
        VALUES (${randomUUID()}, ${uid}, ${v.name}, ${v.group}, ${v.amount}, ${v.currency},
                ${v.effectiveDate}, ${days}, ${v.payDay}, ${v.active})`;
    } else {
      await sql`
        UPDATE salary_profiles SET name = ${v.name}, ledger_group = ${v.group}, amount = ${v.amount},
          currency = ${v.currency}, effective_date = ${v.effectiveDate}, pay_days = ${days},
          pay_day = ${v.payDay}, active = ${v.active}, updated_at = now()
        WHERE id = ${id} AND uid = ${uid}`;
    }
    return { ok: true };
  }

  throw new HttpError(404, "Not found.");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const { uid, email } = await authenticate(req.headers.authorization);
    res.status(200).json(await route(req, uid, email));
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Something went wrong on the server." });
  }
}
