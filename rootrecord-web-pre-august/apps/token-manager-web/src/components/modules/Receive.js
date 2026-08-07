import React from "react";
import { QRCodeSVG } from "qrcode.react";
import PageHeader from "../ui/PageHeader";
import NetworkPill from "../ui/NetworkPill";
import AddressCopy from "../ui/AddressCopy";
import { useWallet } from "../../contexts/WalletContext";
import { ShieldCheck } from "lucide-react";

export default function Receive() {
  const { pubkey, network } = useWallet();
  return (
    <div className="page-shell" data-testid="receive-screen">
      <PageHeader title="Receive" subtitle="Your Solana address" right={<NetworkPill network={network} />} />
      <div className="px-4 pt-6 flex flex-col items-center">
        <div className="card p-5 bg-white/95 rounded-2xl" data-testid="receive-qr">
          <QRCodeSVG
            value={pubkey}
            size={240}
            bgColor="#ffffff"
            fgColor="#07090C"
            level="M"
            includeMargin={false}
          />
        </div>
        <div className="mt-4 text-center">
          <div className="label">Public key</div>
          <div className="mono text-sm text-ink-primary break-all max-w-[420px] mx-auto" data-testid="receive-address-full">
            {pubkey}
          </div>
          <div className="mt-2">
            <AddressCopy address={pubkey} short={false} testid="receive-copy" className="mono text-xs" />
          </div>
        </div>
        <div className="mt-6 max-w-[32ch] text-center flex items-start gap-2 text-xs text-ink-tertiary">
          <ShieldCheck size={14} className="mt-0.5 text-phos" />
          <span>
            Only send SOL and SPL tokens on the <span className="mono text-ink-secondary">{network}</span> cluster to this address.
            Sending other assets may result in permanent loss.
          </span>
        </div>
      </div>
    </div>
  );
}
