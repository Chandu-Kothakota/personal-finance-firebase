import type { CurrencyCode, FxRates } from "../types";

export const CURRENCIES = ["USD", "INR", "CAD", "EUR", "GBP"] as const satisfies readonly CurrencyCode[];

export function formatMoney(amount: number, currency: CurrencyCode): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  })
    .format(amount)
    .replace(/^-/, "\u2212"); // typographic minus sign
}

export function convertToBase(
  amount: number,
  currency: CurrencyCode,
  fx: FxRates,
): number {
  if (currency === fx.base) return amount;
  const rate = fx.rates[currency];
  if (!rate || rate <= 0) return amount;
  return amount / rate;
}

/** Formats a yyyy-MM-dd date as e.g. "Oct 1, 2026" (no timezone shift). */
export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
