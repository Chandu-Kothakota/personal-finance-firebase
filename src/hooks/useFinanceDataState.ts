import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { convertToBase } from "../lib/currency";
import { toUserMessage } from "../lib/errors";
import { loadFinanceData, saveSettings } from "../services/apiService";
import { getFxRates } from "../services/fxService";
import type {
  Debt,
  FxRates,
  LedgerEntry,
  SalaryProfile,
  UserSettings,
} from "../types";

export function useFinanceDataState() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [salaryProfiles, setSalaryProfiles] = useState<SalaryProfile[]>([]);
  const [settings, setSettings] = useState<UserSettings>({ baseCurrency: "USD" });
  const [fx, setFx] = useState<FxRates | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Only the first load shows a loading screen; later refreshes update in place.
  const refresh = useCallback(async () => {
    if (!user) return;

    setError("");

    try {
      const snapshot = await loadFinanceData();
      const rates = await getFxRates(snapshot.settings.baseCurrency);

      setSettings(snapshot.settings);
      setSalaryProfiles(snapshot.salaryProfiles);
      setDebts(snapshot.debts);
      setEntries(snapshot.entries);
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
        primaryOutstanding: 0,
        secondaryCredits: 0,
        secondaryDebts: 0,
        secondaryOutstanding: 0,
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
        debts: groupDebt,
        outstanding: groupCredits - groupExpenseDebits,
      };
    };

    const primary = byGroup("primary");
    const secondary = byGroup("secondary");

    return {
      credits,
      expenseDebits,
      debtBalances,
      outstanding: credits - expenseDebits,
      primaryCredits: primary.credits,
      primaryDebts: primary.debts,
      primaryOutstanding: primary.outstanding,
      secondaryCredits: secondary.credits,
      secondaryDebts: secondary.debts,
      secondaryOutstanding: secondary.outstanding,
    };
  }, [entries, debts, fx]);

  const updateBaseCurrency = useCallback(
    async (baseCurrency: UserSettings["baseCurrency"]) => {
      if (!user) return;
      const next = { ...settings, baseCurrency };
      await saveSettings(next);
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
