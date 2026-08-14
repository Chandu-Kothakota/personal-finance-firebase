import {
  AccountBalanceRounded,
  CreditCardRounded,
  SavingsRounded,
  TrendingUpRounded,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import {
  Bar,
  BarChart,
  CartesianGrid,
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
import { convertToBase, formatMoney } from "../lib/currency";
import { useFinanceData } from "../hooks/useFinanceData";

export function DashboardPage() {
  const data = useFinanceData();

  if (data.loading) return <LoadingScreen />;
  if (data.error) return <Alert severity="error">{data.error}</Alert>;
  if (!data.fx) return <Alert severity="warning">Exchange rates are unavailable.</Alert>;

  const base = data.settings.baseCurrency;
  const expenseByCategory = Object.entries(
    data.entries
      .filter((x) => x.type === "debit")
      .reduce<Record<string, number>>((acc, item) => {
        acc[item.category] =
          (acc[item.category] ?? 0) +
          convertToBase(item.amount, item.currency, data.fx!);
        return acc;
      }, {}),
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const groupChart = [
    {
      name: "Primary",
      Credits: data.summary.primaryCredits,
      Debts: data.summary.primaryDebts,
    },
    {
      name: "Secondary",
      Credits: data.summary.secondaryCredits,
      Debts: data.summary.secondaryDebts,
    },
  ];

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" fontWeight={900}>
          Financial Summary
        </Typography>
        <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
          <Typography color="text.secondary">
            Everything converted to {base}.
          </Typography>
          <Chip
            size="small"
            label={`FX reference date: ${data.fx.date}`}
            variant="outlined"
          />
        </Stack>
      </Box>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard
            label="Total credits"
            value={formatMoney(data.summary.credits, base)}
            caption="Primary + secondary earnings"
            icon={<SavingsRounded />}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard
            label="Tracked debt balances"
            value={formatMoney(data.summary.debtBalances, base)}
            caption="Cards, loans and misc debt"
            icon={<CreditCardRounded />}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard
            label="Recorded expenses"
            value={formatMoney(data.summary.expenseDebits, base)}
            caption="Expense transactions"
            icon={<AccountBalanceRounded />}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard
            label="Outstanding balance"
            value={formatMoney(data.summary.outstanding, base)}
            caption="Credits − expenses − debt"
            icon={<TrendingUpRounded />}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={800} mb={2}>
                Primary vs secondary
              </Typography>
              <Box sx={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={groupChart}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip
                      formatter={(value) =>
                        formatMoney(Number(value ?? 0), base)
                      }
                    />
                    <Legend />
                    <Bar dataKey="Credits" fill="#4f46e5" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="Debts" fill="#f97316" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 5 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={800} mb={2}>
                Expenses by category
              </Typography>
              <Box sx={{ height: 320 }}>
                {expenseByCategory.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expenseByCategory}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={65}
                        outerRadius={110}
                        paddingAngle={2}
                      />
                      <Tooltip
                        formatter={(value) =>
                          formatMoney(Number(value ?? 0), base)
                        }
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <Box sx={{ height: "100%", display: "grid", placeItems: "center" }}>
                    <Typography color="text.secondary">
                      Add expenses to see your category chart.
                    </Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  );
}
