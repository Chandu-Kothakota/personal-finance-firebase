import { createContext } from "react";

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  destructive?: boolean;
};

export type FeedbackApi = {
  notify: (message: string, severity?: "success" | "error" | "info") => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

export const FeedbackContext = createContext<FeedbackApi | null>(null);
