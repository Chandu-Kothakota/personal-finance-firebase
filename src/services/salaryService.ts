import type { SalaryProfile } from "../types";

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
