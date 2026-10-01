import { sql } from "./db";

/**
 * Statement that creates any missing salary credits up to `today` (yyyy-MM-dd, the client's
 * local date). Runs entirely in Postgres so it can ride along in the same round trip as the
 * reads. Idempotent: ids/occurrence keys are deterministic and conflicts are skipped.
 * Pay days beyond a month's end use that month's last day; at most two distinct days apply.
 */
export function materializeSalaryCreditsStatement(uid: string, today: string) {
  return sql`
    INSERT INTO entries (id, uid, type, ledger_group, category, description, amount, currency,
                         date, source, salary_profile_id, salary_occurrence_key)
    SELECT 'salary_' || p.id || '_' || to_char(pay.d, 'YYYYMMDD') || pd.sfx,
           p.uid, 'credit', p.ledger_group, 'Salary', p.name, p.amount, p.currency,
           pay.d, 'salary', p.id,
           p.id || ':' || to_char(pay.d, 'YYYY-MM-DD') || replace(pd.sfx, '_', ':')
    FROM salary_profiles p
    CROSS JOIN LATERAL (
      SELECT CASE WHEN cardinality(p.pay_days) > 0 THEN p.pay_days ELSE ARRAY[p.pay_day] END AS a
    ) arr
    CROSS JOIN LATERAL (
      SELECT x.day, CASE WHEN x.idx = 1 THEN '' ELSE '_' || x.idx END AS sfx
      FROM unnest(arr.a) WITH ORDINALITY AS x(day, idx)
      WHERE x.day BETWEEN 1 AND 31 AND x.idx <= 2 AND (x.idx = 1 OR x.day <> arr.a[1])
    ) pd
    CROSS JOIN LATERAL generate_series(
      date_trunc('month', p.effective_date::timestamp),
      date_trunc('month', ${today}::date::timestamp),
      interval '1 month'
    ) AS m(ms)
    CROSS JOIN LATERAL (
      SELECT m.ms::date
             + (least(pd.day, extract(day FROM m.ms + interval '1 month' - interval '1 day')::int) - 1) AS d
    ) pay
    WHERE p.uid = ${uid} AND p.active
      AND pay.d >= p.effective_date AND pay.d <= ${today}::date
    ON CONFLICT DO NOTHING`;
}
