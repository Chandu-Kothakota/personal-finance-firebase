import {
  AccountBalanceRounded,
  AddRounded,
  ArrowDownwardRounded,
  ArrowUpwardRounded,
  CreditCardRounded,
  PaymentsRounded,
  SavingsRounded,
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

const PIE_COLORS = ["#0F766E", "#2563EB", "#D97706", "#7C3AED", "#DC2626", "#0891B2", "#475467"];

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
    { name: "Primary", Credits: data.summary.primaryCredits, Liabilities: data.summary.primaryDebts },
    { name: "Secondary", Credits: data.summary.secondaryCredits, Liabilities: data.summary.secondaryDebts },
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
            Consolidated financial position across income, expenses and liabilities.
          </Typography>
        </Box>
        <Stack direction="row" gap={1.2} flexWrap="wrap">
          <Chip variant="outlined" label={`FX ${data.fx.date}`} sx={{ bgcolor: "#fff" }} />
          <Button startIcon={<AddRounded />} variant="contained" onClick={() => navigate("/transactions")}>Add transaction</Button>
        </Stack>
      </Stack>

      <Card sx={{ overflow: "hidden", border: 0, color: "#fff", background: "linear-gradient(125deg, #0B1F33 0%, #123A4A 62%, #0F766E 150%)", boxShadow: "0 20px 45px rgba(11,31,51,.18)" }}>
        <CardContent sx={{ p: { xs: 3, md: 4 }, "&:last-child": { pb: { xs: 3, md: 4 } } }}>
          <Grid container spacing={3} alignItems="center">
            <Grid size={{ xs: 12, md: 7 }}>
              <Typography variant="overline" sx={{ color: "rgba(255,255,255,.58)", fontWeight: 800, letterSpacing: ".1em" }}>NET FINANCIAL POSITION</Typography>
              <Typography variant="h3" sx={{ mt: 0.7, color: "#fff", fontVariantNumeric: "tabular-nums" }}>{formatMoney(data.summary.outstanding, base)}</Typography>
              <Typography sx={{ mt: 1.2, color: "rgba(255,255,255,.66)", maxWidth: 620 }}>
                Running balance of all credits and debits, including debt payments. All figures normalized to {base}.
              </Typography>
              <Stack direction="row" spacing={3.5} sx={{ mt: 3.2 }} flexWrap="wrap" useFlexGap>
                <Box><Typography variant="caption" sx={{ color: "rgba(255,255,255,.52)" }}>TOTAL CREDITS</Typography><Typography variant="h6" sx={{ color: "#D1FAE5", mt: 0.3 }}>{formatMoney(data.summary.credits, base)}</Typography></Box>
                <Box><Typography variant="caption" sx={{ color: "rgba(255,255,255,.52)" }}>TOTAL OUTFLOW + DEBT</Typography><Typography variant="h6" sx={{ color: "#FDE68A", mt: 0.3 }}>{formatMoney(totalOutflow, base)}</Typography></Box>
              </Stack>
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <Box sx={{ p: 2.5, borderRadius: 3.5, bgcolor: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.10)", backdropFilter: "blur(8px)" }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography fontWeight={750}>Coverage indicator</Typography>
                  <Chip size="small" label={isPositive ? "Positive" : "Attention"} sx={{ bgcolor: isPositive ? "rgba(52,211,153,.16)" : "rgba(251,191,36,.16)", color: isPositive ? "#A7F3D0" : "#FDE68A" }} />
                </Stack>
                <LinearProgress variant="determinate" value={coverage} sx={{ mt: 2.2, height: 8, borderRadius: 999, bgcolor: "rgba(255,255,255,.12)", "& .MuiLinearProgress-bar": { borderRadius: 999, bgcolor: "#5EEAD4" } }} />
                <Stack direction="row" justifyContent="space-between" sx={{ mt: 1.2 }}><Typography variant="caption" sx={{ color: "rgba(255,255,255,.55)" }}>Credits vs tracked obligations</Typography><Typography variant="caption" fontWeight={800}>{coverage.toFixed(0)}%</Typography></Stack>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, xl: 3 }}><SummaryCard label="Total credits" value={formatMoney(data.summary.credits, base)} caption="Primary + secondary income" icon={<SavingsRounded />} tone="positive" /></Grid>
        <Grid size={{ xs: 12, sm: 6, xl: 3 }}><SummaryCard label="Debt portfolio" value={formatMoney(data.summary.debtBalances, base)} caption={`${data.debts.length} tracked account${data.debts.length === 1 ? "" : "s"}`} icon={<CreditCardRounded />} tone="warning" /></Grid>
        <Grid size={{ xs: 12, sm: 6, xl: 3 }}><SummaryCard label="Recorded expenses" value={formatMoney(data.summary.expenseDebits, base)} caption="Manual debit transactions" icon={<PaymentsRounded />} tone="negative" /></Grid>
        <Grid size={{ xs: 12, sm: 6, xl: 3 }}><SummaryCard label="Net position" value={formatMoney(data.summary.outstanding, base)} caption="Credits − expenses (incl. debt payments)" icon={<TrendingUpRounded />} tone={isPositive ? "positive" : "negative"} /></Grid>
      </Grid>

      <Grid container spacing={2.2}>
        <Grid size={{ xs: 12, xl: 8 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2.5}>
                <Box><Typography variant="h6">Primary vs secondary position</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>Credits and liabilities by portfolio group</Typography></Box>
                <Chip size="small" label={base} variant="outlined" />
              </Stack>
              <Box sx={{ height: 330 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={groupChart} barGap={10}>
                    <CartesianGrid stroke="#EEF1F4" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#667085", fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#98A2B3", fontSize: 11 }} />
                    <Tooltip formatter={(value) => formatMoney(Number(value ?? 0), base)} cursor={{ fill: "#F8FAFC" }} contentStyle={{ borderRadius: 12, border: "1px solid #E4E7EC", boxShadow: "0 10px 24px rgba(16,24,40,.08)" }} />
                    <Legend iconType="circle" />
                    <Bar dataKey="Credits" fill="#0F766E" radius={[7, 7, 0, 0]} maxBarSize={48} />
                    <Bar dataKey="Liabilities" fill="#D97706" radius={[7, 7, 0, 0]} maxBarSize={48} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, xl: 4 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6">Expense composition</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>Top categories by recorded spend</Typography>
              <Box sx={{ height: 250, mt: 1 }}>
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

      <Grid container spacing={2.2}>
        <Grid size={{ xs: 12, lg: 7 }}>
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
                  <Stack direction="row" alignItems="center" gap={1.5} sx={{ px: 3, py: 1.65 }}>
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
              <Typography variant="h6">Portfolio snapshot</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4, mb: 2.5 }}>At-a-glance view of your two financial groups</Typography>
              <Stack spacing={1.5}>
                {[
                  { label: "Primary", credits: data.summary.primaryCredits, debts: data.summary.primaryDebts, outstanding: data.summary.primaryOutstanding, icon: <WalletRounded fontSize="small" />, color: "#0F766E", bg: "#E4F5F2" },
                  { label: "Secondary", credits: data.summary.secondaryCredits, debts: data.summary.secondaryDebts, outstanding: data.summary.secondaryOutstanding, icon: <AccountBalanceRounded fontSize="small" />, color: "#2563EB", bg: "#EAF1FF" },
                ].map((group) => (
                  <Box key={group.label} sx={{ p: 2.2, borderRadius: 3, border: "1px solid #E6EAF0", bgcolor: "#FBFCFD" }}>
                    <Stack direction="row" alignItems="center" gap={1.4}>
                      <Box sx={{ width: 40, height: 40, borderRadius: 2.5, display: "grid", placeItems: "center", bgcolor: group.bg, color: group.color }}>{group.icon}</Box>
                      <Box sx={{ flex: 1 }}><Typography fontWeight={800}>{group.label}</Typography><Typography variant="caption" color="text.secondary">Portfolio group</Typography></Box>
                    </Stack>
                    <Grid container spacing={2} sx={{ mt: 0.6 }}>
                      <Grid size={4}><Typography variant="caption" color="text.secondary">Credits</Typography><Typography fontWeight={800} sx={{ mt: 0.3 }}>{formatMoney(group.credits, base)}</Typography></Grid>
                      <Grid size={4}><Typography variant="caption" color="text.secondary">Liabilities</Typography><Typography fontWeight={800} sx={{ mt: 0.3 }}>{formatMoney(group.debts, base)}</Typography></Grid>
                      <Grid size={4}><Typography variant="caption" color="text.secondary">Outstanding</Typography><Typography fontWeight={800} sx={{ mt: 0.3, color: group.outstanding >= 0 ? "success.main" : "error.main" }}>{formatMoney(group.outstanding, base)}</Typography></Grid>
                    </Grid>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  );
}
