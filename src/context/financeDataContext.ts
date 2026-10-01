import { createContext } from "react";
import type { useFinanceDataState } from "../hooks/useFinanceDataState";

export const FinanceDataContext = createContext<ReturnType<
  typeof useFinanceDataState
> | null>(null);
