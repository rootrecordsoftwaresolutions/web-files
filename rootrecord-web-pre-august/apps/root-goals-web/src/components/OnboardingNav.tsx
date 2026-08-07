import { useNavigate } from "react-router-dom";

import { isLoggedIn } from "../lib/api";

export function OnboardingNav({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate();

  return (
    <header className="app-top-bar app-top-bar--flow">
      <button type="button" className="app-top-bar__back" onClick={onBack}>
        ← Back
      </button>
      {isLoggedIn() ? (
        <button type="button" className="app-top-bar__home" onClick={() => navigate("/home")}>
          Goals
        </button>
      ) : null}
    </header>
  );
}
