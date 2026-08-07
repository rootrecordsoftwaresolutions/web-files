# HELE

## Website

- [helehawaii.com](https://helehawaii.com) — active

## Token

| Field | Value |
|--------|--------|
| Name | Hele Token (HELE) |
| Mint | `6cTyE6Uw5yWPbjvPJLnnA7tVgkbNqZihjnLzUUzuGAG8` |
| Decimals | 3 |
| Current supply | **99,940,392.382** HELE (reported snapshot — use [Solscan](https://solscan.io/token/6cTyE6Uw5yWPbjvPJLnnA7tVgkbNqZihjnLzUUzuGAG8) for live supply) |
| Authority | `BgwDWXBhCaXjDWpX6viCb1MwMSW8jbWHSxi5FyGwyppY` |
| Creator | `BgwDWXBhCaXjDWpX6viCb1MwMSW8jbWHSxi5FyGwyppY` |
| First mint (UTC) | 15:17:47 Jul 4, 2025 |
| Treasury | `G1DHctEcwkiLw8NZDfCbDCbuPktQBmWa6P2aobDuMKuZ` — [Solscan](https://solscan.io/account/G1DHctEcwkiLw8NZDfCbDCbuPktQBmWa6P2aobDuMKuZ) |
| Locked (yearly release) | `oaQtjV8Aj2rxTLAvQzFZvMqf3byhUeCaEaFz7vGQk5v` — [Solscan](https://solscan.io/account/oaQtjV8Aj2rxTLAvQzFZvMqf3byhUeCaEaFz7vGQk5v) |
| Jupiter Referral Program | `45ruCyfdRkWpRNGEqWzjCiXRHkZs8WXCLQ67Pnpye7Hp` — [Solscan](https://solscan.io/account/45ruCyfdRkWpRNGEqWzjCiXRHkZs8WXCLQ67Pnpye7Hp) |

| Resource | Link |
|----------|------|
| Dexscreener | [6cTyE6Uw5yWPbjvPJLnnA7tVgkbNqZihjnLzUUzuGAG8](https://dexscreener.com/solana/6cTyE6Uw5yWPbjvPJLnnA7tVgkbNqZihjnLzUUzuGAG8) |
| Solscan | [6cTyE6Uw5yWPbjvPJLnnA7tVgkbNqZihjnLzUUzuGAG8](https://solscan.io/token/6cTyE6Uw5yWPbjvPJLnnA7tVgkbNqZihjnLzUUzuGAG8) |

## Top holders (reference snapshot)

Balances and **USD** figures are from a single explorer-style export; live values belong on [Solscan token page](https://solscan.io/token/6cTyE6Uw5yWPbjvPJLnnA7tVgkbNqZihjnLzUUzuGAG8) (Holders tab). Row **1** is the [yearly-vesting locked account](https://solscan.io/account/oaQtjV8Aj2rxTLAvQzFZvMqf3byhUeCaEaFz7vGQk5v); some other rows still show truncated labels from that export.

| # | Account / pool | Balance | Share | USD (snapshot) |
|---|----------------|---------|-------|------------------|
| 1 | Locked vesting — `oaQtjV8Aj2rxTLAvQzFZvMqf3byhUeCaEaFz7vGQk5v` | 99,000,000 | 99.05% | $2,893.39 |
| 2 | Raydium Vault Authority #2 — **HELE–USDC** (Pool 1) | 902,885.035 | 0.9034% | $26.38 |
| 3 | Raydium **WSOL–HELE** (market / Pool 2) | 36,873.218 | 0.03689% | $1.07 |
| 4 | Jupiter Partner Referral Fee Vault (`AkiE4MbTJEMV` …) | 631.64 | 0.000632% | $0.01947 |
| 5 | `G1h65GPPAUkk` / `7JsGiWdyufvb` (fragments) | 1.151 | 0.000001151% | $0.00003363 |
| 6 | `Fm7xY42BKe1U` / `E62t8A21LAdm` (fragments) | 1 | 0.000001% | $0.00002922 |
| 7 | Phantom: Fees (`CpWrgsbDrKUA` …) | 0.338 | 0.000000338% | $0.000009878 |

Solscan tagged rows **2** and **4** as whale-adjacent clusters (+6 / +1 related accounts in the UI).

## Liquidity ops note (2026-04-28)

**Jupiter Partner Referral Fee Vault** (Solscan label; pubkey fragment `AkiE4MbTJEMV`… — confirm full token account on the [Holders tab](https://solscan.io/token/6cTyE6Uw5yWPbjvPJLnnA7tVgkbNqZihjnLzUUzuGAG8)) holds **~631.64 HELE** (~0.000632%, ~**$0.01947** in the latest snapshot export).

Internal view as of **2026-04-28:** this referral vault is the main **discretionary sell-side** pocket left among tracked wallets (vesting is on a fixed schedule; Raydium balances are pool liquidity). If referral fees stack as HELE and later hit the market, it is the lever that can still create surprise supply. **Priority:** unwind that exposure through Jupiter’s referral flow—claim or route fees per [Jupiter referral / fee docs](https://station.jup.ag/docs/apis/adding-fees) and the [referral dashboard](https://referral.jup.ag/dashboard)—so the vault is not sitting on idle HELE that could sell in one go. On-chain referral program account: `45ruCyfdRkWpRNGEqWzjCiXRHkZs8WXCLQ67Pnpye7Hp` ([Solscan](https://solscan.io/account/45ruCyfdRkWpRNGEqWzjCiXRHkZs8WXCLQ67Pnpye7Hp)).

## Vesting (Streamflow)

- **Contract:** [Streamflow — mainnet](https://app.streamflow.finance/contract/solana/mainnet/9XRT2Bo1Z9gXoQa5Khf5mTVt4ngqVmxQXymoxU7RkKWm)  
  `9XRT2Bo1Z9gXoQa5Khf5mTVt4ngqVmxQXymoxU7RkKWm`
- **Schedule:** unlocks yearly on **September 18**.
- **Recipient wallet:** `BgwDWXBhCaXjDWpX6viCb1MwMSW8jbWHSxi5FyGwyppY`
- **Locked account (token balance; yearly release):** [Solscan](https://solscan.io/account/oaQtjV8Aj2rxTLAvQzFZvMqf3byhUeCaEaFz7vGQk5v) — `oaQtjV8Aj2rxTLAvQzFZvMqf3byhUeCaEaFz7vGQk5v`

## Environment

Local RPC/network defaults live in `.env`. Public `TREASURY_WALLET`, `LOCKED_VESTING_WALLET`, `JUPITER_REFERRAL_PROGRAM_ID`, optional snapshot `HELE_CURRENT_SUPPLY`, and dev signer `DEV_WALLET_SECRET_KEY` are defined there (see `.env`).
