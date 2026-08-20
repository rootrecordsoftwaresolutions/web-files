import http from "node:http";
import {
  loadEnv,
  SEXI_PORT,
  cursorApiKey,
  SEXI_MODEL,
  AVA_HANDOFF,
} from "./config.mjs";
import { workspaceRoot } from "./cursorBrain.mjs";
import { recommend } from "./recommend.mjs";
import { storePaths } from "./store.mjs";

const env = await loadEnv();
storePaths();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${SEXI_PORT}`);
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "GET" && url.pathname === "/health") {
    res.end(
      JSON.stringify({
        ok: true,
        service: "ava-ivy",
        version: "0.4.0",
        brain: "cursor",
        cursor: Boolean(cursorApiKey(env)),
        cursorModel: SEXI_MODEL,
        workspace: workspaceRoot(),
        handoff: AVA_HANDOFF,
        note: "Ack first, then one Root Server answer. Never name other AIs in Discord.",
      }),
    );
    return;
  }

  if (req.method === "POST" && url.pathname === "/v1/recommend") {
    let body = "";
    for await (const chunk of req) body += chunk;
    let parsed = {};
    try {
      parsed = body ? JSON.parse(body) : {};
    } catch {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "invalid_json" }));
      return;
    }
    const answer = await recommend({
      question: parsed.question || parsed.prompt || "",
      context: parsed.context || "",
      env,
    });
    res.end(JSON.stringify({ answer }));
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ error: "not_found" }));
});

server.listen(SEXI_PORT, "127.0.0.1", () => {
  console.log(`ava-ivy HTTP on http://127.0.0.1:${SEXI_PORT}`);
});
