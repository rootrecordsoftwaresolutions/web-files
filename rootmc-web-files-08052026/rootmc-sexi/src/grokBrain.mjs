import { grokToken, SEXI_GROK_MODEL } from "./config.mjs";
import { SEXI_HARD_RULES, SEXI_PERSONA } from "./persona.mjs";
import { gatherSiteContext } from "./siteContext.mjs";
import { gatherLocalContext } from "./localContext.mjs";
import { scrubPublicReply } from "./scrub.mjs";

/**
 * Chatty Grok brain — wiki/site + local workspace packs.
 */
export async function grokRecommend({ question, context = "", env }) {
  const key = grokToken(env || {});
  if (!key) {
    return { ok: false, reason: "missing_xai_key", text: null };
  }

  const site = await gatherSiteContext(question);
  const local = gatherLocalContext(`${question}\n${context}`);

  const system = `${SEXI_PERSONA}

${SEXI_HARD_RULES}

Mode: Discord chat on Grok (xAI) with packs attached.
- You HAVE local file/log excerpts in the pack when present — use them. Do not say you lack file access if the local pack has content.
- Use wiki/site excerpts for public docs. Cite https://rootmc.net links when useful.
- Continuity: follow this player's recent Discord lines.
- Keep tone chill and shorter. Less "bestie".
- For big code edits/implementations, say you'll finish that on the Root Server (Cursor) — but reading logs/files from the pack is fair game now.
- Don't invent live economy numbers.`;

  const user = `Discord conversation context:
${String(context || "(none)").slice(0, 6500)}

Latest ask:
${String(question).trim()}

Site/wiki pack:
${site.brief.slice(0, 7000)}

${local.brief.slice(0, 12000)}

Write Sexi's Discord reply now. If they asked about logs/files, answer from the local pack.`;

  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: SEXI_GROK_MODEL,
        temperature: 0.55,
        max_tokens: 750,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      console.warn("grokRecommend", res.status, text.slice(0, 200));
      return { ok: false, reason: `http_${res.status}`, text: null };
    }
    const data = JSON.parse(text);
    const reply = data?.choices?.[0]?.message?.content?.trim();
    if (!reply) return { ok: false, reason: "empty", text: null };
    return {
      ok: true,
      reason: "ok",
      text: scrubPublicReply(reply),
      pages: site.pages,
      local: local.hasFiles,
    };
  } catch (err) {
    console.warn("grokRecommend:", err?.message || err);
    return { ok: false, reason: "error", text: null };
  }
}
