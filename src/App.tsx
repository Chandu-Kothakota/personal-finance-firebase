import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { LoadingScreen } from "./components/LoadingScreen";
import { useAuth } from "./context/AuthContext";
import { DashboardPage } from "./pages/DashboardPage";
import { DebtsPage } from "./pages/DebtsPage";
import { LoginPage } from "./pages/LoginPage";
import { SalaryPage } from "./pages/SalaryPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TransactionsPage } from "./pages/TransactionsPage";

function ProtectedLayout() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen label="Checking your session…" />;
  if (!user) return <Navigate to="/login" replace />;

  return <AppShell />;
}

export default function App() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={
          loading ? (
            <LoadingScreen />
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
