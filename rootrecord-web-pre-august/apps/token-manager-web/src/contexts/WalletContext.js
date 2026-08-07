import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { connectWallet, getPreferences, patchPreferences } from "../lib/api";
import { getConnection, isValidPubkey } from "../lib/solana";
import { getPhantomProvider, phantomConnect, phantomDisconnect, phantomSignAndSend } from "../lib/wallet";

const LS_PUBKEY = "rrtm_pubkey";
const LS_MODE = "rrtm_mode"; // 'phantom' | 'watch'
const LS_NETWORK = "rrtm_network";

const WalletCtx = createContext(null);

export function useWallet() {
  const ctx = useContext(WalletCtx);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}

export function WalletProvider({ children }) {
  const [pubkey, setPubkey] = useState(() => localStorage.getItem(LS_PUBKEY) || "");
  const [mode, setMode] = useState(() => localStorage.getItem(LS_MODE) || "");
  const [network, setNetwork] = useState(() =>
    localStorage.getItem(LS_NETWORK) ||
    process.env.REACT_APP_DEFAULT_NETWORK ||
    "mainnet-beta"
  );
  const [preferences, setPreferences] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastError, setLastError] = useState("");

  const connection = useMemo(() => getConnection(network), [network]);

  // persist
  useEffect(() => {
    if (pubkey) localStorage.setItem(LS_PUBKEY, pubkey);
    else localStorage.removeItem(LS_PUBKEY);
  }, [pubkey]);
  useEffect(() => {
    if (mode) localStorage.setItem(LS_MODE, mode);
    else localStorage.removeItem(LS_MODE);
  }, [mode]);
  useEffect(() => {
    localStorage.setItem(LS_NETWORK, network);
  }, [network]);

  // Sync preferences to server whenever connected
  useEffect(() => {
    if (!pubkey) { setPreferences(null); return; }
    let ignore = false;
    (async () => {
      try {
        await connectWallet(pubkey);
        const { data } = await getPreferences(pubkey);
        if (ignore) return;
        setPreferences(data || null);
        if (data?.network && data.network !== network) {
          setNetwork(data.network);
        }
      } catch (e) {
        // Offline or backend down — non-fatal; keep local network value
        // eslint-disable-next-line no-console
        console.warn("wallet sync failed", e?.message);
      }
    })();
    return () => { ignore = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pubkey]);

  const connectPhantom = useCallback(async () => {
    setLastError("");
    setIsConnecting(true);
    try {
      const { pubkey: pk } = await phantomConnect();
      setPubkey(pk);
      setMode("phantom");
      return pk;
    } catch (e) {
      setLastError(e?.message || "Failed to connect Phantom.");
      throw e;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const connectWatch = useCallback(async (addr) => {
    setLastError("");
    const pk = String(addr || "").trim();
    if (!isValidPubkey(pk)) {
      const msg = "That doesn't look like a valid Solana address.";
      setLastError(msg);
      throw new Error(msg);
    }
    setPubkey(pk);
    setMode("watch");
    return pk;
  }, []);

  const disconnect = useCallback(async () => {
    try { await phantomDisconnect(); } catch { /* ignore */ }
    setPubkey("");
    setMode("");
    setPreferences(null);
  }, []);

  const changeNetwork = useCallback(async (net) => {
    setNetwork(net);
    if (pubkey) {
      try {
        await patchPreferences(pubkey, { network: net });
        setPreferences((p) => ({ ...(p || {}), network: net }));
      } catch { /* non-fatal */ }
    }
  }, [pubkey]);

  const updatePreference = useCallback(async (key, value) => {
    if (!pubkey) return;
    const body = { [key]: value };
    try {
      const { data } = await patchPreferences(pubkey, body);
      setPreferences(data || null);
    } catch { /* non-fatal */ }
  }, [pubkey]);

  const signAndSend = useCallback(async (tx) => {
    if (mode !== "phantom") {
      throw new Error("Signing is only available in wallet mode. Switch from Watch mode and connect Phantom.");
    }
    if (!getPhantomProvider()) {
      throw new Error("Phantom wallet is no longer available in this browser.");
    }
    return phantomSignAndSend(tx, connection);
  }, [mode, connection]);

  const value = useMemo(() => ({
    pubkey,
    mode,
    isWatch: mode === "watch",
    canSign: mode === "phantom",
    isConnected: Boolean(pubkey),
    network,
    connection,
    preferences,
    isConnecting,
    lastError,
    connectPhantom,
    connectWatch,
    disconnect,
    changeNetwork,
    updatePreference,
    signAndSend,
  }), [pubkey, mode, network, connection, preferences, isConnecting, lastError,
       connectPhantom, connectWatch, disconnect, changeNetwork, updatePreference, signAndSend]);

  return <WalletCtx.Provider value={value}>{children}</WalletCtx.Provider>;
}
