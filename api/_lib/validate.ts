import { HttpError } from "./auth";

const CURRENCIES = ["USD", "INR", "CAD", "EUR", "GBP"];
const GROUPS = ["primary", "secondary"];

type Body = Record<string, unknown>;

export function asBody(value: unknown): Body {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "Request body must be a JSON object.");
  }
  return value as Body;
}

export function str(body: Body, key: string, opts: { optional?: boolean; max?: number } = {}) {
  const value = body[key];
  if (value === undefined || value === null || value === "") {
    if (opts.optional) return null;
    throw new HttpError(400, `"${key}" is required.`);
  }
  if (typeof value !== "string" || value.length > (opts.max ?? 500)) {
    throw new HttpError(400, `"${key}" is invalid.`);
  }
  return value;
}

export function oneOf(body: Body, key: string, allowed: string[]) {
  const value = body[key];
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new HttpError(400, `"${key}" is invalid.`);
  }
  return value;
}

export const currency = (body: Body) => oneOf(body, "currency", CURRENCIES);
export const group = (body: Body) => oneOf(body, "group", GROUPS);

export function num(body: Body, key: string) {
  const value = body[key];
  if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) >= 1e13) {
    throw new HttpError(400, `"${key}" must be a number.`);
  }
  return value;
}

export function isoDate(value: unknown, key: string): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(400, `"${key}" must be a date in yyyy-MM-dd format.`);
  }
  const [y, m, d] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(y, m - 1, d));
  if (parsed.getUTCFullYear() !== y || parsed.getUTCMonth() !== m - 1 || parsed.getUTCDate() !== d) {
    throw new HttpError(400, `"${key}" is not a valid date.`);
  }
  return value;
}

export function payDays(body: Body): number[] | null {
  const value = body.payDays;
  if (value === undefined || value === null) return null;
  if (
    !Array.isArray(value) ||
    value.length > 2 ||
    !value.every((d) => Number.isInteger(d) && d >= 1 && d <= 31)
  ) {
    throw new HttpError(400, `"payDays" is invalid.`);
  }
  return [...new Set(value as number[])];
}
