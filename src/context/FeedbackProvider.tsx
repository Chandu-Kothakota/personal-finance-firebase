import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Snackbar, Typography } from "@mui/material";
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { FeedbackContext, type ConfirmOptions, type FeedbackApi } from "./feedbackContext";

type Toast = { key: number; message: string; severity: "success" | "error" | "info" };

/** App-wide toasts and confirmation dialogs (replaces window.confirm). */
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<(ok: boolean) => void>(undefined);

  const notify = useCallback<FeedbackApi["notify"]>((message, severity = "success") => {
    setToast({ key: Date.now(), message, severity });
  }, []);

  const confirm = useCallback<FeedbackApi["confirm"]>((options) => {
    setConfirmState(options);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = undefined;
    setConfirmState(null);
  };

  const api = useMemo(() => ({ notify, confirm }), [notify, confirm]);

  return (
    <FeedbackContext.Provider value={api}>
      {children}

      <Snackbar
        key={toast?.key}
        open={toast !== null}
        autoHideDuration={toast?.severity === "error" ? 6000 : 3500}
        onClose={(_, reason) => reason !== "clickaway" && setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={toast?.severity ?? "success"}
          variant="filled"
          onClose={() => setToast(null)}
          sx={{ minWidth: 280, boxShadow: "0 8px 24px rgba(16,24,40,.18)" }}
        >
          {toast?.message}
        </Alert>
      </Snackbar>

      <Dialog open={confirmState !== null} onClose={() => close(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{confirmState?.title}</DialogTitle>
        {confirmState?.message && (
          <DialogContent>
            <Typography variant="body2" color="text.secondary">{confirmState.message}</Typography>
          </DialogContent>
        )}
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => close(false)} color="inherit">Cancel</Button>
          <Button
            onClick={() => close(true)}
            variant="contained"
            color={confirmState?.destructive ? "error" : "primary"}
            autoFocus
          >
            {confirmState?.confirmLabel ?? "Confirm"}
          </Button>
        </DialogActions>
      </Dialog>
    </FeedbackContext.Provider>
  );
}
