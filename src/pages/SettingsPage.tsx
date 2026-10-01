import { DownloadOutlined, LogoutOutlined } from "@mui/icons-material";
import { Box, Button, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { useState, type ReactNode } from "react";
import { PageHeader, Panel } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useFeedback } from "../hooks/useFeedback";
import { useFinanceData } from "../hooks/useFinanceData";
import { downloadCsv } from "../lib/csv";
import { CURRENCIES } from "../lib/currency";
import { todayIso } from "../lib/dates";
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

function Kbd({ children }: { children: ReactNode }) {
  return (
    <Box
      component="kbd"
      sx={{ px: 0.75, py: 0.1, border: 1, borderColor: "divider", borderBottomWidth: 2, borderRadius: 0.75, fontSize: 12, fontFamily: "inherit", bgcolor: "background.default" }}
    >
      {children}
    </Box>
  );
}

export function SettingsPage() {
  useDocumentTitle("Settings");
  const data = useFinanceData();
  const { user, logout } = useAuth();
  const { notify } = useFeedback();
  const [saving, setSaving] = useState(false);

  async function changeBase(value: string) {
    setSaving(true);
    try {
      await data.updateBaseCurrency(value as typeof data.settings.baseCurrency);
      notify(`Totals now shown in ${value}`);
    } catch (err) {
      notify(toUserMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  function exportAll() {
    const stamp = todayIso();
    downloadCsv(`transactions-${stamp}.csv`, [
      ["Date", "Type", "Description", "Category", "Group", "Source", "Amount", "Currency"],
      ...data.entries.map((e) => [e.date, e.type === "credit" ? "Income" : "Expense", e.description, e.category, e.group, e.source ?? "manual", e.type === "credit" ? e.amount : -e.amount, e.currency]),
    ]);
    downloadCsv(`debts-${stamp}.csv`, [
      ["Account", "Type", "Category", "Group", "Balance", "Currency", "Notes"],
      ...data.debts.map((d) => [d.name, d.kind, d.category, d.group, d.balance, d.currency, d.notes ?? ""]),
    ]);
    notify("Exported transactions and debts");
  }

  return (
    <Box>
      <PageHeader title="Settings" description="Preferences, data and account." />

      <Stack spacing={2} sx={{ maxWidth: 760 }}>
        <Panel title="Display">
          <Box sx={{ my: -2.25 }}>
            <SettingRow
              label="Base currency"
              help="Totals and charts are converted to this currency using daily reference rates. Each account keeps its own currency."
            >
              <TextField
                select
                fullWidth
                label="Currency"
                value={data.settings.baseCurrency}
                disabled={saving}
                onChange={(e) => void changeBase(e.target.value)}
              >
                {CURRENCIES.map((currency) => (
                  <MenuItem key={currency} value={currency}>{currency}</MenuItem>
                ))}
              </TextField>
            </SettingRow>
          </Box>
        </Panel>

        <Panel title="Your data">
          <Box sx={{ my: -2.25 }}>
            <SettingRow
              label="Export to CSV"
              help={`Download all ${data.entries.length} transactions and ${data.debts.length} debt accounts as spreadsheets.`}
            >
              <Button variant="outlined" fullWidth startIcon={<DownloadOutlined />} onClick={exportAll}>
                Export everything
              </Button>
            </SettingRow>
          </Box>
        </Panel>

        <Panel title="Keyboard shortcuts">
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="body2">New transaction</Typography>
            <Kbd>N</Kbd>
          </Stack>
        </Panel>

        <Panel title="Account">
          <Box sx={{ my: -2.25 }}>
            <SettingRow label="Signed in as" help={user?.email ?? ""}>
              <Button variant="outlined" color="inherit" fullWidth startIcon={<LogoutOutlined />} onClick={() => void logout()}>
                Sign out
              </Button>
            </SettingRow>
          </Box>
        </Panel>
      </Stack>
    </Box>
  );
}
