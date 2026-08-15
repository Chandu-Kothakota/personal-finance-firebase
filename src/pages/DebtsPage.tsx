import { zodResolver } from "@hookform/resolvers/zod";
import {
  AddRounded,
  DeleteRounded,
  EditRounded,
  PaymentsRounded,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "../context/AuthContext";
import { useFinanceData } from "../hooks/useFinanceData";
import { CURRENCIES, formatMoney } from "../lib/currency";
import { toUserMessage } from "../lib/errors";
import { makeDebtPayment } from "../services/debtService";
import { deleteDebt, saveDebt } from "../services/firestoreService";
import type { Debt } from "../types";

const schema = z.object({
  group: z.enum(["primary", "secondary"]),
  name: z.string().trim().min(1).max(80),
  category: z.string().trim().min(1).max(60),
  kind: z.enum(["credit_card", "loan", "misc"]),
  balance: z.coerce.number().min(0),
  currency: z.enum(CURRENCIES),
  notes: z.string().max(300).optional(),
});

const paymentSchema = z.object({
  amount: z.coerce
    .number()
    .finite()
    .positive("Payment amount must be greater than zero")
    .refine(
      (amount) => Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-7,
      "Payment amount cannot have more than two decimal places",
    ),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Payment date is required"),
});

type FormInput = z.input<typeof schema>;
type FormData = z.output<typeof schema>;
type PaymentFormInput = z.input<typeof paymentSchema>;
type PaymentFormData = z.output<typeof paymentSchema>;

const defaults: FormData = {
  group: "primary",
  name: "",
  category: "Credit Card",
  kind: "credit_card",
  balance: 0,
  currency: "INR",
  notes: "",
};

const paymentDefaults: PaymentFormData = {
  amount: 0,
  date: new Date().toISOString().slice(0, 10),
};

export function DebtsPage() {
  const { user } = useAuth();
  const data = useFinanceData();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Debt | null>(null);
  const [paymentDebt, setPaymentDebt] = useState<Debt | null>(null);
  const [paymentError, setPaymentError] = useState("");
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [error, setError] = useState("");
  const paymentInFlight = useRef(false);

  const form = useForm<FormInput, unknown, FormData>({ resolver: zodResolver(schema), defaultValues: defaults });
  const paymentForm = useForm<PaymentFormInput, unknown, PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: paymentDefaults,
  });

  function newDebt() {
    setEditing(null);
    form.reset(defaults);
    setOpen(true);
  }

  function edit(debt: Debt) {
    setEditing(debt);
    form.reset({
      group: debt.group,
      name: debt.name,
      category: debt.category,
      kind: debt.kind,
      balance: debt.balance,
      currency: debt.currency,
      notes: debt.notes ?? "",
    });
    setOpen(true);
  }

  function openPayment(debt: Debt) {
    setPaymentError("");
    paymentForm.reset(paymentDefaults);
    setPaymentDebt(debt);
  }

  function closePayment() {
    if (paymentInFlight.current) return;
    setPaymentDebt(null);
    setPaymentError("");
  }

  async function submit(values: FormData) {
    if (!user) return;
    try {
      setError("");
      await saveDebt(user.uid, values, editing?.id);
      setOpen(false);
      await data.refresh();
    } catch (err) {
      setError(toUserMessage(err));
    }
  }

  async function remove(id: string) {
    if (!user || !window.confirm("Delete this debt?")) return;
    try {
      await deleteDebt(user.uid, id);
      await data.refresh();
    } catch (err) {
      setError(toUserMessage(err));
    }
  }

  async function submitPayment(values: PaymentFormData) {
    if (!user || !paymentDebt || paymentInFlight.current) return;

    const paymentMinorUnits = Math.round(values.amount * 100);
    const balanceMinorUnits = Math.round(paymentDebt.balance * 100);
    if (balanceMinorUnits === 0) {
      paymentForm.setError("amount", {
        message: "A payment cannot be made against a zero-balance debt",
      });
      return;
    }
    if (paymentMinorUnits > balanceMinorUnits) {
      paymentForm.setError("amount", {
        message: "Payment amount cannot exceed the current debt balance",
      });
      return;
    }

    paymentInFlight.current = true;
    setPaymentProcessing(true);
    setPaymentError("");
    try {
      await makeDebtPayment(user.uid, paymentDebt.id, values);
      setPaymentDebt(null);
      await data.refresh();
    } catch (err) {
      setPaymentError(toUserMessage(err));
    } finally {
      paymentInFlight.current = false;
      setPaymentProcessing(false);
    }
  }

  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="h4" fontWeight={900}>Debts</Typography>
          <Typography color="text.secondary">
            Track INR, CAD, USD and other balances separately.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddRounded />} onClick={newDebt}>
          Add debt
        </Button>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      <Grid container spacing={2}>
        {data.debts.map((debt) => (
          <Grid key={debt.id} size={{ xs: 12, sm: 6, lg: 4 }}>
            <Card>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" gap={1}>
                  <Box>
                    <Typography variant="h6" fontWeight={800}>{debt.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {debt.group} · {debt.category} · {debt.kind.replace("_", " ")}
                    </Typography>
                  </Box>
                  <Stack direction="row">
                    <IconButton onClick={() => edit(debt)}><EditRounded /></IconButton>
                    <IconButton onClick={() => void remove(debt.id)}><DeleteRounded /></IconButton>
                  </Stack>
                </Stack>
                <Typography variant="h5" fontWeight={900} sx={{ mt: 2 }}>
                  {formatMoney(debt.balance, debt.currency)}
                </Typography>
                {debt.notes && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {debt.notes}
                  </Typography>
                )}
                <Button
                  variant="outlined"
                  startIcon={<PaymentsRounded />}
                  disabled={Math.round(debt.balance * 100) <= 0}
                  onClick={() => openPayment(debt)}
                  sx={{ mt: 2 }}
                >
                  Make payment
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? "Edit debt" : "Add debt"}</DialogTitle>
        <Box component="form" onSubmit={form.handleSubmit(submit)}>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Controller name="name" control={form.control} render={({ field, fieldState }) => (
                <TextField {...field} label="Name" error={!!fieldState.error} helperText={fieldState.error?.message} />
              )} />
              <Controller name="group" control={form.control} render={({ field }) => (
                <TextField {...field} select label="Group">
                  <MenuItem value="primary">primary</MenuItem>
                  <MenuItem value="secondary">secondary</MenuItem>
                </TextField>
              )} />
              <Controller name="category" control={form.control} render={({ field, fieldState }) => (
                <TextField {...field} label="Category" error={!!fieldState.error} helperText={fieldState.error?.message} />
              )} />
              <Controller name="kind" control={form.control} render={({ field }) => (
                <TextField {...field} select label="Debt type">
                  <MenuItem value="credit_card">Credit card</MenuItem>
                  <MenuItem value="loan">Loan</MenuItem>
                  <MenuItem value="misc">Miscellaneous</MenuItem>
                </TextField>
              )} />
              <Stack direction="row" spacing={2}>
                <Controller name="balance" control={form.control} render={({ field, fieldState }) => (
                  <TextField {...field} fullWidth type="number" inputProps={{ step: "0.01", min: "0" }} label="Balance" error={!!fieldState.error} helperText={fieldState.error?.message} />
                )} />
                <Controller name="currency" control={form.control} render={({ field }) => (
                  <TextField {...field} select fullWidth label="Currency">
                    {CURRENCIES.map((currency) => <MenuItem key={currency} value={currency}>{currency}</MenuItem>)}
                  </TextField>
                )} />
              </Stack>
              <Controller name="notes" control={form.control} render={({ field }) => (
                <TextField {...field} label="Notes" multiline minRows={2} />
              )} />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">Save</Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={paymentDebt !== null} onClose={closePayment} fullWidth maxWidth="sm">
        <DialogTitle>Make debt payment</DialogTitle>
        <Box component="form" onSubmit={paymentForm.handleSubmit(submitPayment)}>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              {paymentError && <Alert severity="error">{paymentError}</Alert>}
              <TextField
                label="Debt"
                value={paymentDebt?.name ?? ""}
                slotProps={{ input: { readOnly: true } }}
              />
              <TextField
                label="Current balance"
                value={paymentDebt ? formatMoney(paymentDebt.balance, paymentDebt.currency) : ""}
                slotProps={{ input: { readOnly: true } }}
              />
              <Controller name="amount" control={paymentForm.control} render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  type="number"
                  label={`Payment amount (${paymentDebt?.currency ?? ""})`}
                  inputProps={{ step: "0.01", min: "0.01" }}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )} />
              <Controller name="date" control={paymentForm.control} render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  type="date"
                  label="Payment date"
                  slotProps={{ inputLabel: { shrink: true } }}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )} />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={closePayment} disabled={paymentProcessing}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={paymentProcessing}
            >
              {paymentProcessing ? "Processing…" : "Make payment"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Stack>
  );
}
