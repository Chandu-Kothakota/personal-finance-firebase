import { format } from "date-fns";
import { api } from "../lib/api";
import type { Debt, LedgerEntry, SalaryProfile, UserSettings } from "../types";

export type FinanceSnapshot = {
  settings: UserSettings;
  entries: LedgerEntry[];
  debts: Debt[];
  salaryProfiles: SalaryProfile[];
};

/** Loads everything in one request; the server also creates any missing salary credits. */
export function loadFinanceData(): Promise<FinanceSnapshot> {
  return api("GET", `data?today=${format(new Date(), "yyyy-MM-dd")}`);
}

export async function saveSettings(settings: UserSettings): Promise<void> {
  await api("PUT", "settings", settings);
}

export async function saveEntry(entry: Omit<LedgerEntry, "id">, id?: string): Promise<void> {
  await api(id ? "PUT" : "POST", id ? `entries/${id}` : "entries", entry);
}

export async function deleteEntry(id: string): Promise<void> {
  await api("DELETE", `entries/${id}`);
}

export async function saveDebt(debt: Omit<Debt, "id">, id?: string): Promise<void> {
  await api(id ? "PUT" : "POST", id ? `debts/${id}` : "debts", debt);
}

export async function deleteDebt(id: string): Promise<void> {
  await api("DELETE", `debts/${id}`);
}

export async function makeDebtPayment(
  debtId: string,
  payment: { amount: number; date: string },
): Promise<void> {
  await api("POST", `debts/${debtId}/payment`, payment);
}

export async function saveSalaryProfile(
  profile: Omit<SalaryProfile, "id">,
  id?: string,
): Promise<void> {
  await api(id ? "PUT" : "POST", id ? `salary-profiles/${id}` : "salary-profiles", profile);
}

export async function deleteSalaryProfile(id: string): Promise<void> {
  await api("DELETE", `salary-profiles/${id}`);
}
