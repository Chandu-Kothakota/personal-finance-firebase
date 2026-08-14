import {
  AccountBalanceWalletRounded,
  LockRounded,
  SecurityRounded,
  ShowChartRounded,
  VisibilityOffRounded,
  VisibilityRounded,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { toUserMessage } from "../lib/errors";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Box sx={{ minHeight: "100vh", display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.05fr .95fr" }, bgcolor: "#F3F6F9" }}>
      <Box sx={{ display: { xs: "none", lg: "flex" }, position: "relative", overflow: "hidden", p: 7, color: "#fff", bgcolor: "#0B1F33", alignItems: "center" }}>
        <Box sx={{ position: "absolute", width: 520, height: 520, borderRadius: "50%", bgcolor: "rgba(20,184,166,.12)", right: -180, top: -170 }} />
        <Box sx={{ position: "absolute", width: 320, height: 320, borderRadius: "50%", border: "1px solid rgba(255,255,255,.08)", left: -100, bottom: -100 }} />
        <Stack spacing={4.5} sx={{ position: "relative", maxWidth: 620 }}>
          <Stack direction="row" alignItems="center" gap={1.5}>
            <Box sx={{ width: 46, height: 46, borderRadius: 3, bgcolor: "#14B8A6", display: "grid", placeItems: "center" }}><AccountBalanceWalletRounded /></Box>
            <Box><Typography variant="h6" fontWeight={800}>Finance Command</Typography><Typography variant="body2" sx={{ color: "rgba(255,255,255,.58)" }}>Private wealth and debt workspace</Typography></Box>
          </Stack>
          <Box>
            <Chip label="PERSONAL FINANCE CONTROL" size="small" sx={{ mb: 2.5, bgcolor: "rgba(94,234,212,.12)", color: "#99F6E4", border: "1px solid rgba(94,234,212,.16)" }} />
            <Typography variant="h3" sx={{ maxWidth: 560, lineHeight: 1.08 }}>A clearer view of your entire financial position.</Typography>
            <Typography variant="h6" sx={{ mt: 2.5, color: "rgba(255,255,255,.62)", fontWeight: 500, maxWidth: 520, lineHeight: 1.6 }}>
              Monitor income, liabilities, spending and multi-currency balances from one secure private dashboard.
            </Typography>
          </Box>
          <Stack direction="row" spacing={3}>
            <Stack direction="row" gap={1.2} alignItems="center"><SecurityRounded sx={{ color: "#5EEAD4" }} /><Typography variant="body2" sx={{ color: "rgba(255,255,255,.72)" }}>Firebase secured</Typography></Stack>
            <Stack direction="row" gap={1.2} alignItems="center"><ShowChartRounded sx={{ color: "#5EEAD4" }} /><Typography variant="body2" sx={{ color: "rgba(255,255,255,.72)" }}>Live financial overview</Typography></Stack>
          </Stack>
        </Stack>
      </Box>

      <Box sx={{ display: "grid", placeItems: "center", px: 2.5, py: 6 }}>
        <Card sx={{ width: "100%", maxWidth: 470, boxShadow: "0 24px 60px rgba(16,24,40,.10)" }}>
          <CardContent sx={{ p: { xs: 3.5, sm: 5 } }}>
            <Stack spacing={3.2}>
              <Box>
                <Box sx={{ width: 44, height: 44, borderRadius: 2.5, bgcolor: "#E4F5F2", color: "#0F766E", display: "grid", placeItems: "center", mb: 2 }}><LockRounded /></Box>
                <Typography variant="h4">Welcome back</Typography>
                <Typography color="text.secondary" sx={{ mt: 1 }}>Sign in to access your private financial workspace.</Typography>
              </Box>

              {error && <Alert severity="error">{error}</Alert>}

              <Box component="form" onSubmit={submit}>
                <Stack spacing={2.2}>
                  <TextField label="Email address" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required fullWidth />
                  <TextField
                    label="Password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    fullWidth
                    slotProps={{ input: { endAdornment: <InputAdornment position="end"><IconButton onClick={() => setShowPassword((v) => !v)} edge="end">{showPassword ? <VisibilityOffRounded /> : <VisibilityRounded />}</IconButton></InputAdornment> } }}
                  />
                  <Button type="submit" variant="contained" size="large" disabled={submitting} sx={{ py: 1.15 }}>
                    {submitting ? "Signing in…" : "Sign in securely"}
                  </Button>
                </Stack>
              </Box>

              <Typography variant="caption" color="text.secondary" textAlign="center">
                Private access only · Authentication managed by Firebase
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
