# Visiting Hawaiʻi (web + PWA)

Local-first Hawaiian Islands travel guide by **RootRecord**. Vite + React + TypeScript; offline via service worker (PWA) and bundled JSON in `src/data/places.ts`.

## Monorepo layout

| Path | Role |
|------|------|
| `Web/apps/visiting-hawaii-web/` | Web app + PWA (this project) |
| `Mobile/visiting-hawaii-app/` | Android/iOS Capacitor wrapper |

This follows the same pattern as Weather Manager, Kīlauea Alerts, etc. (not Expo — integrates with `cloudflare-update-pages.bat` and Mobile release scripts).

## Develop

```powershell
cd Web\apps\visiting-hawaii-web
pnpm install
pnpm run dev
```

## Build & Pages deploy

```powershell
pnpm run build
pnpm run pages:deploy
```

First-time Cloudflare Pages project: create `rootrecord-visiting-hawaii-web` in the dashboard (or add to your Pages setup script), then deploy.

## Capacitor (Android)

```powershell
cd Mobile\visiting-hawaii-app
pnpm install
pnpm run cap:sync
pnpm exec cap open android
```

Run `npx cap add android` once if `android/` is missing (see `Mobile/visiting-hawaii-app/README.md`).

## Content

Edit `src/data/places.ts` and `src/data/catalog.ts`. Future: sync from `rootrecord-api-account` or a dedicated Worker.

## Weather API (future)

`src/lib/weather.ts` uses mock data. Wire to `rootrecord-api-weather` / `rootrecord-api-kilauea` with island coordinates when auth is needed.

## Sponsored listings

- Business signup: https://rootrecord.info/visiting-hawaii-sponsor.html
- API: `rootrecord-api-account` routes under `/api/visiting-hawaii/sponsored/*`
- After creating a $100/year Price in Stripe, set Worker var `STRIPE_VISITING_HAWAII_SPONSORED_PRICE_ID` and run migration `0071_visiting_hawaii_sponsored_listings.sql`
- Webhook activation: `rootrecord-license` `/v1/billing/webhook` (shared `stripe-webhook.ts`)

## Features (v0.1)

- 6 islands, 8 categories, 40+ seeded places
- Island onboarding + header switcher
- Bottom nav: Home, Explore, Map, Saved, Profile
- Leaflet map + OSM tiles (cached in PWA)
- Favorites, trip collections, per-place notes (localStorage via Zustand)
- Mālama ratings, cultural tips, glossary
- Dark mode, large text, voice search (where supported)
- [RootRecord](https://rootrecord.info) in Profile / footer
