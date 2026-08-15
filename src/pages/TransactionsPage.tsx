import { zodResolver } from "@hookform/resolvers/zod";
import { AddRounded, DeleteRounded, EditRounded } from "@mui/icons-material";
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
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
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

const defaults: FormData = {
  type: "debit",
  group: "primary",
  category: "General",
  description: "",
  amount: 0,
  currency: "USD",
  date: new Date().toISOString().slice(0, 10),
};

export function TransactionsPage() {
  const { user } = useAuth();
  const data = useFinanceData();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LedgerEntry | null>(null);
  const [error, setError] = useState("");

  const form = useForm<FormInput, unknown, FormData>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
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

  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="h4" fontWeight={900}>Transactions</Typography>
          <Typography color="text.secondary">
            Add expenses, secondary income, refunds, or any manual credit/debit.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddRounded />} onClick={addNew}>
          Add transaction
        </Button>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      <Card>
        <CardContent>
          <Stack spacing={1.25}>
            {data.entries.length === 0 && (
              <Typography color="text.secondary">No transactions yet.</Typography>
            )}

            {data.entries.map((item) => {
              const isDebtPayment = item.source === "debt_payment";

              return (
                <Stack
                  key={item.id}
                  direction={{ xs: "column", sm: "row" }}
                  alignItems={{ sm: "center" }}
                  gap={1}
                  sx={{ py: 1.25, borderBottom: 1, borderColor: "divider" }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                      <Typography fontWeight={700}>{item.description}</Typography>
                      {isDebtPayment && (
                        <Chip size="small" color="info" variant="outlined" label="Linked debt payment" />
                      )}
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {item.date} · {item.group} · {item.category}
                      {item.source === "salary" ? " · auto salary" : ""}
                      {isDebtPayment ? " · generated from debt payment" : ""}
                    </Typography>
                  </Box>
                  <Typography
                    fontWeight={800}
                    sx={{ minWidth: 140, textAlign: { sm: "right" } }}
                  >
                    {item.type === "debit" ? "−" : "+"}
                    {formatMoney(item.amount, item.currency)}
                  </Typography>
                  <Tooltip title={isDebtPayment ? "Linked debt payments cannot be edited here" : "Edit transaction"}>
                    <span>
                      <IconButton
                        onClick={() => edit(item)}
                        aria-label="Edit transaction"
                        disabled={isDebtPayment}
                      >
                        <EditRounded />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title={isDebtPayment ? "Linked debt payments cannot be deleted here" : "Delete transaction"}>
                    <span>
                      <IconButton
                        onClick={() => void remove(item)}
                        aria-label="Delete transaction"
                        disabled={isDebtPayment}
                      >
                        <DeleteRounded />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              );
            })}
          </Stack>
        </CardContent>
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? "Edit transaction" : "Add transaction"}</DialogTitle>
        <Box component="form" onSubmit={form.handleSubmit(submit)}>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              {(["type", "group", "currency"] as const).map((name) => (
                <Controller
                  key={name}
                  name={name}
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      select
                      label={name[0].toUpperCase() + name.slice(1)}
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                    >
                      {(name === "type"
                        ? ["credit", "debit"]
                        : name === "group"
                          ? ["primary", "secondary"]
                          : CURRENCIES
                      ).map((value) => (
                        <MenuItem key={value} value={value}>
                          {value}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
              ))}

              <Controller
                name="category"
                control={form.control}
                render={({ field, fieldState }) => (
                  <TextField {...field} label="Category" error={!!fieldState.error} helperText={fieldState.error?.message} />
                )}
              />
              <Controller
                name="description"
                control={form.control}
                render={({ field, fieldState }) => (
                  <TextField {...field} label="Description" error={!!fieldState.error} helperText={fieldState.error?.message} />
                )}
              />
              <Controller
                name="amount"
                control={form.control}
                render={({ field, fieldState }) => (
                  <TextField {...field} type="number" inputProps={{ step: "0.01", min: "0" }} label="Amount" error={!!fieldState.error} helperText={fieldState.error?.message} />
                )}
              />
              <Controller
                name="date"
                control={form.control}
                render={({ field, fieldState }) => (
                  <TextField {...field} type="date" label="Date" slotProps={{ inputLabel: { shrink: true } }} error={!!fieldState.error} helperText={fieldState.error?.message} />
                )}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">Save</Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Stack>
  );
}
