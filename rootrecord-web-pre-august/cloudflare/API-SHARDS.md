# Per-app API Workers (shards)

These directories are **full copies** of `rootrecord-primary` (same TypeScript, same `src/router.ts`, same D1 + R2 bindings). They exist so you can:

- Attach **separate custom hostnames** later (e.g. `api-weather.rootrecord.info` → `rootrecord-api-weather`) and point **new** mobile/web builds at them.
- **Split metrics and logs** in the Cloudflare dashboard per product without changing behavior today.

## Canonical until you cut over

**`rootrecord-primary`** (`api.rootrecord.info`) remains the **production** Worker for **native Android** builds (Capacitor WebView) and any client without a shard URL configured.

**Product web (Cloudflare Pages)** bundles in this repo default the API origin to the matching shard on **`https://rootrecord-api-<weather|business|account|token|kilauea>.rootrecord.workers.dev`**, detected at runtime when `Capacitor.isNativePlatform()` is false (CRA apps) or always for **Kīlauea Vite** (`VITE_ROOTRECORD_API_ORIGIN` optional override). Override per app with `REACT_APP_BACKEND_URL` / `REACT_APP_RR_BACKEND_URL` / `VITE_ROOTRECORD_API_ORIGIN` if you add custom domains (e.g. `api-weather.rootrecord.info`) later.

**Do not remove or stop deploying** `rootrecord-primary` until native apps and any remaining traffic are intentionally pointed at shards only.

## Shards + scheduled jobs

Each shard sets **`WORKER_SHARD`** in `[vars]` so `src/index.ts` `scheduled()` only runs jobs for that product. **`rootrecord-primary`** keeps the **full** cron set until you intentionally remove schedules there after traffic cutover (otherwise the same D1 work would run twice).

| Directory | `WORKER_SHARD` | `[triggers]` / crons | What runs on this Worker |
|-----------|----------------|----------------------|---------------------------|
| `rootrecord-api-weather` | `weather` | `*/5 * * * *` | NOAA NWS FCM path (`runNoaaAlertCron` — `rrwm_*`) |
| `rootrecord-api-business` | `business` | *(none)* | No first-party cron in this codebase for BM |
| `rootrecord-api-account` | `account` | `45 8 * * *` | Inactive account cleanup + HTTP error log prune |
| `rootrecord-api-token` | `token` | `*/5 * * * *`, `0 7 * * *` | RRTT custodial payout (07:00 UTC) + treasury `rootrecord-solana-tx` triggers (:00 / :10) |
| `rootrecord-api-kilauea` | `kilauea` | *(none)* | No Worker cron for Kīlauea (native app + USGS direct) |

Canonical **`rootrecord-primary`** `wrangler.toml`: unchanged — still `*/5`, `0 7`, `45 8` with `WORKER_SHARD` unset (= **primary**, all jobs).

## Shared gitignored secrets with primary

Each shard’s `deploy.ps1` reads and writes **JWT** and **INTERNAL_WALLET_ENC_KEY_B64** helper files from **`rootrecord-primary/`** (`.deploy-jwt`, `.deploy-internal-wallet-key`) so a shard deploy never generates a **different** encryption key or JWT file in its own folder. Deploy **`rootrecord-primary` at least once** on a machine before relying on auto-generated files, or set `ROOTRECORD_PRIMARY_JWT_SECRET` and `INTERNAL_WALLET_ENC_KEY_B64` in `credentials.env`.

Otherwise, shard deploy is the same as primary: walk-up `credentials.env`, `wrangler secret put …`, `wrangler d1 migrations apply root-record --remote`, `wrangler deploy`.

## First-time deploy (orderly)

From each shard directory (after `npm ci`):

```powershell
cd Web/cloudflare/rootrecord-api-weather
npm ci
powershell -NoProfile -ExecutionPolicy Bypass -File ./deploy.ps1
```

Repeat for `rootrecord-api-business`, `rootrecord-api-account`, `rootrecord-api-token`, `rootrecord-api-kilauea`.

Or run **`Web/cloudflare/deploy-api-shards.ps1`** from `Web/cloudflare` to deploy all five in sequence (does **not** deploy `rootrecord-primary`).

## Custom domains (later)

When you are ready, add a **Workers Custom Domain** (or zone route) for each Worker name above, e.g. `api-weather.rootrecord.info` → `rootrecord-api-weather`. Keep **`api.rootrecord.info`** on `rootrecord-primary` until traffic migration is complete.

## Drift / updates

**Prefer editing `src/` in `rootrecord-api-*`** for new work, then **copy the same files** to the other shards (and to `rootrecord-primary` only while Android / `api.rootrecord.info` still need identical behavior). Shared pieces include `router.ts`, `primary-auth.ts`, `web-sso.ts`, `cors.ts`, `auth.ts`, `me-account-routes.ts`, and route modules those import. Longer term, consider one shared package + thin Workers — this layout optimizes for **safe duplication + observability** first.
