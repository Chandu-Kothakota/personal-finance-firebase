import { useContext } from "react";
import { FinanceDataContext } from "../context/financeDataContext";

export function useFinanceData() {
  const ctx = useContext(FinanceDataContext);
  if (!ctx) throw new Error("useFinanceData must be used within FinanceDataProvider");
  return ctx;
}
