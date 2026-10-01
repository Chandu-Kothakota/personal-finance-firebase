import { zodResolver } from "@hookform/resolvers/zod";
import { AddOutlined, DeleteOutline, EditOutlined } from "@mui/icons-material";
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
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { LoadingScreen } from "../components/LoadingScreen";
import { EmptyState, PageHeader, Panel, StatCard, labelOf } from "../components/ui";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useFeedback } from "../hooks/useFeedback";
import { useFinanceData } from "../hooks/useFinanceData";
import { useIsMobile } from "../hooks/useIsMobile";
import { CURRENCIES, convertToBase, formatDate, formatMoney } from "../lib/currency";
import { nextPayDate, relativeDays, toIsoDate, todayIso } from "../lib/dates";
import { toUserMessage } from "../lib/errors";
import { deleteSalaryProfile, saveSalaryProfile } from "../services/apiService";
import { getSalaryPayDays } from "../services/salaryService";
import type { SalaryProfile } from "../types";

const schema = z
  .object({
    name: z.string().trim().min(1, "Give this income a name").max(80, "Keep it under 80 characters"),
    group: z.enum(["primary", "secondary"]),
    amount: z.coerce.number({ error: "Enter the amount per paycheck" }).positive("Amount must be greater than zero"),
    currency: z.enum(CURRENCIES),
    effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a start date"),
    payDay1: z.coerce.number().int().min(1).max(31),
    payDay2: z.coerce.number().int().min(0).max(31),
    active: z.boolean(),
  })
  .refine((v) => v.payDay2 === 0 || v.payDay1 !== v.payDay2, {
    path: ["payDay2"],
    message: "Choose a different day from the first pay day",
  });

type FormInput = z.input<typeof schema>;
type FormData = z.output<typeof schema>;

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

function ordinal(n: number) {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
}

function monthlyAmount(profile: SalaryProfile): number {
  return profile.amount * getSalaryPayDays(profile).length;
}

const emptyProfile: FormInput = {
  name: "Salary",
  group: "primary",
  amount: "",
  currency: "USD",
  effectiveDate: "",
  payDay1: 15,
  payDay2: 0,
  active: true,
};

export function SalaryPage() {
  useDocumentTitle("Income");
  const data = useFinanceData();
  const { notify, confirm } = useFeedback();
  const mobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SalaryProfile | null>(null);
  const [formError, setFormError] = useState("");
  const [toggling, setToggling] = useState<string | null>(null);

  const form = useForm<FormInput, unknown, FormData>({ resolver: zodResolver(schema), defaultValues: emptyProfile });

  useEffect(() => {
    if (!open) return;
    setFormError("");
    if (editing) {
      const days = getSalaryPayDays(editing);
      form.reset({
        name: editing.name,
        group: editing.group,
        amount: editing.amount,
        currency: editing.currency,
        effectiveDate: editing.effectiveDate,
        payDay1: days[0] ?? 15,
        payDay2: days[1] ?? 0,
        active: editing.active,
      });
    } else {
      form.reset({ ...emptyProfile, currency: data.settings.baseCurrency, effectiveDate: todayIso() });
    }
  }, [open, editing, data.settings.baseCurrency, form]);

  function add() {
    setEditing(null);
    setOpen(true);
  }

  function edit(profile: SalaryProfile) {
    setEditing(profile);
    setOpen(true);
  }

  async function submit(values: FormData) {
    setFormError("");
    try {
      const { payDay1, payDay2, ...profile } = values;
      await saveSalaryProfile(
        { ...profile, payDays: payDay2 === 0 ? [payDay1] : [payDay1, payDay2], payDay: payDay1 },
        editing?.id,
      );
      setOpen(false);
      notify(editing ? "Income schedule updated" : "Income schedule added");
      await data.refresh();
    } catch (err) {
      setFormError(toUserMessage(err));
    }
  }

  async function toggleActive(profile: SalaryProfile) {
    const { id, updatedAt: _updatedAt, ...rest } = profile;
    void _updatedAt;
    setToggling(id);
    try {
      await saveSalaryProfile({ ...rest, active: !profile.active }, id);
      notify(profile.active ? `${profile.name} paused. No new credits will be added.` : `${profile.name} resumed`);
      await data.refresh();
    } catch (err) {
      notify(toUserMessage(err), "error");
    } finally {
      setToggling(null);
    }
  }

  async function remove(profile: SalaryProfile) {
    const ok = await confirm({
      title: `Delete ${profile.name}?`,
      message: "Future credits will stop. Salary credits already recorded stay in your transactions.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteSalaryProfile(profile.id);
      notify("Income schedule deleted");
      await data.refresh();
    } catch (err) {
      notify(toUserMessage(err), "error");
    }
  }

  if (data.loading) return <LoadingScreen label="Loading income…" />;

  const activeProfiles = data.salaryProfiles.filter((profile) => profile.active);
  const pausedProfiles = data.salaryProfiles.filter((profile) => !profile.active);
  const projectedMonthlyIncome = data.fx
    ? activeProfiles.reduce((total, profile) => total + convertToBase(monthlyAmount(profile), profile.currency, data.fx!), 0)
    : 0;
  const base = data.settings.baseCurrency;
  const next = data.salaryProfiles
    .map((p) => ({ profile: p, date: nextPayDate(p) }))
    .filter((x): x is { profile: SalaryProfile; date: Date } => x.date !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime())[0];
  const saving = form.formState.isSubmitting;

  return (
    <Box>
      <PageHeader
        title="Income"
        description="Recurring income is recorded automatically on each pay date."
        actions={
          <Button variant="contained" startIcon={<AddOutlined />} onClick={add}>
            New income schedule
          </Button>
        }
      />

      <Stack spacing={2}>
        {data.error && (
          <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void data.refresh()}>Retry</Button>}>
            {data.error}
          </Alert>
        )}

        <Grid container spacing={2}>
          <Grid size={{ xs: 6, sm: 4 }}>
            <StatCard label="Expected per month" value={formatMoney(projectedMonthlyIncome, base)} caption="From active schedules" />
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <StatCard
              label="Next payday"
              value={next ? formatDate(toIsoDate(next.date)) : "—"}
              caption={next ? `${relativeDays(next.date)} · ${next.profile.name}` : "No active schedules"}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <StatCard
              label="Schedules"
              value={`${activeProfiles.length} active`}
              caption={pausedProfiles.length > 0 ? `${pausedProfiles.length} paused` : "None paused"}
            />
          </Grid>
        </Grid>

        <Panel title="Schedules" flush>
          {data.salaryProfiles.length === 0 ? (
            <EmptyState
              title="No income schedules"
              message="Add your salary or other regular income and it will be recorded automatically on each pay date."
              action={<Button variant="outlined" startIcon={<AddOutlined />} onClick={add}>New income schedule</Button>}
            />
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>Schedule</TableCell>
                    <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Next pay</TableCell>
                    <TableCell align="right">Per paycheck</TableCell>
                    <TableCell align="right" sx={{ display: { xs: "none", lg: "table-cell" } }}>Monthly</TableCell>
                    <TableCell align="center">Active</TableCell>
                    <TableCell align="right" sx={{ display: { xs: "none", sm: "table-cell" } }}><Box component="span" sx={visuallyHidden}>Actions</Box></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.salaryProfiles.map((profile) => {
                    const nextDate = nextPayDate(profile);
                    return (
                      <TableRow key={profile.id} hover onClick={() => edit(profile)} sx={{ cursor: "pointer" }}>
                        <TableCell sx={{ maxWidth: { xs: 120, sm: 260 } }}>
                          <Typography variant="body2" fontWeight={500} noWrap color={profile.active ? "text.primary" : "text.secondary"}>{profile.name}</Typography>
                          <Typography variant="caption" color="text.secondary" noWrap component="p">
                            {labelOf(profile.group)} · since {formatDate(profile.effectiveDate)}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ display: { xs: "none", md: "table-cell" }, color: "text.secondary" }}>
                          {getSalaryPayDays(profile).map(ordinal).join(" & ")} monthly
                        </TableCell>
                        <TableCell sx={{ display: { xs: "none", sm: "table-cell" }, whiteSpace: "nowrap" }}>
                          {nextDate ? (
                            <>
                              <Typography variant="body2">{formatDate(toIsoDate(nextDate))}</Typography>
                              <Typography variant="caption" color="text.secondary">{relativeDays(nextDate)}</Typography>
                            </>
                          ) : (
                            <Typography variant="body2" color="text.secondary">Paused</Typography>
                          )}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                          {formatMoney(profile.amount, profile.currency)}
                        </TableCell>
                        <TableCell align="right" sx={{ display: { xs: "none", lg: "table-cell" }, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", color: "text.secondary" }}>
                          {formatMoney(monthlyAmount(profile), profile.currency)}
                        </TableCell>
                        <TableCell align="center" sx={{ py: 0 }} onClick={(e) => e.stopPropagation()}>
                          <Tooltip title={profile.active ? "Pause this schedule" : "Resume this schedule"}>
                            <Switch
                              size="small"
                              checked={profile.active}
                              disabled={toggling === profile.id}
                              onChange={() => void toggleActive(profile)}
                              slotProps={{ input: { "aria-label": `${profile.name} active` } }}
                            />
                          </Tooltip>
                        </TableCell>
                        <TableCell align="right" sx={{ display: { xs: "none", sm: "table-cell" }, whiteSpace: "nowrap", py: 0.5 }} onClick={(e) => e.stopPropagation()}>
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => edit(profile)} aria-label={`Edit ${profile.name}`}><EditOutlined fontSize="small" /></IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton size="small" onClick={() => void remove(profile)} aria-label={`Delete ${profile.name}`}>
                              <DeleteOutline fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Panel>

        <Typography variant="caption" color="text.secondary">
          Pay days are calendar dates; in shorter months the last day of the month is used. Weekends and holidays aren't shifted,
          and each credit is added once its date arrives.
        </Typography>
      </Stack>

      <Dialog open={open} onClose={saving ? undefined : () => setOpen(false)} fullWidth maxWidth="sm" fullScreen={mobile}>
        <DialogTitle>{editing ? "Edit income schedule" : "New income schedule"}</DialogTitle>
        <Box component="form" onSubmit={form.handleSubmit(submit)} noValidate sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <DialogContent dividers>
            {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
            <Grid container spacing={2}>
              <Grid size={12}>
                <Controller name="name" control={form.control} render={({ field, fieldState }) => (
                  <TextField {...field} fullWidth label="Name" placeholder="e.g. Salary, Rental income" error={!!fieldState.error} helperText={fieldState.error?.message} />
                )} />
              </Grid>
              <Grid size={{ xs: 7, sm: 8 }}>
                <Controller name="amount" control={form.control} render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    value={field.value ?? ""}
                    fullWidth
                    autoFocus={!editing}
                    type="number"
                    label="Amount per paycheck"
                    placeholder="0.00"
                    slotProps={{ htmlInput: { step: "0.01", min: "0", inputMode: "decimal" } }}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )} />
              </Grid>
              <Grid size={{ xs: 5, sm: 4 }}>
                <Controller name="currency" control={form.control} render={({ field }) => (
                  <TextField {...field} fullWidth select label="Currency">
                    {CURRENCIES.map((currency) => <MenuItem key={currency} value={currency}>{currency}</MenuItem>)}
                  </TextField>
                )} />
              </Grid>
              <Grid size={6}>
                <Controller name="payDay1" control={form.control} render={({ field }) => (
                  <TextField {...field} fullWidth select label="Paid on" helperText="Day of the month">
                    {DAYS.map((d) => <MenuItem key={d} value={d}>{ordinal(d)}</MenuItem>)}
                  </TextField>
                )} />
              </Grid>
              <Grid size={6}>
                <Controller name="payDay2" control={form.control} render={({ field, fieldState }) => (
                  <TextField {...field} fullWidth select label="Also paid on" error={!!fieldState.error} helperText={fieldState.error?.message ?? "For twice-monthly pay"}>
                    <MenuItem value={0}>Not paid twice</MenuItem>
                    {DAYS.map((d) => <MenuItem key={d} value={d}>{ordinal(d)}</MenuItem>)}
                  </TextField>
                )} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Controller name="effectiveDate" control={form.control} render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    fullWidth
                    type="date"
                    label="Starting from"
                    slotProps={{ inputLabel: { shrink: true } }}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message ?? "Pay dates before this are skipped"}
                  />
                )} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Controller name="group" control={form.control} render={({ field }) => (
                  <TextField {...field} fullWidth select label="Account group">
                    <MenuItem value="primary">Primary</MenuItem>
                    <MenuItem value="secondary">Secondary</MenuItem>
                  </TextField>
                )} />
              </Grid>
              <Grid size={12}>
                <Controller name="active" control={form.control} render={({ field }) => (
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    gap={2}
                    sx={{ p: 1.5, borderRadius: 1, bgcolor: "background.default", border: 1, borderColor: "divider" }}
                  >
                    <Box>
                      <Typography variant="body2" fontWeight={600}>Active</Typography>
                      <Typography variant="body2" color="text.secondary">Paused schedules don't add new credits.</Typography>
                    </Box>
                    <Switch checked={field.value} onChange={(_, checked) => field.onChange(checked)} slotProps={{ input: { "aria-label": "Active" } }} />
                  </Stack>
                )} />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            {editing && mobile && (
              <Button color="error" onClick={() => { setOpen(false); void remove(editing); }} sx={{ mr: "auto" }}>Delete</Button>
            )}
            <Button onClick={() => setOpen(false)} color="inherit" disabled={saving}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Add schedule"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
