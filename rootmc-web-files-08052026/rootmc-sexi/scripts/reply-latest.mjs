import { loadEnv, botToken, sexiBotAppId, DISCORD_API, watchChannels } from "../src/config.mjs";
import { extractQuestion, looksLikeSexiTrigger, recommend } from "../src/recommend.mjs";
import { buildPlayerContext } from "../src/playerContext.mjs";

const env = await loadEnv();
console.log("watch", watchChannels(env).join(","));
const token = botToken(env);
const botAppId = sexiBotAppId(env);
const headers = {
  Authorization: `Bot ${token}`,
  "User-Agent": "RootMC-Sexi/0.3",
  "Content-Type": "application/json",
};
const channelId = process.argv[2] || "1516108586307158088";
const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages?limit=30`, { headers });
const messages = await res.json();
if (!Array.isArray(messages)) {
  console.log("bad messages", res.status, JSON.stringify(messages).slice(0, 200));
  process.exit(1);
}
const trigger = messages.find((m) => !m.author?.bot && looksLikeSexiTrigger(m, botAppId));
console.log(
  "found",
  Boolean(trigger),
  trigger ? `content=${JSON.stringify(trigger.content)}` : "",
  "mentionIds",
  trigger?.mentions?.map((u) => u.id)?.join(",") || "",
);
if (!trigger) process.exit(0);
const question = extractQuestion(trigger.content) || "hey — you pinged me, what's up?";
const context = buildPlayerContext({ trigger, messages, sexiBotId: botAppId });
const answer = await recommend({ question, context, env });
const post = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    content: String(answer).slice(0, 2000),
    message_reference: { message_id: trigger.id },
    allowed_mentions: { parse: [] },
  }),
});
console.log("post", post.status, String(answer).slice(0, 180));
