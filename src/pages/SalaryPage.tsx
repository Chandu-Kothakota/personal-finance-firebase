import { zodResolver } from "@hookform/resolvers/zod";
import { AddOutlined, EditOutlined } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  Switch,
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
import { EmptyState, PageHeader, Panel, StatCard, StatusBadge, labelOf } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useFinanceData } from "../hooks/useFinanceData";
import { CURRENCIES, convertToBase, formatDate, formatMoney } from "../lib/currency";
import { toUserMessage } from "../lib/errors";
import { saveSalaryProfile } from "../services/apiService";
import { getSalaryPayDays } from "../services/salaryService";
import type { SalaryProfile } from "../types";

const requiredPayDay = z
  .string()
  .trim()
  .regex(/^(?:[1-9]|[12]\d|3[01])$/, "Pay day must be between 1 and 31")
  .transform(Number);

const optionalPayDay = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || /^(?:[1-9]|[12]\d|3[01])$/.test(value),
    "Pay day must be between 1 and 31",
  )
  .transform((value) => (value === "" ? undefined : Number(value)));

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  group: z.enum(["primary", "secondary"]),
  amount: z.coerce.number().positive(),
  currency: z.enum(CURRENCIES),
  effectiveDate: z.string().min(1),
  payDay1: requiredPayDay,
  payDay2: optionalPayDay,
  active: z.boolean(),
}).refine(
  (values) => values.payDay2 === undefined || values.payDay1 !== values.payDay2,
  {
    path: ["payDay2"],
    message: "Pay day 2 must be different from pay day 1",
  },
);

type FormInput = z.input<typeof schema>;
type FormData = z.output<typeof schema>;

const defaults: FormInput = {
  name: "Primary Salary",
  group: "primary",
  amount: 0,
  currency: "USD",
  effectiveDate: new Date().toISOString().slice(0, 10),
  payDay1: "15",
  payDay2: "30",
  active: true,
};

function monthlyAmount(profile: SalaryProfile): number {
  return profile.amount * getSalaryPayDays(profile).length;
}

export function SalaryPage() {
  const { user } = useAuth();
  const data = useFinanceData();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SalaryProfile | null>(null);
  const [error, setError] = useState("");

  const form = useForm<FormInput, unknown, FormData>({ resolver: zodResolver(schema), defaultValues: defaults });

  function add() {
    setEditing(null);
    form.reset({ ...defaults, currency: data.settings.baseCurrency });
    setOpen(true);
  }

  function edit(profile: SalaryProfile) {
    const payDays = getSalaryPayDays(profile);
    setEditing(profile);
    form.reset({
      name: profile.name,
      group: profile.group,
      amount: profile.amount,
      currency: profile.currency,
      effectiveDate: profile.effectiveDate,
      payDay1: String(payDays[0] ?? 15),
      payDay2: payDays[1] === undefined ? "" : String(payDays[1]),
      active: profile.active,
    });
    setOpen(true);
  }

  async function submit(values: FormData) {
    if (!user) return;
    try {
      setError("");
      const { payDay1, payDay2, ...profile } = values;
      await saveSalaryProfile(
        {
          ...profile,
          payDays: payDay2 === undefined ? [payDay1] : [payDay1, payDay2],
          payDay: payDay1,
        },
        editing?.id,
      );
      setOpen(false);
      await data.refresh();
    } catch (err) {
      setError(toUserMessage(err));
    }
  }

  if (data.loading) return <LoadingScreen label="Loading recurring income…" />;

  const activeProfiles = data.salaryProfiles.filter((profile) => profile.active);
  const pausedProfiles = data.salaryProfiles.filter((profile) => !profile.active);
  const expectedDeposits = activeProfiles.reduce(
    (total, profile) => total + getSalaryPayDays(profile).length,
    0,
  );
  const projectedMonthlyIncome = data.fx
    ? activeProfiles.reduce(
        (total, profile) => total + convertToBase(monthlyAmount(profile), profile.currency, data.fx!),
        0,
      )
    : 0;
  const base = data.settings.baseCurrency;
  const ordinal = (n: number) => {
    const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
    return `${n}${suffix}`;
  };

  return (
    <Box>
      <PageHeader
        title="Income"
        description="Recurring income schedules. Credits are added automatically on each pay date."
        actions={
          <Button variant="contained" startIcon={<AddOutlined />} onClick={add}>
            New income schedule
          </Button>
        }
      />

      <Stack spacing={2}>
        {error && <Alert severity="error">{error}</Alert>}
        {data.error && <Alert severity="error">{data.error}</Alert>}

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <StatCard label="Projected monthly income" value={formatMoney(projectedMonthlyIncome, base)} caption={`Active schedules, in ${base}`} />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <StatCard
              label="Active schedules"
              value={String(activeProfiles.length)}
              caption={pausedProfiles.length > 0 ? `${pausedProfiles.length} paused` : "None paused"}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <StatCard label="Deposits per month" value={String(expectedDeposits)} caption="Across active schedules" />
          </Grid>
        </Grid>

        <Panel title="Schedules" flush>
          {data.salaryProfiles.length === 0 ? (
            <EmptyState
              title="No income schedules"
              message="Add your salary or other regular income to have credits recorded automatically on each pay date."
              action={<Button startIcon={<AddOutlined />} onClick={add}>New income schedule</Button>}
            />
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>Pay days</TableCell>
                    <TableCell sx={{ display: { xs: "none", lg: "table-cell" } }}>Effective</TableCell>
                    <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Status</TableCell>
                    <TableCell align="right">Per paycheck</TableCell>
                    <TableCell align="right" sx={{ display: { xs: "none", md: "table-cell" } }}>Monthly</TableCell>
                    <TableCell align="right"><Box component="span" sx={visuallyHidden}>Actions</Box></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.salaryProfiles.map((profile) => (
                    <TableRow key={profile.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>{profile.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{labelOf(profile.group)} · {profile.currency}</Typography>
                      </TableCell>
                      <TableCell sx={{ display: { xs: "none", md: "table-cell" }, color: "text.secondary" }}>
                        {getSalaryPayDays(profile).map(ordinal).join(" & ")} of the month
                      </TableCell>
                      <TableCell sx={{ display: { xs: "none", lg: "table-cell" }, color: "text.secondary", whiteSpace: "nowrap" }}>{formatDate(profile.effectiveDate)}</TableCell>
                      <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>
                        <StatusBadge label={profile.active ? "Active" : "Paused"} status={profile.active ? "positive" : "neutral"} />
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                        {formatMoney(profile.amount, profile.currency)}
                      </TableCell>
                      <TableCell align="right" sx={{ display: { xs: "none", md: "table-cell" }, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", color: "text.secondary" }}>
                        {formatMoney(monthlyAmount(profile), profile.currency)}
                      </TableCell>
                      <TableCell align="right" sx={{ py: 0.5 }}>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => edit(profile)} aria-label={`Edit ${profile.name}`}><EditOutlined fontSize="small" /></IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Panel>

        <Typography variant="caption" color="text.secondary">
          Pay days are calendar dates (1–31); shorter months use their last day. Weekends and holidays are not shifted,
          and credits are only added once each date arrives.
        </Typography>
      </Stack>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? "Edit income schedule" : "New income schedule"}</DialogTitle>
        <Box component="form" onSubmit={form.handleSubmit(submit)}>
          <DialogContent dividers>
            <Grid container spacing={2} sx={{ mt: 0.25 }}>
              <Grid size={12}>
                <Controller name="name" control={form.control} render={({ field, fieldState }) => (
                  <TextField {...field} fullWidth label="Income name" error={!!fieldState.error} helperText={fieldState.error?.message} />
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
                <Controller name="effectiveDate" control={form.control} render={({ field, fieldState }) => (
                  <TextField {...field} fullWidth type="date" label="Effective date" slotProps={{ inputLabel: { shrink: true } }} error={!!fieldState.error} helperText={fieldState.error?.message} />
                )} />
              </Grid>
              <Grid size={{ xs: 12, sm: 7 }}>
                <Controller name="amount" control={form.control} render={({ field, fieldState }) => (
                  <TextField {...field} fullWidth type="number" inputProps={{ step: "0.01", min: "0" }} label="Amount per paycheck" error={!!fieldState.error} helperText={fieldState.error?.message} />
                )} />
              </Grid>
              <Grid size={{ xs: 12, sm: 5 }}>
                <Controller name="currency" control={form.control} render={({ field }) => (
                  <TextField {...field} fullWidth select label="Currency">
                    {CURRENCIES.map((currency) => <MenuItem key={currency} value={currency}>{currency}</MenuItem>)}
                  </TextField>
                )} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Controller name="payDay1" control={form.control} render={({ field, fieldState }) => (
                  <TextField {...field} fullWidth type="number" label="Pay day 1" inputProps={{ min: 1, max: 31 }} error={!!fieldState.error} helperText={fieldState.error?.message ?? "Required"} />
                )} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Controller name="payDay2" control={form.control} render={({ field, fieldState }) => (
                  <TextField {...field} fullWidth type="number" label="Pay day 2" inputProps={{ min: 1, max: 31 }} error={!!fieldState.error} helperText={fieldState.error?.message ?? "Optional for monthly schedules"} />
                )} />
              </Grid>
              <Grid size={12}>
                <Controller name="active" control={form.control} render={({ field }) => (
                  <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: "background.default", border: 1, borderColor: "divider" }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>Active schedule</Typography>
                        <Typography variant="body2" color="text.secondary">Paused schedules do not create new credits.</Typography>
                      </Box>
                      <Switch checked={field.value} onChange={(_, checked) => field.onChange(checked)} />
                    </Stack>
                  </Box>
                )} />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">{editing ? "Save changes" : "Add income"}</Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
