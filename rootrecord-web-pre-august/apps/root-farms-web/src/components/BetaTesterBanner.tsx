import { useAuth } from "../contexts/AuthContext";

export function BetaTesterBanner({ onSignIn }: { onSignIn: () => void }) {
  const auth = useAuth();
  if (!auth.guestMode || auth.authed) return null;

  return (
    <div className="beta-tester-banner" role="status">
      <p className="beta-tester-banner-text">
        You&apos;re playing as a <strong>Beta Tester</strong>. Progress stays on this device only — it won&apos;t
        save to your RootRecord account.
      </p>
      <button type="button" className="btn btn-secondary btn-sm" onClick={onSignIn}>
        Sign in to save progress
      </button>
    </div>
  );
}
