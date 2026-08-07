import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { WalletProvider, useWallet } from "./contexts/WalletContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import BottomNav from "./components/ui/BottomNav";
import Toast, { ToastProvider } from "./components/ui/Toast";
import AuthScreen from "./components/modules/AuthScreen";
import Connect from "./components/modules/Connect";
import Dashboard from "./components/modules/Dashboard";
import Send from "./components/modules/Send";
import Receive from "./components/modules/Receive";
import History from "./components/modules/History";
import Settings from "./components/modules/Settings";
import DeveloperMessages from "./components/modules/DeveloperMessages";
import Feedback from "./components/modules/Feedback";
import AddressBook from "./components/modules/AddressBook";
import MyWallet from "./components/modules/MyWallet";
import About from "./components/modules/About";

function AuthGate({ children }) {
  const { user } = useAuth();
  const loc = useLocation();
  if (user === undefined) {
    return <div className="page-shell p-6 text-ink-tertiary">Loading…</div>;
  }
  if (!user) {
    return <Navigate to="/auth" replace state={{ from: loc.pathname }} />;
  }
  return children;
}

function Gate({ children }) {
  const { isConnected } = useWallet();
  const loc = useLocation();
  if (!isConnected) {
    return <Navigate to="/connect" replace state={{ from: loc.pathname }} />;
  }
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthScreen />} />
      <Route path="/connect" element={<Connect />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="/dashboard"
        element={
          <AuthGate>
            <Gate><Dashboard /></Gate>
          </AuthGate>
        }
      />
      <Route
        path="/send"
        element={
          <AuthGate>
            <Gate><Send /></Gate>
          </AuthGate>
        }
      />
      <Route
        path="/receive"
        element={
          <AuthGate>
            <Gate><Receive /></Gate>
          </AuthGate>
        }
      />
      <Route
        path="/history"
        element={
          <AuthGate>
            <Gate><History /></Gate>
          </AuthGate>
        }
      />
      <Route
        path="/settings"
        element={
          <AuthGate>
            <Gate><Settings /></Gate>
          </AuthGate>
        }
      />
      <Route
        path="/developer-messages"
        element={
          <AuthGate>
            <Gate><DeveloperMessages /></Gate>
          </AuthGate>
        }
      />
      <Route
        path="/feedback"
        element={
          <AuthGate>
            <Gate><Feedback /></Gate>
          </AuthGate>
        }
      />
      <Route
        path="/contacts"
        element={
          <AuthGate>
            <Gate><AddressBook /></Gate>
          </AuthGate>
        }
      />
      <Route
        path="/my-wallet"
        element={
          <AuthGate>
            <MyWallet />
          </AuthGate>
        }
      />
      <Route
        path="/about"
        element={
          <AuthGate>
            <About />
          </AuthGate>
        }
      />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <WalletProvider>
        <ToastProvider>
          <BrowserRouter>
            <div className="min-h-[100dvh] lg:pl-56" data-testid="app-root">
              <AppRoutes />
              <BottomNav />
              <Toast />
            </div>
          </BrowserRouter>
        </ToastProvider>
      </WalletProvider>
    </AuthProvider>
  );
}
