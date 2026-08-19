import {
  AccountBalanceRounded,
  AddRounded,
  ArrowDownwardRounded,
  ArrowUpwardRounded,
  CreditCardRounded,
  SavingsRounded,
  TrendingDownRounded,
  TrendingUpRounded,
  WalletRounded,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { LoadingScreen } from "../components/LoadingScreen";
import { SummaryCard } from "../components/SummaryCard";
import { useFinanceData } from "../hooks/useFinanceData";
import { convertToBase, formatMoney } from "../lib/currency";
import type { CurrencyCode } from "../types";

const PIE_COLORS = ["#0F766E", "#2563EB", "#D97706", "#7C3AED", "#DC2626", "#0891B2", "#475467"];

function AccountGroupCard({
  label,
  icon,
  color,
  bg,
  credits,
  debts,
  outstanding,
  base,
}: {
  label: string;
  icon: ReactNode;
  color: string;
  bg: string;
  credits: number;
  debts: number;
  outstanding: number;
  base: CurrencyCode;
}) {
  const positive = outstanding >= 0;
  const ratio = credits > 0 ? Math.min(100, (debts / credits) * 100) : debts > 0 ? 100 : 0;
  const ratioColor = ratio > 70 ? "#DC2626" : ratio > 40 ? "#D97706" : "#16A34A";

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
        <Stack direction="row" alignItems="center" gap={1.4}>
          <Box sx={{ width: 44, height: 44, borderRadius: 2.8, display: "grid", placeItems: "center", bgcolor: bg, color, flexShrink: 0 }}>
            {icon}
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="h6">{label}</Typography>
            <Typography variant="caption" color="text.secondary">Portfolio group</Typography>
          </Box>
          <Chip
            size="small"
            label={positive ? "Healthy" : "Attention"}
            sx={{
              bgcolor: positive ? "#EAF8F0" : "#FFF5E7",
              color: positive ? "#15803D" : "#B45309",
              fontWeight: 750,
            }}
          />
        </Stack>

        <Box sx={{ mt: 2.6 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={700} letterSpacing=".04em">
            OUTSTANDING BALANCE
          </Typography>
          <Typography
            variant="h3"
            sx={{ mt: 0.4, fontVariantNumeric: "tabular-nums", color: positive ? "success.main" : "error.main" }}
          >
            {formatMoney(outstanding, base)}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
            What you currently have available in this group
          </Typography>
        </Box>

        <Divider sx={{ my: 2.4 }} />

        <Grid container spacing={2}>
          <Grid size={6}>
            <Stack direction="row" gap={1.1} alignItems="flex-start">
              <Box sx={{ width: 32, height: 32, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: "#EAF8F0", color: "#15803D", flexShrink: 0, mt: 0.2 }}>
                <ArrowUpwardRounded sx={{ fontSize: 17 }} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary">Credits</Typography>
                <Typography fontWeight={800} noWrap>{formatMoney(credits, base)}</Typography>
              </Box>
            </Stack>
          </Grid>
          <Grid size={6}>
            <Stack direction="row" gap={1.1} alignItems="flex-start">
              <Box sx={{ width: 32, height: 32, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: "#FFF5E7", color: "#B45309", flexShrink: 0, mt: 0.2 }}>
                <CreditCardRounded sx={{ fontSize: 17 }} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary">Liabilities</Typography>
                <Typography fontWeight={800} noWrap>{formatMoney(debts, base)}</Typography>
              </Box>
            </Stack>
          </Grid>
        </Grid>

        <Box sx={{ mt: 2.6 }}>
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.7 }}>
            <Typography variant="caption" color="text.secondary">Liabilities vs credits</Typography>
            <Typography variant="caption" fontWeight={800}>{ratio.toFixed(0)}%</Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={ratio}
            sx={{ height: 7, borderRadius: 999, bgcolor: "#EEF2F6", "& .MuiLinearProgress-bar": { borderRadius: 999, bgcolor: ratioColor } }}
          />
        </Box>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const data = useFinanceData();
  const navigate = useNavigate();

  if (data.loading) return <LoadingScreen />;
  if (data.error) return <Alert severity="error">{data.error}</Alert>;
  if (!data.fx) return <Alert severity="warning">Exchange rates are unavailable.</Alert>;

  const base = data.settings.baseCurrency;
  const expenseByCategory = Object.entries(
    data.entries
      .filter((x) => x.type === "debit")
      .reduce<Record<string, number>>((acc, item) => {
        acc[item.category] = (acc[item.category] ?? 0) + convertToBase(item.amount, item.currency, data.fx!);
        return acc;
      }, {}),
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 7);

  const recent = [...data.entries].slice(0, 6);
  const totalOutflow = data.summary.expenseDebits + data.summary.debtBalances;
  const coverage = data.summary.credits > 0 ? Math.max(0, Math.min(100, (data.summary.credits / Math.max(totalOutflow, 1)) * 100)) : 0;
  const isPositive = data.summary.outstanding >= 0;

  return (
    <Stack spacing={3.2}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} gap={2}>
        <Box>
          <Typography variant="h4">Overview</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.6 }}>
            What you currently have across your primary and secondary accounts.
          </Typography>
        </Box>
        <Stack direction="row" gap={1.2} flexWrap="wrap">
          <Chip variant="outlined" label={`FX ${data.fx.date}`} sx={{ bgcolor: "#fff" }} />
          <Button startIcon={<AddRounded />} variant="contained" onClick={() => navigate("/transactions")}>Add transaction</Button>
        </Stack>
      </Stack>

      <Grid container spacing={2.2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <AccountGroupCard
            label="Primary"
            icon={<WalletRounded />}
            color="#0F766E"
            bg="#E4F5F2"
            credits={data.summary.primaryCredits}
            debts={data.summary.primaryDebts}
            outstanding={data.summary.primaryOutstanding}
            base={base}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <AccountGroupCard
            label="Secondary"
            icon={<AccountBalanceRounded />}
            color="#2563EB"
            bg="#EAF1FF"
            credits={data.summary.secondaryCredits}
            debts={data.summary.secondaryDebts}
            outstanding={data.summary.secondaryOutstanding}
            base={base}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, xl: 3 }}><SummaryCard label="Total credits" value={formatMoney(data.summary.credits, base)} caption="Primary + secondary income" icon={<SavingsRounded />} tone="positive" /></Grid>
        <Grid size={{ xs: 12, sm: 6, xl: 3 }}><SummaryCard label="Total liabilities" value={formatMoney(data.summary.debtBalances, base)} caption={`${data.debts.length} tracked account${data.debts.length === 1 ? "" : "s"}`} icon={<CreditCardRounded />} tone="warning" /></Grid>
        <Grid size={{ xs: 12, sm: 6, xl: 3 }}><SummaryCard label="Total outstanding" value={formatMoney(data.summary.outstanding, base)} caption="Credits − debits (incl. debt payments)" icon={isPositive ? <TrendingUpRounded /> : <TrendingDownRounded />} tone={isPositive ? "positive" : "negative"} /></Grid>
        <Grid size={{ xs: 12, sm: 6, xl: 3 }}><SummaryCard label="Coverage" value={`${coverage.toFixed(0)}%`} caption="Credits vs total obligations" icon={<TrendingUpRounded />} tone={isPositive ? "positive" : "neutral"} /></Grid>
      </Grid>

      <Grid container spacing={2.2}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: 0 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 3, pb: 2 }}>
                <Box><Typography variant="h6">Recent activity</Typography><Typography variant="body2" color="text.secondary">Latest recorded credits and debits</Typography></Box>
                <Button size="small" onClick={() => navigate("/transactions")}>View all</Button>
              </Stack>
              <Divider />
              {recent.length === 0 ? (
                <Box sx={{ p: 4, textAlign: "center" }}><Typography color="text.secondary">No transactions recorded yet.</Typography></Box>
              ) : recent.map((item, index) => (
                <Box key={item.id}>
                  <Stack
                    direction="row"
                    alignItems="center"
                    gap={1.5}
                    sx={{ px: 3, py: 1.65, transition: "background-color .15s ease", "&:hover": { bgcolor: "#FBFCFD" } }}
                  >
                    <Box sx={{ width: 38, height: 38, borderRadius: 2.3, display: "grid", placeItems: "center", bgcolor: item.type === "credit" ? "#EAF8F0" : "#FEF1F1", color: item.type === "credit" ? "#15803D" : "#B42318" }}>
                      {item.type === "credit" ? <ArrowUpwardRounded fontSize="small" /> : <ArrowDownwardRounded fontSize="small" />}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}><Typography fontWeight={700} noWrap>{item.description}</Typography><Typography variant="caption" color="text.secondary">{item.category} · {item.group} · {item.date}</Typography></Box>
                    <Typography fontWeight={800} color={item.type === "credit" ? "success.main" : "text.primary"}>{item.type === "credit" ? "+" : "−"}{formatMoney(item.amount, item.currency)}</Typography>
                  </Stack>
                  {index < recent.length - 1 && <Divider sx={{ ml: 8.8 }} />}
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 5 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6">Expense composition</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>Top categories by recorded spend</Typography>
              <Box sx={{ height: 220, mt: 1 }}>
                {expenseByCategory.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={expenseByCategory} dataKey="value" nameKey="name" innerRadius={62} outerRadius={88} paddingAngle={3} stroke="none">
                        {expenseByCategory.map((_, index) => <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(value) => formatMoney(Number(value ?? 0), base)} contentStyle={{ borderRadius: 12, border: "1px solid #E4E7EC" }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <Box sx={{ height: "100%", display: "grid", placeItems: "center" }}><Typography color="text.secondary">No expense data yet</Typography></Box>}
              </Box>
              <Stack spacing={1.15}>
                {expenseByCategory.slice(0, 4).map((item, index) => (
                  <Stack key={item.name} direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" alignItems="center" gap={1}><Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: PIE_COLORS[index] }} /><Typography variant="body2" color="text.secondary">{item.name}</Typography></Stack>
                    <Typography variant="body2" fontWeight={750}>{formatMoney(item.value, base)}</Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  );
}
