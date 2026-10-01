import { AddOutlined, DeleteOutline, DownloadOutlined, EditOutlined, SearchOutlined } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
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
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { visuallyHidden } from "@mui/utils";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { LoadingScreen } from "../components/LoadingScreen";
import { TransactionDialog } from "../components/TransactionDialog";
import { Amount, EmptyState, PageHeader, Panel, StatCard, StatusBadge, labelOf } from "../components/ui";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useFeedback } from "../hooks/useFeedback";
import { useFinanceData } from "../hooks/useFinanceData";
import { downloadCsv } from "../lib/csv";
import { convertToBase, formatDate, formatMoney } from "../lib/currency";
import { PERIODS, inPeriod, todayIso, type Period } from "../lib/dates";
import { toUserMessage } from "../lib/errors";
import { deleteEntry } from "../services/apiService";
import type { LedgerEntry } from "../types";

type TypeFilter = "all" | LedgerEntry["type"];
type GroupFilter = "all" | LedgerEntry["group"];
type SortKey = "date" | "amount";

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

const isPeriod = (v: string | null): v is Period => PERIODS.some((p) => p.value === v);
const isType = (v: string | null): v is TypeFilter => v === "all" || v === "credit" || v === "debit";

export function TransactionsPage() {
  useDocumentTitle("Transactions");
  const data = useFinanceData();
  const { notify, confirm } = useFeedback();
  const [params, setParams] = useSearchParams();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LedgerEntry | null>(null);
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<Period>(() => {
    const p = params.get("period");
    return isPeriod(p) ? p : "all";
  });
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(() => {
    const t = params.get("type");
    return isType(t) ? t : "all";
  });
  const [groupFilter, setGroupFilter] = useState<GroupFilter>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "date", dir: "desc" });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const fx = data.fx;
  const base = data.settings.baseCurrency;
  const normalizedSearch = search.trim().toLowerCase();

  const filtered = useMemo(() => {
    const toBase = (e: LedgerEntry) => (fx ? convertToBase(e.amount, e.currency, fx) : e.amount);
    const rows = data.entries.filter((item) => {
      if (typeFilter !== "all" && item.type !== typeFilter) return false;
      if (groupFilter !== "all" && item.group !== groupFilter) return false;
      if (!inPeriod(item.date, period)) return false;
      if (!normalizedSearch) return true;
      return [item.description, item.category, item.currency, sourceLabel(item), String(item.amount)]
        .some((value) => value.toLowerCase().includes(normalizedSearch));
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    return rows.sort((a, b) =>
      sort.key === "date"
        ? dir * (a.date.localeCompare(b.date) || String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? "")))
        : dir * (toBase(a) - toBase(b)),
    );
  }, [data.entries, typeFilter, groupFilter, period, normalizedSearch, sort, fx]);

  const totals = useMemo(
    () =>
      filtered.reduce(
        (acc, e) => {
          const v = fx ? convertToBase(e.amount, e.currency, fx) : e.amount;
          if (e.type === "credit") acc.income += v;
          else acc.expenses += v;
          return acc;
        },
        { income: 0, expenses: 0 },
      ),
    [filtered, fx],
  );

  const filtersActive = normalizedSearch !== "" || typeFilter !== "all" || groupFilter !== "all" || period !== "all";
  const lastPage = Math.max(0, Math.ceil(filtered.length / rowsPerPage) - 1);
  const currentPage = Math.min(page, lastPage);
  const pageRows = filtered.slice(currentPage * rowsPerPage, currentPage * rowsPerPage + rowsPerPage);
  const periodLabel = PERIODS.find((p) => p.value === period)!.label.toLowerCase();

  // Keep period/type in the URL so links from the Overview and page refreshes keep them.
  function setUrlParam(key: "period" | "type", value: string) {
    const next = new URLSearchParams(params);
    if (value === "all") next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  }

  function clearFilters() {
    setSearch("");
    setPeriod("all");
    setTypeFilter("all");
    setGroupFilter("all");
    setPage(0);
    setParams({}, { replace: true });
  }

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));
  }

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(item: LedgerEntry) {
    if (item.source === "debt_payment") {
      notify("Debt payments are managed from the Debts page.", "info");
      return;
    }
    setEditing(item);
    setDialogOpen(true);
  }

  async function remove(item: LedgerEntry) {
    const ok = await confirm({
      title: "Delete this transaction?",
      message: `“${item.description}” (${formatMoney(item.amount, item.currency)} on ${formatDate(item.date)}) will be permanently removed.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteEntry(item.id);
      notify("Transaction deleted");
      await data.refresh();
    } catch (err) {
      notify(toUserMessage(err), "error");
    }
  }

  function exportCsv() {
    downloadCsv(`transactions-${todayIso()}.csv`, [
      ["Date", "Type", "Description", "Category", "Group", "Source", "Amount", "Currency"],
      ...filtered.map((e) => [
        e.date,
        e.type === "credit" ? "Income" : "Expense",
        e.description,
        e.category,
        labelOf(e.group),
        sourceLabel(e),
        e.type === "credit" ? e.amount : -e.amount,
        e.currency,
      ]),
    ]);
    notify(`Exported ${filtered.length} transaction${filtered.length === 1 ? "" : "s"}`);
  }

  if (data.loading) return <LoadingScreen label="Loading transactions…" />;

  const net = totals.income - totals.expenses;
  const scope = filtersActive ? "Matching filters" : "All time";

  return (
    <Box>
      <PageHeader
        title="Transactions"
        description="Every credit, expense, salary deposit and debt payment. Click a row to edit it."
        actions={
          <>
            <Button variant="outlined" startIcon={<DownloadOutlined />} onClick={exportCsv} disabled={filtered.length === 0}>
              Export CSV
            </Button>
          </>
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
            <StatCard label="Income" value={formatMoney(totals.income, base)} caption={scope} />
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <StatCard label="Expenses" value={formatMoney(totals.expenses, base)} caption={scope} />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <StatCard
              label="Net"
              value={formatMoney(net, base)}
              tone={net < 0 ? "negative" : "default"}
              caption={`${filtered.length} transaction${filtered.length === 1 ? "" : "s"}`}
            />
          </Grid>
        </Grid>

        <Panel flush>
          <Stack direction={{ xs: "column", md: "row" }} gap={1.5} sx={{ p: 2 }} alignItems={{ md: "center" }}>
            <TextField
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(0); }}
              placeholder="Search description, category or amount"
              aria-label="Search transactions"
              sx={{ flex: 1, minWidth: { md: 220 } }}
              slotProps={{
                input: {
                  startAdornment: <InputAdornment position="start"><SearchOutlined fontSize="small" /></InputAdornment>,
                },
              }}
            />
            <ToggleButtonGroup
              exclusive
              size="small"
              value={typeFilter}
              onChange={(_, v: TypeFilter | null) => {
                if (!v) return;
                setTypeFilter(v);
                setPage(0);
                setUrlParam("type", v);
              }}
              aria-label="Filter by type"
              sx={{ "& .MuiToggleButton-root": { textTransform: "none", px: 1.5, py: 0.6, flex: { xs: 1, md: "none" } } }}
            >
              <ToggleButton value="all">All</ToggleButton>
              <ToggleButton value="credit">Income</ToggleButton>
              <ToggleButton value="debit">Expenses</ToggleButton>
            </ToggleButtonGroup>
            <Stack direction="row" gap={1.5}>
              <TextField
                select
                label="Period"
                value={period}
                onChange={(e) => {
                  const v = e.target.value as Period;
                  setPeriod(v);
                  setPage(0);
                  setUrlParam("period", v);
                }}
                sx={{ minWidth: 150, flex: 1 }}
              >
                {PERIODS.map((p) => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
              </TextField>
              <TextField
                select
                label="Group"
                value={groupFilter}
                onChange={(e) => { setGroupFilter(e.target.value as GroupFilter); setPage(0); }}
                sx={{ minWidth: 130, flex: 1 }}
              >
                <MenuItem value="all">All groups</MenuItem>
                <MenuItem value="primary">Primary</MenuItem>
                <MenuItem value="secondary">Secondary</MenuItem>
              </TextField>
            </Stack>
            {filtersActive && (
              <Button size="small" onClick={clearFilters} sx={{ whiteSpace: "nowrap", alignSelf: { xs: "flex-start", md: "center" } }}>
                Clear filters
              </Button>
            )}
          </Stack>
          <Divider />

          {filtered.length === 0 ? (
            <EmptyState
              title={data.entries.length === 0 ? "No transactions yet" : "Nothing matches these filters"}
              message={
                data.entries.length === 0
                  ? "Record your first income or expense to start building your history. Tip: press N anywhere."
                  : `No transactions for ${periodLabel}${normalizedSearch ? ` matching “${search.trim()}”` : ""}.`
              }
              action={
                data.entries.length === 0
                  ? <Button variant="outlined" startIcon={<AddOutlined />} onClick={openNew}>New transaction</Button>
                  : <Button variant="outlined" onClick={clearFilters}>Clear filters</Button>
              }
            />
          ) : (
            <>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }} sortDirection={sort.key === "date" ? sort.dir : false}>
                        <TableSortLabel active={sort.key === "date"} direction={sort.key === "date" ? sort.dir : "desc"} onClick={() => toggleSort("date")}>
                          Date
                        </TableSortLabel>
                      </TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>Category</TableCell>
                      <TableCell sx={{ display: { xs: "none", lg: "table-cell" } }}>Group</TableCell>
                      <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Source</TableCell>
                      <TableCell align="right" sortDirection={sort.key === "amount" ? sort.dir : false}>
                        <TableSortLabel active={sort.key === "amount"} direction={sort.key === "amount" ? sort.dir : "desc"} onClick={() => toggleSort("amount")}>
                          Amount
                        </TableSortLabel>
                      </TableCell>
                      <TableCell align="right" sx={{ width: 88 }}><Box component="span" sx={visuallyHidden}>Actions</Box></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pageRows.map((item) => {
                      const isDebtPayment = item.source === "debt_payment";
                      return (
                        <TableRow key={item.id} hover onClick={() => openEdit(item)} sx={{ cursor: isDebtPayment ? "default" : "pointer" }}>
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
                          <TableCell align="right" sx={{ whiteSpace: "nowrap", py: 0.5 }} onClick={(e) => e.stopPropagation()}>
                            <Tooltip title={isDebtPayment ? "Managed from the Debts page" : "Edit"}>
                              <span>
                                <IconButton onClick={() => openEdit(item)} aria-label={`Edit ${item.description}`} disabled={isDebtPayment} size="small">
                                  <EditOutlined fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title={isDebtPayment ? "Managed from the Debts page" : "Delete"}>
                              <span>
                                <IconButton onClick={() => void remove(item)} aria-label={`Delete ${item.description}`} disabled={isDebtPayment} size="small">
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
              {filtered.length > 25 && (
                <TablePagination
                  component="div"
                  count={filtered.length}
                  page={currentPage}
                  onPageChange={(_, p) => setPage(p)}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0); }}
                  rowsPerPageOptions={[25, 50, 100]}
                  sx={{ borderTop: 1, borderColor: "divider" }}
                />
              )}
            </>
          )}
        </Panel>
      </Stack>

      <TransactionDialog open={dialogOpen} entry={editing} onClose={() => setDialogOpen(false)} />
    </Box>
  );
}
