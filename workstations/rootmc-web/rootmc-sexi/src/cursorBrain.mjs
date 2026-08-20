import path from "node:path";
import { fileURLToPath } from "node:url";
import { Agent, CursorAgentError } from "@cursor/sdk";
import { cursorApiKey, SEXI_MODEL, SEXI_WORKSPACE } from "./config.mjs";
import { SEXI_HARD_RULES, SEXI_PERSONA } from "./persona.mjs";
import { scrubPublicReply } from "./scrub.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** RootMC workspace root (plugins, web, docs). */
export function workspaceRoot() {
  if (SEXI_WORKSPACE) return SEXI_WORKSPACE;
  return path.resolve(__dirname, "../../..");
}

let queue = Promise.resolve();
let pending = 0; // Root Server Agent.prompt jobs
let asksOpen = 0; // Discord asks mid-flight (packs + brain)

/** Discord asks mid-flight (packs + brain). Used for instant queue warnings. */
export function brainQueueDepth() {
  return asksOpen;
}

export function beginAsk() {
  asksOpen += 1;
}

export function endAsk() {
  asksOpen = Math.max(0, asksOpen - 1);
}

function enqueue(fn) {
  pending += 1;
  const run = queue.then(
    async () => {
      try {
        return await fn();
      } finally {
        pending = Math.max(0, pending - 1);
      }
    },
    async () => {
      try {
        return await fn();
      } finally {
        pending = Math.max(0, pending - 1);
      }
    },
  );
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/**
 * Root Server mode — local Cursor agent on the RootMC workspace.
 * Prefer fast replies; deep dig only when asked / packs need file inspection.
 */
export async function cursorRecommend({ question, context = "", env, deep = false }) {
  const apiKey = cursorApiKey(env || {});
  if (!apiKey) {
    return { ok: false, reason: "missing_cursor_api_key", text: null };
  }

  const cwd = workspaceRoot();
  const modeNote = deep
    ? `Mode: Root Server deep dig.
Use attached packs first. Only inspect extra files if the packs don't answer.
OUTPUT ONLY a Discord reply — accurate summary, no secret dumps, no raw disk paths, no deploy steps.
Never name other AIs or vendors — say Root Server if you must.
If you'd edit code, describe the change; Alex executes.`
    : `Mode: Root Server quick assist.
Answer from the attached packs + question. Do NOT wander the repo unless the packs are empty/irrelevant.
OUTPUT ONLY a Discord reply. Accuracy > vibes. Never name other AIs.`;

  const prompt = `${SEXI_PERSONA}

${SEXI_HARD_RULES}

${modeNote}

Quality bar:
- Be correct. Wrong confidence is worse than "not sure".
- Be fast to read: answer first, then one link or next step.
- Stay in Ava's voice.

Thread/context (Discord — includes this player's recent messages; stay in continuity):
${String(context || "(none)").slice(0, 5500)}

Question (may continue prior chat):
${String(question).trim()}

Write Ava's Discord reply now.`;

  return enqueue(async () => {
    const tryPrompt = async (withSandbox) =>
      Agent.prompt(prompt, {
        apiKey,
        model: {
          id: SEXI_MODEL,
          // Composer 2.5 Standard — cheapest Cursor API tier (Fast is ~6×).
          params: [{ id: "fast", value: "false" }],
        },
        local: {
          cwd,
          settingSources: [],
          autoReview: true,
          ...(withSandbox ? { sandboxOptions: { enabled: true } } : {}),
        },
      });

    try {
      let result;
      try {
        result = await tryPrompt(true);
      } catch (err) {
        const msg = err instanceof CursorAgentError ? err.message : String(err?.message || err);
        if (!/sandbox/i.test(msg)) throw err;
        console.warn("cursor sandbox unsupported — retrying without sandbox");
        result = await tryPrompt(false);
      }

      if (result.status === "error") {
        console.warn("cursor run error", result.id, result.error?.message || result.error);
        return { ok: false, reason: "run_error", text: null, runId: result.id };
      }

      const raw = String(result.result || "").trim();
      if (!raw) {
        return { ok: false, reason: "empty_result", text: null, runId: result.id };
      }

      return {
        ok: true,
        reason: "ok",
        text: scrubPublicReply(raw),
        runId: result.id,
        agentId: result.agentId,
      };
    } catch (err) {
      const msg = err instanceof CursorAgentError ? err.message : String(err?.message || err);
      console.warn("cursorRecommend:", msg);
      return {
        ok: false,
        reason: err instanceof CursorAgentError ? "startup_error" : "unknown_error",
        text: null,
      };
    }
  });
}
