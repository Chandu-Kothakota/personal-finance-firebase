import {
  AccountBalanceOutlined,
  CreditCardOutlined,
  DashboardOutlined,
  LogoutOutlined,
  MenuOutlined,
  ReceiptLongOutlined,
  SettingsOutlined,
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
import { colors } from "../theme/theme";

const drawerWidth = 232;

const links = [
  { to: "/", label: "Overview", icon: <DashboardOutlined fontSize="small" /> },
  { to: "/transactions", label: "Transactions", icon: <ReceiptLongOutlined fontSize="small" /> },
  { to: "/debts", label: "Debts", icon: <CreditCardOutlined fontSize="small" /> },
  { to: "/salary", label: "Income", icon: <AccountBalanceOutlined fontSize="small" /> },
];

const secondaryLinks = [
  { to: "/settings", label: "Settings", icon: <SettingsOutlined fontSize="small" /> },
];

function isActive(pathname: string, to: string) {
  return to === "/" ? pathname === "/" : pathname.startsWith(to);
}

export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: 1,
        bgcolor: colors.navy,
        color: "#fff",
        display: "grid",
        placeItems: "center",
        fontWeight: 700,
        fontSize: size * 0.5,
        flexShrink: 0,
      }}
    >
      M
    </Box>
  );
}

function NavList({ items, onNavigate }: { items: typeof links; onNavigate?: () => void }) {
  const { pathname } = useLocation();
  return (
    <List disablePadding>
      {items.map((link) => {
        const active = isActive(pathname, link.to);
        return (
          <ListItemButton
            key={link.to}
            component={NavLink}
            to={link.to}
            onClick={onNavigate}
            sx={{
              mb: 0.25,
              borderRadius: 1,
              minHeight: 38,
              px: 1.5,
              color: active ? colors.navy : colors.textSecondary,
              bgcolor: active ? colors.navyTint : "transparent",
              "&:hover": { bgcolor: active ? colors.navyTint : colors.subtle, color: colors.text },
            }}
          >
            <ListItemIcon sx={{ minWidth: 32, color: "inherit" }}>{link.icon}</ListItemIcon>
            <ListItemText
              primary={link.label}
              slotProps={{ primary: { fontSize: 14, fontWeight: active ? 600 : 500 } }}
            />
          </ListItemButton>
        );
      })}
    </List>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Stack sx={{ height: "100%", bgcolor: colors.surface, borderRight: 1, borderColor: "divider" }}>
      <Stack direction="row" alignItems="center" gap={1.25} sx={{ px: 2.25, height: 60 }}>
        <BrandMark />
        <Typography fontWeight={600} fontSize={15}>My Finance</Typography>
      </Stack>
      <Divider />
      <Box sx={{ px: 1.25, pt: 2, flex: 1 }}>
        <Typography variant="overline" color="text.disabled" sx={{ px: 1.5, display: "block", mb: 0.5 }}>
          Accounts
        </Typography>
        <NavList items={links} onNavigate={onNavigate} />
      </Box>
      <Box sx={{ px: 1.25, pb: 2 }}>
        <NavList items={secondaryLinks} onNavigate={onNavigate} />
      </Box>
    </Stack>
  );
}

export function AppShell() {
  const { user, logout } = useAuth();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up("lg"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const initials = (user?.email?.[0] ?? "U").toUpperCase();

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      {desktop ? (
        <Drawer variant="permanent" sx={{ width: drawerWidth, flexShrink: 0, "& .MuiDrawer-paper": { width: drawerWidth, border: 0 } }}>
          <Sidebar />
        </Drawer>
      ) : (
        <Drawer
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ "& .MuiDrawer-paper": { width: drawerWidth, border: 0 } }}
        >
          <Sidebar onNavigate={() => setMobileOpen(false)} />
        </Drawer>
      )}

      <Box sx={{ ml: { lg: `${drawerWidth}px` } }}>
        <AppBar
          position="sticky"
          elevation={0}
          color="inherit"
          sx={{ bgcolor: colors.surface, borderBottom: 1, borderColor: "divider" }}
        >
          <Toolbar sx={{ minHeight: { xs: 56, sm: 60 }, gap: 1 }}>
            {!desktop && (
              <>
                <IconButton onClick={() => setMobileOpen(true)} edge="start" aria-label="Open navigation">
                  <MenuOutlined />
                </IconButton>
                <BrandMark size={26} />
              </>
            )}
            <Box sx={{ flex: 1 }} />
            <Typography variant="body2" color="text.secondary" sx={{ display: { xs: "none", sm: "block" } }}>
              {user?.email}
            </Typography>
            <Avatar sx={{ width: 30, height: 30, fontSize: 13, fontWeight: 600, bgcolor: colors.navyTint, color: colors.navy }}>
              {initials}
            </Avatar>
            <Tooltip title="Sign out">
              <IconButton onClick={() => void logout()} aria-label="Sign out" size="small">
                <LogoutOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
          </Toolbar>
        </AppBar>

        <Box component="main" sx={{ px: { xs: 2, sm: 3, xl: 4 }, py: { xs: 2.5, sm: 3.5 }, maxWidth: 1400, mx: "auto" }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
