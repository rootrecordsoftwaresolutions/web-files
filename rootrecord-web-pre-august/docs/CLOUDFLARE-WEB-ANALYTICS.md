# Cloudflare Web Analytics (per app)

Goal: **one Web Analytics “site” per hostname** (separate cards in the dashboard) while keeping deploys scripted.

## 1. Add a site per hostname (dashboard)

1. Cloudflare Dashboard → **Web analytics** → **Add a site**.
2. Enter the hostname (e.g. `weather.rootrecord.info`, `business.rootrecord.info`, `kilauea.rootrecord.info`, `rootrecord.info`).
3. Choose **JS Snippet** (manual token) so the token is stable and you control injection from this repo.
4. Copy the **site token** only (the value inside `data-cf-beacon` / the snippet they show).

Repeat for each product subdomain **and** marketing (`rootrecord.info`) if you want it split from any legacy setup.

## 2. Put tokens in `credentials.env` (never commit)

| Host / use case | Suggested env var (used by deploy scripts) |
|-----------------|---------------------------------------------|
| Marketing Pages (`rootrecord-website`) | `CF_WEB_ANALYTICS_TOKEN_MARKETING` |
| Weather web | `CF_WEB_ANALYTICS_TOKEN_WEATHER` |
| Business web | `CF_WEB_ANALYTICS_TOKEN_BUSINESS` |
| Account Hub web | `CF_WEB_ANALYTICS_TOKEN_ACCOUNT` |
| Token Manager web | `CF_WEB_ANALYTICS_TOKEN_TOKEN` |
| Kīlauea web | `CF_WEB_ANALYTICS_TOKEN_KILAUEA` |
| Root Goals web | `CF_WEB_ANALYTICS_TOKEN_GOALS` |

See **`Web/credentials.env.example`** for copy-paste lines.

## 3. Deploy wiring (already implemented)

- **Marketing** (`Web/main/pages-deploy.ps1`): copies the site to a **temp folder**, injects the beacon into `*.html` there only (so **tokens never touch tracked files**), then `wrangler pages deploy`.
- **Product Pages** (`Web/scripts/deploy-product-web-to-pages.ps1`): injects into **`build/`** after `pnpm run build` (build output is gitignored).

Injection script: `Web/scripts/inject-cf-web-analytics.ps1`.

## 4. Avoid double counting

Do **not** also enable **Workers & Pages → project → Metrics → Web Analytics** auto-snippet **and** inject the same token manually, or you may load the beacon twice.

Pick **one** method per project. For **separate** Web Analytics cards per hostname, the env-token + deploy inject path matches that model.

## 5. Optional: Pages-only auto (no token in repo)

If you prefer Cloudflare’s **one-click** inject for a Pages project only: [Enable Web Analytics (Pages)](https://developers.cloudflare.com/pages/how-to/web-analytics/). That does **not** use the env vars above; use it **instead** of tokens for that project if you want zero secrets in `credentials.env` for that app.
