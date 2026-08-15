export type LedgerGroup = "primary" | "secondary";
export type EntryType = "credit" | "debit";
export type DebtKind = "credit_card" | "loan" | "misc";
export type CurrencyCode = "USD" | "INR" | "CAD" | "EUR" | "GBP";

export interface LedgerEntry {
  id: string;
  type: EntryType;
  group: LedgerGroup;
  category: string;
  description: string;
  amount: number;
  currency: CurrencyCode;
  date: string;
  source?: "manual" | "salary" | "debt_payment";
  debtId?: string;
  salaryProfileId?: string;
  salaryOccurrenceKey?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Debt {
  id: string;
  group: LedgerGroup;
  name: string;
  category: string;
  kind: DebtKind;
  balance: number;
  currency: CurrencyCode;
  notes?: string;
  updatedAt?: unknown;
}

export interface SalaryProfile {
  id: string;
  name: string;
  group: LedgerGroup;
  amount: number;
  currency: CurrencyCode;
  effectiveDate: string;
  payDays?: number[];
  payDay?: number;
  active: boolean;
  updatedAt?: unknown;
}

export interface UserSettings {
  baseCurrency: CurrencyCode;
  displayName?: string;
}

export interface FxRates {
  base: CurrencyCode;
  date: string;
  rates: Record<string, number>;
}
