import type { SalaryProfile } from "../types";
import { getSalaryPayDays } from "../services/salaryService";

const pad = (n: number) => String(n).padStart(2, "0");

/** Local date as yyyy-MM-dd. */
export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export const todayIso = () => toIsoDate(new Date());

/** "2026-10" for a yyyy-MM-dd date. */
export const monthKey = (iso: string) => iso.slice(0, 7);

/** Month key `offset` months from the current month (0 = this month, -1 = last month). */
export function monthKeyFromNow(offset: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** "Oct" or "Oct 2026" for a month key. */
export function monthLabel(key: string, withYear = false): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", withYear ? { month: "short", year: "numeric" } : { month: "short" });
}

export type Period = "all" | "this-month" | "last-month" | "last-3-months" | "this-year";

export const PERIODS: { value: Period; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "last-3-months", label: "Last 3 months" },
  { value: "this-year", label: "This year" },
];

/** Whether a yyyy-MM-dd date falls inside the period (relative to today). */
export function inPeriod(iso: string, period: Period): boolean {
  const month = monthKey(iso);
  switch (period) {
    case "all":
      return true;
    case "this-month":
      return month === monthKeyFromNow(0);
    case "last-month":
      return month === monthKeyFromNow(-1);
    case "last-3-months":
      return month >= monthKeyFromNow(-2);
    case "this-year":
      return iso.slice(0, 4) === String(new Date().getFullYear());
  }
}

/** Next date (today or later) a salary profile pays out, or null if paused/unscheduled. */
export function nextPayDate(profile: SalaryProfile, from = new Date()): Date | null {
  if (!profile.active) return null;
  const days = getSalaryPayDays(profile);
  if (days.length === 0) return null;

  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const [ey, em, ed] = profile.effectiveDate.split("-").map(Number);
  const effective = new Date(ey, em - 1, ed);
  const start = effective > today ? effective : today;

  for (let i = 0; i < 24; i++) {
    const month = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const candidates = days
      .map((d) => new Date(month.getFullYear(), month.getMonth(), Math.min(d, lastDay)))
      .filter((d) => d >= start)
      .sort((a, b) => a.getTime() - b.getTime());
    if (candidates.length > 0) return candidates[0];
  }
  return null;
}

/** "Today", "Tomorrow", "in 5 days" for a future date. */
export function relativeDays(date: Date, from = new Date()): string {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const days = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `in ${days} days`;
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}
