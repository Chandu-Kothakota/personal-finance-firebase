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
  Stack,
  Typography,
} from "@mui/material";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { LoadingScreen } from "../components/LoadingScreen";
import { SummaryCard } from "../components/SummaryCard";
import { useFinanceData } from "../hooks/useFinanceData";
import { convertToBase, formatMoney } from "../lib/currency";
import type { CurrencyCode } from "../types";

const PIE_COLORS = ["#0F766E", "#2563EB", "#D97706", "#7C3AED", "#DC2626", "#0891B2", "#475467"];
const CREDIT_COLOR = "#16A34A";
const LIABILITY_COLOR = "#DC2626";

function AccountGroupCard({
  label,
  icon,
  color,
  tint,
  credits,
  debts,
  outstanding,
  base,
}: {
  label: string;
  icon: ReactNode;
  color: string;
  tint: string;
  credits: number;
  debts: number;
  outstanding: number;
  base: CurrencyCode;
}) {
  const positive = outstanding >= 0;
  const liabilityTone = debts <= 0 ? "text.secondary" : debts > credits ? "error.main" : "warning.main";
  const total = credits + debts;
  const liabilityShare = total > 0 ? (debts / total) * 100 : 0;
  const pieData =
    total > 0
      ? [
          { name: "Credits", value: credits, color: CREDIT_COLOR },
          { name: "Liabilities", value: debts, color: LIABILITY_COLOR },
        ]
      : [{ name: "No data", value: 1, color: "#E4E7EC" }];

  return (
    <Card sx={{ height: "100%", overflow: "hidden", borderTop: `4px solid ${color}`, background: `linear-gradient(168deg, ${tint} 0%, #FFFFFF 58%)` }}>
      <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
        <Stack direction="row" alignItems="center" gap={1.4}>
          <Box sx={{ width: 44, height: 44, borderRadius: 2.8, display: "grid", placeItems: "center", bgcolor: "#fff", color, flexShrink: 0, boxShadow: "0 6px 16px rgba(16,24,40,.08)" }}>
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

        <Grid container spacing={2} sx={{ mt: 2.2 }}>
          <Grid size={6}>
            <Typography variant="caption" color="text.secondary" fontWeight={700} letterSpacing=".03em">
              OUTSTANDING BALANCE
            </Typography>
            <Typography variant="h4" sx={{ mt: 0.3, fontVariantNumeric: "tabular-nums", color: positive ? "success.main" : "error.main" }} noWrap>
              {formatMoney(outstanding, base)}
            </Typography>
          </Grid>
          <Grid size={6}>
            <Typography variant="caption" color="text.secondary" fontWeight={700} letterSpacing=".03em">
              OUTSTANDING LIABILITY
            </Typography>
            <Typography variant="h4" sx={{ mt: 0.3, fontVariantNumeric: "tabular-nums", color: liabilityTone }} noWrap>
              {formatMoney(debts, base)}
            </Typography>
          </Grid>
        </Grid>

        <Stack direction="row" alignItems="center" gap={2.5} sx={{ mt: 2.8 }}>
          <Box sx={{ width: 104, height: 104, position: "relative", flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={32} outerRadius={50} paddingAngle={total > 0 ? 4 : 0} stroke="none">
                  {pieData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
              <Typography variant="body2" fontWeight={850}>{liabilityShare.toFixed(0)}%</Typography>
            </Box>
          </Box>
          <Stack spacing={1.1} sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" alignItems="center" gap={1}>
              <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: CREDIT_COLOR, flexShrink: 0 }} />
              <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>Credits</Typography>
              <Typography variant="body2" fontWeight={800}>{formatMoney(credits, base)}</Typography>
            </Stack>
            <Stack direction="row" alignItems="center" gap={1}>
              <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: LIABILITY_COLOR, flexShrink: 0 }} />
              <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>Liabilities</Typography>
              <Typography variant="body2" fontWeight={800}>{formatMoney(debts, base)}</Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary">Share of liabilities in this group's total</Typography>
          </Stack>
        </Stack>
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

  const groupChart = [
    { name: "Primary", Balance: data.summary.primaryOutstanding, Liability: data.summary.primaryDebts },
    { name: "Secondary", Balance: data.summary.secondaryOutstanding, Liability: data.summary.secondaryDebts },
  ];

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
            tint="#E4F5F2"
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
            tint="#EAF1FF"
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
        <Grid size={{ xs: 12, xl: 7 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2.5}>
                <Box><Typography variant="h6">Balance vs liability by group</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>Outstanding balance and outstanding liability, side by side</Typography></Box>
                <Chip size="small" label={base} variant="outlined" />
              </Stack>
              <Box sx={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={groupChart} barGap={10}>
                    <CartesianGrid stroke="#EEF1F4" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#667085", fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#98A2B3", fontSize: 11 }} />
                    <Tooltip formatter={(value) => formatMoney(Number(value ?? 0), base)} cursor={{ fill: "#F8FAFC" }} contentStyle={{ borderRadius: 12, border: "1px solid #E4E7EC", boxShadow: "0 10px 24px rgba(16,24,40,.08)" }} />
                    <Legend iconType="circle" />
                    <Bar dataKey="Balance" fill={CREDIT_COLOR} radius={[7, 7, 0, 0]} maxBarSize={54} />
                    <Bar dataKey="Liability" fill={LIABILITY_COLOR} radius={[7, 7, 0, 0]} maxBarSize={54} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, xl: 5 }}>
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

      <Card>
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
    </Stack>
  );
}
