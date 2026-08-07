/**
 * Wallet provider helpers.
 *
 * Supported modes:
 *  - "phantom"  → Phantom browser/extension provider (window.solana / window.phantom.solana)
 *  - "watch"    → Read-only: user pastes any Solana public key. No signing.
 *
 * We deliberately never ask for seed phrases or private keys.
 *
 * NOTE: For native Android deep-linking to Phantom, integrate
 * @phantom/wallet-adapter-mobile or similar in the Capacitor build. This file
 * focuses on the web/Capacitor-WebView case which already handles the common
 * case (Phantom extension in the bundled web view or desktop browser).
 */

export function getPhantomProvider() {
  if (typeof window === "undefined") return null;
  const w = window;
  const p = w.phantom?.solana;
  if (p?.isPhantom) return p;
  if (w.solana?.isPhantom) return w.solana;
  return null;
}

export function phantomDeeplinkInstall() {
  const url = "https://phantom.app/ul/browse/" + encodeURIComponent(window.location.href);
  // Fallback: open install page
  const installUrl = "https://phantom.app/download";
  try {
    window.location.href = url;
    setTimeout(() => { window.location.href = installUrl; }, 800);
  } catch {
    window.location.href = installUrl;
  }
}

export async function phantomConnect() {
  const p = getPhantomProvider();
  if (!p) throw new Error("Phantom wallet not detected.");
  const res = await p.connect();
  const pubkey = res?.publicKey?.toBase58?.() || p.publicKey?.toBase58?.();
  if (!pubkey) throw new Error("Phantom connected but did not return a public key.");
  return { provider: p, pubkey };
}

export async function phantomDisconnect() {
  const p = getPhantomProvider();
  if (!p) return;
  try { await p.disconnect(); } catch { /* ignore */ }
}

/** Sign & send a Solana Transaction via Phantom, returning a signature string. */
export async function phantomSignAndSend(tx, connection) {
  const p = getPhantomProvider();
  if (!p) throw new Error("Phantom wallet not available.");
  // Phantom supports signAndSendTransaction natively.
  if (typeof p.signAndSendTransaction === "function") {
    const { signature } = await p.signAndSendTransaction(tx);
    return signature;
  }
  const signed = await p.signTransaction(tx);
  const raw = signed.serialize();
  const sig = await connection.sendRawTransaction(raw, { skipPreflight: false, preflightCommitment: "confirmed" });
  return sig;
}
