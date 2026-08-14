import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../config/firebase";
import type { Debt, LedgerEntry, SalaryProfile, UserSettings } from "../types";

function userCollection(uid: string, name: string) {
  return collection(db, "users", uid, name);
}

export async function ensureUserDocument(uid: string, email?: string | null) {
  await setDoc(
    doc(db, "users", uid),
    {
      email: email ?? null,
      lastLoginAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function listEntries(uid: string): Promise<LedgerEntry[]> {
  const snapshot = await getDocs(
    query(userCollection(uid, "entries"), orderBy("date", "desc")),
  );
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as LedgerEntry);
}

export async function saveEntry(
  uid: string,
  entry: Omit<LedgerEntry, "id">,
  id?: string,
): Promise<void> {
  if (id) {
    await updateDoc(doc(db, "users", uid, "entries", id), {
      ...entry,
      updatedAt: serverTimestamp(),
    });
    return;
  }

  await addDoc(userCollection(uid, "entries"), {
    ...entry,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteEntry(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(db, "users", uid, "entries", id));
}

export async function listDebts(uid: string): Promise<Debt[]> {
  const snapshot = await getDocs(userCollection(uid, "debts"));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Debt);
}

export async function saveDebt(
  uid: string,
  debt: Omit<Debt, "id">,
  id?: string,
): Promise<void> {
  const ref = id
    ? doc(db, "users", uid, "debts", id)
    : doc(userCollection(uid, "debts"));

  await setDoc(
    ref,
    {
      ...debt,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function deleteDebt(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(db, "users", uid, "debts", id));
}

export async function listSalaryProfiles(uid: string): Promise<SalaryProfile[]> {
  const snapshot = await getDocs(userCollection(uid, "salaryProfiles"));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as SalaryProfile);
}

export async function saveSalaryProfile(
  uid: string,
  profile: Omit<SalaryProfile, "id">,
  id?: string,
): Promise<void> {
  const ref = id
    ? doc(db, "users", uid, "salaryProfiles", id)
    : doc(userCollection(uid, "salaryProfiles"));

  await setDoc(
    ref,
    {
      ...profile,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function getSettings(uid: string): Promise<UserSettings> {
  const snapshot = await getDocs(userCollection(uid, "settings"));
  const settings = snapshot.docs.find((item) => item.id === "preferences");
  return (
    (settings?.data() as UserSettings | undefined) ?? {
      baseCurrency: (import.meta.env.VITE_BASE_CURRENCY ?? "USD") as UserSettings["baseCurrency"],
    }
  );
}

export async function saveSettings(uid: string, settings: UserSettings): Promise<void> {
  await setDoc(
    doc(db, "users", uid, "settings", "preferences"),
    settings,
    { merge: true },
  );
}
