/** @jest-environment node */
import { Keypair } from "@solana/web3.js";
import {
  buildSplTransferTx,
  isValidPubkey,
} from "./solana";

describe("isValidPubkey", () => {
  it("accepts valid base58 addresses", () => {
    const pk = Keypair.generate().publicKey.toBase58();
    expect(isValidPubkey(pk)).toBe(true);
    expect(isValidPubkey("So11111111111111111111111111111111111111112")).toBe(true);
  });

  it("rejects invalid values", () => {
    expect(isValidPubkey("")).toBe(false);
    expect(isValidPubkey(null)).toBe(false);
    expect(isValidPubkey("not-a-pubkey!!!")).toBe(false);
  });
});

describe("buildSplTransferTx", () => {
  /** Mainnet USDC — stable mint for ATA derivation in Jest (avoids env edge cases with random mints). */
  const mint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
  const blockhash = "EETubPtdELBhoo7Qqzi6VB5cCZYMPV6E9RWJ223QS6nV";

  it("adds ATA create + transfer when recipient ATA is missing", async () => {
    const from = Keypair.generate().publicKey.toBase58();
    const to = Keypair.generate().publicKey.toBase58();
    const conn = {
      getLatestBlockhash: jest.fn().mockResolvedValue({ blockhash }),
      getAccountInfo: jest.fn().mockResolvedValue(null),
    };
    const tx = await buildSplTransferTx(conn, from, to, mint, 1000n, 6);
    expect(conn.getLatestBlockhash).toHaveBeenCalledWith("confirmed");
    expect(conn.getAccountInfo).toHaveBeenCalled();
    expect(tx.instructions.length).toBe(2);
    expect(tx.recentBlockhash).toBe(blockhash);
  });

  it("adds only transfer when recipient ATA exists", async () => {
    const from = Keypair.generate().publicKey.toBase58();
    const to = Keypair.generate().publicKey.toBase58();
    const conn = {
      getLatestBlockhash: jest.fn().mockResolvedValue({ blockhash }),
      getAccountInfo: jest.fn().mockResolvedValue({
        lamports: 2_039_280,
        data: new Uint8Array(165),
        owner: Keypair.generate().publicKey,
        executable: false,
        rentEpoch: 0,
      }),
    };
    const tx = await buildSplTransferTx(conn, from, to, mint, 1n, 9);
    expect(tx.instructions.length).toBe(1);
  });
});
