import {
  AccountBalanceOutlined,
  AddOutlined,
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
  Button,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { TransactionDialog } from "./TransactionDialog";
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
  const navigate = useNavigate();
  const desktop = useMediaQuery(theme.breakpoints.up("lg"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [quickAdd, setQuickAdd] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const initials = (user?.email?.[0] ?? "U").toUpperCase();

  // "N" opens a new transaction from anywhere (unless typing in a field or a dialog is open).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key.toLowerCase() !== "n" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (target.closest("input, textarea, select, [contenteditable], [role=dialog]")) return;
      e.preventDefault();
      setQuickAdd(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
            <Tooltip title="New transaction (N)">
              <Button
                variant="contained"
                size="small"
                startIcon={<AddOutlined />}
                onClick={() => setQuickAdd(true)}
                sx={{ display: { xs: "none", sm: "inline-flex" } }}
              >
                New transaction
              </Button>
            </Tooltip>
            <IconButton
              onClick={() => setQuickAdd(true)}
              aria-label="New transaction"
              sx={{ display: { xs: "inline-flex", sm: "none" }, bgcolor: "primary.main", color: "#fff", "&:hover": { bgcolor: "primary.dark" } }}
              size="small"
            >
              <AddOutlined fontSize="small" />
            </IconButton>
            <IconButton
              onClick={(e) => setMenuAnchor(e.currentTarget)}
              aria-label="Account menu"
              aria-haspopup="menu"
              aria-expanded={menuAnchor ? "true" : undefined}
              sx={{ ml: 0.5, p: 0.25 }}
            >
              <Avatar sx={{ width: 32, height: 32, fontSize: 13, fontWeight: 600, bgcolor: colors.navyTint, color: colors.navy }}>
                {initials}
              </Avatar>
            </IconButton>
            <Menu
              anchorEl={menuAnchor}
              open={Boolean(menuAnchor)}
              onClose={() => setMenuAnchor(null)}
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
              transformOrigin={{ vertical: "top", horizontal: "right" }}
              slotProps={{ paper: { sx: { mt: 1, minWidth: 220, border: 1, borderColor: "divider", boxShadow: "0 8px 24px rgba(16,24,40,.10)" } } }}
            >
              <Box sx={{ px: 2, py: 1.25 }}>
                <Typography variant="caption" color="text.secondary">Signed in as</Typography>
                <Typography variant="body2" fontWeight={600} noWrap>{user?.email}</Typography>
              </Box>
              <Divider />
              <MenuItem onClick={() => { setMenuAnchor(null); navigate("/settings"); }}>
                <ListItemIcon><SettingsOutlined fontSize="small" /></ListItemIcon>
                Settings
              </MenuItem>
              <MenuItem onClick={() => { setMenuAnchor(null); void logout(); }}>
                <ListItemIcon><LogoutOutlined fontSize="small" /></ListItemIcon>
                Sign out
              </MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>

        <Box component="main" sx={{ px: { xs: 2, sm: 3, xl: 4 }, py: { xs: 2.5, sm: 3.5 }, maxWidth: 1400, mx: "auto" }}>
          <Outlet />
        </Box>
      </Box>

      <TransactionDialog open={quickAdd} entry={null} onClose={() => setQuickAdd(false)} />
    </Box>
  );
}
