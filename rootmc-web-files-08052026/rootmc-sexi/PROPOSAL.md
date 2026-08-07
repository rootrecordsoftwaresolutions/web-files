# Proposal: Sexi Discord recommendation assistant

**Status:** foundation scaffolding — local workstation service. Not production Paper.

## Goal

Let staff (and later players in proposal threads) talk to **Sexi** for **direct design recommendations** without waiting for Alex to relay Cursor chat.

Trigger ideas: `Sexi`, `@sexi`, or bot mention in watched channels (proposals, admins, updates — configurable).

## Principles

1. **Recommendations only in public Discord** — no secrets, deploy steps, DB hosts, jar versions, or internal file paths.
2. **Opt-out pings** — never mention users who ask not to be tagged.
3. **Local-first** — runs on the operator machine in the background; later can move behind `api.rootmc.net` if we want.
4. **Optional LLM** — Grok (or later Cursor SDK) when keys exist; otherwise short heuristic replies so the loop still works.

## v0 delivered (this PR / folder)

`Web Files/rootmc-sexi/`:

- HTTP health + `/v1/recommend`
- Channel poller for Sexi / bot mentions → reply in-thread
- Deny-list for mentions
- Proposal poster script
- **Cursor SDK** local `Agent.prompt` brain (scrubbed); heuristic fallback without `CURSOR_API_KEY`

## Next phases (not building yet unless approved)

1. Discord Gateway (lower latency than poll) + Message Content intent
2. Slash command `/sexi` or custom `@Sexi` webhook role
3. Per-channel allowlist + rate limits
4. Optional Cloudflare Worker proxy with staff-only auth

## Success criteria

- `npm start` stays up locally
- Asking “Sexi, thoughts on X?” in a watched channel gets a useful design reply
- No secret leakage in Discord replies
