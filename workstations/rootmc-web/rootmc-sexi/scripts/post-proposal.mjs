import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadRootMcEnv, rootMcBotToken } from "../../rootmc-realm-api/scripts/lib/rootmc-env.mjs";
import { discordMessageUrl } from "../../rootmc-realm-api/scripts/lib/rootmc-discord.mjs";

const API = "https://discord.com/api/v10";
const forumId = "1526664180491358419";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const planPath = path.resolve(__dirname, "../PROPOSAL.md");
const planBytes = fs.readFileSync(planPath);
const token = rootMcBotToken(loadRootMcEnv()).replace(/^bot\s+/i, "").trim();

const summary = [
  "**Proposal: Sexi Discord recommendation assistant** — foundation scaffolding.",
  "",
  "**Goal:** Local background helper so staff can ask **Sexi** / `@sexi` for **design recommendations** in Discord (proposals / admins) without waiting for a Cursor relay.",
  "",
  "**Principles:**",
  "• Public replies = game-design only (no secrets / deploys / DB / jars)",
  "• Opt-out: never ping players who ask not to be tagged",
  "• Local-first HTTP + poller now; Gateway / slash / Cursor SDK later",
  "",
  "**v0 folder:** `Web Files/rootmc-sexi/` — `npm start` → health on `:8787` + channel poller.",
  "",
  "Full proposal attached. Status: **foundation live locally — expand after feedback.**",
].join("\n");

const threadRes = await fetch(`${API}/channels/${forumId}/threads`, {
  method: "POST",
  headers: {
    Authorization: `Bot ${token}`,
    "Content-Type": "application/json",
    "User-Agent": "RootMC/post-sexi-proposal",
  },
  body: JSON.stringify({
    name: "Sexi Discord recommendation assistant (foundation)",
    auto_archive_duration: 10080,
    message: { content: summary.slice(0, 2000) },
  }),
});
const threadText = await threadRes.text();
if (!threadRes.ok) throw new Error(`thread ${threadRes.status}: ${threadText.slice(0, 500)}`);
const thread = JSON.parse(threadText);
console.log("DISCORD_THREAD", discordMessageUrl(forumId, thread.id));

const form = new FormData();
form.append("payload_json", JSON.stringify({ content: "Full proposal (markdown)." }));
form.append("files[0]", new Blob([planBytes], { type: "text/markdown" }), "sexi-proposal.md");
const fileRes = await fetch(`${API}/channels/${thread.id}/messages`, {
  method: "POST",
  headers: { Authorization: `Bot ${token}`, "User-Agent": "RootMC/post-sexi-proposal" },
  body: form,
});
const fileText = await fileRes.text();
if (!fileRes.ok) throw new Error(`file ${fileRes.status}: ${fileText.slice(0, 500)}`);
const msg = JSON.parse(fileText);
console.log("DISCORD_FILE", discordMessageUrl(thread.id, msg.id));
