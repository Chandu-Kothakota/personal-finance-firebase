import { AddOutlined } from "@mui/icons-material";
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
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { LoadingScreen } from "../components/LoadingScreen";
import { Amount, EmptyState, PageHeader, Panel, StatCard, labelOf } from "../components/ui";
import { useFinanceData } from "../hooks/useFinanceData";
import { convertToBase, formatDate, formatMoney } from "../lib/currency";
import { colors } from "../theme/theme";
import type { CurrencyCode } from "../types";

function Row({ label, value, color, strong }: { label: string; value: string; color?: string; strong?: boolean }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ py: 1.1 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography
        variant="body2"
        sx={{ fontWeight: strong ? 600 : 500, color: color ?? "text.primary", fontVariantNumeric: "tabular-nums" }}
      >
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
    <Panel title={title} subtitle="Account group">
      <Typography variant="overline" color="text.secondary" component="p">Cash balance</Typography>
      <Typography
        sx={{ fontSize: "1.75rem", fontWeight: 600, fontVariantNumeric: "tabular-nums", color: outstanding >= 0 ? colors.text : colors.negative }}
      >
        {formatMoney(outstanding, base)}
      </Typography>

      <Box sx={{ mt: 1.5, borderTop: 1, borderColor: "divider" }}>
        <Row label="Total income" value={formatMoney(credits, base)} />
        <Box sx={{ borderTop: 1, borderColor: "divider" }}>
          <Row label="Outstanding liabilities" value={formatMoney(debts, base)} color={debts > 0 ? colors.warning : undefined} />
        </Box>
      </Box>

      <Box sx={{ mt: 1.5 }}>
        <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.75 }}>
          <Typography variant="caption" color="text.secondary">Liabilities as share of income + liabilities</Typography>
          <Typography variant="caption" fontWeight={600}>{share.toFixed(0)}%</Typography>
        </Stack>
        <Box
          role="meter"
          aria-valuenow={Math.round(share)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${title} liability share`}
          sx={{ height: 6, borderRadius: 3, bgcolor: "#E8ECF1", overflow: "hidden" }}
        >
          <Box sx={{ width: `${share}%`, height: "100%", bgcolor: colors.seriesLiability, borderRadius: 3 }} />
        </Box>
      </Box>
    </Panel>
  );
}

export function DashboardPage() {
  const data = useFinanceData();
  const navigate = useNavigate();

  if (data.loading) return <LoadingScreen />;
  if (data.error) return <Alert severity="error">{data.error}</Alert>;
  if (!data.fx) return <Alert severity="warning">Exchange rates are unavailable.</Alert>;

  const fx = data.fx;
  const base = data.settings.baseCurrency;
  const { summary } = data;

  const spendByCategory = Object.entries(
    data.entries
      .filter((x) => x.type === "debit")
      .reduce<Record<string, number>>((acc, item) => {
        acc[item.category] = (acc[item.category] ?? 0) + convertToBase(item.amount, item.currency, fx);
        return acc;
      }, {}),
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  const topSpend = spendByCategory.slice(0, 6);
  const otherSpend = spendByCategory.slice(6).reduce((sum, x) => sum + x.value, 0);
  if (otherSpend > 0) topSpend.push({ name: "Other", value: otherSpend });
  const maxSpend = Math.max(...topSpend.map((x) => x.value), 1);

  const groupChart = [
    { name: "Primary", Balance: summary.primaryOutstanding, Liabilities: summary.primaryDebts },
    { name: "Secondary", Balance: summary.secondaryOutstanding, Liabilities: summary.secondaryDebts },
  ];

  const recent = data.entries.slice(0, 8);
  const money = (v: number) => formatMoney(v, base);
  const compact = (v: number) =>
    new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v);

  return (
    <Box>
      <PageHeader
        title="Overview"
        description={`All figures in ${base} · exchange rates as of ${fx.date}`}
        actions={
          <Button variant="contained" startIcon={<AddOutlined />} onClick={() => navigate("/transactions")}>
            New transaction
          </Button>
        }
      />

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            label="Cash balance"
            value={money(summary.outstanding)}
            caption="Income minus expenses"
            tone={summary.outstanding >= 0 ? "default" : "negative"}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard label="Total income" value={money(summary.credits)} caption="All recorded credits" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard label="Total expenses" value={money(summary.expenseDebits)} caption="Including debt payments" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            label="Outstanding liabilities"
            value={money(summary.debtBalances)}
            caption={`${data.debts.length} debt account${data.debts.length === 1 ? "" : "s"}`}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <GroupSummary
            title="Primary"
            credits={summary.primaryCredits}
            outstanding={summary.primaryOutstanding}
            debts={summary.primaryDebts}
            base={base}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <GroupSummary
            title="Secondary"
            credits={summary.secondaryCredits}
            outstanding={summary.secondaryOutstanding}
            debts={summary.secondaryDebts}
            base={base}
          />
        </Grid>

        <Grid size={{ xs: 12, lg: 7 }}>
          <Panel title="Balance and liabilities by group" subtitle={`Cash balance against outstanding debt, ${base}`}>
            <Box sx={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={groupChart} barGap={2} barCategoryGap="30%" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#EDF0F4" vertical={false} />
                  <XAxis dataKey="name" axisLine={{ stroke: colors.border }} tickLine={false} tick={{ fill: colors.textSecondary, fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} width={48} tick={{ fill: colors.textMuted, fontSize: 11 }} tickFormatter={compact} />
                  <Tooltip
                    formatter={(value) => money(Number(value ?? 0))}
                    cursor={{ fill: colors.subtle }}
                    contentStyle={{ borderRadius: 6, border: `1px solid ${colors.border}`, fontSize: 13, boxShadow: "0 4px 12px rgba(16,24,40,.08)" }}
                  />
                  <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12, color: colors.textSecondary }} />
                  <Bar dataKey="Balance" isAnimationActive={false} fill={colors.seriesBalance} radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="Liabilities" isAnimationActive={false} fill={colors.seriesLiability} radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Panel>
        </Grid>

        <Grid size={{ xs: 12, lg: 5 }}>
          <Panel title="Spending by category" subtitle={`Total recorded expenses, ${base}`}>
            {topSpend.length === 0 ? (
              <EmptyState title="No expenses yet" message="Expenses will appear here once you record them." />
            ) : (
              <Stack spacing={1.5}>
                {topSpend.map((item) => (
                  <Box key={item.name}>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                      <Typography variant="body2" noWrap sx={{ pr: 2 }}>{item.name}</Typography>
                      <Typography variant="body2" fontWeight={600} sx={{ fontVariantNumeric: "tabular-nums" }}>{money(item.value)}</Typography>
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

        <Grid size={12}>
          <Panel
            title="Recent activity"
            flush
            action={<Button size="small" onClick={() => navigate("/transactions")}>View all</Button>}
          >
            {recent.length === 0 ? (
              <EmptyState title="No transactions yet" message="Record your first credit or debit to get started." />
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
                      <TableRow key={item.id} hover>
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
