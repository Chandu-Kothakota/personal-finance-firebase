import {
  AccountBalanceWalletRounded,
  AddCardRounded,
  DashboardRounded,
  LogoutRounded,
  MenuRounded,
  PaymentsRounded,
  SettingsRounded,
  ShieldRounded,
} from "@mui/icons-material";
import {
  AppBar,
  Avatar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const drawerWidth = 252;

const links = [
  { to: "/", label: "Overview", icon: <DashboardRounded fontSize="small" /> },
  { to: "/transactions", label: "Transactions", icon: <PaymentsRounded fontSize="small" /> },
  { to: "/debts", label: "Debt portfolio", icon: <AddCardRounded fontSize="small" /> },
  { to: "/salary", label: "Income", icon: <AccountBalanceWalletRounded fontSize="small" /> },
  { to: "/settings", label: "Settings", icon: <SettingsRounded fontSize="small" /> },
];

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  const location = useLocation();

  return (
    <Stack sx={{ height: "100%", bgcolor: "#0B1F33", color: "#fff" }}>
      <Box sx={{ px: 2.5, py: 2.6 }}>
        <Stack direction="row" alignItems="center" gap={1.4}>
          <Box sx={{ width: 38, height: 38, borderRadius: 2.5, bgcolor: "#14B8A6", display: "grid", placeItems: "center", boxShadow: "0 8px 20px rgba(20,184,166,.25)" }}>
            <AccountBalanceWalletRounded fontSize="small" />
          </Box>
          <Box>
            <Typography fontWeight={800} lineHeight={1.1}>Finance Command</Typography>
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,.58)" }}>Personal financial control</Typography>
          </Box>
        </Stack>
      </Box>

      <Divider sx={{ borderColor: "rgba(255,255,255,.09)" }} />

      <Box sx={{ px: 1.5, pt: 2, flex: 1 }}>
        <Typography variant="overline" sx={{ px: 1.25, color: "rgba(255,255,255,.42)", fontWeight: 800, letterSpacing: ".08em" }}>
          Workspace
        </Typography>
        <List sx={{ mt: 0.8 }}>
          {links.map((link) => {
            const active = link.to === "/" ? location.pathname === "/" : location.pathname.startsWith(link.to);
            return (
              <ListItemButton
                key={link.to}
                component={NavLink}
                to={link.to}
                onClick={onNavigate}
                sx={{
                  mb: 0.5,
                  borderRadius: 2.5,
                  minHeight: 46,
                  color: active ? "#FFFFFF" : "rgba(255,255,255,.68)",
                  bgcolor: active ? "rgba(20,184,166,.16)" : "transparent",
                  border: active ? "1px solid rgba(20,184,166,.22)" : "1px solid transparent",
                  transition: "background-color .15s ease, color .15s ease, transform .15s ease",
                  "&:hover": { bgcolor: "rgba(255,255,255,.07)", color: "#FFFFFF", transform: "translateX(2px)" },
                }}
              >
                <ListItemIcon sx={{ minWidth: 38, color: "inherit" }}>{link.icon}</ListItemIcon>
                <ListItemText primary={link.label} primaryTypographyProps={{ fontSize: 14, fontWeight: active ? 750 : 600 }} />
              </ListItemButton>
            );
          })}
        </List>
      </Box>

      <Box sx={{ p: 2 }}>
        <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: "rgba(255,255,255,.055)", border: "1px solid rgba(255,255,255,.08)" }}>
          <Stack direction="row" alignItems="center" gap={1.2}>
            <ShieldRounded sx={{ color: "#5EEAD4", fontSize: 20 }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="caption" sx={{ display: "block", color: "rgba(255,255,255,.52)" }}>Secured with Firebase</Typography>
              <Typography variant="body2" fontWeight={700} noWrap>{user?.email ?? "Private account"}</Typography>
            </Box>
          </Stack>
        </Box>
      </Box>
    </Stack>
  );
}

export function AppShell() {
  const { user, logout } = useAuth();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up("lg"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const initials = (user?.email?.[0] ?? "F").toUpperCase();

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      {desktop ? (
        <Drawer variant="permanent" sx={{ width: drawerWidth, flexShrink: 0, "& .MuiDrawer-paper": { width: drawerWidth, border: 0 } }}>
          <Sidebar />
        </Drawer>
      ) : (
        <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)} ModalProps={{ keepMounted: true }} sx={{ "& .MuiDrawer-paper": { width: drawerWidth, border: 0 } }}>
          <Sidebar onNavigate={() => setMobileOpen(false)} />
        </Drawer>
      )}

      <Box sx={{ ml: { lg: `${drawerWidth}px` } }}>
        <AppBar position="sticky" elevation={0} color="inherit" sx={{ bgcolor: "rgba(255,255,255,.92)", backdropFilter: "blur(16px)", borderBottom: "1px solid", borderColor: "divider" }}>
          <Toolbar sx={{ minHeight: 68 }}>
            {!desktop && (
              <IconButton onClick={() => setMobileOpen(true)} sx={{ mr: 1 }}><MenuRounded /></IconButton>
            )}
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" color="text.secondary" fontWeight={600}>Personal Finance</Typography>
              <Typography fontWeight={800}>Financial Control Center</Typography>
            </Box>
            <Stack direction="row" alignItems="center" gap={1.2}>
              <Box sx={{ display: { xs: "none", sm: "block" }, textAlign: "right" }}>
                <Typography variant="body2" fontWeight={700}>Private workspace</Typography>
                <Typography variant="caption" color="text.secondary">{user?.email}</Typography>
              </Box>
              <Avatar sx={{ width: 36, height: 36, bgcolor: "#E4F5F2", color: "#0F766E", fontWeight: 800 }}>{initials}</Avatar>
              <Tooltip title="Sign out">
                <IconButton onClick={() => void logout()} aria-label="Sign out"><LogoutRounded fontSize="small" /></IconButton>
              </Tooltip>
            </Stack>
          </Toolbar>
        </AppBar>

        <Box component="main" sx={{ p: { xs: 2, sm: 3, xl: 4 }, maxWidth: 1600, mx: "auto" }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
