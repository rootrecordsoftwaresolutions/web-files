import { useEffect, useState } from "react";

import { useAuth } from "../contexts/AuthContext";
import { useGame } from "../contexts/GameContext";
import { PLOT_COUNT, ROWS_PER_PLOT } from "../game/catalog";
import { formatRu } from "../game/format";
import { fetchRootsMintStatus, mintFullRootsBalance, type RootsMintStatus } from "../lib/rootsMintApi";

const IS_NATIVE = typeof window !== "undefined" && Boolean((window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());

export function SettingsScreen({ onSignIn }: { onSignIn?: () => void }) {
  const auth = useAuth();
  const game = useGame();
  const showMintingMachine = !IS_NATIVE && auth.authed && !auth.guestMode;
  const [mintStatus, setMintStatus] = useState<RootsMintStatus | null>(null);
  const [mintStatusDetail, setMintStatusDetail] = useState<string | null>(null);
  const [destination, setDestination] = useState("");
  const [mintBusy, setMintBusy] = useState(false);
  const [mintConfirm, setMintConfirm] = useState(false);
  const [mintResult, setMintResult] = useState<string | null>(null);
  const [mintReceipt, setMintReceipt] = useState<{ signature: string; explorer: string } | null>(null);

  useEffect(() => {
    if (!showMintingMachine) return;
    let cancelled = false;
    (async () => {
      const status = await fetchRootsMintStatus();
      if (cancelled) return;
      if (status.ok) {
        setMintStatus(status);
        setMintStatusDetail(null);
      } else {
        setMintStatus(null);
        setMintStatusDetail(status.detail);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showMintingMachine]);

  const runMint = async () => {
    if (!mintConfirm) {
      setMintConfirm(true);
      setMintResult("Press Mint full balance again to confirm.");
      return;
    }
    setMintBusy(true);
    setMintResult(null);
    setMintReceipt(null);
    const result = await mintFullRootsBalance(destination);
    setMintBusy(false);
    setMintConfirm(false);
    if (result.ok) {
      setMintResult("Mint complete.");
      setMintReceipt({ signature: result.tx_signature, explorer: result.explorer });
      await game.refreshServerBalance();
      const status = await fetchRootsMintStatus();
      if (status.ok) setMintStatus(status);
      return;
    }
    setMintResult(result.detail);
    if (result.tx_signature && result.explorer) {
      setMintReceipt({ signature: result.tx_signature, explorer: result.explorer });
    }
    if (result.new_balance != null) await game.refreshServerBalance();
  };

  const solBalanceText = mintStatus
    ? (mintStatus.custodial_sol_lamports / 1_000_000_000).toLocaleString(undefined, { maximumFractionDigits: 6 })
    : "0";

  return (
    <div className="screen settings-screen">
      <h1>Settings</h1>
      <section className="settings-block">
        <h2>Account</h2>
        {auth.guestMode && !auth.authed ? (
          <>
            <p className="settings-line">Playing as a Beta Tester</p>
            <p className="settings-note">
              Progress is stored on this device only. Sign in with rootrecord.info to save your farm and Root Units
              across devices.
            </p>
            {onSignIn ? (
              <button type="button" className="btn btn-secondary" onClick={onSignIn}>
                Sign in to save progress
              </button>
            ) : null}
          </>
        ) : (
          <>
            <p className="settings-line">Signed in as {auth.email}</p>
            {!auth.accountVerified ? (
              <p className="settings-note">
                This RootRecord account is not verified yet. Verify by email on{" "}
                <a href="https://rootrecord.info/account.html" target="_blank" rel="noopener noreferrer">
                  rootrecord.info/account
                </a>{" "}
                or link Discord at{" "}
                <a href="https://rootrecord.info/discord-verify" target="_blank" rel="noopener noreferrer">
                  /discord-verify
                </a>{" "}
                so password recovery and account changes are protected.
              </p>
            ) : null}
            <button type="button" className="btn btn-ghost" onClick={() => void auth.logout()}>
              Sign out
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => void game.refreshServerBalance()}>
              Refresh balance
            </button>
          </>
        )}
      </section>
      <section className="settings-block">
        <h2>Game</h2>
        <p className="settings-line">{PLOT_COUNT} edible root varieties · {ROWS_PER_PLOT} rows each</p>
        <button type="button" className="btn btn-danger" onClick={() => game.resetProgress()}>
          Reset farm progress
        </button>
      </section>
      {!auth.guestMode ? (
        <section className="settings-block">
          <h2>Root Units (beta)</h2>
          <p className="settings-note">
            Root Farms uses the same Root Units balance as your rootrecord.info account when signed in.
          </p>
        </section>
      ) : null}
      {!IS_NATIVE ? (
        <section className="settings-block">
          <h2>Official ROOTS token</h2>
          <p className="settings-note">
            ROOTS is the official Root Record Token. Mint:{" "}
            <span className="settings-token-address">8hwxLN1Q4Yr8xFErErULCqNvcF1cMwGjpRXPz6DAH7gM</span>. The token has 8 decimals; Root Units display as decimal ROOTS values as the web experience prepares for future token migrations.
          </p>
        </section>
      ) : null}
      {showMintingMachine ? (
        <section className="settings-block minting-machine">
          <h2>Minting Machine</h2>
          <p className="settings-note">
            Mint your full internal ROOTS balance to Solana. This removes the minted amount from Root Record internal
            circulation after the on-chain transaction confirms.
          </p>
          <div className="minting-machine-grid">
            <div>
              <span className="minting-machine-label">Available internal balance</span>
              <strong>{game.balanceReady ? formatRu(game.spendableBalance) : "Loading..."}</strong>
            </div>
            <div>
              <span className="minting-machine-label">Custodial SOL for fees</span>
              <strong>{solBalanceText} SOL</strong>
              <small>Minimum 0.01 SOL for mint + ATA fees.</small>
            </div>
          </div>
          {mintStatus?.custodial_wallet ? (
            <p className="settings-note">
              Fee payer: <span className="settings-token-address">{mintStatus.custodial_wallet}</span>
            </p>
          ) : null}
          <label className="minting-machine-field">
            Destination wallet
            <input
              value={destination}
              onChange={(e) => {
                setDestination(e.target.value);
                setMintConfirm(false);
              }}
              placeholder={mintStatus?.custodial_wallet || "Defaults to your custodial wallet"}
            />
          </label>
          {mintStatus?.custodial_wallet ? (
            <button type="button" className="btn btn-ghost" onClick={() => setDestination(mintStatus.custodial_wallet)}>
              Use custodial wallet
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-secondary minting-machine-action"
            disabled={
              mintBusy ||
              !game.balanceReady ||
              game.spendableBalance <= 0 ||
              !mintStatus ||
              mintStatus.custodial_sol_lamports < mintStatus.minimum_sol_lamports
            }
            onClick={() => void runMint()}
          >
            {mintBusy ? "Minting..." : mintConfirm ? "Confirm mint full balance" : "Mint full balance"}
          </button>
          {mintStatusDetail ? <p className="settings-note minting-machine-error">{mintStatusDetail}</p> : null}
          {mintResult ? <p className="settings-note">{mintResult}</p> : null}
          {mintReceipt ? (
            <p className="settings-note">
              Transaction:{" "}
              <a href={mintReceipt.explorer} target="_blank" rel="noopener noreferrer">
                {mintReceipt.signature.slice(0, 12)}…
              </a>
            </p>
          ) : null}
        </section>
      ) : null}
      <section className="settings-block">
        <h2>Legal</h2>
        <p className="settings-note settings-links">
          <a href="https://rootrecord.info/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>
          <span aria-hidden> · </span>
          <a href="https://rootrecord.info/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
        </p>
      </section>
    </div>
  );
}
