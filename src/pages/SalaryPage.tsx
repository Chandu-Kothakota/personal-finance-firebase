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
import type { SalaryProfile } from "../types";

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  group: z.enum(["primary", "secondary"]),
  amount: z.coerce.number().positive(),
  currency: z.enum(CURRENCIES),
  effectiveDate: z.string().min(1),
  payDay: z.coerce.number().int().min(1).max(28),
  active: z.boolean(),
});

type FormInput = z.input<typeof schema>;
type FormData = z.output<typeof schema>;

const defaults: FormData = {
  name: "Primary Salary",
  group: "primary",
  amount: 0,
  currency: "USD",
  effectiveDate: new Date().toISOString().slice(0, 10),
  payDay: 15,
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
    setEditing(profile);
    form.reset({
      name: profile.name,
      group: profile.group,
      amount: profile.amount,
      currency: profile.currency,
      effectiveDate: profile.effectiveDate,
      payDay: profile.payDay,
      active: profile.active,
    });
    setOpen(true);
  }

  async function submit(values: FormData) {
    if (!user) return;
    try {
      setError("");
      await saveSalaryProfile(user.uid, values, editing?.id);
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
        Default pay day is the 15th. The effective date controls when auto-crediting starts.
        Editing the profile affects future missing occurrences; already-created salary entries remain editable in Transactions.
      </Alert>

      {error && <Alert severity="error">{error}</Alert>}

      <Grid container spacing={2}>
        {data.salaryProfiles.map((profile) => (
          <Grid key={profile.id} size={{ xs: 12, md: 6 }}>
            <Card>
              <CardContent>
                <Stack direction="row" justifyContent="space-between">
                  <Box>
                    <Typography variant="h6" fontWeight={800}>{profile.name}</Typography>
                    <Typography color="text.secondary" variant="body2">
                      {profile.group} · every month on day {profile.payDay} · effective {profile.effectiveDate}
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
        ))}
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
              <Controller name="payDay" control={form.control} render={({ field, fieldState }) => (
                <TextField {...field} type="number" label="Pay day" inputProps={{ min: 1, max: 28 }} error={!!fieldState.error} helperText={fieldState.error?.message} />
              )} />
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
