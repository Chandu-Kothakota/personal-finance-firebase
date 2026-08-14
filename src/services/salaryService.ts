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

function occurrenceDates(profile: SalaryProfile, today: Date): Date[] {
  const effective = parseISO(profile.effectiveDate);
  let cursor = startOfMonth(effective);
  const results: Date[] = [];

  while (!isAfter(cursor, today)) {
    const maxDay = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const payDate = setDate(cursor, Math.min(profile.payDay, maxDay));

    const validStart = isAfter(payDate, effective) || isEqual(payDate, effective);
    const validEnd = isBefore(payDate, today) || isEqual(payDate, today);

    if (validStart && validEnd) results.push(payDate);
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

    for (const payDate of dates) {
      const key = `${profile.id}:${format(payDate, "yyyy-MM-dd")}`;
      const existing = await getDocs(
        query(entriesRef, where("salaryOccurrenceKey", "==", key)),
      );

      if (!existing.empty) continue;

      const deterministicRef = doc(
        db,
        "users",
        uid,
        "entries",
        `salary_${profile.id}_${format(payDate, "yyyyMMdd")}`,
      );

      await runTransaction(db, async (tx) => {
        const current = await tx.get(deterministicRef);
        if (current.exists()) return;

        tx.set(deterministicRef, {
          type: "credit",
          group: profile.group,
          category: "Salary",
          description: profile.name,
          amount: profile.amount,
          currency: profile.currency,
          date: format(payDate, "yyyy-MM-dd"),
          source: "salary",
          salaryProfileId: profile.id,
          salaryOccurrenceKey: key,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        created += 1;
      });
    }
  }

  return created;
}
