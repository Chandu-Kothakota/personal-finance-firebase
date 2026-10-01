import type { ReactNode } from "react";
import { useFinanceDataState } from "../hooks/useFinanceDataState";
import { FinanceDataContext } from "./financeDataContext";

export function FinanceDataProvider({ children }: { children: ReactNode }) {
  const value = useFinanceDataState();
  return <FinanceDataContext.Provider value={value}>{children}</FinanceDataContext.Provider>;
}
