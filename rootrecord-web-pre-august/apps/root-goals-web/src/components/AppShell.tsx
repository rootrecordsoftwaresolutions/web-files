import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { isLoggedIn, logout } from "../lib/api";
import { recordNativeAdAction } from "../lib/nativeAds";
import { useGoalsStore } from "../store/useGoalsStore";
import { AppFooter } from "./AppFooter";

export function AuthenticatedShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { beginNewGoal } = useGoalsStore();
  const onGoalDetail = /^\/goals\/[^/]+/.test(location.pathname);

  if (!isLoggedIn()) {
    navigate("/auth", { replace: true });
    return null;
  }

  const addGoal = () => {
    recordNativeAdAction();
    beginNewGoal();
    navigate("/onboarding");
  };

  const signOut = async () => {
    recordNativeAdAction();
    try {
      await logout();
    } catch {
      /* ignore */
    }
    navigate("/auth", { replace: true });
  };

  return (
    <div className="app-shell">
      <header className="app-top-bar">
        {onGoalDetail ? (
          <button type="button" className="app-top-bar__back" onClick={() => navigate("/home")}>
            ← Goals
          </button>
        ) : (
          <span className="app-top-bar__brand">Root Goals</span>
        )}
        {!onGoalDetail ? (
          <button type="button" className="app-top-bar__action" onClick={signOut}>
            Sign out
          </button>
        ) : null}
      </header>

      <div className="app-shell__body">
        <Outlet />
      </div>

      <div className="app-shell__meta">
        <AppFooter />
      </div>

      <nav className="app-bottom-nav" aria-label="Main navigation">
        <NavLink
          to="/home"
          end
          className={({ isActive }) => `app-bottom-nav__item${isActive ? " is-active" : ""}`}
        >
          Goals
        </NavLink>
        <button type="button" className="app-bottom-nav__item app-bottom-nav__item--accent" onClick={addGoal}>
          Add goal
        </button>
      </nav>
    </div>
  );
}
