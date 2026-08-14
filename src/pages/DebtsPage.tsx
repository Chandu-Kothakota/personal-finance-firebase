import { zodResolver } from "@hookform/resolvers/zod";
import { AddRounded, DeleteRounded, EditRounded } from "@mui/icons-material";
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
import { deleteDebt, saveDebt } from "../services/firestoreService";
import type { Debt } from "../types";

const schema = z.object({
  group: z.enum(["primary", "secondary"]),
  name: z.string().trim().min(1).max(80),
  category: z.string().trim().min(1).max(60),
  kind: z.enum(["credit_card", "loan", "misc"]),
  balance: z.coerce.number().min(0),
  currency: z.enum(CURRENCIES),
  notes: z.string().max(300).optional(),
});

type FormInput = z.input<typeof schema>;
type FormData = z.output<typeof schema>;

const defaults: FormData = {
  group: "primary",
  name: "",
  category: "Credit Card",
  kind: "credit_card",
  balance: 0,
  currency: "INR",
  notes: "",
};

export function DebtsPage() {
  const { user } = useAuth();
  const data = useFinanceData();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Debt | null>(null);
  const [error, setError] = useState("");

  const form = useForm<FormInput, unknown, FormData>({ resolver: zodResolver(schema), defaultValues: defaults });

  function newDebt() {
    setEditing(null);
    form.reset(defaults);
    setOpen(true);
  }

  function edit(debt: Debt) {
    setEditing(debt);
    form.reset({
      group: debt.group,
      name: debt.name,
      category: debt.category,
      kind: debt.kind,
      balance: debt.balance,
      currency: debt.currency,
      notes: debt.notes ?? "",
    });
    setOpen(true);
  }

  async function submit(values: FormData) {
    if (!user) return;
    try {
      setError("");
      await saveDebt(user.uid, values, editing?.id);
      setOpen(false);
      await data.refresh();
    } catch (err) {
      setError(toUserMessage(err));
    }
  }

  async function remove(id: string) {
    if (!user || !window.confirm("Delete this debt?")) return;
    try {
      await deleteDebt(user.uid, id);
      await data.refresh();
    } catch (err) {
      setError(toUserMessage(err));
    }
  }

  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="h4" fontWeight={900}>Debts</Typography>
          <Typography color="text.secondary">
            Track INR, CAD, USD and other balances separately.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddRounded />} onClick={newDebt}>
          Add debt
        </Button>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      <Grid container spacing={2}>
        {data.debts.map((debt) => (
          <Grid key={debt.id} size={{ xs: 12, sm: 6, lg: 4 }}>
            <Card>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" gap={1}>
                  <Box>
                    <Typography variant="h6" fontWeight={800}>{debt.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {debt.group} · {debt.category} · {debt.kind.replace("_", " ")}
                    </Typography>
                  </Box>
                  <Stack direction="row">
                    <IconButton onClick={() => edit(debt)}><EditRounded /></IconButton>
                    <IconButton onClick={() => void remove(debt.id)}><DeleteRounded /></IconButton>
                  </Stack>
                </Stack>
                <Typography variant="h5" fontWeight={900} sx={{ mt: 2 }}>
                  {formatMoney(debt.balance, debt.currency)}
                </Typography>
                {debt.notes && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {debt.notes}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? "Edit debt" : "Add debt"}</DialogTitle>
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
              <Controller name="category" control={form.control} render={({ field, fieldState }) => (
                <TextField {...field} label="Category" error={!!fieldState.error} helperText={fieldState.error?.message} />
              )} />
              <Controller name="kind" control={form.control} render={({ field }) => (
                <TextField {...field} select label="Debt type">
                  <MenuItem value="credit_card">Credit card</MenuItem>
                  <MenuItem value="loan">Loan</MenuItem>
                  <MenuItem value="misc">Miscellaneous</MenuItem>
                </TextField>
              )} />
              <Stack direction="row" spacing={2}>
                <Controller name="balance" control={form.control} render={({ field, fieldState }) => (
                  <TextField {...field} fullWidth type="number" inputProps={{ step: "0.01", min: "0" }} label="Balance" error={!!fieldState.error} helperText={fieldState.error?.message} />
                )} />
                <Controller name="currency" control={form.control} render={({ field }) => (
                  <TextField {...field} select fullWidth label="Currency">
                    {CURRENCIES.map((currency) => <MenuItem key={currency} value={currency}>{currency}</MenuItem>)}
                  </TextField>
                )} />
              </Stack>
              <Controller name="notes" control={form.control} render={({ field }) => (
                <TextField {...field} label="Notes" multiline minRows={2} />
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
