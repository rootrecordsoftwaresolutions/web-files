/* eslint-env es2020 */
import {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  clusterApiUrl,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
} from "@solana/spl-token";

export const NETWORKS = {
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
  devnet: "https://api.devnet.solana.com",
  testnet: "https://api.testnet.solana.com",
};

export function getRpcUrl(network) {
  return NETWORKS[network] || NETWORKS["mainnet-beta"];
}

export function getConnection(network) {
  const url = getRpcUrl(network);
  return new Connection(url, { commitment: "confirmed" });
}

export { LAMPORTS_PER_SOL, PublicKey, clusterApiUrl };

export async function fetchSolBalance(conn, pubkey) {
  const pk = new PublicKey(pubkey);
  const lamports = await conn.getBalance(pk, "confirmed");
  return lamports; // number of lamports
}

/** Returns merged list of tokens from both classic SPL and Token-2022 programs. */
export async function fetchTokenAccounts(conn, pubkey) {
  const pk = new PublicKey(pubkey);
  const results = [];
  for (const program of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
    try {
      const res = await conn.getParsedTokenAccountsByOwner(pk, { programId: program });
      for (const { pubkey: acctPk, account } of res.value) {
        const info = account?.data?.parsed?.info;
        if (!info) continue;
        const mint = info.mint;
        const ta = info.tokenAmount || {};
        const uiAmount = Number(ta.uiAmount || 0);
        const decimals = Number(ta.decimals || 0);
        const amount = ta.amount || "0";
        const isNft = decimals === 0 && uiAmount === 1;
        results.push({
          accountPubkey: acctPk.toBase58(),
          mint,
          uiAmount,
          amount,
          decimals,
          isNft,
          programId: program.toBase58(),
        });
      }
    } catch (e) {
      // continue — token-2022 may not be available on some clusters or RPCs
      // eslint-disable-next-line no-console
      console.warn("token fetch failed", program.toBase58(), e?.message);
    }
  }
  return results;
}

export async function fetchRecentSignatures(conn, pubkey, limit = 15) {
  const pk = new PublicKey(pubkey);
  return conn.getSignaturesForAddress(pk, { limit });
}

/** Build a simple SOL transfer transaction (lamports, integer). */
export async function buildSolTransferTx(conn, fromPubkey, toPubkey, lamports) {
  const from = new PublicKey(fromPubkey);
  const to = new PublicKey(toPubkey);
  const { blockhash } = await conn.getLatestBlockhash("confirmed");
  const tx = new Transaction({
    feePayer: from,
    recentBlockhash: blockhash,
  }).add(
    SystemProgram.transfer({
      fromPubkey: from,
      toPubkey: to,
      lamports: BigInt(lamports),
    })
  );
  return tx;
}

/** Build a SPL (classic) token transfer tx, creating the recipient ATA if needed. */
export async function buildSplTransferTx(conn, fromPubkey, toPubkey, mint, amountBigInt, decimals) {
  const owner = new PublicKey(fromPubkey);
  const recipient = new PublicKey(toPubkey);
  const mintPk = new PublicKey(mint);

  const fromAta = getAssociatedTokenAddressSync(mintPk, owner, false, TOKEN_PROGRAM_ID);
  const toAta = getAssociatedTokenAddressSync(mintPk, recipient, false, TOKEN_PROGRAM_ID);

  const { blockhash } = await conn.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: owner, recentBlockhash: blockhash });

  // Create recipient ATA if it doesn't exist
  const toAtaInfo = await conn.getAccountInfo(toAta);
  if (!toAtaInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        owner,
        toAta,
        recipient,
        mintPk,
        TOKEN_PROGRAM_ID
      )
    );
  }

  tx.add(
    createTransferCheckedInstruction(
      fromAta,
      mintPk,
      toAta,
      owner,
      amountBigInt,
      decimals,
      [],
      TOKEN_PROGRAM_ID
    )
  );
  return tx;
}

/** Best-effort validator for a Solana base58 pubkey. */
export function isValidPubkey(s) {
  try {
    if (!s || typeof s !== "string") return false;
    new PublicKey(s);
    return true;
  } catch {
    return false;
  }
}
