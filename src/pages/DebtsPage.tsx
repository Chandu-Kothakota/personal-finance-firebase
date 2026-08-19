import { zodResolver } from "@hookform/resolvers/zod";
import {
  AccountBalanceRounded,
  AddRounded,
  CheckCircleRounded,
  CreditCardRounded,
  DeleteRounded,
  EditRounded,
  PaymentsRounded,
  ReceiptLongRounded,
  SearchRounded,
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
import { useRef, useState, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { LoadingScreen } from "../components/LoadingScreen";
import { useAuth } from "../context/AuthContext";
import { useFinanceData } from "../hooks/useFinanceData";
import { CURRENCIES, formatMoney } from "../lib/currency";
import { toUserMessage } from "../lib/errors";
import { makeDebtPayment } from "../services/debtService";
import { deleteDebt, saveDebt } from "../services/firestoreService";
import type { Debt, DebtKind, LedgerGroup } from "../types";

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
type GroupFilter = "all" | LedgerGroup;
type StatusFilter = "all" | "outstanding" | "paid";

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

const debtKindDetails: Record<DebtKind, { label: string; icon: ReactNode; color: string; background: string }> = {
  credit_card: { label: "Credit card", icon: <CreditCardRounded />, color: "#7C3AED", background: "#F3EEFF" },
  loan: { label: "Loan", icon: <AccountBalanceRounded />, color: "#2563EB", background: "#EAF1FF" },
  misc: { label: "Other debt", icon: <ReceiptLongRounded />, color: "#D97706", background: "#FFF5E7" },
};

function isPaid(debt: Debt): boolean {
  return Math.round(debt.balance * 100) <= 0;
}

export function DebtsPage() {
  const { user } = useAuth();
  const data = useFinanceData();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Debt | null>(null);
  const [paymentDebt, setPaymentDebt] = useState<Debt | null>(null);
  const [paymentError, setPaymentError] = useState("");
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<GroupFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [error, setError] = useState("");
  const paymentInFlight = useRef(false);

  const form = useForm<FormInput, unknown, FormData>({ resolver: zodResolver(schema), defaultValues: defaults });
  const paymentForm = useForm<PaymentFormInput, unknown, PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: paymentDefaults,
  });

  const normalizedSearch = search.trim().toLowerCase();
  const filteredDebts = data.debts.filter((debt) => {
    const paid = isPaid(debt);
    const matchesGroup = groupFilter === "all" || debt.group === groupFilter;
    const matchesStatus = statusFilter === "all"
      || (statusFilter === "paid" && paid)
      || (statusFilter === "outstanding" && !paid);
    const matchesSearch = normalizedSearch === "" || [
      debt.name,
      debt.category,
      debt.currency,
      debtKindDetails[debt.kind].label,
    ].some((value) => value.toLowerCase().includes(normalizedSearch));

    return matchesGroup && matchesStatus && matchesSearch;
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

  if (data.loading) return <LoadingScreen label="Loading debt portfolio…" />;

  const outstandingDebts = data.debts.filter((debt) => !isPaid(debt));
  const paidDebts = data.debts.filter(isPaid);
  const base = data.settings.baseCurrency;

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} gap={2}>
        <Box>
          <Typography variant="h4">Debt portfolio</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.6 }}>
            Monitor outstanding balances and make payments without losing ledger history.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddRounded />} onClick={newDebt} sx={{ alignSelf: { xs: "flex-start", md: "auto" } }}>
          Add debt
        </Button>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}
      {data.error && <Alert severity="error">{data.error}</Alert>}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card sx={{ height: "100%", border: "1px solid #E6EAF0", background: "linear-gradient(135deg, #E4F5F2 0%, #F3F6F9 65%)" }}>
            <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
                <Box>
                  <Typography variant="overline" sx={{ color: "text.secondary", fontWeight: 800, letterSpacing: ".09em" }}>TOTAL OUTSTANDING</Typography>
                  <Typography variant="h4" sx={{ mt: 0.7, color: "#0B1F33", fontVariantNumeric: "tabular-nums" }}>
                    {formatMoney(data.summary.debtBalances, base)}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1, color: "text.secondary" }}>
                    Consolidated portfolio balance in {base}
                  </Typography>
                </Box>
                <Box sx={{ width: 46, height: 46, borderRadius: 3, display: "grid", placeItems: "center", bgcolor: "rgba(15,118,110,.12)", color: "#0F766E" }}>
                  <AccountBalanceRounded />
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
              <Box sx={{ width: 40, height: 40, borderRadius: 2.5, display: "grid", placeItems: "center", bgcolor: "#FFF5E7", color: "#D97706" }}><PaymentsRounded /></Box>
              <Typography variant="h5" sx={{ mt: 2 }}>{outstandingDebts.length}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>Outstanding account{outstandingDebts.length === 1 ? "" : "s"}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
              <Box sx={{ width: 40, height: 40, borderRadius: 2.5, display: "grid", placeItems: "center", bgcolor: "#EAF8F0", color: "#15803D" }}><CheckCircleRounded /></Box>
              <Typography variant="h5" sx={{ mt: 2 }}>{paidDebts.length}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>Paid-off account{paidDebts.length === 1 ? "" : "s"}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
          <Stack direction={{ xs: "column", lg: "row" }} gap={1.5}>
            <TextField
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search account, category, or currency…"
              aria-label="Search debt portfolio"
              sx={{ flex: 1 }}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> } }}
            />
            <Stack direction={{ xs: "column", sm: "row" }} gap={1.5}>
              <TextField select label="Group" value={groupFilter} onChange={(event) => setGroupFilter(event.target.value as GroupFilter)} sx={{ minWidth: { sm: 150 } }}>
                <MenuItem value="all">All groups</MenuItem>
                <MenuItem value="primary">Primary</MenuItem>
                <MenuItem value="secondary">Secondary</MenuItem>
              </TextField>
              <TextField select label="Status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} sx={{ minWidth: { sm: 165 } }}>
                <MenuItem value="all">All statuses</MenuItem>
                <MenuItem value="outstanding">Outstanding</MenuItem>
                <MenuItem value="paid">Paid off</MenuItem>
              </TextField>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {filteredDebts.length === 0 ? (
        <Card>
          <CardContent>
            <Stack alignItems="center" textAlign="center" sx={{ py: 5 }}>
              <Box sx={{ width: 56, height: 56, borderRadius: 3, display: "grid", placeItems: "center", bgcolor: "#EEF4F8", color: "#475467" }}>
                <CreditCardRounded />
              </Box>
              <Typography variant="h6" sx={{ mt: 2 }}>
                {data.debts.length === 0 ? "No debt accounts yet" : "No matching debt accounts"}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.6, maxWidth: 430 }}>
                {data.debts.length === 0
                  ? "Add a credit card, loan, or other balance to begin tracking your debt portfolio."
                  : "Try a different search term or update the group and status filters."}
              </Typography>
              {data.debts.length === 0 && <Button startIcon={<AddRounded />} onClick={newDebt} sx={{ mt: 2 }}>Add debt</Button>}
            </Stack>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {filteredDebts.map((debt) => {
            const paid = isPaid(debt);
            const kind = debtKindDetails[debt.kind];

            return (
              <Grid key={debt.id} size={{ xs: 12, md: 6, xl: 4 }}>
                <Card sx={{ height: "100%", borderTop: `3px solid ${paid ? "#16A34A" : kind.color}` }}>
                  <CardContent sx={{ p: 2.5, height: "100%", display: "flex", flexDirection: "column", "&:last-child": { pb: 2.5 } }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1.5}>
                      <Stack direction="row" alignItems="center" gap={1.3} sx={{ minWidth: 0 }}>
                        <Box sx={{ width: 42, height: 42, borderRadius: 2.5, display: "grid", placeItems: "center", bgcolor: kind.background, color: kind.color, flexShrink: 0 }}>
                          {kind.icon}
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="h6" noWrap>{debt.name}</Typography>
                          <Typography variant="body2" color="text.secondary">{kind.label}</Typography>
                        </Box>
                      </Stack>
                      <Stack direction="row" flexShrink={0}>
                        <Tooltip title="Edit debt"><IconButton size="small" onClick={() => edit(debt)} aria-label={`Edit ${debt.name}`}><EditRounded fontSize="small" /></IconButton></Tooltip>
                        <Tooltip title="Delete debt"><IconButton size="small" onClick={() => void remove(debt.id)} aria-label={`Delete ${debt.name}`}><DeleteRounded fontSize="small" /></IconButton></Tooltip>
                      </Stack>
                    </Stack>

                    <Stack direction="row" gap={0.8} flexWrap="wrap" sx={{ mt: 2 }}>
                      <Chip size="small" label={debt.group} sx={{ textTransform: "capitalize" }} />
                      <Chip size="small" variant="outlined" label={debt.category} />
                      <Chip size="small" variant="outlined" label={debt.currency} />
                      <Chip size="small" color={paid ? "success" : "warning"} label={paid ? "Paid off" : "Outstanding"} />
                    </Stack>

                    <Box sx={{ mt: 2.4 }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>CURRENT BALANCE</Typography>
                      <Typography variant="h5" sx={{ mt: 0.45, fontVariantNumeric: "tabular-nums" }}>
                        {formatMoney(debt.balance, debt.currency)}
                      </Typography>
                    </Box>

                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1.4, minHeight: 40 }}>
                      {debt.notes || "No notes added for this account."}
                    </Typography>

                    <Divider sx={{ my: 2 }} />
                    <Button
                      fullWidth
                      variant={paid ? "text" : "outlined"}
                      startIcon={paid ? <CheckCircleRounded /> : <PaymentsRounded />}
                      disabled={paid}
                      onClick={() => openPayment(debt)}
                      sx={{ mt: "auto" }}
                    >
                      {paid ? "Paid in full" : "Make payment"}
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? "Edit debt account" : "Add debt account"}</DialogTitle>
        <Box component="form" onSubmit={form.handleSubmit(submit)}>
          <DialogContent dividers>
            <Grid container spacing={2} sx={{ mt: 0.25 }}>
              <Grid size={12}>
                <Controller name="name" control={form.control} render={({ field, fieldState }) => (
                  <TextField {...field} fullWidth label="Account name" error={!!fieldState.error} helperText={fieldState.error?.message} />
                )} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Controller name="group" control={form.control} render={({ field }) => (
                  <TextField {...field} fullWidth select label="Group">
                    <MenuItem value="primary">Primary</MenuItem>
                    <MenuItem value="secondary">Secondary</MenuItem>
                  </TextField>
                )} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Controller name="kind" control={form.control} render={({ field }) => (
                  <TextField {...field} fullWidth select label="Debt type">
                    <MenuItem value="credit_card">Credit card</MenuItem>
                    <MenuItem value="loan">Loan</MenuItem>
                    <MenuItem value="misc">Miscellaneous</MenuItem>
                  </TextField>
                )} />
              </Grid>
              <Grid size={12}>
                <Controller name="category" control={form.control} render={({ field, fieldState }) => (
                  <TextField {...field} fullWidth label="Category" error={!!fieldState.error} helperText={fieldState.error?.message} />
                )} />
              </Grid>
              <Grid size={{ xs: 12, sm: 7 }}>
                <Controller name="balance" control={form.control} render={({ field, fieldState }) => (
                  <TextField {...field} fullWidth type="number" inputProps={{ step: "0.01", min: "0" }} label="Current balance" error={!!fieldState.error} helperText={fieldState.error?.message} />
                )} />
              </Grid>
              <Grid size={{ xs: 12, sm: 5 }}>
                <Controller name="currency" control={form.control} render={({ field }) => (
                  <TextField {...field} fullWidth select label="Currency">
                    {CURRENCIES.map((currency) => <MenuItem key={currency} value={currency}>{currency}</MenuItem>)}
                  </TextField>
                )} />
              </Grid>
              <Grid size={12}>
                <Controller name="notes" control={form.control} render={({ field }) => (
                  <TextField {...field} fullWidth label="Notes" multiline minRows={3} />
                )} />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">{editing ? "Save changes" : "Add debt"}</Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={paymentDebt !== null} onClose={closePayment} fullWidth maxWidth="sm">
        <DialogTitle>Make debt payment</DialogTitle>
        <Box component="form" onSubmit={paymentForm.handleSubmit(submitPayment)}>
          <DialogContent dividers>
            <Stack spacing={2.2} sx={{ mt: 0.25 }}>
              {paymentError && <Alert severity="error">{paymentError}</Alert>}
              <Box sx={{ p: 2.2, borderRadius: 3, bgcolor: "#F8FAFC", border: "1px solid", borderColor: "divider" }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>PAYING</Typography>
                    <Typography variant="h6" sx={{ mt: 0.35 }}>{paymentDebt?.name}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>{paymentDebt?.category}</Typography>
                  </Box>
                  {paymentDebt && <Chip variant="outlined" label={paymentDebt.currency} />}
                </Stack>
                <Divider sx={{ my: 1.7 }} />
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">Current balance</Typography>
                  <Typography fontWeight={850} sx={{ fontVariantNumeric: "tabular-nums" }}>
                    {paymentDebt ? formatMoney(paymentDebt.balance, paymentDebt.currency) : ""}
                  </Typography>
                </Stack>
              </Box>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 7 }}>
                  <Controller name="amount" control={paymentForm.control} render={({ field, fieldState }) => (
                    <TextField {...field} fullWidth type="number" label={`Payment amount (${paymentDebt?.currency ?? ""})`} inputProps={{ step: "0.01", min: "0.01" }} error={!!fieldState.error} helperText={fieldState.error?.message} />
                  )} />
                </Grid>
                <Grid size={{ xs: 12, sm: 5 }}>
                  <Controller name="date" control={paymentForm.control} render={({ field, fieldState }) => (
                    <TextField {...field} fullWidth type="date" label="Payment date" slotProps={{ inputLabel: { shrink: true } }} error={!!fieldState.error} helperText={fieldState.error?.message} />
                  )} />
                </Grid>
              </Grid>
              <Typography variant="body2" color="text.secondary">
                This will reduce the account balance and add a linked debit to Transactions.
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={closePayment} disabled={paymentProcessing}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={paymentProcessing}>
              {paymentProcessing ? "Processing…" : "Confirm payment"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Stack>
  );
}
