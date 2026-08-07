import React, { useCallback, useEffect, useState } from "react";
import { KeyRound, Wallet, PlusCircle } from "lucide-react";
import PageHeader from "../ui/PageHeader";
import AddressCopy from "../ui/AddressCopy";
import NetworkPill from "../ui/NetworkPill";
import { useWallet } from "../../contexts/WalletContext";
import { createMyInternalWallet, formatRrApiError, getMyInternalWallet } from "../../lib/rrApi";

export default function MyWallet() {
  const { network } = useWallet();
  const [pubkey, setPubkey] = useState("");
  const [createdAt, setCreatedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setErr("");
    setLoading(true);
    try {
      const { data } = await getMyInternalWallet();
      setPubkey(String(data?.pubkey || ""));
      setCreatedAt(String(data?.created_at || ""));
    } catch (e) {
      setErr(formatRrApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = useCallback(async () => {
    setErr("");
    setCreating(true);
    try {
      const { data } = await createMyInternalWallet();
      setPubkey(String(data?.pubkey || ""));
      setCreatedAt(String(data?.created_at || ""));
    } catch (e) {
      setErr(formatRrApiError(e));
    } finally {
      setCreating(false);
    }
  }, []);

  return (
    <div className="page-shell" data-testid="my-wallet-screen">
      <PageHeader title="My Wallet" subtitle="Internal RootRecord wallet" right={<NetworkPill network={network} />} />

      <div className="px-4 pt-4 space-y-4">
        <div className="card p-4" data-testid="my-wallet-about">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-phos/10 text-phos flex items-center justify-center">
              <KeyRound size={18} />
            </div>
            <div className="text-sm text-ink-secondary">
              <div className="font-semibold text-ink-primary mb-1">Internal wallet</div>
              <div>
                This wallet is created and stored server-side for RootRecord features. The private key is not shown in the app.
              </div>
            </div>
          </div>
        </div>

        <div className="card p-4" data-testid="my-wallet-card">
          <div className="flex items-center gap-2">
            <Wallet size={16} className="text-ink-secondary" />
            <div className="label mb-0">Address</div>
          </div>

          <div className="mt-3">
            {loading ? (
              <div className="text-sm text-ink-tertiary">Loading…</div>
            ) : pubkey ? (
              <>
                <AddressCopy address={pubkey} short={false} className="mono text-[12px]" testid="my-wallet-address" />
                {createdAt ? (
                  <div className="mt-2 text-[11px] text-ink-tertiary" data-testid="my-wallet-created-at">
                    Created: {createdAt}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="text-sm text-ink-tertiary">No internal wallet yet.</div>
            )}
          </div>

          {err ? (
            <div className="mt-3 text-sm text-red-200 bg-red-500/10 border border-red-400/20 rounded-xl p-3" data-testid="my-wallet-error">
              {err}
            </div>
          ) : null}

          <div className="mt-4">
            <button
              className="btn btn-primary w-full"
              onClick={create}
              disabled={creating || loading}
              data-testid="my-wallet-create"
            >
              <PlusCircle size={16} /> {creating ? "Creating…" : pubkey ? "Recreate (disabled)" : "Create internal wallet"}
            </button>
            <div className="mt-2 text-[11px] text-ink-tertiary">
              If you already have one, Create returns the existing address.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

