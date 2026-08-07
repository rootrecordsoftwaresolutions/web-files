import React from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { AuthProvider } from "./lib/auth";
import BottomNav from "./components/BottomNav";
import TopBar from "./components/TopBar";
import TickerStrip from "./components/TickerStrip";
import ServerHealthBanner from "./components/ServerHealthBanner";
import Home from "./pages/Home";
import Market from "./pages/Market";
import MarketDetail from "./pages/MarketDetail";
import Portfolio from "./pages/Portfolio";
import Rewards from "./pages/Rewards";
import Auth from "./pages/Auth";
import Leaderboards from "./pages/Leaderboards";
import More from "./pages/More";

export default function App() {
  const location = useLocation();
  const hideChrome = location.pathname === "/auth";
  return (
    <AuthProvider>
      <div className="max-w-md mx-auto min-h-screen relative bg-bg-base pb-safe">
        {!hideChrome && (
          <>
            <TopBar />
            <ServerHealthBanner />
            <TickerStrip />
          </>
        )}
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Home />} />
            <Route path="/market" element={<Market />} />
            <Route path="/market/:ticker" element={<MarketDetail />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/rewards" element={<Rewards />} />
            <Route path="/leaderboards" element={<Leaderboards />} />
            <Route path="/more" element={<More />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </AnimatePresence>
        {!hideChrome && <BottomNav />}
      </div>
    </AuthProvider>
  );
}
