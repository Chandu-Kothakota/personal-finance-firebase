import { Alert, Card, CardContent, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { useState } from "react";
import { useFinanceData } from "../hooks/useFinanceData";
import { CURRENCIES } from "../lib/currency";
import { toUserMessage } from "../lib/errors";

export function SettingsPage() {
  const data = useFinanceData();
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
    <Stack spacing={3}>
      <div>
        <Typography variant="h4" fontWeight={900}>Settings</Typography>
        <Typography color="text.secondary">Personalize how totals are shown.</Typography>
      </div>

      {message && <Alert severity="success">{message}</Alert>}
      {error && <Alert severity="error">{error}</Alert>}

      <Card sx={{ maxWidth: 650 }}>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6" fontWeight={800}>Currency</Typography>
            <TextField
              select
              label="Base currency"
              value={data.settings.baseCurrency}
              onChange={(e) => void changeBase(e.target.value)}
            >
              {CURRENCIES.map((currency) => (
                <MenuItem key={currency} value={currency}>{currency}</MenuItem>
              ))}
            </TextField>
            <Typography variant="body2" color="text.secondary">
              Debt and credit cards can remain in their original currencies. Dashboard totals are converted into this base currency using cached daily reference rates.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
