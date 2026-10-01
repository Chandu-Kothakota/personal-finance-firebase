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
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { LoadingScreen } from "../components/LoadingScreen";
import { Amount, EmptyState, PageHeader, Panel, StatCard, StatusBadge, labelOf } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useFinanceData } from "../hooks/useFinanceData";
import { CURRENCIES, formatDate, formatMoney } from "../lib/currency";
import { toUserMessage } from "../lib/errors";
import { deleteEntry, saveEntry } from "../services/apiService";
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
  if (item.source === "salary") return "Salary";
  if (item.source === "debt_payment") return "Debt payment";
  return "Manual";
}

function sourceStatus(item: LedgerEntry) {
  if (item.source === "salary") return "positive" as const;
  if (item.source === "debt_payment") return "info" as const;
  return "neutral" as const;
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
      await deleteEntry(item.id);
      await data.refresh();
    } catch (err) {
      setError(toUserMessage(err));
    }
  }

  if (data.loading) return <LoadingScreen label="Loading transactions…" />;

  const base = data.settings.baseCurrency;
  const filtersActive = normalizedSearch !== "" || typeFilter !== "all" || groupFilter !== "all";

  return (
    <Box>
      <PageHeader
        title="Transactions"
        description="Every credit, expense, salary deposit and debt payment."
        actions={
          <Button variant="contained" startIcon={<AddOutlined />} onClick={addNew}>
            New transaction
          </Button>
        }
      />

      <Stack spacing={2}>
        {error && <Alert severity="error">{error}</Alert>}
        {data.error && <Alert severity="error">{data.error}</Alert>}

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <StatCard label="Total income" value={formatMoney(data.summary.credits, base)} caption="All recorded credits" />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <StatCard label="Total expenses" value={formatMoney(data.summary.expenseDebits, base)} caption="Expenses and debt payments" />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <StatCard label="Records" value={data.entries.length.toLocaleString()} caption={`Totals shown in ${base}`} />
          </Grid>
        </Grid>

        <Panel flush>
          <Stack direction={{ xs: "column", md: "row" }} gap={1.5} sx={{ p: 2 }}>
            <TextField
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search description, category or currency"
              aria-label="Search transactions"
              sx={{ flex: 1 }}
              slotProps={{
                input: {
                  startAdornment: <InputAdornment position="start"><SearchOutlined fontSize="small" /></InputAdornment>,
                },
              }}
            />
            <TextField select label="Type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as TypeFilter)} sx={{ minWidth: 140 }}>
              <MenuItem value="all">All types</MenuItem>
              <MenuItem value="credit">Credits</MenuItem>
              <MenuItem value="debit">Debits</MenuItem>
            </TextField>
            <TextField select label="Group" value={groupFilter} onChange={(event) => setGroupFilter(event.target.value as GroupFilter)} sx={{ minWidth: 140 }}>
              <MenuItem value="all">All groups</MenuItem>
              <MenuItem value="primary">Primary</MenuItem>
              <MenuItem value="secondary">Secondary</MenuItem>
            </TextField>
          </Stack>
          <Divider />

          {filteredEntries.length === 0 ? (
            <EmptyState
              title={data.entries.length === 0 ? "No transactions yet" : "No matching transactions"}
              message={
                data.entries.length === 0
                  ? "Record your first credit or debit to start building your history."
                  : "Try a different search term or clear the filters."
              }
              action={data.entries.length === 0 ? <Button startIcon={<AddOutlined />} onClick={addNew}>New transaction</Button> : undefined}
            />
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Date</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>Category</TableCell>
                    <TableCell sx={{ display: { xs: "none", lg: "table-cell" } }}>Group</TableCell>
                    <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Source</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell align="right" sx={{ width: 88 }}><Box component="span" sx={visuallyHidden}>Actions</Box></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredEntries.map((item) => {
                    const isDebtPayment = item.source === "debt_payment";
                    return (
                      <TableRow key={item.id} hover>
                        <TableCell sx={{ display: { xs: "none", sm: "table-cell" }, whiteSpace: "nowrap", color: "text.secondary" }}>{formatDate(item.date)}</TableCell>
                        <TableCell sx={{ maxWidth: { xs: 150, sm: 320 } }}>
                          <Typography variant="body2" noWrap>{item.description}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: { sm: "none" } }}>{formatDate(item.date)}</Typography>
                        </TableCell>
                        <TableCell sx={{ display: { xs: "none", md: "table-cell" }, color: "text.secondary" }}>{item.category}</TableCell>
                        <TableCell sx={{ display: { xs: "none", lg: "table-cell" }, color: "text.secondary" }}>{labelOf(item.group)}</TableCell>
                        <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>
                          <StatusBadge label={sourceLabel(item)} status={sourceStatus(item)} />
                        </TableCell>
                        <TableCell align="right">
                          <Amount value={formatMoney(item.amount, item.currency)} positive={item.type === "credit"} />
                        </TableCell>
                        <TableCell align="right" sx={{ whiteSpace: "nowrap", py: 0.5 }}>
                          <Tooltip title={isDebtPayment ? "Debt payments can't be edited here" : "Edit"}>
                            <span>
                              <IconButton onClick={() => edit(item)} aria-label="Edit transaction" disabled={isDebtPayment} size="small">
                                <EditOutlined fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title={isDebtPayment ? "Debt payments can't be deleted here" : "Delete"}>
                            <span>
                              <IconButton onClick={() => void remove(item)} aria-label="Delete transaction" disabled={isDebtPayment} size="small">
                                <DeleteOutline fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          {filtersActive && filteredEntries.length > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", px: 2, py: 1.25, borderTop: 1, borderColor: "divider" }}>
              Showing {filteredEntries.length} of {data.entries.length} records
            </Typography>
          )}
        </Panel>
      </Stack>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? "Edit transaction" : "New transaction"}</DialogTitle>
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
    </Box>
  );
}
