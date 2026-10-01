import { Alert, Box, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { useState, type ReactNode } from "react";
import { PageHeader, Panel } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useFinanceData } from "../hooks/useFinanceData";
import { CURRENCIES } from "../lib/currency";
import { toUserMessage } from "../lib/errors";

function SettingRow({ label, help, children }: { label: string; help: string; children: ReactNode }) {
  return (
    <Stack direction={{ xs: "column", sm: "row" }} gap={{ xs: 1.5, sm: 4 }} sx={{ py: 2.25 }}>
      <Box sx={{ flex: 1 }}>
        <Typography variant="body2" fontWeight={600}>{label}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>{help}</Typography>
      </Box>
      <Box sx={{ width: { xs: "100%", sm: 240 }, flexShrink: 0 }}>{children}</Box>
    </Stack>
  );
}

export function SettingsPage() {
  const data = useFinanceData();
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function changeBase(value: string) {
    try {
      setError("");
      setMessage("");
      await data.updateBaseCurrency(value as typeof data.settings.baseCurrency);
      setMessage("Base currency updated.");
    } catch (err) {
      setError(toUserMessage(err));
    }
  }

  return (
    <Box>
      <PageHeader title="Settings" description="Preferences for how your figures are displayed." />

      <Stack spacing={2} sx={{ maxWidth: 760 }}>
        {message && <Alert severity="success">{message}</Alert>}
        {error && <Alert severity="error">{error}</Alert>}

        <Panel title="Display">
          <Box sx={{ mt: -2.25, mb: -2.25 }}>
            <SettingRow
              label="Base currency"
              help="Totals and charts are converted to this currency using daily reference rates. Individual accounts keep their own currency."
            >
              <TextField
                select
                fullWidth
                label="Currency"
                value={data.settings.baseCurrency}
                onChange={(e) => void changeBase(e.target.value)}
              >
                {CURRENCIES.map((currency) => (
                  <MenuItem key={currency} value={currency}>{currency}</MenuItem>
                ))}
              </TextField>
            </SettingRow>
          </Box>
        </Panel>

        <Panel title="Account">
          <Box sx={{ mt: -2.25, mb: -2.25 }}>
            <SettingRow label="Signed in as" help="Your login is managed through Firebase Authentication.">
              <Typography variant="body2" sx={{ pt: { sm: 1 }, wordBreak: "break-all" }}>{user?.email}</Typography>
            </SettingRow>
          </Box>
        </Panel>
      </Stack>
    </Box>
  );
}
