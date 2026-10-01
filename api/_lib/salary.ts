import {
  addMonths,
  format,
  isAfter,
  isBefore,
  isEqual,
  parseISO,
  setDate,
  startOfMonth,
} from "date-fns";
import { sql } from "./db";

type ProfileRow = {
  id: string;
  name: string;
  ledger_group: string;
  amount: string;
  currency: string;
  effective_date: string;
  pay_days: number[] | null;
  pay_day: number | null;
};

function payDaysOf(profile: Pick<ProfileRow, "pay_days" | "pay_day">): number[] {
  const configured = profile.pay_days?.length
    ? profile.pay_days
    : profile.pay_day !== null
      ? [profile.pay_day]
      : [];

  return configured
    .filter(
      (day, index, days) =>
        Number.isInteger(day) && day >= 1 && day <= 31 && days.indexOf(day) === index,
    )
    .slice(0, 2);
}

/**
 * Creates any missing salary credits up to `today` (yyyy-MM-dd, the client's local date).
 * Idempotent: ids and occurrence keys are deterministic and inserts skip conflicts.
 */
export async function materializeSalaryCredits(uid: string, todayIso: string) {
  const profiles = (await sql`
    SELECT id, name, ledger_group, amount, currency,
           to_char(effective_date, 'YYYY-MM-DD') AS effective_date, pay_days, pay_day
    FROM salary_profiles WHERE uid = ${uid} AND active
  `) as ProfileRow[];

  const today = parseISO(todayIso);
  const inserts: ReturnType<typeof sql>[] = [];

  for (const profile of profiles) {
    const effective = parseISO(profile.effective_date);
    const payDays = payDaysOf(profile);
    let cursor = startOfMonth(effective);

    while (!isAfter(cursor, today)) {
      const maxDay = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();

      payDays.forEach((payDay, index) => {
        const payDate = setDate(cursor, Math.min(payDay, maxDay));
        const validStart = isAfter(payDate, effective) || isEqual(payDate, effective);
        const validEnd = isBefore(payDate, today) || isEqual(payDate, today);
        if (!validStart || !validEnd) return;

        const date = format(payDate, "yyyy-MM-dd");
        const key = `${profile.id}:${date}${index === 0 ? "" : `:${index + 1}`}`;
        const id = `salary_${profile.id}_${format(payDate, "yyyyMMdd")}${index === 0 ? "" : `_${index + 1}`}`;

        inserts.push(sql`
          INSERT INTO entries (id, uid, type, ledger_group, category, description, amount,
                               currency, date, source, salary_profile_id, salary_occurrence_key)
          VALUES (${id}, ${uid}, 'credit', ${profile.ledger_group}, 'Salary', ${profile.name},
                  ${profile.amount}, ${profile.currency}, ${date}, 'salary', ${profile.id}, ${key})
          ON CONFLICT DO NOTHING
        `);
      });
      cursor = addMonths(cursor, 1);
    }
  }

  if (inserts.length > 0) await sql.transaction(inserts);
}
