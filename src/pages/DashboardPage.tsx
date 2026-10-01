import { ChevronRightOutlined } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Grid,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { LoadingScreen } from "../components/LoadingScreen";
import { Amount, EmptyState, PageHeader, Panel, StatCard, labelOf, trendBetween } from "../components/ui";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useFinanceData } from "../hooks/useFinanceData";
import { convertToBase, formatDate, formatMoney } from "../lib/currency";
import { greeting, monthKey, monthKeyFromNow, monthLabel, nextPayDate, relativeDays, toIsoDate } from "../lib/dates";
import { colors } from "../theme/theme";
import type { CurrencyCode } from "../types";

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ py: 1.1 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 500, color: color ?? "text.primary", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </Typography>
    </Stack>
  );
}

function GroupSummary({
  title,
  credits,
  outstanding,
  debts,
  base,
}: {
  title: string;
  credits: number;
  outstanding: number;
  debts: number;
  base: CurrencyCode;
}) {
  const total = credits + debts;
  const share = total > 0 ? (debts / total) * 100 : 0;

  return (
    <Panel title={`${title} accounts`}>
      <Typography variant="overline" color="text.secondary" component="p">Cash balance</Typography>
      <Typography
        sx={{ fontSize: "1.75rem", fontWeight: 600, fontVariantNumeric: "tabular-nums", color: outstanding >= 0 ? colors.text : colors.negative }}
      >
        {formatMoney(outstanding, base)}
      </Typography>

      <Box sx={{ mt: 1.5, borderTop: 1, borderColor: "divider" }}>
        <Row label="Total income" value={formatMoney(credits, base)} />
        <Box sx={{ borderTop: 1, borderColor: "divider" }}>
          <Row label="Outstanding debt" value={formatMoney(debts, base)} color={debts > 0 ? colors.warning : undefined} />
        </Box>
      </Box>

      <Box sx={{ mt: 1.5 }}>
        <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.75 }}>
          <Typography variant="caption" color="text.secondary">Debt share of income + debt</Typography>
          <Typography variant="caption" fontWeight={600}>{share.toFixed(0)}%</Typography>
        </Stack>
        <Box
          role="meter"
          aria-valuenow={Math.round(share)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${title} debt share`}
          sx={{ height: 6, borderRadius: 3, bgcolor: "#E8ECF1", overflow: "hidden" }}
        >
          <Box sx={{ width: `${share}%`, height: "100%", bgcolor: colors.seriesLiability, borderRadius: 3 }} />
        </Box>
      </Box>
    </Panel>
  );
}

export function DashboardPage() {
  useDocumentTitle("Overview");
  const data = useFinanceData();
  const navigate = useNavigate();
  const [spendRange, setSpendRange] = useState<"month" | "all">("month");

  if (data.loading) return <LoadingScreen />;
  if (data.error) {
    return (
      <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void data.refresh()}>Retry</Button>}>
        {data.error}
      </Alert>
    );
  }
  if (!data.fx) return <Alert severity="warning">Exchange rates are unavailable.</Alert>;

  const fx = data.fx;
  const base = data.settings.baseCurrency;
  const { summary } = data;
  const money = (v: number) => formatMoney(v, base);
  const toBase = (amount: number, currency: CurrencyCode) => convertToBase(amount, currency, fx);

  // Monthly income and expenses for the last 6 months (including this one).
  const months = Array.from({ length: 6 }, (_, i) => monthKeyFromNow(i - 5));
  const byMonth = new Map(months.map((m) => [m, { income: 0, expenses: 0 }]));
  for (const e of data.entries) {
    const bucket = byMonth.get(monthKey(e.date));
    if (!bucket) continue;
    if (e.type === "credit") bucket.income += toBase(e.amount, e.currency);
    else bucket.expenses += toBase(e.amount, e.currency);
  }
  const trendData = months.map((m) => ({ name: monthLabel(m), Income: byMonth.get(m)!.income, Expenses: byMonth.get(m)!.expenses }));
  const thisMonth = byMonth.get(monthKeyFromNow(0))!;
  const lastMonth = byMonth.get(monthKeyFromNow(-1))!;
  const lastLabel = monthLabel(monthKeyFromNow(-1));

  const currentMonth = monthKeyFromNow(0);
  const spendTotals = new Map<string, number>();
  for (const e of data.entries) {
    if (e.type !== "debit" || (spendRange === "month" && monthKey(e.date) !== currentMonth)) continue;
    spendTotals.set(e.category, (spendTotals.get(e.category) ?? 0) + toBase(e.amount, e.currency));
  }
  const spend = [...spendTotals.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const topSpend = spend.slice(0, 6);
  const otherSpend = spend.slice(6).reduce((sum, x) => sum + x.value, 0);
  if (otherSpend > 0) topSpend.push({ name: "Other", value: otherSpend });
  const maxSpend = Math.max(...topSpend.map((x) => x.value), 1);
  const spendTotal = spend.reduce((sum, x) => sum + x.value, 0);

  const upcoming = data.salaryProfiles
    .map((p) => ({ profile: p, date: nextPayDate(p) }))
    .filter((x): x is { profile: typeof x.profile; date: Date } => x.date !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const openDebts = data.debts.filter((d) => d.balance > 0).length;
  const recent = data.entries.slice(0, 8);
  const compact = (v: number) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v);
  const monthName = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <Box>
      <PageHeader
        title={greeting()}
        description={`Here's where things stand for ${monthName}. Figures in ${base}, rates as of ${formatDate(fx.date)}.`}
      />

      <Grid container spacing={2}>
        <Grid size={{ xs: 6, lg: 3 }}>
          <StatCard
            label="Cash balance"
            value={money(summary.outstanding)}
            caption="Income minus expenses"
            tone={summary.outstanding >= 0 ? "default" : "negative"}
          />
        </Grid>
        <Grid size={{ xs: 6, lg: 3 }}>
          <StatCard
            label="Income this month"
            value={money(thisMonth.income)}
            trend={trendBetween(thisMonth.income, lastMonth.income, lastLabel, true)}
            caption={thisMonth.income === 0 && lastMonth.income === 0 ? "Nothing recorded yet" : undefined}
            onClick={() => navigate("/transactions?period=this-month&type=credit")}
          />
        </Grid>
        <Grid size={{ xs: 6, lg: 3 }}>
          <StatCard
            label="Spent this month"
            value={money(thisMonth.expenses)}
            trend={trendBetween(thisMonth.expenses, lastMonth.expenses, lastLabel, false)}
            caption={thisMonth.expenses === 0 && lastMonth.expenses === 0 ? "Nothing recorded yet" : undefined}
            onClick={() => navigate("/transactions?period=this-month&type=debit")}
          />
        </Grid>
        <Grid size={{ xs: 6, lg: 3 }}>
          <StatCard
            label="Outstanding debt"
            value={money(summary.debtBalances)}
            caption={openDebts === 0 ? "All paid off" : `${openDebts} open account${openDebts === 1 ? "" : "s"}`}
            onClick={() => navigate("/debts")}
          />
        </Grid>

        <Grid size={{ xs: 12, lg: 7 }}>
          <Panel title="Income vs expenses" subtitle={`Last 6 months, ${base}`}>
            <Box sx={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData} barGap={2} barCategoryGap="28%" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#EDF0F4" vertical={false} />
                  <XAxis dataKey="name" axisLine={{ stroke: colors.border }} tickLine={false} tick={{ fill: colors.textSecondary, fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} width={48} tick={{ fill: colors.textMuted, fontSize: 11 }} tickFormatter={compact} />
                  <Tooltip
                    formatter={(value) => money(Number(value ?? 0))}
                    cursor={{ fill: colors.subtle }}
                    contentStyle={{ borderRadius: 6, border: `1px solid ${colors.border}`, fontSize: 13, boxShadow: "0 4px 12px rgba(16,24,40,.08)" }}
                  />
                  <Legend iconType="square" iconSize={10} itemSorter={null} wrapperStyle={{ fontSize: 12, color: colors.textSecondary }} />
                  <Bar dataKey="Income" isAnimationActive={false} fill={colors.seriesBalance} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="Expenses" isAnimationActive={false} fill={colors.seriesLiability} radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Panel>
        </Grid>

        <Grid size={{ xs: 12, lg: 5 }}>
          <Panel
            title="Spending by category"
            subtitle={spendTotal > 0 ? `${money(spendTotal)} total` : undefined}
            action={
              <ToggleButtonGroup
                exclusive
                size="small"
                value={spendRange}
                onChange={(_, v) => v && setSpendRange(v)}
                aria-label="Spending period"
                sx={{ flexShrink: 0, "& .MuiToggleButton-root": { textTransform: "none", py: 0.25, px: 1.25, fontSize: 12, whiteSpace: "nowrap" } }}
              >
                <ToggleButton value="month">This month</ToggleButton>
                <ToggleButton value="all">All time</ToggleButton>
              </ToggleButtonGroup>
            }
          >
            {topSpend.length === 0 ? (
              <EmptyState
                title={spendRange === "month" ? "No spending this month" : "No expenses yet"}
                message="Expenses appear here, grouped by category, as you record them."
              />
            ) : (
              <Stack spacing={1.5}>
                {topSpend.map((item) => (
                  <Box key={item.name}>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                      <Typography variant="body2" noWrap sx={{ pr: 2 }}>{item.name}</Typography>
                      <Typography variant="body2" fontWeight={600} sx={{ fontVariantNumeric: "tabular-nums" }}>
                        {money(item.value)}
                        <Box component="span" sx={{ color: "text.secondary", fontWeight: 400, ml: 1, display: "inline-block", minWidth: 34, textAlign: "right" }}>
                          {Math.round((item.value / spendTotal) * 100)}%
                        </Box>
                      </Typography>
                    </Stack>
                    <Box sx={{ height: 8, bgcolor: "#EDF0F4", borderRadius: 1 }}>
                      <Box
                        title={`${item.name}: ${money(item.value)}`}
                        sx={{ width: `${(item.value / maxSpend) * 100}%`, minWidth: 4, height: "100%", bgcolor: colors.seriesBalance, borderRadius: 1 }}
                      />
                    </Box>
                  </Box>
                ))}
              </Stack>
            )}
          </Panel>
        </Grid>

        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          <GroupSummary title="Primary" credits={summary.primaryCredits} outstanding={summary.primaryOutstanding} debts={summary.primaryDebts} base={base} />
        </Grid>
        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          <GroupSummary title="Secondary" credits={summary.secondaryCredits} outstanding={summary.secondaryOutstanding} debts={summary.secondaryDebts} base={base} />
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Panel
            title="Upcoming income"
            flush
            action={<Button size="small" onClick={() => navigate("/salary")}>Manage</Button>}
          >
            {upcoming.length === 0 ? (
              <EmptyState
                title="No scheduled income"
                message="Add your salary so it's recorded automatically on each pay date."
                action={<Button size="small" variant="outlined" onClick={() => navigate("/salary")}>Add income schedule</Button>}
              />
            ) : (
              <Box>
                {upcoming.map(({ profile, date }) => (
                  <Stack
                    key={profile.id}
                    direction="row"
                    alignItems="center"
                    gap={2}
                    sx={{ px: 2.5, py: 1.75, borderBottom: 1, borderColor: "divider", "&:last-child": { borderBottom: 0 } }}
                  >
                    <Box
                      sx={{ width: 44, flexShrink: 0, textAlign: "center", border: 1, borderColor: "divider", borderRadius: 1, overflow: "hidden" }}
                    >
                      <Typography sx={{ fontSize: 10, fontWeight: 600, bgcolor: colors.navy, color: "#fff", py: 0.25, textTransform: "uppercase" }}>
                        {date.toLocaleDateString("en-US", { month: "short" })}
                      </Typography>
                      <Typography sx={{ fontSize: 16, fontWeight: 600, py: 0.25 }}>{date.getDate()}</Typography>
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={500} noWrap>{profile.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{relativeDays(date)} · {formatDate(toIsoDate(date))}</Typography>
                    </Box>
                    <Typography variant="body2" fontWeight={600} sx={{ color: colors.positive, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                      +{formatMoney(profile.amount, profile.currency)}
                    </Typography>
                  </Stack>
                ))}
              </Box>
            )}
          </Panel>
        </Grid>

        <Grid size={12}>
          <Panel
            title="Recent activity"
            flush
            action={<Button size="small" endIcon={<ChevronRightOutlined />} onClick={() => navigate("/transactions")}>View all</Button>}
          >
            {recent.length === 0 ? (
              <EmptyState title="No transactions yet" message="Press N or use “New transaction” to record your first one." />
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Date</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Category</TableCell>
                      <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>Group</TableCell>
                      <TableCell align="right">Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recent.map((item) => (
                      <TableRow key={item.id} hover sx={{ cursor: "pointer" }} onClick={() => navigate("/transactions")}>
                        <TableCell sx={{ display: { xs: "none", sm: "table-cell" }, whiteSpace: "nowrap", color: "text.secondary" }}>{formatDate(item.date)}</TableCell>
                        <TableCell sx={{ maxWidth: { xs: 190, sm: 280 } }}>
                          <Typography variant="body2" noWrap>{item.description}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: { sm: "none" } }}>{formatDate(item.date)}</Typography>
                        </TableCell>
                        <TableCell sx={{ display: { xs: "none", sm: "table-cell" }, color: "text.secondary" }}>{item.category}</TableCell>
                        <TableCell sx={{ display: { xs: "none", md: "table-cell" }, color: "text.secondary" }}>{labelOf(item.group)}</TableCell>
                        <TableCell align="right">
                          <Amount value={formatMoney(item.amount, item.currency)} positive={item.type === "credit"} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Panel>
        </Grid>
      </Grid>
    </Box>
  );
}
