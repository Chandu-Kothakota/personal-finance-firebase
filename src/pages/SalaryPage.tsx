import { zodResolver } from "@hookform/resolvers/zod";
import { AddRounded, EditRounded } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "../context/AuthContext";
import { useFinanceData } from "../hooks/useFinanceData";
import { CURRENCIES, formatMoney } from "../lib/currency";
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

  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="h4" fontWeight={900}>Recurring earnings</Typography>
          <Typography color="text.secondary">
            Salary credits are materialized automatically when you open the app.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddRounded />} onClick={add}>
          Add earning
        </Button>
      </Stack>

      <Alert severity="info">
        Configure one or two pay days from 1–31. Shorter months use their last valid day,
        and credits are only created after each date arrives. Existing one-day profiles remain supported.
      </Alert>

      {error && <Alert severity="error">{error}</Alert>}

      <Grid container spacing={2}>
        {data.salaryProfiles.map((profile) => {
          const payDays = getSalaryPayDays(profile);
          const schedule = payDays.length === 2
            ? `days ${payDays[0]} and ${payDays[1]}`
            : `day ${payDays[0] ?? "not configured"}`;

          return (
            <Grid key={profile.id} size={{ xs: 12, md: 6 }}>
              <Card>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between">
                    <Box>
                      <Typography variant="h6" fontWeight={800}>{profile.name}</Typography>
                      <Typography color="text.secondary" variant="body2">
                        {profile.group} · every month on {schedule} · effective {profile.effectiveDate}
                      </Typography>
                    </Box>
                    <IconButton onClick={() => edit(profile)}><EditRounded /></IconButton>
                  </Stack>
                  <Typography variant="h5" fontWeight={900} sx={{ mt: 2 }}>
                    {formatMoney(profile.amount, profile.currency)}
                  </Typography>
                  <Typography variant="body2" color={profile.active ? "success.main" : "text.secondary"}>
                    {profile.active ? "Active" : "Paused"}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? "Edit recurring earning" : "Add recurring earning"}</DialogTitle>
        <Box component="form" onSubmit={form.handleSubmit(submit)}>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Controller name="name" control={form.control} render={({ field, fieldState }) => (
                <TextField {...field} label="Name" error={!!fieldState.error} helperText={fieldState.error?.message} />
              )} />
              <Controller name="group" control={form.control} render={({ field }) => (
                <TextField {...field} select label="Group">
                  <MenuItem value="primary">primary</MenuItem>
                  <MenuItem value="secondary">secondary</MenuItem>
                </TextField>
              )} />
              <Stack direction="row" spacing={2}>
                <Controller name="amount" control={form.control} render={({ field, fieldState }) => (
                  <TextField {...field} fullWidth type="number" inputProps={{ step: "0.01", min: "0" }} label="Amount" error={!!fieldState.error} helperText={fieldState.error?.message} />
                )} />
                <Controller name="currency" control={form.control} render={({ field }) => (
                  <TextField {...field} fullWidth select label="Currency">
                    {CURRENCIES.map((currency) => <MenuItem key={currency} value={currency}>{currency}</MenuItem>)}
                  </TextField>
                )} />
              </Stack>
              <Controller name="effectiveDate" control={form.control} render={({ field, fieldState }) => (
                <TextField {...field} type="date" label="Effective date" slotProps={{ inputLabel: { shrink: true } }} error={!!fieldState.error} helperText={fieldState.error?.message} />
              )} />
              <Stack direction="row" spacing={2}>
                <Controller name="payDay1" control={form.control} render={({ field, fieldState }) => (
                  <TextField {...field} fullWidth type="number" label="Pay day 1" inputProps={{ min: 1, max: 31 }} error={!!fieldState.error} helperText={fieldState.error?.message} />
                )} />
                <Controller name="payDay2" control={form.control} render={({ field, fieldState }) => (
                  <TextField {...field} fullWidth type="number" label="Pay day 2" inputProps={{ min: 1, max: 31 }} error={!!fieldState.error} helperText={fieldState.error?.message ?? "Optional for legacy monthly schedules"} />
                )} />
              </Stack>
              <Controller name="active" control={form.control} render={({ field }) => (
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography>Active</Typography>
                  <Switch checked={field.value} onChange={(_, checked) => field.onChange(checked)} />
                </Stack>
              )} />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">Save</Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Stack>
  );
}
