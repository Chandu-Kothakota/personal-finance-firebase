import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  where,
  serverTimestamp,
} from "firebase/firestore";
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
import { db } from "../config/firebase";
import type { SalaryProfile } from "../types";

type SalaryOccurrence = {
  date: Date;
  index: number;
};

export function getSalaryPayDays(
  profile: Pick<SalaryProfile, "payDay" | "payDays">,
): number[] {
  const configuredDays = profile.payDays?.length
    ? profile.payDays
    : profile.payDay !== undefined
      ? [profile.payDay]
      : [];

  return configuredDays
    .filter(
      (day, index, days) =>
        Number.isInteger(day) &&
        day >= 1 &&
        day <= 31 &&
        days.indexOf(day) === index,
    )
    .slice(0, 2);
}

function occurrenceDates(profile: SalaryProfile, today: Date): SalaryOccurrence[] {
  const effective = parseISO(profile.effectiveDate);
  const payDays = getSalaryPayDays(profile);
  let cursor = startOfMonth(effective);
  const results: SalaryOccurrence[] = [];

  while (!isAfter(cursor, today)) {
    const maxDay = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();

    payDays.forEach((payDay, index) => {
      const payDate = setDate(cursor, Math.min(payDay, maxDay));
      const validStart = isAfter(payDate, effective) || isEqual(payDate, effective);
      const validEnd = isBefore(payDate, today) || isEqual(payDate, today);

      if (validStart && validEnd) results.push({ date: payDate, index });
    });
    cursor = addMonths(cursor, 1);
  }

  return results;
}

export async function materializeSalaryCredits(
  uid: string,
  profiles: SalaryProfile[],
): Promise<number> {
  const activeProfiles = profiles.filter((p) => p.active);
  if (activeProfiles.length === 0) return 0;

  const entriesRef = collection(db, "users", uid, "entries");
  let created = 0;

  for (const profile of activeProfiles) {
    const dates = occurrenceDates(profile, new Date());

    for (const occurrence of dates) {
      const formattedDate = format(occurrence.date, "yyyy-MM-dd");
      const occurrenceSuffix = occurrence.index === 0 ? "" : `:${occurrence.index + 1}`;
      const documentSuffix = occurrence.index === 0 ? "" : `_${occurrence.index + 1}`;
      const key = `${profile.id}:${formattedDate}${occurrenceSuffix}`;
      const existing = await getDocs(
        query(entriesRef, where("salaryOccurrenceKey", "==", key)),
      );

      if (!existing.empty) continue;

      const deterministicRef = doc(
        db,
        "users",
        uid,
        "entries",
        `salary_${profile.id}_${format(occurrence.date, "yyyyMMdd")}${documentSuffix}`,
      );

      const wasCreated = await runTransaction(db, async (tx) => {
        const current = await tx.get(deterministicRef);
        if (current.exists()) return false;

        tx.set(deterministicRef, {
          type: "credit",
          group: profile.group,
          category: "Salary",
          description: profile.name,
          amount: profile.amount,
          currency: profile.currency,
          date: formattedDate,
          source: "salary",
          salaryProfileId: profile.id,
          salaryOccurrenceKey: key,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return true;
      });

      if (wasCreated) created += 1;
    }
  }

  return created;
}
