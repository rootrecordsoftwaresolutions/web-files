import React, { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { api, getToken, RR_APP_ID } from "./lib/api";
import { startEarnUsageRewards } from "./lib/earnUsageRewards";
import BottomNav from "./components/ui/BottomNav";
import AuthScreen from "./components/modules/AuthScreen";
import Home from "./components/modules/Home";
import ConnectedApps from "./components/modules/ConnectedApps";
import Security from "./components/modules/Security";
import Subscription from "./components/modules/Subscription";
import Notifications from "./components/modules/Notifications";
import Account from "./components/modules/Account";
import { About, Help } from "./components/modules/Info";
import Feedback from "./components/modules/Feedback";
import DeveloperMessages from "./components/modules/DeveloperMessages";

function EarnUsageHeartbeat() {
  const { user } = useAuth();
  const loc = useLocation();
  useEffect(() => {
    if (!user) return undefined;
    return startEarnUsageRewards(api, {
      appId: RR_APP_ID,
      getToken,
      getPage: () => loc.pathname,
    });
  }, [user, loc.pathname]);
  return null;
}

function Gate({ children }) {
  const { user } = useAuth();
  const loc = useLocation();
  if (user === undefined) {
    return (
      <div
        data-testid="auth-loading"
        className="min-h-[100dvh] flex items-center justify-center text-ink-tertiary text-sm"
      >
        Loading…
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/auth" replace state={{ from: loc.pathname }} />;
  }
  return children;
}

/** If the user is already signed in, /auth bounces back to /home. */
function AuthOrRedirect() {
  const { user } = useAuth();
  if (user === undefined) {
    return (
      <div
        data-testid="auth-loading"
        className="min-h-[100dvh] flex items-center justify-center text-ink-tertiary text-sm"
      >
        Loading…
      </div>
    );
  }
  if (user) return <Navigate to="/home" replace />;
  return <AuthScreen />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthOrRedirect />} />
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="/home" element={<Gate><Home /></Gate>} />
      <Route path="/apps" element={<Gate><ConnectedApps /></Gate>} />
      <Route path="/security" element={<Gate><Security /></Gate>} />
      <Route path="/subscription" element={<Gate><Subscription /></Gate>} />
      <Route path="/notifications" element={<Gate><Notifications /></Gate>} />
      <Route path="/account" element={<Gate><Account /></Gate>} />
      <Route path="/about" element={<Gate><About /></Gate>} />
      <Route path="/help" element={<Gate><Help /></Gate>} />
      <Route path="/feedback" element={<Gate><Feedback /></Gate>} />
      <Route path="/developer-messages" element={<Gate><DeveloperMessages /></Gate>} />
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <EarnUsageHeartbeat />
      <div
        className="min-h-[100dvh] lg:pl-56"
        style={{
          paddingTop: "env(safe-area-inset-top, 0px)",
        }}
      >
        <AppRoutes />
        <BottomNav />
      </div>
    </AuthProvider>
  );
}
