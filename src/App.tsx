import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { Box, CircularProgress } from "@mui/material";
import { useAuth } from "./context/AuthContext";
import { FinanceDataProvider } from "./context/FinanceDataProvider";
import { DashboardPage } from "./pages/DashboardPage";
import { DebtsPage } from "./pages/DebtsPage";
import { LoginPage } from "./pages/LoginPage";
import { SalaryPage } from "./pages/SalaryPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TransactionsPage } from "./pages/TransactionsPage";

function SessionSplash() {
  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center" }} role="status" aria-label="Checking your session">
      <CircularProgress size={28} />
    </Box>
  );
}

function ProtectedLayout() {
  const { user, loading } = useAuth();

  if (loading) return <SessionSplash />;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <FinanceDataProvider>
      <AppShell />
    </FinanceDataProvider>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={
          loading ? (
            <SessionSplash />
          ) : user ? (
            <Navigate to="/" replace />
          ) : (
            <LoginPage />
          )
        }
      />

      <Route element={<ProtectedLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/debts" element={<DebtsPage />} />
        <Route path="/salary" element={<SalaryPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
