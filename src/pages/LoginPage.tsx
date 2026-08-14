import {
  LockRounded,
  VisibilityOffRounded,
  VisibilityRounded,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
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
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        px: 2,
        background:
          "radial-gradient(circle at 20% 10%, rgba(78,70,229,.14), transparent 30%), radial-gradient(circle at 80% 90%, rgba(14,165,233,.12), transparent 30%)",
      }}
    >
      <Card sx={{ width: "100%", maxWidth: 430 }}>
        <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
          <Stack spacing={3}>
            <Box>
              <LockRounded sx={{ fontSize: 42, mb: 1 }} />
              <Typography variant="h4" fontWeight={900}>
                Welcome back
              </Typography>
              <Typography color="text.secondary">
                Sign in to your private finance dashboard.
              </Typography>
            </Box>

            {error && <Alert severity="error">{error}</Alert>}

            <Box component="form" onSubmit={submit}>
              <Stack spacing={2}>
                <TextField
                  label="Email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  fullWidth
                />
                <TextField
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  fullWidth
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowPassword((v) => !v)}
                            edge="end"
                          >
                            {showPassword ? <VisibilityOffRounded /> : <VisibilityRounded />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={submitting}
                >
                  {submitting ? "Signing in…" : "Sign in"}
                </Button>
              </Stack>
            </Box>

            <Typography variant="caption" color="text.secondary">
              No public signup is exposed. Create your one account in Firebase Authentication.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
