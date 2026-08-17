import { zodResolver } from "@hookform/resolvers/zod";
import {
  AddRounded,
  ArrowDownwardRounded,
  ArrowUpwardRounded,
  DeleteRounded,
  EditRounded,
  ReceiptLongRounded,
  SearchRounded,
  SwapVertRounded,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { LoadingScreen } from "../components/LoadingScreen";
import { useAuth } from "../context/AuthContext";
import { useFinanceData } from "../hooks/useFinanceData";
import { CURRENCIES, formatMoney } from "../lib/currency";
import { toUserMessage } from "../lib/errors";
import { deleteEntry, saveEntry } from "../services/firestoreService";
import type { LedgerEntry } from "../types";

const schema = z.object({
  type: z.enum(["credit", "debit"]),
  group: z.enum(["primary", "secondary"]),
  category: z.string().trim().min(1, "Category is required").max(60),
  description: z.string().trim().min(1, "Description is required").max(120),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  currency: z.enum(CURRENCIES),
  date: z.string().min(1, "Date is required"),
});

type FormInput = z.input<typeof schema>;
type FormData = z.output<typeof schema>;
type TypeFilter = "all" | LedgerEntry["type"];
type GroupFilter = "all" | LedgerEntry["group"];

const defaults: FormData = {
  type: "debit",
  group: "primary",
  category: "General",
  description: "",
  amount: 0,
  currency: "USD",
  date: new Date().toISOString().slice(0, 10),
};

function sourceLabel(item: LedgerEntry): string {
  if (item.source === "salary") return "Auto salary";
  if (item.source === "debt_payment") return "Linked debt payment";
  return "Manual";
}

export function TransactionsPage() {
  const { user } = useAuth();
  const data = useFinanceData();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LedgerEntry | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [groupFilter, setGroupFilter] = useState<GroupFilter>("all");
  const [error, setError] = useState("");

  const form = useForm<FormInput, unknown, FormData>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  const normalizedSearch = search.trim().toLowerCase();
  const filteredEntries = data.entries.filter((item) => {
    const matchesType = typeFilter === "all" || item.type === typeFilter;
    const matchesGroup = groupFilter === "all" || item.group === groupFilter;
    const matchesSearch = normalizedSearch === "" || [
      item.description,
      item.category,
      item.currency,
      sourceLabel(item),
    ].some((value) => value.toLowerCase().includes(normalizedSearch));

    return matchesType && matchesGroup && matchesSearch;
  });

  function addNew() {
    setEditing(null);
    form.reset({ ...defaults, currency: data.settings.baseCurrency });
    setOpen(true);
  }

  function edit(item: LedgerEntry) {
    if (item.source === "debt_payment") {
      setError("Linked debt-payment transactions cannot be edited here.");
      return;
    }

    setEditing(item);
    form.reset({
      type: item.type,
      group: item.group,
      category: item.category,
      description: item.description,
      amount: item.amount,
      currency: item.currency,
      date: item.date,
    });
    setOpen(true);
  }

  async function submit(values: FormData) {
    if (!user) return;
    if (editing?.source === "debt_payment") {
      setError("Linked debt-payment transactions cannot be edited here.");
      setOpen(false);
      return;
    }

    setError("");
    try {
      await saveEntry(
        user.uid,
        { ...values, source: editing?.source ?? "manual" },
        editing?.id,
      );
      setOpen(false);
      await data.refresh();
    } catch (err) {
      setError(toUserMessage(err));
    }
  }

  async function remove(item: LedgerEntry) {
    if (item.source === "debt_payment") {
      setError("Linked debt-payment transactions cannot be deleted here.");
      return;
    }
    if (!user || !window.confirm("Delete this transaction?")) return;
    try {
      await deleteEntry(user.uid, item.id);
      await data.refresh();
    } catch (err) {
      setError(toUserMessage(err));
    }
  }

  if (data.loading) return <LoadingScreen label="Loading transactions…" />;

  const base = data.settings.baseCurrency;
  const stats = [
    {
      label: "Total inflow",
      value: formatMoney(data.summary.credits, base),
      caption: "All recorded credits",
      color: "#15803D",
      background: "#EAF8F0",
      icon: <ArrowUpwardRounded />,
    },
    {
      label: "Total outflow",
      value: formatMoney(data.summary.expenseDebits, base),
      caption: "Expenses and debt payments",
      color: "#B42318",
      background: "#FEF1F1",
      icon: <ArrowDownwardRounded />,
    },
    {
      label: "Ledger activity",
      value: data.entries.length.toLocaleString(),
      caption: `${base} base reporting`,
      color: "#2563EB",
      background: "#EAF1FF",
      icon: <SwapVertRounded />,
    },
  ];

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ md: "center" }}
        gap={2}
      >
        <Box>
          <Typography variant="h4">Transactions</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.6 }}>
            Review every credit, expense, salary deposit, and linked debt payment.
          </Typography>
        </Box>
        <Stack direction="row" alignItems="center" gap={1.2} flexWrap="wrap">
          <Chip label={`${data.entries.length} record${data.entries.length === 1 ? "" : "s"}`} variant="outlined" sx={{ bgcolor: "#fff" }} />
          <Button variant="contained" startIcon={<AddRounded />} onClick={addNew}>
            Add transaction
          </Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}
      {data.error && <Alert severity="error">{data.error}</Alert>}

      <Grid container spacing={2}>
        {stats.map((stat) => (
          <Grid key={stat.label} size={{ xs: 12, sm: 6, lg: 4 }}>
            <Card sx={{ height: "100%" }}>
              <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
                  <Box>
                    <Typography variant="body2" color="text.secondary" fontWeight={650}>{stat.label}</Typography>
                    <Typography variant="h5" sx={{ mt: 0.8, fontVariantNumeric: "tabular-nums" }}>{stat.value}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.7 }}>{stat.caption}</Typography>
                  </Box>
                  <Box sx={{ width: 42, height: 42, borderRadius: 2.5, display: "grid", placeItems: "center", color: stat.color, bgcolor: stat.background }}>
                    {stat.icon}
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Card>
        <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
          <Stack direction={{ xs: "column", lg: "row" }} gap={1.5} sx={{ p: 2.5 }}>
            <TextField
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search description, category, currency…"
              aria-label="Search transactions"
              sx={{ flex: 1, minWidth: { lg: 280 } }}
              slotProps={{
                input: {
                  startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment>,
                },
              }}
            />
            <Stack direction={{ xs: "column", sm: "row" }} gap={1.5}>
              <TextField select label="Type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as TypeFilter)} sx={{ minWidth: { sm: 145 } }}>
                <MenuItem value="all">All types</MenuItem>
                <MenuItem value="credit">Credits</MenuItem>
                <MenuItem value="debit">Debits</MenuItem>
              </TextField>
              <TextField select label="Group" value={groupFilter} onChange={(event) => setGroupFilter(event.target.value as GroupFilter)} sx={{ minWidth: { sm: 155 } }}>
                <MenuItem value="all">All groups</MenuItem>
                <MenuItem value="primary">Primary</MenuItem>
                <MenuItem value="secondary">Secondary</MenuItem>
              </TextField>
            </Stack>
          </Stack>

          <Divider />

          {filteredEntries.length === 0 ? (
            <Stack alignItems="center" textAlign="center" sx={{ px: 3, py: 7 }}>
              <Box sx={{ width: 54, height: 54, borderRadius: 3, display: "grid", placeItems: "center", bgcolor: "#EEF4F8", color: "#475467" }}>
                <ReceiptLongRounded />
              </Box>
              <Typography variant="h6" sx={{ mt: 2 }}>
                {data.entries.length === 0 ? "No transactions yet" : "No matching transactions"}
              </Typography>
              <Typography color="text.secondary" variant="body2" sx={{ mt: 0.6, maxWidth: 440 }}>
                {data.entries.length === 0
                  ? "Add your first credit or debit to begin building your financial history."
                  : "Try a different search term or reset the type and group filters."}
              </Typography>
              {data.entries.length === 0 && (
                <Button startIcon={<AddRounded />} onClick={addNew} sx={{ mt: 2 }}>Add transaction</Button>
              )}
            </Stack>
          ) : (
            <Stack divider={<Divider flexItem />}>
              {filteredEntries.map((item) => {
                const isDebtPayment = item.source === "debt_payment";
                const isCredit = item.type === "credit";

                return (
                  <Stack
                    key={item.id}
                    direction={{ xs: "column", sm: "row" }}
                    alignItems={{ sm: "center" }}
                    gap={{ xs: 1.5, sm: 2 }}
                    sx={{ px: { xs: 2, sm: 2.5 }, py: 2, "&:hover": { bgcolor: "#FBFCFD" } }}
                  >
                    <Box sx={{ width: 42, height: 42, borderRadius: 2.5, display: "grid", placeItems: "center", flexShrink: 0, bgcolor: isCredit ? "#EAF8F0" : "#FEF1F1", color: isCredit ? "#15803D" : "#B42318" }}>
                      {isCredit ? <ArrowUpwardRounded fontSize="small" /> : <ArrowDownwardRounded fontSize="small" />}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" alignItems="center" gap={0.8} flexWrap="wrap">
                        <Typography fontWeight={750}>{item.description}</Typography>
                        <Chip size="small" variant="outlined" color={isDebtPayment ? "info" : item.source === "salary" ? "success" : "default"} label={sourceLabel(item)} />
                      </Stack>
                      <Stack direction="row" gap={0.8} alignItems="center" flexWrap="wrap" sx={{ mt: 0.45 }}>
                        <Typography variant="body2" color="text.secondary">{item.date}</Typography>
                        <Typography variant="body2" color="text.disabled">•</Typography>
                        <Typography variant="body2" color="text.secondary">{item.category}</Typography>
                        <Chip size="small" label={item.group} sx={{ height: 22, textTransform: "capitalize" }} />
                      </Stack>
                    </Box>
                    <Typography fontWeight={850} color={isCredit ? "success.main" : "text.primary"} sx={{ minWidth: 145, textAlign: { sm: "right" }, fontVariantNumeric: "tabular-nums" }}>
                      {isCredit ? "+" : "−"}{formatMoney(item.amount, item.currency)}
                    </Typography>
                    <Stack direction="row" alignItems="center" sx={{ alignSelf: { xs: "flex-end", sm: "auto" } }}>
                      <Tooltip title={isDebtPayment ? "Linked debt payments cannot be edited here" : "Edit transaction"}>
                        <span>
                          <IconButton onClick={() => edit(item)} aria-label="Edit transaction" disabled={isDebtPayment} size="small">
                            <EditRounded fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title={isDebtPayment ? "Linked debt payments cannot be deleted here" : "Delete transaction"}>
                        <span>
                          <IconButton onClick={() => void remove(item)} aria-label="Delete transaction" disabled={isDebtPayment} size="small">
                            <DeleteRounded fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
                  </Stack>
                );
              })}
            </Stack>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? "Edit transaction" : "Add transaction"}</DialogTitle>
        <Box component="form" onSubmit={form.handleSubmit(submit)}>
          <DialogContent dividers>
            <Grid container spacing={2} sx={{ mt: 0.25 }}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Controller name="type" control={form.control} render={({ field, fieldState }) => (
                  <TextField {...field} fullWidth select label="Type" error={!!fieldState.error} helperText={fieldState.error?.message}>
                    <MenuItem value="credit">Credit</MenuItem>
                    <MenuItem value="debit">Debit</MenuItem>
                  </TextField>
                )} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Controller name="group" control={form.control} render={({ field, fieldState }) => (
                  <TextField {...field} fullWidth select label="Group" error={!!fieldState.error} helperText={fieldState.error?.message}>
                    <MenuItem value="primary">Primary</MenuItem>
                    <MenuItem value="secondary">Secondary</MenuItem>
                  </TextField>
                )} />
              </Grid>
              <Grid size={12}>
                <Controller name="description" control={form.control} render={({ field, fieldState }) => (
                  <TextField {...field} fullWidth label="Description" error={!!fieldState.error} helperText={fieldState.error?.message} />
                )} />
              </Grid>
              <Grid size={12}>
                <Controller name="category" control={form.control} render={({ field, fieldState }) => (
                  <TextField {...field} fullWidth label="Category" error={!!fieldState.error} helperText={fieldState.error?.message} />
                )} />
              </Grid>
              <Grid size={{ xs: 12, sm: 7 }}>
                <Controller name="amount" control={form.control} render={({ field, fieldState }) => (
                  <TextField {...field} fullWidth type="number" inputProps={{ step: "0.01", min: "0" }} label="Amount" error={!!fieldState.error} helperText={fieldState.error?.message} />
                )} />
              </Grid>
              <Grid size={{ xs: 12, sm: 5 }}>
                <Controller name="currency" control={form.control} render={({ field, fieldState }) => (
                  <TextField {...field} fullWidth select label="Currency" error={!!fieldState.error} helperText={fieldState.error?.message}>
                    {CURRENCIES.map((currency) => <MenuItem key={currency} value={currency}>{currency}</MenuItem>)}
                  </TextField>
                )} />
              </Grid>
              <Grid size={12}>
                <Controller name="date" control={form.control} render={({ field, fieldState }) => (
                  <TextField {...field} fullWidth type="date" label="Date" slotProps={{ inputLabel: { shrink: true } }} error={!!fieldState.error} helperText={fieldState.error?.message} />
                )} />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">{editing ? "Save changes" : "Add transaction"}</Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Stack>
  );
}
