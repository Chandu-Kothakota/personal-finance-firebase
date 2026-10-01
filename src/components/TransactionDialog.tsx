import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { toggleSx } from "./ui";
import { useFeedback } from "../hooks/useFeedback";
import { useFinanceData } from "../hooks/useFinanceData";
import { useIsMobile } from "../hooks/useIsMobile";
import { CURRENCIES } from "../lib/currency";
import { todayIso } from "../lib/dates";
import { toUserMessage } from "../lib/errors";
import { saveEntry } from "../services/apiService";
import type { LedgerEntry } from "../types";

const schema = z.object({
  type: z.enum(["credit", "debit"]),
  group: z.enum(["primary", "secondary"]),
  category: z.string().trim().min(1, "Choose or type a category").max(60, "Keep it under 60 characters"),
  description: z.string().trim().min(1, "Add a short description").max(120, "Keep it under 120 characters"),
  amount: z.coerce.number({ error: "Enter an amount" }).positive("Amount must be greater than zero"),
  currency: z.enum(CURRENCIES),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
});

type FormInput = z.input<typeof schema>;
type FormData = z.output<typeof schema>;

const emptyForm: FormInput = {
  type: "debit",
  group: "primary",
  category: "",
  description: "",
  amount: "",
  currency: "USD",
  date: "",
};


export function TransactionDialog({
  open,
  entry,
  onClose,
}: {
  open: boolean;
  /** The transaction to edit, or null to create a new one. */
  entry: LedgerEntry | null;
  onClose: () => void;
}) {
  const data = useFinanceData();
  const { notify } = useFeedback();
  const mobile = useIsMobile();
  const [error, setError] = useState("");

  const form = useForm<FormInput, unknown, FormData>({ resolver: zodResolver(schema), defaultValues: emptyForm });
  const type = form.watch("type");

  useEffect(() => {
    if (!open) return;
    setError("");
    form.reset(
      entry
        ? {
            type: entry.type,
            group: entry.group,
            category: entry.category,
            description: entry.description,
            amount: entry.amount,
            currency: entry.currency,
            date: entry.date,
          }
        : { ...emptyForm, currency: data.settings.baseCurrency, date: todayIso() },
    );
  }, [open, entry, data.settings.baseCurrency, form]);

  // Existing categories for the chosen type, most used first.
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of data.entries) {
      if (e.type === type && e.source !== "debt_payment") counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  }, [data.entries, type]);

  async function submit(values: FormData) {
    setError("");
    try {
      await saveEntry({ ...values, source: entry?.source ?? "manual" }, entry?.id);
      onClose();
      notify(entry ? "Transaction updated" : `${values.type === "credit" ? "Income" : "Expense"} added`);
      await data.refresh();
    } catch (err) {
      setError(toUserMessage(err));
    }
  }

  const submitting = form.formState.isSubmitting;

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} fullWidth maxWidth="sm" fullScreen={mobile}>
      <DialogTitle>{entry ? "Edit transaction" : "New transaction"}</DialogTitle>
      <Box component="form" onSubmit={form.handleSubmit(submit)} noValidate sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <DialogContent dividers>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {entry?.source === "salary" && (
            <Alert severity="info" sx={{ mb: 2 }}>This was added automatically from an income schedule.</Alert>
          )}
          <Grid container spacing={2}>
            <Grid size={12}>
              <Controller
                name="type"
                control={form.control}
                render={({ field }) => (
                  <ToggleButtonGroup
                    exclusive
                    fullWidth
                    size="small"
                    value={field.value}
                    onChange={(_, v) => v && field.onChange(v)}
                    aria-label="Transaction type"
                    sx={toggleSx}
                  >
                    <ToggleButton value="debit">Expense</ToggleButton>
                    <ToggleButton value="credit">Income</ToggleButton>
                  </ToggleButtonGroup>
                )}
              />
            </Grid>
            <Grid size={{ xs: 7, sm: 8 }}>
              <Controller
                name="amount"
                control={form.control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    value={field.value ?? ""}
                    fullWidth
                    autoFocus={!entry}
                    type="number"
                    label="Amount"
                    placeholder="0.00"
                    slotProps={{ htmlInput: { step: "0.01", min: "0", inputMode: "decimal" } }}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
            </Grid>
            <Grid size={{ xs: 5, sm: 4 }}>
              <Controller
                name="currency"
                control={form.control}
                render={({ field }) => (
                  <TextField {...field} fullWidth select label="Currency">
                    {CURRENCIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                  </TextField>
                )}
              />
            </Grid>
            <Grid size={12}>
              <Controller
                name="description"
                control={form.control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="Description"
                    placeholder={type === "credit" ? "e.g. Freelance payment" : "e.g. Groceries at Costco"}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller
                name="category"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Autocomplete
                    freeSolo
                    options={categories}
                    value={field.value ?? ""}
                    onChange={(_, v) => field.onChange(v ?? "")}
                    onInputChange={(_, v) => field.onChange(v)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Category"
                        placeholder="Pick or type a new one"
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                        onBlur={field.onBlur}
                      />
                    )}
                  />
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller
                name="date"
                control={form.control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    fullWidth
                    type="date"
                    label="Date"
                    slotProps={{ inputLabel: { shrink: true } }}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
            </Grid>
            <Grid size={12}>
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 0.75 }}>Account group</Typography>
              <Controller
                name="group"
                control={form.control}
                render={({ field }) => (
                  <ToggleButtonGroup
                    exclusive
                    fullWidth
                    size="small"
                    value={field.value}
                    onChange={(_, v) => v && field.onChange(v)}
                    aria-label="Account group"
                    sx={toggleSx}
                  >
                    <ToggleButton value="primary">Primary</ToggleButton>
                    <ToggleButton value="secondary">Secondary</ToggleButton>
                  </ToggleButtonGroup>
                )}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose} color="inherit" disabled={submitting}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={submitting}>
            {submitting ? "Saving…" : entry ? "Save changes" : "Add transaction"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
