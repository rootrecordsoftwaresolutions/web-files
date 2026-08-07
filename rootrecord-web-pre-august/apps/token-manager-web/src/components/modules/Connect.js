import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, Wallet, Eye, ExternalLink, AlertTriangle } from "lucide-react";
import { useWallet } from "../../contexts/WalletContext";
import { useToast } from "../ui/Toast";
import { getPhantomProvider, phantomDeeplinkInstall } from "../../lib/wallet";

export default function Connect() {
  const nav = useNavigate();
  const { connectPhantom, connectWatch, isConnecting, lastError, isConnected } = useWallet();
  const toast = useToast();
  const [watchAddr, setWatchAddr] = useState("");
  const [hasPhantom, setHasPhantom] = useState(false);

  useEffect(() => { setHasPhantom(Boolean(getPhantomProvider())); }, []);
  useEffect(() => { if (isConnected) nav("/dashboard", { replace: true }); }, [isConnected, nav]);

  const onConnectPhantom = async () => {
    try {
      await connectPhantom();
      toast.success("Wallet connected");
    } catch (e) {
      toast.error(e?.message || "Failed to connect wallet.");
    }
  };

  const onWatch = async (e) => {
    e.preventDefault();
    try {
      await connectWatch(watchAddr);
      toast.info("Watching address (read-only)");
    } catch (err) {
      toast.error(err?.message || "Invalid address.");
    }
  };

  return (
    <div className="page-shell min-h-[100dvh] flex flex-col px-5"
         style={{ paddingTop: "calc(env(safe-area-inset-top) + 28px)" }}
         data-testid="connect-screen">
      <div className="mt-8 mb-10">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-xl bg-phos/15 border border-phos/30 flex items-center justify-center text-phos">
            <span className="mono text-sm font-bold">RR</span>
          </div>
          <span className="mono text-[11px] uppercase tracking-widest text-ink-tertiary">
            RootRecord · Token Manager
          </span>
        </div>
        <h1 className="font-heading text-[34px] leading-[1.05] font-bold tracking-tight text-ink-primary">
          Your Solana,<br />
          <span className="text-phos">on a leash.</span>
        </h1>
        <p className="text-ink-secondary mt-4 text-[15px] leading-relaxed max-w-[32ch]">
          Non-custodial. We never hold keys or seeds. Sign transactions with your own wallet,
          or just watch any address read-only.
        </p>
      </div>

      <div className="card p-4 mb-3" data-testid="connect-card-phantom">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-magenta/15 border border-magenta/30 flex items-center justify-center text-magenta">
            <Wallet size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-ink-primary">Connect Phantom</div>
            <div className="text-xs text-ink-tertiary mt-0.5">
              Sign & send from your wallet. Nothing leaves your device unsigned.
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-2">
          <button
            className="btn btn-primary w-full"
            onClick={onConnectPhantom}
            disabled={isConnecting || !hasPhantom}
            data-testid="connect-phantom-btn"
          >
            {isConnecting ? "Connecting…" : hasPhantom ? "Connect Phantom" : "Phantom not detected"}
          </button>
          {!hasPhantom && (
            <button
              className="btn btn-secondary w-full"
              onClick={phantomDeeplinkInstall}
              data-testid="install-phantom-btn"
            >
              <ExternalLink size={16} />
              Open in Phantom / Install
            </button>
          )}
        </div>
      </div>

      <div className="card p-4 mb-4" data-testid="connect-card-watch">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-phos/15 border border-phos/30 flex items-center justify-center text-phos">
            <Eye size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-ink-primary">Watch an address</div>
            <div className="text-xs text-ink-tertiary mt-0.5">
              View balances, tokens and activity. Read-only — no signing.
            </div>
          </div>
        </div>
        <form onSubmit={onWatch} className="mt-3 flex flex-col gap-2">
          <label htmlFor="watch" className="sr-only">Solana public key</label>
          <input
            id="watch"
            className="input mono text-[13px]"
            placeholder="e.g. HXk3...ocex"
            value={watchAddr}
            onChange={(e) => setWatchAddr(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            data-testid="watch-address-input"
          />
          <button className="btn btn-secondary w-full" type="submit" data-testid="watch-submit-btn">
            Watch address
          </button>
        </form>
      </div>

      {lastError && (
        <div
          className="mb-3 flex items-start gap-2 text-sm text-rose bg-rose/5 border border-rose/30 rounded-xl p-3"
          data-testid="connect-error"
        >
          <AlertTriangle size={16} className="mt-0.5" />
          <span>{lastError}</span>
        </div>
      )}

      <div className="mt-auto py-4 flex items-start gap-2 text-xs text-ink-tertiary">
        <ShieldCheck size={14} className="mt-0.5 text-phos" />
        <span>
          This app will never ask for your seed phrase or private key. If any screen does, close it immediately.
        </span>
      </div>
    </div>
  );
}
