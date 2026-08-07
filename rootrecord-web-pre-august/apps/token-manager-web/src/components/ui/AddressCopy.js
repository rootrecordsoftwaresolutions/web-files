import React from "react";
import { Copy, Check } from "lucide-react";
import { shortAddr } from "../../lib/format";
import { Clipboard } from "@capacitor/clipboard";

export default function AddressCopy({ address, short = true, className = "", testid = "address-copy" }) {
  const [copied, setCopied] = React.useState(false);
  const onCopy = async () => {
    const val = String(address || "");
    try {
      // Try Capacitor Clipboard (works on native + falls back in web)
      await Clipboard.write({ string: val });
    } catch {
      try {
        await navigator.clipboard?.writeText?.(val);
      } catch { /* ignore */ }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };
  return (
    <button
      type="button"
      onClick={onCopy}
      className={`mono text-sm inline-flex items-center gap-2 text-ink-secondary hover:text-ink-primary transition-colors ${className}`}
      data-testid={testid}
      aria-label="Copy address"
    >
      <span>{short ? shortAddr(address, 4, 4) : address}</span>
      {copied ? <Check size={14} className="text-phos" /> : <Copy size={14} />}
    </button>
  );
}
