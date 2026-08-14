import type { CurrencyCode, FxRates } from "../types";

const CACHE_KEY = "finance-fx-rates-v2";
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

type CacheEnvelope = {
  savedAt: number;
  data: FxRates;
};

export async function getFxRates(base: CurrencyCode): Promise<FxRates> {
  const cached = readCache(base);
  if (cached) return cached;

  const url = `https://api.frankfurter.dev/v2/rates?base=${encodeURIComponent(base)}`;

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Exchange-rate service returned ${response.status}.`);
    }

    const rows = (await response.json()) as Array<{
      date: string;
      base: string;
      quote: string;
      rate: number;
    }>;

    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error("Exchange-rate service returned no rates.");
    }

    const rates: Record<string, number> = { [base]: 1 };
    for (const row of rows) {
      if (row.quote && Number.isFinite(row.rate)) {
        rates[row.quote] = row.rate;
      }
    }

    const data: FxRates = {
      base,
      date: rows[0].date,
      rates,
    };

    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ savedAt: Date.now(), data } satisfies CacheEnvelope),
    );

    return data;
  } catch (error) {
    const stale = readCache(base, true);
    if (stale) return stale;
    throw error;
  }
}

function readCache(base: CurrencyCode, allowStale = false): FxRates | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CacheEnvelope;
    if (parsed.data.base !== base) return null;

    const fresh = Date.now() - parsed.savedAt < CACHE_TTL_MS;
    return fresh || allowStale ? parsed.data : null;
  } catch {
    return null;
  }
}
