import React, { useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { api, getToken, RR_APP_ID } from "./lib/api";
import { startEarnUsageRewards } from "./lib/earnUsageRewards";
import BottomNav from "./components/ui/BottomNav";
import AuthScreen from "./components/modules/AuthScreen";
import Dashboard from "./components/modules/Dashboard";
import TimeTracking from "./components/modules/TimeTracking";
import Finance from "./components/modules/Finance";
import Schedule from "./components/modules/Schedule";
import More from "./components/modules/More";
import WorkLog from "./components/modules/WorkLog";
import Reports from "./components/modules/Reports";
import Stock from "./components/modules/Stock";
import Categories from "./components/modules/Categories";
import { AccountSettings, BusinessSettings, ProgramSettings, About, Feedback } from "./components/modules/Settings";
import DeveloperMessages from "./components/modules/DeveloperMessages";
import ProPaywall from "./components/ProPaywall";
import UpsellModal from "./components/UpsellModal";
import { recordNativeAdAction } from "./lib/nativeAds";

const IS_NATIVE = typeof window !== "undefined" && Boolean(window?.Capacitor?.isNativePlatform?.());

/** Native Android: count navigations toward interstitial ads (free users only; native enforces Pro). */
function NativeAdActionRecorder() {
  const loc = useLocation();
  const lastPath = useRef(null);
  useEffect(() => {
    if (!IS_NATIVE) return;
    if (lastPath.current !== null && lastPath.current !== loc.pathname) {
      recordNativeAdAction();
    }
    lastPath.current = loc.pathname;
  }, [loc.pathname]);
  return null;
}

function EarnUsageHeartbeat() {
  const { user, guest } = useAuth();
  const loc = useLocation();
  useEffect(() => {
    if (!user || guest) return undefined;
    return startEarnUsageRewards(api, {
      appId: RR_APP_ID,
      getToken,
      getPage: () => loc.pathname,
    });
  }, [user, guest, loc.pathname]);
  return null;
}

function Gate({ children }) {
  const { user, guest } = useAuth();
  const loc = useLocation();
  if (user === undefined) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center text-ink-tertiary text-sm">Loading…</div>
    );
  }
  if (!user && !guest) {
    return <Navigate to="/auth" replace state={{ from: loc.pathname }} />;
  }
  // Web: Pro-only. Native (Capacitor Android) bypasses the paywall and runs free-with-restrictions.
  if (user && user.plan !== "pro" && !IS_NATIVE) {
    return <ProPaywall />;
  }
  return children;
}

/** Left rail padding only when the sidebar is shown (not on /auth — avoids off-center sign-in on desktop). */
function AppLayoutShell() {
  const loc = useLocation();
  const padRail = !loc.pathname.startsWith("/auth");
  return (
    <div
      className={`business-web-main min-h-[100dvh] ${padRail ? "lg:pl-56" : ""} pt-[var(--rr-native-ad-banner-height,env(safe-area-inset-top,0px))]`}
    >
      <Outlet />
      <BottomNav />
      <UpsellModal />
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayoutShell />}>
      <Route path="/auth" element={<AuthScreen />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<Gate><Dashboard /></Gate>} />
      <Route path="/track" element={<Gate><TimeTracking /></Gate>} />
      <Route path="/money" element={<Gate><Finance /></Gate>} />
      <Route path="/schedule" element={<Gate><Schedule /></Gate>} />
      <Route path="/more" element={<Gate><More /></Gate>} />
      <Route path="/work-log" element={<Gate><WorkLog /></Gate>} />
      <Route path="/reports" element={<Gate><Reports /></Gate>} />
      <Route path="/stock" element={<Gate><Stock /></Gate>} />
      <Route path="/categories" element={<Gate><Categories /></Gate>} />
      <Route path="/account" element={<Gate><AccountSettings /></Gate>} />
      <Route path="/business" element={<Gate><BusinessSettings /></Gate>} />
      <Route path="/program" element={<Gate><ProgramSettings /></Gate>} />
      <Route path="/about" element={<Gate><About /></Gate>} />
      <Route path="/feedback" element={<Gate><Feedback /></Gate>} />
      <Route path="/developer-messages" element={<Gate><DeveloperMessages /></Gate>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <NativeAdActionRecorder />
        <EarnUsageHeartbeat />
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
