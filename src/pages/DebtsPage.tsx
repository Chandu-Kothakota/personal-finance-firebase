import { zodResolver } from "@hookform/resolvers/zod";
import { AddOutlined, DeleteOutline, EditOutlined, SearchOutlined } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { visuallyHidden } from "@mui/utils";
import { useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { LoadingScreen } from "../components/LoadingScreen";
import { EmptyState, PageHeader, Panel, StatCard, StatusBadge, labelOf } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useFinanceData } from "../hooks/useFinanceData";
import { CURRENCIES, formatMoney } from "../lib/currency";
import { toUserMessage } from "../lib/errors";
import { deleteDebt, makeDebtPayment, saveDebt } from "../services/apiService";
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

const debtKindLabel: Record<DebtKind, string> = {
  credit_card: "Credit card",
  loan: "Loan",
  misc: "Other",
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
      debtKindLabel[debt.kind],
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
      await saveDebt(values, editing?.id);
      setOpen(false);
      await data.refresh();
    } catch (err) {
      setError(toUserMessage(err));
    }
  }

  async function remove(id: string) {
    if (!user || !window.confirm("Delete this debt?")) return;
    try {
      await deleteDebt(id);
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
      await makeDebtPayment(paymentDebt.id, values);
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
    <Box>
      <PageHeader
        title="Debts"
        description="Outstanding balances across cards, loans and other accounts."
        actions={
          <Button variant="contained" startIcon={<AddOutlined />} onClick={newDebt}>
            New debt account
          </Button>
        }
      />

      <Stack spacing={2}>
        {error && <Alert severity="error">{error}</Alert>}
        {data.error && <Alert severity="error">{data.error}</Alert>}

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <StatCard label="Total outstanding" value={formatMoney(data.summary.debtBalances, base)} caption={`Converted to ${base}`} />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <StatCard label="Open accounts" value={String(outstandingDebts.length)} caption="With a balance due" />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <StatCard label="Paid off" value={String(paidDebts.length)} caption="Zero balance" />
          </Grid>
        </Grid>

        <Panel flush>
          <Stack direction={{ xs: "column", md: "row" }} gap={1.5} sx={{ p: 2 }}>
            <TextField
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search account, category or currency"
              aria-label="Search debts"
              sx={{ flex: 1 }}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchOutlined fontSize="small" /></InputAdornment> } }}
            />
            <TextField select label="Group" value={groupFilter} onChange={(event) => setGroupFilter(event.target.value as GroupFilter)} sx={{ minWidth: 140 }}>
              <MenuItem value="all">All groups</MenuItem>
              <MenuItem value="primary">Primary</MenuItem>
              <MenuItem value="secondary">Secondary</MenuItem>
            </TextField>
            <TextField select label="Status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} sx={{ minWidth: 150 }}>
              <MenuItem value="all">All statuses</MenuItem>
              <MenuItem value="outstanding">Outstanding</MenuItem>
              <MenuItem value="paid">Paid off</MenuItem>
            </TextField>
          </Stack>
          <Divider />

          {filteredDebts.length === 0 ? (
            <EmptyState
              title={data.debts.length === 0 ? "No debt accounts yet" : "No matching accounts"}
              message={
                data.debts.length === 0
                  ? "Add a credit card, loan or other balance to start tracking it."
                  : "Try a different search term or clear the filters."
              }
              action={data.debts.length === 0 ? <Button startIcon={<AddOutlined />} onClick={newDebt}>New debt account</Button> : undefined}
            />
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Account</TableCell>
                    <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>Type</TableCell>
                    <TableCell sx={{ display: { xs: "none", lg: "table-cell" } }}>Group</TableCell>
                    <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Status</TableCell>
                    <TableCell align="right">Balance</TableCell>
                    <TableCell align="right"><Box component="span" sx={visuallyHidden}>Actions</Box></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredDebts.map((debt) => {
                    const paid = isPaid(debt);
                    return (
                      <TableRow key={debt.id} hover>
                        <TableCell sx={{ maxWidth: { xs: 100, sm: 320 }, pr: { xs: 1, sm: 2 } }}>
                          <Typography variant="body2" fontWeight={500} noWrap>{debt.name}</Typography>
                          <Typography variant="caption" color="text.secondary" noWrap component="p">
                            {debt.notes ? `${debt.category} · ${debt.notes}` : debt.category}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ display: { xs: "none", md: "table-cell" }, color: "text.secondary" }}>{debtKindLabel[debt.kind]}</TableCell>
                        <TableCell sx={{ display: { xs: "none", lg: "table-cell" }, color: "text.secondary" }}>{labelOf(debt.group)}</TableCell>
                        <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>
                          <StatusBadge label={paid ? "Paid off" : "Outstanding"} status={paid ? "positive" : "warning"} />
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", px: { xs: 1, sm: 2 } }}>
                          {formatMoney(debt.balance, debt.currency)}
                        </TableCell>
                        <TableCell align="right" sx={{ whiteSpace: "nowrap", py: 0.5, pl: { xs: 0.5, sm: 2 }, pr: { xs: 1, sm: 2 } }}>
                          <Button size="small" variant="outlined" disabled={paid} onClick={() => openPayment(debt)} sx={{ mr: 0.5, minWidth: 0, px: { xs: 1.25, sm: 1.75 } }}>
                            Pay
                          </Button>
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => edit(debt)} aria-label={`Edit ${debt.name}`}><EditOutlined fontSize="small" /></IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton size="small" onClick={() => void remove(debt.id)} aria-label={`Delete ${debt.name}`}><DeleteOutline fontSize="small" /></IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Panel>
      </Stack>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? "Edit debt account" : "New debt account"}</DialogTitle>
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
        <DialogTitle>Record payment</DialogTitle>
        <Box component="form" onSubmit={paymentForm.handleSubmit(submitPayment)}>
          <DialogContent dividers>
            <Stack spacing={2.2} sx={{ mt: 0.25 }}>
              {paymentError && <Alert severity="error">{paymentError}</Alert>}
              <Box sx={{ p: 2, borderRadius: 1, bgcolor: "background.default", border: 1, borderColor: "divider" }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
                  <Box>
                    <Typography variant="overline" color="text.secondary" component="p">Paying</Typography>
                    <Typography variant="h6" sx={{ mt: 0.35 }}>{paymentDebt?.name}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>{paymentDebt?.category}</Typography>
                  </Box>
                  {paymentDebt && <StatusBadge label={paymentDebt.currency} status="neutral" />}
                </Stack>
                <Divider sx={{ my: 1.7 }} />
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">Current balance</Typography>
                  <Typography fontWeight={600} sx={{ fontVariantNumeric: "tabular-nums" }}>
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
    </Box>
  );
}
