import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { convertToBase } from "../lib/currency";
import { toUserMessage } from "../lib/errors";
import {
  getSettings,
  listDebts,
  listEntries,
  listSalaryProfiles,
  saveSettings,
} from "../services/firestoreService";
import { getFxRates } from "../services/fxService";
import { materializeSalaryCredits } from "../services/salaryService";
import type {
  Debt,
  FxRates,
  LedgerEntry,
  SalaryProfile,
  UserSettings,
} from "../types";

export function useFinanceData() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [salaryProfiles, setSalaryProfiles] = useState<SalaryProfile[]>([]);
  const [settings, setSettings] = useState<UserSettings>({ baseCurrency: "USD" });
  const [fx, setFx] = useState<FxRates | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError("");

    try {
      const prefs = await getSettings(user.uid);
      setSettings(prefs);

      const [profiles, debtRows] = await Promise.all([
        listSalaryProfiles(user.uid),
        listDebts(user.uid),
      ]);

      setSalaryProfiles(profiles);
      setDebts(debtRows);

      await materializeSalaryCredits(user.uid, profiles);

      const [entryRows, rates] = await Promise.all([
        listEntries(user.uid),
        getFxRates(prefs.baseCurrency),
      ]);

      setEntries(entryRows);
      setFx(rates);
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const summary = useMemo(() => {
    if (!fx) {
      return {
        credits: 0,
        expenseDebits: 0,
        debtBalances: 0,
        outstanding: 0,
        primaryCredits: 0,
        primaryDebts: 0,
        secondaryCredits: 0,
        secondaryDebts: 0,
      };
    }

    const cvt = (amount: number, currency: LedgerEntry["currency"]) =>
      convertToBase(amount, currency, fx);

    const credits = entries
      .filter((x) => x.type === "credit")
      .reduce((sum, x) => sum + cvt(x.amount, x.currency), 0);

    const expenseDebits = entries
      .filter((x) => x.type === "debit")
      .reduce((sum, x) => sum + cvt(x.amount, x.currency), 0);

    const debtBalances = debts.reduce(
      (sum, x) => sum + cvt(x.balance, x.currency),
      0,
    );

    const byGroup = (group: "primary" | "secondary") => {
      const groupCredits = entries
        .filter((x) => x.group === group && x.type === "credit")
        .reduce((sum, x) => sum + cvt(x.amount, x.currency), 0);

      const groupExpenseDebits = entries
        .filter((x) => x.group === group && x.type === "debit")
        .reduce((sum, x) => sum + cvt(x.amount, x.currency), 0);

      const groupDebt = debts
        .filter((x) => x.group === group)
        .reduce((sum, x) => sum + cvt(x.balance, x.currency), 0);

      return {
        credits: groupCredits,
        debts: groupDebt + groupExpenseDebits,
      };
    };

    const primary = byGroup("primary");
    const secondary = byGroup("secondary");

    return {
      credits,
      expenseDebits,
      debtBalances,
      outstanding: credits - expenseDebits - debtBalances,
      primaryCredits: primary.credits,
      primaryDebts: primary.debts,
      secondaryCredits: secondary.credits,
      secondaryDebts: secondary.debts,
    };
  }, [entries, debts, fx]);

  const updateBaseCurrency = useCallback(
    async (baseCurrency: UserSettings["baseCurrency"]) => {
      if (!user) return;
      const next = { ...settings, baseCurrency };
      await saveSettings(user.uid, next);
      setSettings(next);
      setFx(await getFxRates(baseCurrency));
    },
    [user, settings],
  );

  return {
    entries,
    debts,
    salaryProfiles,
    settings,
    fx,
    summary,
    loading,
    error,
    refresh,
    updateBaseCurrency,
  };
}
