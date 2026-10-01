import { VisibilityOffOutlined, VisibilityOutlined } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  IconButton,
  InputAdornment,
  Link,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { BrandMark } from "../components/AppShell";
import { useAuth } from "../context/AuthContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { toUserMessage } from "../lib/errors";

export function LoginPage() {
  useDocumentTitle("Sign in");
  const { login, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

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

  async function forgot() {
    setError("");
    setInfo("");
    if (!email.trim()) {
      setError("Enter your email above first, then choose “Forgot password?” again.");
      return;
    }
    try {
      await resetPassword(email);
      setInfo(`If an account exists for ${email.trim()}, a reset link is on its way.`);
    } catch (err) {
      setError(toUserMessage(err));
    }
  }

  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", bgcolor: "background.default", px: 2, py: 6 }}>
      <Box sx={{ width: "100%", maxWidth: 400 }}>
        <Stack direction="row" alignItems="center" justifyContent="center" gap={1.25} sx={{ mb: 3 }}>
          <BrandMark size={34} />
          <Typography fontWeight={600} fontSize={18}>My Finance</Typography>
        </Stack>

        <Card sx={{ p: { xs: 3, sm: 4 } }}>
          <Typography variant="h5" component="h1">Sign in</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
            Use your account email and password.
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {info && <Alert severity="success" sx={{ mb: 2 }}>{info}</Alert>}

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
                autoFocus
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
                          size="small"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <VisibilityOffOutlined fontSize="small" /> : <VisibilityOutlined fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <Box sx={{ textAlign: "right", mt: "-6px !important" }}>
                <Link component="button" type="button" variant="body2" underline="hover" onClick={() => void forgot()}>
                  Forgot password?
                </Link>
              </Box>
              <Button type="submit" variant="contained" size="large" disabled={submitting} fullWidth>
                {submitting ? "Signing in…" : "Sign in"}
              </Button>
            </Stack>
          </Box>
        </Card>

        <Typography variant="caption" color="text.secondary" component="p" textAlign="center" sx={{ mt: 2.5 }}>
          Private access only.
        </Typography>
      </Box>
    </Box>
  );
}
