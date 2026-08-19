import { zodResolver } from "@hookform/resolvers/zod";
import {
  AccountBalanceWalletRounded,
  AddRounded,
  CalendarMonthRounded,
  CheckCircleRounded,
  EditRounded,
  EventRepeatRounded,
  PauseCircleRounded,
  PaymentsRounded,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { LoadingScreen } from "../components/LoadingScreen";
import { useAuth } from "../context/AuthContext";
import { useFinanceData } from "../hooks/useFinanceData";
import { CURRENCIES, convertToBase, formatMoney } from "../lib/currency";
import { toUserMessage } from "../lib/errors";
import { saveSalaryProfile } from "../services/firestoreService";
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
        user.uid,
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

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} gap={2}>
        <Box>
          <Typography variant="h4">Recurring income</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.6 }}>
            Manage recurring earnings and see the monthly deposit schedule at a glance.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddRounded />} onClick={add} sx={{ alignSelf: { xs: "flex-start", md: "auto" } }}>
          Add earning
        </Button>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}
      {data.error && <Alert severity="error">{data.error}</Alert>}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card sx={{ height: "100%", border: "1px solid #E6EAF0", background: "linear-gradient(135deg, #E4F5F2 0%, #F3F6F9 65%)" }}>
            <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
                <Box>
                  <Typography variant="overline" sx={{ color: "text.secondary", fontWeight: 800, letterSpacing: ".09em" }}>PROJECTED MONTHLY INCOME</Typography>
                  <Typography variant="h4" sx={{ mt: 0.7, color: "#0B1F33", fontVariantNumeric: "tabular-nums" }}>
                    {formatMoney(projectedMonthlyIncome, base)}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1, color: "text.secondary" }}>
                    Active schedules normalized to {base}
                  </Typography>
                </Box>
                <Box sx={{ width: 46, height: 46, borderRadius: 3, display: "grid", placeItems: "center", bgcolor: "rgba(15,118,110,.12)", color: "#0F766E" }}>
                  <AccountBalanceWalletRounded />
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
              <Box sx={{ width: 40, height: 40, borderRadius: 2.5, display: "grid", placeItems: "center", bgcolor: "#EAF8F0", color: "#15803D" }}><CheckCircleRounded /></Box>
              <Typography variant="h5" sx={{ mt: 2 }}>{activeProfiles.length}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>Active schedule{activeProfiles.length === 1 ? "" : "s"}</Typography>
              {pausedProfiles.length > 0 && <Typography variant="caption" color="text.secondary">{pausedProfiles.length} paused</Typography>}
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
              <Box sx={{ width: 40, height: 40, borderRadius: 2.5, display: "grid", placeItems: "center", bgcolor: "#EAF1FF", color: "#2563EB" }}><EventRepeatRounded /></Box>
              <Typography variant="h5" sx={{ mt: 2 }}>{expectedDeposits}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>Expected deposit{expectedDeposits === 1 ? "" : "s"} per month</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Alert severity="info" icon={<CalendarMonthRounded />}>
        Pay days use calendar dates from 1–31; shorter months use their last valid day.
        Weekends and holidays are not shifted. Credits appear only after each scheduled date arrives.
      </Alert>

      {data.salaryProfiles.length === 0 ? (
        <Card>
          <CardContent>
            <Stack alignItems="center" textAlign="center" sx={{ py: 5 }}>
              <Box sx={{ width: 58, height: 58, borderRadius: 3, display: "grid", placeItems: "center", bgcolor: "#E4F5F2", color: "#0F766E" }}>
                <PaymentsRounded />
              </Box>
              <Typography variant="h6" sx={{ mt: 2 }}>No recurring income schedules</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.6, maxWidth: 450 }}>
                Add your salary or other predictable income to automate ledger credits when each pay date arrives.
              </Typography>
              <Button startIcon={<AddRounded />} onClick={add} sx={{ mt: 2 }}>Add earning</Button>
            </Stack>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {data.salaryProfiles.map((profile) => {
            const payDays = getSalaryPayDays(profile);
            const statusColor = profile.active ? "#16A34A" : "#98A2B3";

            return (
              <Grid key={profile.id} size={{ xs: 12, md: 6, xl: 4 }}>
                <Card sx={{ height: "100%", borderTop: `3px solid ${statusColor}` }}>
                  <CardContent sx={{ p: 2.5, height: "100%", display: "flex", flexDirection: "column", "&:last-child": { pb: 2.5 } }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
                      <Stack direction="row" gap={1.3} alignItems="center" sx={{ minWidth: 0 }}>
                        <Box sx={{ width: 42, height: 42, borderRadius: 2.5, display: "grid", placeItems: "center", bgcolor: profile.active ? "#EAF8F0" : "#F2F4F7", color: profile.active ? "#15803D" : "#667085", flexShrink: 0 }}>
                          {profile.active ? <PaymentsRounded /> : <PauseCircleRounded />}
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="h6" noWrap>{profile.name}</Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ textTransform: "capitalize" }}>{profile.group} income</Typography>
                        </Box>
                      </Stack>
                      <Tooltip title="Edit income schedule">
                        <IconButton size="small" onClick={() => edit(profile)} aria-label={`Edit ${profile.name}`}><EditRounded fontSize="small" /></IconButton>
                      </Tooltip>
                    </Stack>

                    <Stack direction="row" gap={0.8} flexWrap="wrap" sx={{ mt: 2 }}>
                      <Chip size="small" color={profile.active ? "success" : "default"} label={profile.active ? "Active" : "Paused"} />
                      <Chip size="small" variant="outlined" label={profile.currency} />
                      <Chip size="small" variant="outlined" label={`${payDays.length}× monthly`} />
                    </Stack>

                    <Box sx={{ mt: 2.4 }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>PER PAYCHECK</Typography>
                      <Typography variant="h5" sx={{ mt: 0.45, fontVariantNumeric: "tabular-nums" }}>
                        {formatMoney(profile.amount, profile.currency)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.45 }}>
                        {formatMoney(monthlyAmount(profile), profile.currency)} scheduled monthly
                      </Typography>
                    </Box>

                    <Divider sx={{ my: 2 }} />

                    <Typography variant="caption" color="text.secondary" fontWeight={700}>PAY SCHEDULE</Typography>
                    <Stack direction="row" gap={1} sx={{ mt: 1 }}>
                      {payDays.map((day, index) => (
                        <Box key={`${profile.id}-${day}`} sx={{ flex: 1, p: 1.4, borderRadius: 2.5, bgcolor: "#F8FAFC", border: "1px solid", borderColor: "divider" }}>
                          <Typography variant="caption" color="text.secondary">Pay day {index + 1}</Typography>
                          <Typography fontWeight={850} sx={{ mt: 0.2 }}>Day {day}</Typography>
                        </Box>
                      ))}
                    </Stack>

                    <Stack direction="row" alignItems="center" gap={0.8} sx={{ mt: 2, color: "text.secondary" }}>
                      <CalendarMonthRounded fontSize="small" />
                      <Typography variant="body2">Effective {profile.effectiveDate}</Typography>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? "Edit recurring income" : "Add recurring income"}</DialogTitle>
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
                  <Box sx={{ p: 1.8, borderRadius: 2.5, bgcolor: "#F8FAFC", border: "1px solid", borderColor: "divider" }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
                      <Box>
                        <Typography fontWeight={750}>Active schedule</Typography>
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
    </Stack>
  );
}
