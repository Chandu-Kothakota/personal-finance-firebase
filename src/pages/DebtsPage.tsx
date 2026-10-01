import { zodResolver } from "@hookform/resolvers/zod";
import { AddOutlined, DeleteOutline, EditOutlined, SearchOutlined } from "@mui/icons-material";
import {
  Alert,
  Autocomplete,
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
  Link,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { visuallyHidden } from "@mui/utils";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { LoadingScreen } from "../components/LoadingScreen";
import { EmptyState, PageHeader, Panel, StatCard, StatusBadge, labelOf, toggleSx } from "../components/ui";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useFeedback } from "../hooks/useFeedback";
import { useFinanceData } from "../hooks/useFinanceData";
import { useIsMobile } from "../hooks/useIsMobile";
import { CURRENCIES, convertToBase, formatDate, formatMoney } from "../lib/currency";
import { todayIso } from "../lib/dates";
import { toUserMessage } from "../lib/errors";
import { deleteDebt, makeDebtPayment, saveDebt } from "../services/apiService";
import { colors } from "../theme/theme";
import type { Debt, DebtKind, LedgerGroup } from "../types";

const schema = z.object({
  group: z.enum(["primary", "secondary"]),
  name: z.string().trim().min(1, "Give the account a name").max(80, "Keep it under 80 characters"),
  category: z.string().trim().max(60, "Keep it under 60 characters"),
  kind: z.enum(["credit_card", "loan", "misc"]),
  balance: z.coerce.number({ error: "Enter the current balance" }).min(0, "Balance can't be negative"),
  currency: z.enum(CURRENCIES),
  notes: z.string().max(300, "Keep notes under 300 characters").optional(),
});

const paymentSchema = z.object({
  amount: z.coerce
    .number({ error: "Enter an amount" })
    .finite()
    .positive("Payment must be greater than zero")
    .refine((amount) => Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-7, "Use at most two decimal places"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
});

type FormInput = z.input<typeof schema>;
type FormData = z.output<typeof schema>;
type PaymentFormInput = z.input<typeof paymentSchema>;
type PaymentFormData = z.output<typeof paymentSchema>;
type GroupFilter = "all" | LedgerGroup;
type StatusFilter = "all" | "outstanding" | "paid";

const kindLabel: Record<DebtKind, string> = { credit_card: "Credit card", loan: "Loan", misc: "Other" };
const kindDefaultCategory: Record<DebtKind, string> = { credit_card: "Credit Card", loan: "Loan", misc: "Other" };

const emptyDebt: FormInput = { group: "primary", name: "", category: "", kind: "credit_card", balance: "", currency: "USD", notes: "" };

function isPaid(debt: Debt): boolean {
  return Math.round(debt.balance * 100) <= 0;
}

export function DebtsPage() {
  useDocumentTitle("Debts");
  const data = useFinanceData();
  const { notify, confirm } = useFeedback();
  const mobile = useIsMobile();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Debt | null>(null);
  const [formError, setFormError] = useState("");
  const [paymentDebt, setPaymentDebt] = useState<Debt | null>(null);
  const [paymentError, setPaymentError] = useState("");
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<GroupFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const form = useForm<FormInput, unknown, FormData>({ resolver: zodResolver(schema), defaultValues: emptyDebt });
  const paymentForm = useForm<PaymentFormInput, unknown, PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { amount: "", date: todayIso() },
  });
  const paymentAmount = Number(paymentForm.watch("amount")) || 0;

  const fx = data.fx;
  const toBase = (d: Debt) => (fx ? convertToBase(d.balance, d.currency, fx) : d.balance);

  const categoryOptions = useMemo(
    () => [...new Set(["Credit Card", "Loan", "Personal", "Auto", "Student", "Medical", ...data.debts.map((d) => d.category)])].filter(Boolean),
    [data.debts],
  );

  const normalizedSearch = search.trim().toLowerCase();
  const filteredDebts = data.debts
    .filter((debt) => {
      const paid = isPaid(debt);
      if (groupFilter !== "all" && debt.group !== groupFilter) return false;
      if (statusFilter === "paid" && !paid) return false;
      if (statusFilter === "outstanding" && paid) return false;
      if (!normalizedSearch) return true;
      return [debt.name, debt.category, debt.currency, kindLabel[debt.kind], debt.notes ?? ""]
        .some((value) => value.toLowerCase().includes(normalizedSearch));
    })
    // Outstanding first, largest balance first.
    .sort((a, b) => Number(isPaid(a)) - Number(isPaid(b)) || toBase(b) - toBase(a));

  useEffect(() => {
    if (!open) return;
    setFormError("");
    form.reset(
      editing
        ? {
            group: editing.group,
            name: editing.name,
            category: editing.category,
            kind: editing.kind,
            balance: editing.balance,
            currency: editing.currency,
            notes: editing.notes ?? "",
          }
        : { ...emptyDebt, currency: data.settings.baseCurrency },
    );
  }, [open, editing, data.settings.baseCurrency, form]);

  function newDebt() {
    setEditing(null);
    setOpen(true);
  }

  function edit(debt: Debt) {
    setEditing(debt);
    setOpen(true);
  }

  function openPayment(debt: Debt) {
    setPaymentError("");
    paymentForm.reset({ amount: "", date: todayIso() });
    setPaymentDebt(debt);
  }

  async function submit(values: FormData) {
    setFormError("");
    try {
      await saveDebt({ ...values, category: values.category || kindDefaultCategory[values.kind] }, editing?.id);
      setOpen(false);
      notify(editing ? "Debt account updated" : "Debt account added");
      await data.refresh();
    } catch (err) {
      setFormError(toUserMessage(err));
    }
  }

  async function remove(debt: Debt) {
    const ok = await confirm({
      title: `Delete ${debt.name}?`,
      message: "The account will be removed. Payments already recorded stay in your transactions.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteDebt(debt.id);
      notify("Debt account deleted");
      await data.refresh();
    } catch (err) {
      notify(toUserMessage(err), "error");
    }
  }

  async function submitPayment(values: PaymentFormData) {
    if (!paymentDebt) return;
    if (Math.round(values.amount * 100) > Math.round(paymentDebt.balance * 100)) {
      paymentForm.setError("amount", { message: "Payment can't be more than the current balance" });
      return;
    }
    setPaymentError("");
    try {
      await makeDebtPayment(paymentDebt.id, values);
      const paidOff = Math.round(values.amount * 100) === Math.round(paymentDebt.balance * 100);
      notify(paidOff ? `${paymentDebt.name} is now paid off` : `Payment of ${formatMoney(values.amount, paymentDebt.currency)} recorded`);
      setPaymentDebt(null);
      await data.refresh();
    } catch (err) {
      setPaymentError(toUserMessage(err));
    }
  }

  if (data.loading) return <LoadingScreen label="Loading debts…" />;

  const outstandingDebts = data.debts.filter((debt) => !isPaid(debt));
  const paidDebts = data.debts.filter(isPaid);
  const base = data.settings.baseCurrency;
  const largest = [...outstandingDebts].sort((a, b) => toBase(b) - toBase(a))[0];
  const filtersActive = normalizedSearch !== "" || groupFilter !== "all" || statusFilter !== "all";
  const savingDebt = form.formState.isSubmitting;
  const paying = paymentForm.formState.isSubmitting;
  const remaining = paymentDebt ? Math.max(0, paymentDebt.balance - paymentAmount) : 0;

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
        {data.error && (
          <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void data.refresh()}>Retry</Button>}>
            {data.error}
          </Alert>
        )}

        <Grid container spacing={2}>
          <Grid size={{ xs: 6, sm: 4 }}>
            <StatCard label="Total outstanding" value={formatMoney(data.summary.debtBalances, base)} caption={`Converted to ${base}`} />
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <StatCard
              label="Largest balance"
              value={largest ? formatMoney(largest.balance, largest.currency) : "—"}
              caption={largest ? largest.name : "Nothing outstanding"}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <StatCard
              label="Accounts"
              value={`${outstandingDebts.length} open`}
              caption={paidDebts.length > 0 ? `${paidDebts.length} paid off` : "None paid off yet"}
            />
          </Grid>
        </Grid>

        <Panel flush>
          <Stack direction={{ xs: "column", md: "row" }} gap={1.5} sx={{ p: 2 }} alignItems={{ md: "center" }}>
            <TextField
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search account, category, currency or notes"
              aria-label="Search debts"
              sx={{ flex: 1 }}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchOutlined fontSize="small" /></InputAdornment> } }}
            />
            <Stack direction="row" gap={1.5}>
              <TextField select label="Group" value={groupFilter} onChange={(event) => setGroupFilter(event.target.value as GroupFilter)} sx={{ minWidth: 130, flex: 1 }}>
                <MenuItem value="all">All groups</MenuItem>
                <MenuItem value="primary">Primary</MenuItem>
                <MenuItem value="secondary">Secondary</MenuItem>
              </TextField>
              <TextField select label="Status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} sx={{ minWidth: 140, flex: 1 }}>
                <MenuItem value="all">All statuses</MenuItem>
                <MenuItem value="outstanding">Outstanding</MenuItem>
                <MenuItem value="paid">Paid off</MenuItem>
              </TextField>
            </Stack>
            {filtersActive && (
              <Button size="small" onClick={() => { setSearch(""); setGroupFilter("all"); setStatusFilter("all"); }} sx={{ whiteSpace: "nowrap" }}>
                Clear filters
              </Button>
            )}
          </Stack>
          <Divider />

          {filteredDebts.length === 0 ? (
            <EmptyState
              title={data.debts.length === 0 ? "No debt accounts yet" : "No matching accounts"}
              message={
                data.debts.length === 0
                  ? "Add a credit card, loan or other balance to track it and record payments."
                  : "Try a different search term or clear the filters."
              }
              action={data.debts.length === 0 ? <Button variant="outlined" startIcon={<AddOutlined />} onClick={newDebt}>New debt account</Button> : undefined}
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
                      <TableRow key={debt.id} hover onClick={() => edit(debt)} sx={{ cursor: "pointer", ...(paid ? { "& td": { color: "text.secondary" } } : {}) }}>
                        <TableCell sx={{ maxWidth: { xs: 100, sm: 320 }, pr: { xs: 1, sm: 2 } }}>
                          <Typography variant="body2" fontWeight={500} noWrap color={paid ? "text.secondary" : "text.primary"}>{debt.name}</Typography>
                          <Typography variant="caption" color="text.secondary" noWrap component="p">
                            {debt.notes ? `${debt.category} · ${debt.notes}` : debt.category}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ display: { xs: "none", md: "table-cell" }, color: "text.secondary" }}>{kindLabel[debt.kind]}</TableCell>
                        <TableCell sx={{ display: { xs: "none", lg: "table-cell" }, color: "text.secondary" }}>{labelOf(debt.group)}</TableCell>
                        <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>
                          <StatusBadge label={paid ? "Paid off" : "Outstanding"} status={paid ? "positive" : "warning"} />
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", px: { xs: 1, sm: 2 } }}>
                          {formatMoney(debt.balance, debt.currency)}
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{ whiteSpace: "nowrap", py: 0.5, pl: { xs: 0.5, sm: 2 }, pr: { xs: 1, sm: 2 } }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button size="small" variant="outlined" disabled={paid} onClick={() => openPayment(debt)} sx={{ mr: 0.5, minWidth: 0, px: { xs: 1.25, sm: 1.75 } }}>
                            Pay
                          </Button>
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => edit(debt)} aria-label={`Edit ${debt.name}`}><EditOutlined fontSize="small" /></IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton size="small" onClick={() => void remove(debt)} aria-label={`Delete ${debt.name}`}><DeleteOutline fontSize="small" /></IconButton>
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

      <Dialog open={open} onClose={savingDebt ? undefined : () => setOpen(false)} fullWidth maxWidth="sm" fullScreen={mobile}>
        <DialogTitle>{editing ? "Edit debt account" : "New debt account"}</DialogTitle>
        <Box component="form" onSubmit={form.handleSubmit(submit)} noValidate sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <DialogContent dividers>
            {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
            <Grid container spacing={2}>
              <Grid size={12}>
                <Controller name="kind" control={form.control} render={({ field }) => (
                  <ToggleButtonGroup exclusive fullWidth size="small" value={field.value} onChange={(_, v) => v && field.onChange(v)} aria-label="Debt type" sx={toggleSx}>
                    <ToggleButton value="credit_card">Credit card</ToggleButton>
                    <ToggleButton value="loan">Loan</ToggleButton>
                    <ToggleButton value="misc">Other</ToggleButton>
                  </ToggleButtonGroup>
                )} />
              </Grid>
              <Grid size={12}>
                <Controller name="name" control={form.control} render={({ field, fieldState }) => (
                  <TextField {...field} fullWidth autoFocus={!editing} label="Account name" placeholder="e.g. Chase Sapphire" error={!!fieldState.error} helperText={fieldState.error?.message} />
                )} />
              </Grid>
              <Grid size={{ xs: 7, sm: 8 }}>
                <Controller name="balance" control={form.control} render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    value={field.value ?? ""}
                    fullWidth
                    type="number"
                    label="Current balance"
                    placeholder="0.00"
                    slotProps={{ htmlInput: { step: "0.01", min: "0", inputMode: "decimal" } }}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )} />
              </Grid>
              <Grid size={{ xs: 5, sm: 4 }}>
                <Controller name="currency" control={form.control} render={({ field }) => (
                  <TextField {...field} fullWidth select label="Currency">
                    {CURRENCIES.map((currency) => <MenuItem key={currency} value={currency}>{currency}</MenuItem>)}
                  </TextField>
                )} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Controller name="category" control={form.control} render={({ field, fieldState }) => (
                  <Autocomplete
                    freeSolo
                    options={categoryOptions}
                    value={field.value ?? ""}
                    onChange={(_, v) => field.onChange(v ?? "")}
                    onInputChange={(_, v) => field.onChange(v)}
                    renderInput={(params) => (
                      <TextField {...params} label="Category" placeholder="Optional" error={!!fieldState.error} helperText={fieldState.error?.message} onBlur={field.onBlur} />
                    )}
                  />
                )} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Controller name="group" control={form.control} render={({ field }) => (
                  <TextField {...field} fullWidth select label="Account group">
                    <MenuItem value="primary">Primary</MenuItem>
                    <MenuItem value="secondary">Secondary</MenuItem>
                  </TextField>
                )} />
              </Grid>
              <Grid size={12}>
                <Controller name="notes" control={form.control} render={({ field, fieldState }) => (
                  <TextField {...field} fullWidth label="Notes" placeholder="Due date, interest rate, anything useful" multiline minRows={2} error={!!fieldState.error} helperText={fieldState.error?.message} />
                )} />
              </Grid>
            </Grid>
            {editing && (
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 2 }}>
                To record a payment, use <strong>Pay</strong> instead of lowering the balance here, so it also appears in your transactions.
              </Typography>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setOpen(false)} color="inherit" disabled={savingDebt}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={savingDebt}>
              {savingDebt ? "Saving…" : editing ? "Save changes" : "Add debt account"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={paymentDebt !== null} onClose={paying ? undefined : () => setPaymentDebt(null)} fullWidth maxWidth="xs" fullScreen={mobile}>
        <DialogTitle>Record a payment</DialogTitle>
        <Box component="form" onSubmit={paymentForm.handleSubmit(submitPayment)} noValidate sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <DialogContent dividers>
            <Stack spacing={2}>
              {paymentError && <Alert severity="error">{paymentError}</Alert>}
              <Box sx={{ p: 2, borderRadius: 1, bgcolor: "background.default", border: 1, borderColor: "divider" }}>
                <Typography variant="body2" fontWeight={600}>{paymentDebt?.name}</Typography>
                <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
                  <Typography variant="body2" color="text.secondary">Current balance</Typography>
                  <Typography variant="body2" fontWeight={600} sx={{ fontVariantNumeric: "tabular-nums" }}>
                    {paymentDebt ? formatMoney(paymentDebt.balance, paymentDebt.currency) : ""}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">After this payment</Typography>
                  <Typography
                    variant="body2"
                    fontWeight={600}
                    sx={{ fontVariantNumeric: "tabular-nums", color: paymentDebt && paymentAmount > paymentDebt.balance ? colors.negative : remaining === 0 && paymentAmount > 0 ? colors.positive : "text.primary" }}
                  >
                    {paymentDebt ? (paymentAmount > paymentDebt.balance ? "More than owed" : formatMoney(remaining, paymentDebt.currency)) : ""}
                  </Typography>
                </Stack>
              </Box>
              <Controller name="amount" control={paymentForm.control} render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  value={field.value ?? ""}
                  fullWidth
                  autoFocus
                  type="number"
                  label={`Payment amount (${paymentDebt?.currency ?? ""})`}
                  placeholder="0.00"
                  slotProps={{ htmlInput: { step: "0.01", min: "0.01", inputMode: "decimal" } }}
                  error={!!fieldState.error}
                  helperText={
                    fieldState.error?.message ?? (
                      paymentDebt && (
                        <Link
                          component="button"
                          type="button"
                          underline="hover"
                          onClick={() => paymentForm.setValue("amount", paymentDebt.balance, { shouldValidate: true })}
                          sx={{ fontSize: "inherit" }}
                        >
                          Pay full balance ({formatMoney(paymentDebt.balance, paymentDebt.currency)})
                        </Link>
                      )
                    )
                  }
                />
              )} />
              <Controller name="date" control={paymentForm.control} render={({ field, fieldState }) => (
                <TextField {...field} fullWidth type="date" label="Payment date" slotProps={{ inputLabel: { shrink: true } }} error={!!fieldState.error} helperText={fieldState.error?.message} />
              )} />
              <Typography variant="caption" color="text.secondary">
                The balance goes down and a matching expense is added to Transactions
                {paymentForm.watch("date") ? ` on ${formatDate(paymentForm.watch("date"))}` : ""}.
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setPaymentDebt(null)} color="inherit" disabled={paying}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={paying}>
              {paying ? "Recording…" : "Record payment"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
