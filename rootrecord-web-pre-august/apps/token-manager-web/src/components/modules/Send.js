/* eslint-env es2020 */
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight, ShieldCheck, AlertTriangle, Eye, BookUser, Check, Coins,
} from "lucide-react";
import { useWallet } from "../../contexts/WalletContext";
import PageHeader from "../ui/PageHeader";
import NetworkPill from "../ui/NetworkPill";
import { useToast } from "../ui/Toast";
import {
  buildSolTransferTx, buildSplTransferTx, fetchSolBalance, fetchTokenAccounts,
  isValidPubkey,
} from "../../lib/solana";
import { listContacts } from "../../lib/api";
import { reportSolanaToolActivity } from "../../lib/rrApi";
import {
  formatSol, formatTokenAmount, lamportsToSol, parseDecimalToBaseUnits,
  shortAddr,
} from "../../lib/format";

const STEPS = ["amount", "review", "sent"];
const FEE_RESERVE_LAMPORTS = 5000; // ~0.000005 SOL reserved for fees

const SOL_ASSET = { kind: "sol", symbol: "SOL", decimals: 9 };

export default function Send() {
  const nav = useNavigate();
  const toast = useToast();
  const { pubkey, network, connection, canSign, signAndSend } = useWallet();

  const [step, setStep] = useState("amount");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [contacts, setContacts] = useState([]);
  const [tokens, setTokens] = useState([]); // SPL tokens (excluding NFTs/zero balances)
  const [asset, setAsset] = useState(SOL_ASSET);
  const [balanceLamports, setBalanceLamports] = useState(0);
  const [busy, setBusy] = useState(false);
  const [signature, setSignature] = useState("");
  const [error, setError] = useState("");
  const [showContacts, setShowContacts] = useState(false);
  const [showAssets, setShowAssets] = useState(false);

  // Initial load: SOL balance + SPL tokens + contacts
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const lamports = await fetchSolBalance(connection, pubkey);
        if (!cancelled) setBalanceLamports(lamports);
      } catch { /* ignore */ }
      try {
        const ta = await fetchTokenAccounts(connection, pubkey);
        if (cancelled) return;
        const fungibles = (ta || []).filter((t) => !t.isNft && t.uiAmount > 0);
        setTokens(fungibles);
      } catch { /* ignore */ }
      try {
        const { data } = await listContacts(pubkey);
        if (!cancelled) setContacts(data || []);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [pubkey, connection]);

  // If the user picks an SPL asset that's no longer in the list (refreshed away), fall back to SOL.
  useEffect(() => {
    if (asset.kind === "spl") {
      const still = tokens.find((t) => t.mint === asset.mint);
      if (!still) setAsset(SOL_ASSET);
      else if (still.uiAmount !== asset.uiAmount || still.decimals !== asset.decimals) {
        setAsset({
          kind: "spl",
          symbol: shortAddr(still.mint, 4, 4),
          mint: still.mint,
          decimals: still.decimals,
          uiAmount: still.uiAmount,
          accountPubkey: still.accountPubkey,
        });
      }
    }
  }, [tokens]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resolve the amount the user typed to base units (lamports for SOL, token base units for SPL).
  const baseUnits = useMemo(() => {
    return parseDecimalToBaseUnits(amount, asset.decimals);
  }, [amount, asset.decimals]);

  // Validation
  const validTo = isValidPubkey(to.trim());
  const amountInvalidShape = amount.length > 0 && baseUnits == null;
  const amountTooLarge = (() => {
    if (baseUnits == null || baseUnits <= 0n) return false;
    if (asset.kind === "sol") {
      return Number(baseUnits) + FEE_RESERVE_LAMPORTS > balanceLamports;
    }
    // For SPL: amount must be <= owned balance, AND user must have SOL for fees.
    const ownedRaw = parseDecimalToBaseUnits(String(asset.uiAmount), asset.decimals);
    if (ownedRaw == null) return true;
    if (baseUnits > ownedRaw) return true;
    if (balanceLamports < FEE_RESERVE_LAMPORTS) return true; // not enough SOL for fee
    return false;
  })();

  const insufficientSolForFee =
    asset.kind === "spl" && balanceLamports < FEE_RESERVE_LAMPORTS;

  const sendingToSelf = to.trim() && to.trim() === pubkey;
  const canProceed =
    validTo &&
    !sendingToSelf &&
    baseUnits != null &&
    baseUnits > 0n &&
    !amountTooLarge &&
    !amountInvalidShape;

  const onContinue = () => {
    setError("");
    if (!validTo) return setError("Recipient address is not a valid Solana public key.");
    if (sendingToSelf) return setError("Cannot send to your own address.");
    if (amountInvalidShape) return setError(`Amount has more than ${asset.decimals} decimal places for this token.`);
    if (baseUnits == null || baseUnits <= 0n) return setError("Amount must be greater than 0.");
    if (asset.kind === "sol" && Number(baseUnits) + FEE_RESERVE_LAMPORTS > balanceLamports) {
      return setError("Not enough SOL to cover amount + network fee.");
    }
    if (asset.kind === "spl") {
      if (insufficientSolForFee) return setError("Not enough SOL in this wallet to pay the network fee.");
      const ownedRaw = parseDecimalToBaseUnits(String(asset.uiAmount), asset.decimals);
      if (ownedRaw == null || baseUnits > ownedRaw) return setError("Amount exceeds your token balance.");
    }
    setStep("review");
  };

  const onConfirm = async () => {
    setBusy(true); setError("");
    try {
      if (!canSign) throw new Error("You're in Watch mode. Connect Phantom to sign transactions.");
      let tx;
      if (asset.kind === "sol") {
        tx = await buildSolTransferTx(connection, pubkey, to.trim(), Number(baseUnits));
      } else {
        tx = await buildSplTransferTx(
          connection, pubkey, to.trim(), asset.mint, baseUnits, asset.decimals,
        );
      }
      const sig = await signAndSend(tx);
      setSignature(String(sig));
      void reportSolanaToolActivity({
        action: asset.kind === "sol" ? "send_sol" : "send_spl",
        wallet: pubkey,
        signature: String(sig),
        cluster: network,
        summary:
          asset.kind === "sol"
            ? `Sent SOL → ${shortAddr(to.trim(), 4, 4)}`
            : `Sent SPL → ${shortAddr(to.trim(), 4, 4)}`,
        metadata: {
          to: to.trim(),
          amount: String(amount),
          mint: asset.kind === "spl" ? asset.mint : undefined,
        },
      });
      setStep("sent");
      toast.success("Transaction sent");
    } catch (e) {
      const msg = e?.message || "Failed to send transaction.";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const onMax = () => {
    if (asset.kind === "sol") {
      const maxLamports = Math.max(0, balanceLamports - FEE_RESERVE_LAMPORTS);
      const sol = lamportsToSol(maxLamports);
      setAmount(sol ? trimDecimal(sol, 9) : "");
    } else {
      // For SPL, the full uiAmount is the max (fee paid in SOL separately).
      setAmount(trimDecimal(asset.uiAmount, asset.decimals));
    }
  };

  const onPickAsset = (next) => {
    setAsset(next);
    setAmount("");
    setError("");
    setShowAssets(false);
  };

  const onReset = () => {
    setStep("amount");
    setAmount("");
    setTo("");
    setSignature("");
    setError("");
    setAsset(SOL_ASSET);
  };

  const explorerUrl = (sig) => {
    const cluster = network === "mainnet-beta" ? "" : `?cluster=${network}`;
    return `https://explorer.solana.com/tx/${sig}${cluster}`;
  };

  // Display helpers
  const symbolLabel = asset.kind === "sol" ? "SOL" : asset.symbol;
  const balanceLine = asset.kind === "sol"
    ? <>Balance: <span className="mono text-ink-secondary">{formatSol(balanceLamports, 4)} SOL</span></>
    : <>Balance: <span className="mono text-ink-secondary">{formatTokenAmount(asset.uiAmount, Math.min(asset.decimals, 6))} {symbolLabel}</span></>;

  return (
    <div className="page-shell" data-testid="send-screen">
      <PageHeader
        title={`Send ${symbolLabel}`}
        subtitle={`From ${shortAddr(pubkey)}`}
        right={<NetworkPill network={network} />}
      />

      <div className="px-4 pt-4 space-y-3">
        {!canSign && (
          <div className="card p-3 text-sm flex items-start gap-2 border border-amber/30 bg-amber/5 text-amber" data-testid="watch-mode-warning">
            <Eye size={16} className="mt-0.5" />
            <span>You're watching a read-only address. To send, disconnect and reconnect with Phantom.</span>
          </div>
        )}

        <StepDots step={step} />

        {step === "amount" && (
          <div className="space-y-3" data-testid="send-step-amount">
            {/* Asset picker */}
            <div data-testid="send-asset-picker">
              <label className="label">Asset</label>
              <button
                type="button"
                onClick={() => setShowAssets((s) => !s)}
                className="card w-full p-3 flex items-center gap-3 hover:bg-white/5 transition-colors"
                data-testid="send-asset-toggle"
                aria-expanded={showAssets}
              >
                <AssetGlyph asset={asset} />
                <div className="flex-1 min-w-0 text-left">
                  <div className="font-semibold text-ink-primary mono">{symbolLabel}</div>
                  <div className="text-[11px] text-ink-tertiary mono truncate">
                    {asset.kind === "sol" ? "Native SOL" : asset.mint}
                  </div>
                </div>
                <div className="text-right">
                  <div className="mono text-ink-primary text-sm font-semibold">
                    {asset.kind === "sol"
                      ? formatSol(balanceLamports, 4)
                      : formatTokenAmount(asset.uiAmount, Math.min(asset.decimals, 6))}
                  </div>
                  <div className="text-[10px] text-ink-tertiary uppercase tracking-widest">balance</div>
                </div>
              </button>

              {showAssets && (
                <div className="card mt-2 divide-y divide-white/5 max-h-[280px] overflow-y-auto" data-testid="send-asset-list">
                  <AssetRow
                    onClick={() => onPickAsset(SOL_ASSET)}
                    selected={asset.kind === "sol"}
                    label="SOL"
                    sublabel="Native SOL"
                    right={`${formatSol(balanceLamports, 4)}`}
                    glyph={<AssetGlyph asset={SOL_ASSET} />}
                    testid="send-asset-option-sol"
                  />
                  {tokens.length === 0 ? (
                    <div className="p-3 text-sm text-ink-tertiary" data-testid="send-asset-empty">
                      No SPL tokens with a balance on {network}.
                    </div>
                  ) : tokens.map((t) => (
                    <AssetRow
                      key={t.accountPubkey}
                      onClick={() => onPickAsset({
                        kind: "spl",
                        symbol: shortAddr(t.mint, 4, 4),
                        mint: t.mint,
                        decimals: t.decimals,
                        uiAmount: t.uiAmount,
                        accountPubkey: t.accountPubkey,
                      })}
                      selected={asset.kind === "spl" && asset.mint === t.mint}
                      label={shortAddr(t.mint, 4, 4)}
                      sublabel={t.mint}
                      right={formatTokenAmount(t.uiAmount, Math.min(t.decimals, 6))}
                      glyph={
                        <div className="w-9 h-9 rounded-lg bg-bg-elevated border border-white/10 flex items-center justify-center mono text-[10px] text-ink-secondary">
                          SPL
                        </div>
                      }
                      testid={`send-asset-option-${t.mint}`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Recipient */}
            <div>
              <label className="label" htmlFor="send-to">Recipient</label>
              <div className="relative">
                <input
                  id="send-to"
                  className="input mono text-[13px] pr-12"
                  placeholder="Solana public key"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  data-testid="send-to-input"
                />
                <button
                  type="button"
                  onClick={() => setShowContacts((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-ink-secondary hover:bg-white/5"
                  aria-label="Open address book"
                  data-testid="send-contacts-toggle"
                >
                  <BookUser size={18} />
                </button>
              </div>
              {to && !validTo && (
                <div className="text-xs text-rose mt-1" data-testid="send-to-invalid">Not a valid Solana address.</div>
              )}
              {showContacts && (
                <div className="card mt-2 divide-y divide-white/5" data-testid="send-contacts-list">
                  {contacts.length === 0 && (
                    <div className="p-3 text-sm text-ink-tertiary">No contacts yet.</div>
                  )}
                  {contacts.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { setTo(c.address); setShowContacts(false); }}
                      className="w-full flex items-center justify-between p-3 text-left hover:bg-white/5 transition-colors"
                      data-testid={`send-contact-${c.id}`}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-ink-primary truncate">{c.label}</div>
                        <div className="mono text-[11px] text-ink-tertiary truncate">{c.address}</div>
                      </div>
                      <Check size={16} className="text-phos opacity-60" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Amount */}
            <div>
              <div className="flex items-center justify-between">
                <label className="label" htmlFor="send-amount">Amount ({symbolLabel})</label>
                <button type="button" onClick={onMax} className="text-xs text-phos hover:text-phos/80 mono uppercase tracking-widest" data-testid="send-max-btn">
                  Max
                </button>
              </div>
              <input
                id="send-amount"
                className="input mono text-[20px]"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))}
                data-testid="send-amount-input"
              />
              <div className="flex items-center justify-between text-xs text-ink-tertiary mt-1">
                <span>{balanceLine}</span>
                <span>Network fee: <span className="mono">~0.000005 SOL</span></span>
              </div>
              {amountInvalidShape && (
                <div className="text-xs text-rose mt-1" data-testid="send-amount-invalid">
                  Up to {asset.decimals} decimal places for this asset.
                </div>
              )}
              {amountTooLarge && !amountInvalidShape && (
                <div className="text-xs text-rose mt-1" data-testid="send-insufficient">
                  {asset.kind === "sol"
                    ? "Insufficient SOL for amount + fee."
                    : insufficientSolForFee
                      ? "Not enough SOL in this wallet to pay the network fee."
                      : "Amount exceeds your token balance."}
                </div>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-2 text-sm text-rose bg-rose/5 border border-rose/30 rounded-xl p-3" data-testid="send-error-amount">
                <AlertTriangle size={16} className="mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              className="btn btn-primary w-full"
              onClick={onContinue}
              disabled={!canProceed || !canSign}
              data-testid="send-continue-btn"
            >
              <ArrowUpRight size={16} /> Review transfer
            </button>
          </div>
        )}

        {step === "review" && (
          <div className="signing-bg rounded-2xl p-4 border border-phos/25 shadow-phos" data-testid="send-step-review">
            <div className="flex items-center gap-2 text-phos mono text-xs uppercase tracking-widest">
              <ShieldCheck size={14} /> Confirm & sign
            </div>
            <div className="mt-4 space-y-3">
              <Row label="You send">
                <span className="mono text-ink-primary text-lg font-bold" data-testid="review-amount">
                  {amount} {symbolLabel}
                </span>
              </Row>
              {asset.kind === "spl" && (
                <Row label="Token">
                  <span className="mono text-ink-secondary text-[11px] break-all text-right" data-testid="review-mint">
                    {asset.mint}
                  </span>
                </Row>
              )}
              <Row label="To">
                <span className="mono text-ink-primary text-sm break-all text-right" data-testid="review-to">{to}</span>
              </Row>
              <Row label="Network">
                <NetworkPill network={network} />
              </Row>
              <Row label="Network fee">
                <span className="mono text-ink-secondary text-sm">~0.000005 SOL</span>
              </Row>
            </div>
            {error && (
              <div className="mt-3 flex items-start gap-2 text-sm text-rose bg-rose/5 border border-rose/30 rounded-xl p-3" data-testid="send-error-review">
                <AlertTriangle size={16} className="mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button className="btn btn-secondary" onClick={() => setStep("amount")} disabled={busy} data-testid="send-back-btn">
                Back
              </button>
              <button className="btn btn-primary" onClick={onConfirm} disabled={busy} data-testid="send-confirm-btn">
                {busy ? "Signing…" : "Sign & send"}
              </button>
            </div>
            <div className="mt-3 text-[11px] text-ink-tertiary">
              Your wallet app will open to approve this transaction. RootRecord never sees your keys.
            </div>
          </div>
        )}

        {step === "sent" && (
          <div className="card p-6 text-center" data-testid="send-step-sent">
            <div className="mx-auto w-14 h-14 rounded-full bg-phos/15 border border-phos/40 text-phos flex items-center justify-center pulse-phos">
              <Check size={28} />
            </div>
            <div className="mt-4 font-heading text-xl font-bold text-ink-primary">Sent</div>
            <div className="text-sm text-ink-secondary mt-1">Your transfer was submitted to the network.</div>
            <div className="mt-4 card p-3 text-left bg-bg-elevated">
              <div className="label">Signature</div>
              <div className="mono text-[11px] text-ink-primary break-all" data-testid="sent-signature">{signature}</div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <a className="btn btn-secondary" href={explorerUrl(signature)} target="_blank" rel="noreferrer" data-testid="send-view-explorer">
                View on Explorer
              </a>
              <button className="btn btn-primary" onClick={onReset} data-testid="send-another-btn">
                Send another
              </button>
            </div>
            <button className="mt-3 text-xs text-ink-tertiary hover:text-ink-secondary" onClick={() => nav("/dashboard")} data-testid="send-done-btn">
              Back to dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-white/5 last:border-b-0">
      <span className="label mt-1 mb-0 flex-shrink-0">{label}</span>
      <div className="flex-1 text-right min-w-0">{children}</div>
    </div>
  );
}

function StepDots({ step }) {
  const i = STEPS.indexOf(step);
  return (
    <div className="flex items-center gap-1.5" data-testid="send-stepdots">
      {STEPS.map((s, idx) => (
        <span
          key={s}
          className={`h-1.5 rounded-full transition-all ${
            idx === i ? "w-8 bg-phos" : idx < i ? "w-4 bg-phos/40" : "w-4 bg-white/10"
          }`}
        />
      ))}
    </div>
  );
}

function AssetGlyph({ asset }) {
  if (asset.kind === "sol") {
    return (
      <div className="w-9 h-9 rounded-lg bg-phos/15 border border-phos/30 flex items-center justify-center text-phos mono text-[10px] font-bold">
        SOL
      </div>
    );
  }
  return (
    <div className="w-9 h-9 rounded-lg bg-magenta/12 border border-magenta/30 flex items-center justify-center text-magenta">
      <Coins size={16} />
    </div>
  );
}

function AssetRow({ onClick, selected, label, sublabel, right, glyph, testid }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 text-left transition-colors ${
        selected ? "bg-phos/5" : "hover:bg-white/5"
      }`}
      data-testid={testid}
    >
      {glyph}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-ink-primary mono">{label}</div>
        <div className="text-[11px] text-ink-tertiary mono truncate">{sublabel}</div>
      </div>
      <div className="mono text-ink-primary text-sm">{right}</div>
      {selected && <Check size={16} className="text-phos ml-1" />}
    </button>
  );
}

/** Trim a Number to at most `maxDecimals` digits and remove trailing zeros, returning a string. */
function trimDecimal(n, maxDecimals) {
  const v = Number(n);
  if (!Number.isFinite(v) || v === 0) return "";
  const fixed = v.toFixed(Math.min(maxDecimals, 9)); // safe for SOL (9). For very high decimals we still cap at 9.
  return fixed.replace(/\.?0+$/, "");
}
