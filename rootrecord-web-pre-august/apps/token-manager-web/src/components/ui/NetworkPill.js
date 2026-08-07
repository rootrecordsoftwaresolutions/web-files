import React from "react";
import { networkLabel } from "../../lib/format";

export default function NetworkPill({ network }) {
  const cls =
    network === "mainnet-beta"
      ? "pill-mainnet"
      : network === "devnet"
      ? "pill-devnet"
      : "pill-testnet";
  return (
    <span className={`pill ${cls}`} data-testid="network-pill">
      <span
        className="inline-block w-[6px] h-[6px] rounded-full"
        style={{ background: "currentColor" }}
      />
      {networkLabel(network)}
    </span>
  );
}
