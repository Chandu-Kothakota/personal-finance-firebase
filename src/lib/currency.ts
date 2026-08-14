import type { CurrencyCode, FxRates } from "../types";

export const CURRENCIES = ["USD", "INR", "CAD", "EUR", "GBP"] as const satisfies readonly CurrencyCode[];

export function formatMoney(amount: number, currency: CurrencyCode): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
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
