import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AuthenticatedShell } from "./components/AppShell";
import { isLoggedIn } from "./lib/api";
import { AuthPage, GeneratingPage, OnboardingPage } from "./screens/OnboardingPages";
import { GoalDetailPage, GoalsHomePage } from "./screens/GoalPages";
import { PublicGoalDetailPage, PublicGoalsListPage } from "./screens/PublicPages";

function RootEntry() {
  if (isLoggedIn()) return <Navigate to="/home" replace />;
  return <OnboardingPage />;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootEntry />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/generating" element={<GeneratingPage />} />
        <Route element={<AuthenticatedShell />}>
          <Route path="/home" element={<GoalsHomePage />} />
          <Route path="/goals/:id" element={<GoalDetailPage />} />
        </Route>
        <Route path="/:address/goals/:slug" element={<PublicGoalDetailPage />} />
        <Route path="/:address/goals" element={<PublicGoalsListPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
