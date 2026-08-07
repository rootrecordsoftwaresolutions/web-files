import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../ui/PageHeader";
import NetworkPill from "../ui/NetworkPill";
import AddressCopy from "../ui/AddressCopy";
import { useWallet } from "../../contexts/WalletContext";
import { LogOut, BookUser, Network, ChevronRight, ShieldCheck, Wallet, Megaphone, MessageSquare, Monitor, ExternalLink, HelpCircle } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "../../contexts/AuthContext";
import { NATIVE_APP_VERSION } from "../../lib/nativeAppVersion";

const NETS = [
  { id: "mainnet-beta", label: "Mainnet", hint: "Live SOL — be careful" },
  { id: "devnet", label: "Devnet", hint: "Free SOL via faucet · safe to test" },
  { id: "testnet", label: "Testnet", hint: "Validator performance cluster" },
];

const DESKTOP_WEB_URL = "https://token.rootrecord.info/";

const IS_NATIVE_ANDROID = (() => {
  try { return Capacitor?.isNativePlatform?.() === true; } catch { return false; }
})();

export default function Settings() {
  const nav = useNavigate();
  const { pubkey, mode, network, changeNetwork, disconnect } = useWallet();
  const { user, logout, refreshEntitlement } = useAuth();
  const [entBusy, setEntBusy] = useState(false);

  return (
    <div className="page-shell" data-testid="settings-screen">
      <PageHeader title="Settings" subtitle="Preferences & network" right={<NetworkPill network={network} />} />

      <div className="px-4 pt-4 space-y-4">
        <div className="card p-4" data-testid="settings-account">
          <div className="label mb-2">Connected wallet</div>
          <AddressCopy address={pubkey} short={false} className="mono text-[12px]" testid="settings-address" />
          <div className="mt-2 text-xs text-ink-tertiary">
            Mode: <span className="mono uppercase tracking-widest">{mode || "none"}</span>
          </div>
        </div>

        <div className="card p-4" data-testid="settings-rootrecord-login">
          <div className="label mb-2">RootRecord login</div>
          <div className="text-sm text-ink-secondary">
            {user?.email ? (
              <>
                Signed in as <span className="mono">{user.email}</span>
              </>
            ) : (
              "Not signed in."
            )}
          </div>
          <div className="mt-3 flex gap-2">
            <div className="mt-3 flex flex-col gap-2">
              {user?.email ? (
                <>
                  <div className="flex gap-2">
                    <button
                      className="btn btn-ghost flex-1"
                      onClick={async () => {
                        await logout();
                        nav("/auth", { replace: true });
                      }}
                      data-testid="settings-rr-logout"
                    >
                      <LogOut size={16} /> Sign out
                    </button>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary w-full text-xs"
                    disabled={entBusy}
                    onClick={async () => {
                      setEntBusy(true);
                      try {
                        await refreshEntitlement();
                      } catch (e) {
                        console.warn("refreshEntitlement", e);
                      } finally {
                        setEntBusy(false);
                      }
                    }}
                    data-testid="settings-refresh-entitlement"
                  >
                    {entBusy ? "Refreshing plan…" : "Refresh plan from server"}
                  </button>
                </>
              ) : (
                <button className="btn btn-primary w-full" onClick={() => nav("/auth")} data-testid="settings-rr-login">
                  Sign in
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="card overflow-hidden" data-testid="settings-network">
          <div className="px-4 py-3 flex items-center gap-2 border-b border-white/5">
            <Network size={16} className="text-ink-secondary" />
            <span className="label mb-0">Network</span>
          </div>
          <div className="divide-y divide-white/5">
            {NETS.map((n) => (
              <button
                key={n.id}
                onClick={() => changeNetwork(n.id)}
                className={`w-full flex items-center justify-between p-4 text-left transition-colors ${
                  network === n.id ? "bg-phos/5" : "hover:bg-white/5"
                }`}
                data-testid={`settings-network-${n.id}`}
              >
                <div>
                  <div className="font-semibold text-ink-primary">{n.label}</div>
                  <div className="text-[11px] text-ink-tertiary mt-0.5">{n.hint}</div>
                </div>
                <span
                  className={`w-4 h-4 rounded-full border ${
                    network === n.id ? "bg-phos border-phos" : "border-white/20"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        {IS_NATIVE_ANDROID && (
          <a
            href={DESKTOP_WEB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="card w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors no-underline"
            data-testid="settings-desktop-link"
          >
            <div className="flex items-center gap-3">
              <Monitor size={18} className="text-phos" />
              <div className="text-left">
                <div className="font-semibold text-ink-primary">Desktop version — members</div>
                <div className="text-[11px] text-ink-tertiary mt-0.5">token.rootrecord.info — full experience in any desktop or laptop browser.</div>
              </div>
            </div>
            <ExternalLink size={16} className="text-ink-tertiary" />
          </a>
        )}

        <button
          onClick={() => nav("/developer-messages")}
          className="card w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
          data-testid="settings-open-developer-messages"
        >
          <div className="flex items-center gap-3">
            <Megaphone size={18} className="text-phos" />
            <div className="text-left">
              <div className="font-semibold text-ink-primary">Developer messages</div>
              <div className="text-[11px] text-ink-tertiary mt-0.5">Release notes and notices from RootRecord.</div>
            </div>
          </div>
          <ChevronRight size={16} className="text-ink-tertiary" />
        </button>

        <button
          onClick={() => nav("/about")}
          className="card w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
          data-testid="settings-open-about"
        >
          <div className="flex items-center gap-3">
            <HelpCircle size={18} className="text-phos" />
            <div className="text-left">
              <div className="font-semibold text-ink-primary">About &amp; Help</div>
              <div className="text-[11px] text-ink-tertiary mt-0.5">Version, principles, and plans.</div>
            </div>
          </div>
          <ChevronRight size={16} className="text-ink-tertiary" />
        </button>

        <button
          onClick={() => nav("/feedback")}
          className="card w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
          data-testid="settings-open-feedback"
        >
          <div className="flex items-center gap-3">
            <MessageSquare size={18} className="text-phos" />
            <div className="text-left">
              <div className="font-semibold text-ink-primary">Send feedback</div>
              <div className="text-[11px] text-ink-tertiary mt-0.5">In-app note to the team.</div>
            </div>
          </div>
          <ChevronRight size={16} className="text-ink-tertiary" />
        </button>

        <button
          onClick={() => nav("/contacts")}
          className="card w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
          data-testid="settings-open-contacts"
        >
          <div className="flex items-center gap-3">
            <BookUser size={18} className="text-phos" />
            <div className="text-left">
              <div className="font-semibold text-ink-primary">Address book</div>
              <div className="text-[11px] text-ink-tertiary mt-0.5">Save and reuse recipient addresses.</div>
            </div>
          </div>
          <ChevronRight size={16} className="text-ink-tertiary" />
        </button>

        <button
          onClick={() => nav("/my-wallet")}
          className="card w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
          data-testid="settings-open-my-wallet"
        >
          <div className="flex items-center gap-3">
            <Wallet size={18} className="text-phos" />
            <div className="text-left">
              <div className="font-semibold text-ink-primary">My Wallet</div>
              <div className="text-[11px] text-ink-tertiary mt-0.5">Internal RootRecord wallet address.</div>
            </div>
          </div>
          <ChevronRight size={16} className="text-ink-tertiary" />
        </button>

        <div className="card p-4 flex items-start gap-2 text-xs text-ink-secondary" data-testid="settings-security-note">
          <ShieldCheck size={16} className="mt-0.5 text-phos" />
          <span>
            RootRecord never stores or transmits seed phrases or private keys. Signing always happens in your wallet app.
          </span>
        </div>

        <button
          onClick={async () => { await disconnect(); nav("/connect", { replace: true }); }}
          className="btn btn-danger w-full"
          data-testid="settings-disconnect-btn"
        >
          <LogOut size={16} /> Disconnect
        </button>

        <div className="text-center text-[11px] text-ink-tertiary pt-2">
          RootRecord Token Manager · v{NATIVE_APP_VERSION} · mobile
        </div>
      </div>
    </div>
  );
}
