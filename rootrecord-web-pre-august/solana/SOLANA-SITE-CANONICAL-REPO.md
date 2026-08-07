# Solana Tools site — single source of truth (read before any Solana web work)

**Repo:** https://github.com/RootRecord/solana-rootrecord-site (`main`)  
**Live:** https://solana.rootrecord.info (Vercel builds from that repo only)

## Monorepo (`Web-Development-2026`)

The Next.js app **is not** maintained under `Web/solana/`. **Do not** re-add `Web/solana/solana-rootrecord-site`, subtree workflows, or extra trees under `Development/` (`*-sync`, `*-tmp`, robocopy mirrors, `git worktree` used only to “ship” the site).

## One clone — routine work (agents + humans)

1. Use **one** local checkout of **`RootRecord/solana-rootrecord-site`** (fixed path the user keeps, e.g. next to `Web/`). Add that folder to the Cursor workspace if it is not already open.
2. All edits, `pnpm dev`, commits, and pushes run **from that directory’s git root** (`git rev-parse --show-toplevel` must be that repo).
3. **Publish / what actually triggers Vercel:** from that same repo, on `main`:

   ```bash
   git push origin main
   ```

   That is the entire deploy path. There is no second repo, no subtree, no step inside `Web-Development-2026`.

4. If there is **no** clone on disk yet, **one** `git clone https://github.com/RootRecord/solana-rootrecord-site.git` to a stable path is enough — then use only that path forever; do **not** clone again for each task.

## Do not (redundant / wrong)

- Do **not** create a fresh clone under `Development/solana-rootrecord-site-tmp` (or similar) for every change or push.
- Do **not** `git worktree` + robocopy / mirror scripts to “sync” into GitHub — that was a **one-off recovery**, not the workflow.
- Do **not** edit or push from `Web/solana/` for the public site.

## Local dev (in the one clone)

```bash
cd /path/to/solana-rootrecord-site
pnpm install
pnpm dev
```

## Env / secrets

Use **`.env.example`** in that repo and the Vercel project env UI — not paths under `Web/`.
