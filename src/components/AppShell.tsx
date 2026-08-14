import {
  AccountBalanceWalletRounded,
  AddCardRounded,
  DashboardRounded,
  LogoutRounded,
  PaymentsRounded,
  SettingsRounded,
} from "@mui/icons-material";
import {
  AppBar,
  Box,
  Button,
  Container,
  IconButton,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const links = [
  { to: "/", label: "Summary", icon: <DashboardRounded fontSize="small" /> },
  { to: "/transactions", label: "Transactions", icon: <PaymentsRounded fontSize="small" /> },
  { to: "/debts", label: "Debts", icon: <AddCardRounded fontSize="small" /> },
  { to: "/salary", label: "Earnings", icon: <AccountBalanceWalletRounded fontSize="small" /> },
  { to: "/settings", label: "Settings", icon: <SettingsRounded fontSize="small" /> },
];

export function AppShell() {
  const { user, logout } = useAuth();

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="sticky" color="inherit" elevation={0}>
        <Toolbar sx={{ borderBottom: 1, borderColor: "divider" }}>
          <Container maxWidth="xl">
            <Stack
              direction={{ xs: "column", md: "row" }}
              alignItems={{ xs: "stretch", md: "center" }}
              gap={1.5}
              py={1}
            >
              <Box sx={{ mr: { md: 2 } }}>
                <Typography variant="h6" fontWeight={900}>
                  My Finance
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {user?.email}
                </Typography>
              </Box>

              <Stack direction="row" gap={0.5} sx={{ flex: 1, overflowX: "auto" }}>
                {links.map((link) => (
                  <Button
                    key={link.to}
                    component={NavLink}
                    to={link.to}
                    startIcon={link.icon}
                    sx={{
                      whiteSpace: "nowrap",
                      "&.active": {
                        bgcolor: "action.selected",
                      },
                    }}
                  >
                    {link.label}
                  </Button>
                ))}
              </Stack>

              <Tooltip title="Sign out">
                <IconButton onClick={() => void logout()} aria-label="Sign out">
                  <LogoutRounded />
                </IconButton>
              </Tooltip>
            </Stack>
          </Container>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Outlet />
      </Container>
    </Box>
  );
}
