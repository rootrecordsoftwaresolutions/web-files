/**
 * Ava Ivy desktop — Electron main.
 */
import { app, BrowserWindow, ipcMain, shell } from "electron";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadDesktopEnv,
  fetchDiscordHistory,
  fetchTelegramHistory,
  fetchSlackHistory,
  listDiscordTextChannels,
  listDiscordPrivateChannels,
  listSlackChannels,
  listTelegramChats,
  listPostPresets,
  postAsAva,
  rewriteDraft,
  summarizeChannel,
  fetchRewriteProviders,
  fetchCronStatus,
  runCronJob,
  configureCron,
  fetchCoreChatStatus,
  coreChat,
  coreChatEnhance,
  coreChatGold,
  editDiscordMessage,
  deleteDiscordMessage,
  listFeedbackQueue,
  processFeedbackNext,
  ackFeedbackItem,
  dualPostFeedback,
  feedbackTemplates,
  FEEDBACK_TARGETS,
  deleteSlackMessage,
  clearDiscordOwnMessages,
  clearSlackOwnMessages,
  clearAllFeedbackAndStamp,
} from "./lib/avaBridge.mjs";
import { listOpsCatalog, opsCommandById } from "./lib/opsCommands.mjs";
import { listAvaLinks } from "./lib/avaLinks.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTEXT_LIMIT = 150;
const AVA_HOME = process.env.AVA_HANDOFF || "/home/ava-core/ava";
const AVA_CORE = process.env.AVA_CORE || path.join(AVA_HOME, "core");
const AVA_PORT = Number(process.env.AVA_PORT || 8787) || 8787;

let mainWindow = null;
/** @type {import('node:child_process').ChildProcess | null} */
let runningOps = null;
let runningOpsId = null;

function nodeBin() {
  const home = os.homedir();
  const candidates = [
    process.env.AVA_NODE_BIN,
    path.join(home, ".local", "bin", "node"),
    "/usr/local/bin/node",
    "/usr/bin/node",
  ].filter(Boolean);
  for (const c of candidates) {
    try {
      if (c && fs.existsSync(c)) return c;
    } catch {
      /* ignore */
    }
  }
  return "node";
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 920,
    minWidth: 980,
    minHeight: 680,
    title: "Ava Ivy",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function sendOps(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function appendLine(line) {
  sendOps("ava:ops-line", { line: String(line).replace(/\r?\n$/, "") });
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (runningOps) {
    try {
      runningOps.kill("SIGTERM");
    } catch {
      /* ignore */
    }
  }
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("ava:env-status", async () => {
  const env = await loadDesktopEnv();
  return {
    ok: true,
    hasDiscord: Boolean(env.discordToken),
    hasSlack: Boolean(env.slackToken),
    hasTelegram: Boolean(env.telegramToken),
    rewriteUrl: env.rewriteUrl,
    operatorChatId: env.operatorChatId,
  };
});

ipcMain.handle("ava:list-discord-channels", async () => {
  const env = await loadDesktopEnv();
  return listDiscordTextChannels(env);
});

ipcMain.handle("ava:list-discord-private", async () => {
  const env = await loadDesktopEnv();
  return listDiscordPrivateChannels(env);
});

ipcMain.handle("ava:list-slack-channels", async () => {
  const env = await loadDesktopEnv();
  return listSlackChannels(env);
});

ipcMain.handle("ava:list-telegram-chats", async () => {
  const env = await loadDesktopEnv();
  return listTelegramChats(env);
});

ipcMain.handle("ava:list-presets", async () => listPostPresets());

ipcMain.handle("ava:history", async (_e, { surface, channelId, limit }) => {
  const env = await loadDesktopEnv();
  const n = Math.min(200, Math.max(1, Number(limit) || CONTEXT_LIMIT));
  if (surface === "telegram") {
    return fetchTelegramHistory(env, channelId || env.operatorChatId, n);
  }
  if (surface === "slack") {
    return fetchSlackHistory(env, channelId, n);
  }
  return fetchDiscordHistory(env, channelId, n);
});

ipcMain.handle("ava:send", async (_e, opts) => {
  const env = await loadDesktopEnv();
  return postAsAva(env, {
    ...opts,
    rewrite: opts.rewrite !== false && String(opts.provider || "") !== "exact",
  });
});

ipcMain.handle("ava:post", async (_e, opts) => {
  const env = await loadDesktopEnv();
  return postAsAva(env, {
    ...opts,
    rewrite: Boolean(opts.rewrite) && String(opts.provider || "") !== "exact",
  });
});

ipcMain.handle("ava:rewrite-preview", async (_e, opts) => {
  const env = await loadDesktopEnv();
  let context = [];
  try {
    if (opts.surface === "discord" && opts.channelId) {
      context = (await fetchDiscordHistory(env, opts.channelId, 20)).messages || [];
    } else if (opts.surface === "slack" && opts.channelId) {
      context = (await fetchSlackHistory(env, opts.channelId, 20)).messages || [];
    } else if (opts.surface === "telegram" && opts.channelId) {
      context = (await fetchTelegramHistory(env, opts.channelId, 20)).messages || [];
    }
  } catch {
    context = [];
  }
  return rewriteDraft(env, {
    text: opts.text,
    surface: opts.surface,
    context,
    provider: opts.provider || "dream",
    compare: Boolean(opts.compare),
  });
});

ipcMain.handle("ava:summarize", async (_e, opts) => {
  const env = await loadDesktopEnv();
  return summarizeChannel(env, opts);
});

ipcMain.handle("ava:rewrite-providers", async () => {
  const env = await loadDesktopEnv();
  return fetchRewriteProviders(env);
});

ipcMain.handle("ava:core-status", async () => {
  try {
    const env = await loadDesktopEnv();
    return await fetchCoreChatStatus(env);
  } catch (err) {
    return { ok: false, detail: err?.message || String(err) };
  }
});

/** @type {AbortController | null} */
let coreChatAbort = null;

ipcMain.handle("ava:core-chat", async (_e, opts) => {
  try {
    if (coreChatAbort) {
      try {
        coreChatAbort.abort();
      } catch {
        /* ignore */
      }
    }
    coreChatAbort = new AbortController();
    const env = await loadDesktopEnv();
    const result = await coreChat(env, {
      ...(opts || {}),
      signal: coreChatAbort.signal,
    });
    coreChatAbort = null;
    return result;
  } catch (err) {
    coreChatAbort = null;
    return { ok: false, detail: err?.message || String(err) };
  }
});

ipcMain.handle("ava:core-cancel", async () => {
  if (coreChatAbort) {
    try {
      coreChatAbort.abort();
    } catch {
      /* ignore */
    }
    coreChatAbort = null;
    return { ok: true, cancelled: true };
  }
  return { ok: true, cancelled: false };
});

ipcMain.handle("ava:core-enhance", async (_e, opts) => {
  try {
    const env = await loadDesktopEnv();
    return await coreChatEnhance(env, opts || {});
  } catch (err) {
    return { ok: false, detail: err?.message || String(err) };
  }
});

ipcMain.handle("ava:core-gold", async (_e, opts) => {
  try {
    const env = await loadDesktopEnv();
    return await coreChatGold(env, opts || {});
  } catch (err) {
    return { ok: false, detail: err?.message || String(err) };
  }
});

ipcMain.handle("ava:discord-edit", async (_e, opts) => {
  try {
    const env = await loadDesktopEnv();
    return await editDiscordMessage(
      env,
      opts?.channelId,
      opts?.messageId,
      opts?.text,
    );
  } catch (err) {
    return { ok: false, detail: err?.message || String(err) };
  }
});

ipcMain.handle("ava:discord-delete", async (_e, opts) => {
  try {
    const env = await loadDesktopEnv();
    return await deleteDiscordMessage(env, opts?.channelId, opts?.messageId);
  } catch (err) {
    return { ok: false, detail: err?.message || String(err) };
  }
});

ipcMain.handle("ava:feedback-targets", async () => ({
  ok: true,
  targets: FEEDBACK_TARGETS,
  templates: feedbackTemplates(),
}));

ipcMain.handle("ava:feedback-list", async (_e, opts) => {
  try {
    const env = await loadDesktopEnv();
    return await listFeedbackQueue(env, opts || {});
  } catch (err) {
    return { ok: false, detail: err?.message || String(err), feedback: [] };
  }
});

ipcMain.handle("ava:feedback-process-next", async () => {
  try {
    const env = await loadDesktopEnv();
    return await processFeedbackNext(env);
  } catch (err) {
    return { ok: false, detail: err?.message || String(err) };
  }
});

ipcMain.handle("ava:feedback-ack", async (_e, opts) => {
  try {
    const env = await loadDesktopEnv();
    return await ackFeedbackItem(env, opts?.id || opts?.feedbackId, opts?.note || "");
  } catch (err) {
    return { ok: false, detail: err?.message || String(err) };
  }
});

ipcMain.handle("ava:feedback-dual-post", async (_e, opts) => {
  try {
    const env = await loadDesktopEnv();
    return await dualPostFeedback(env, opts || {});
  } catch (err) {
    return { ok: false, detail: err?.message || String(err) };
  }
});

ipcMain.handle("ava:feedback-delete-discord", async (_e, opts) => {
  try {
    const env = await loadDesktopEnv();
    return await deleteDiscordMessage(
      env,
      opts?.channelId || FEEDBACK_TARGETS.discordDevelopment.id,
      opts?.messageId,
    );
  } catch (err) {
    return { ok: false, detail: err?.message || String(err) };
  }
});

ipcMain.handle("ava:feedback-delete-slack", async (_e, opts) => {
  try {
    const env = await loadDesktopEnv();
    return await deleteSlackMessage(
      env,
      opts?.channelId || FEEDBACK_TARGETS.slackFeedback.id,
      opts?.messageTs || opts?.messageId,
    );
  } catch (err) {
    return { ok: false, detail: err?.message || String(err) };
  }
});

ipcMain.handle("ava:feedback-clear-discord", async (_e, opts) => {
  try {
    const env = await loadDesktopEnv();
    return await clearDiscordOwnMessages(
      env,
      opts?.channelId || FEEDBACK_TARGETS.discordDevelopment.id,
      opts || {},
    );
  } catch (err) {
    return { ok: false, detail: err?.message || String(err), deleted: 0 };
  }
});

ipcMain.handle("ava:feedback-clear-slack", async (_e, opts) => {
  try {
    const env = await loadDesktopEnv();
    return await clearSlackOwnMessages(
      env,
      opts?.channelId || FEEDBACK_TARGETS.slackFeedback.id,
      opts || {},
    );
  } catch (err) {
    return { ok: false, detail: err?.message || String(err), deleted: 0 };
  }
});

ipcMain.handle("ava:feedback-clear-all", async (_e, opts) => {
  try {
    const env = await loadDesktopEnv();
    return await clearAllFeedbackAndStamp(env, opts || {});
  } catch (err) {
    return { ok: false, detail: err?.message || String(err) };
  }
});

ipcMain.handle("ava:cron-status", async () => {
  try {
    const env = await loadDesktopEnv();
    return await fetchCronStatus(env);
  } catch (err) {
    return { ok: false, detail: err?.message || String(err), jobs: [] };
  }
});

ipcMain.handle("ava:cron-run", async (_e, { id }) => {
  try {
    const env = await loadDesktopEnv();
    return await runCronJob(env, id);
  } catch (err) {
    return { ok: false, detail: err?.message || String(err) };
  }
});

ipcMain.handle("ava:cron-config", async (_e, body) => {
  try {
    const env = await loadDesktopEnv();
    return await configureCron(env, body);
  } catch (err) {
    return { ok: false, detail: err?.message || String(err) };
  }
});

ipcMain.handle("ava:ops-catalog", async () => ({
  ok: true,
  groups: listOpsCatalog(),
  core: AVA_CORE,
  running: runningOpsId,
}));

ipcMain.handle("ava:list-links", async () => listAvaLinks());

ipcMain.handle("ava:release-status", async (_e, { kind } = {}) => {
  const k = kind === "apps" ? "apps" : "plugins";
  try {
    const res = await fetch(`http://127.0.0.1:${AVA_PORT}/api/${k}/status`, {
      cache: "no-store",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        detail: json.detail || `http_${res.status}`,
        hint: json.hint || null,
      };
    }
    return json;
  } catch (err) {
    return { ok: false, detail: err?.message || String(err) };
  }
});

ipcMain.handle("ava:release-action", async (_e, { kind, action, targets } = {}) => {
  const k = kind === "apps" ? "apps" : "plugins";
  const act = String(action || "").toLowerCase();
  if (!["bump", "build", "release"].includes(act)) {
    return { ok: false, detail: "bad_action" };
  }
  try {
    const res = await fetch(`http://127.0.0.1:${AVA_PORT}/api/${k}/${act}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targets: Array.isArray(targets) ? targets : [] }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok && !json.accepted) {
      return { ok: false, detail: json.detail || `http_${res.status}`, ...json };
    }
    return json;
  } catch (err) {
    return { ok: false, detail: err?.message || String(err) };
  }
});

ipcMain.handle("ava:open-link", async (_e, { url } = {}) => {
  const href = String(url || "").trim();
  if (!/^https?:\/\//i.test(href)) {
    return { ok: false, detail: "invalid_url" };
  }
  try {
    await shell.openExternal(href);
    return { ok: true };
  } catch (err) {
    return { ok: false, detail: err?.message || String(err) };
  }
});

ipcMain.handle("ava:ops-cancel", async () => {
  if (!runningOps) return { ok: true, detail: "idle" };
  try {
    runningOps.kill("SIGTERM");
  } catch (err) {
    return { ok: false, detail: err?.message || String(err) };
  }
  return { ok: true, detail: "signaled" };
});

ipcMain.handle("ava:ops-run", async (_e, { id }) => {
  const cmd = opsCommandById(String(id || ""));
  if (!cmd) return { ok: false, detail: "unknown_command" };
  if (runningOps) return { ok: false, detail: `busy:${runningOpsId}` };

  if (cmd.kind === "http") {
    const url = `http://127.0.0.1:${AVA_PORT}${cmd.path}`;
    runningOpsId = cmd.id;
    sendOps("ava:ops-start", { id: cmd.id, label: cmd.label, detail: `${cmd.method} ${url}` });
    appendLine(`$ ${cmd.method} ${url}`);
    try {
      const res = await fetch(url, { method: cmd.method || "GET" });
      const text = await res.text();
      appendLine(`← ${res.status}`);
      const clipped = text.length > 8000 ? `${text.slice(0, 8000)}\n…(truncated)` : text;
      for (const line of clipped.split(/\r?\n/)) appendLine(line);
      sendOps("ava:ops-done", { id: cmd.id, code: res.ok ? 0 : res.status });
      runningOpsId = null;
      return { ok: res.ok, detail: `http_${res.status}` };
    } catch (err) {
      appendLine(`error: ${err?.message || err}`);
      sendOps("ava:ops-done", { id: cmd.id, code: 1 });
      runningOpsId = null;
      return { ok: false, detail: err?.message || String(err) };
    }
  }

  const scriptPath = path.join(AVA_CORE, "scripts", cmd.script);
  if (!fs.existsSync(scriptPath)) {
    return { ok: false, detail: `missing_script:${cmd.script}` };
  }

  const bin = nodeBin();
  const args = [scriptPath, ...(cmd.args || [])];
  const childEnv = {
    ...process.env,
    PATH: `${path.join(os.homedir(), ".local", "bin")}:${process.env.PATH || ""}`,
    AVA_HANDOFF: AVA_HOME,
    ROOTMC_ENV_FILE: process.env.ROOTMC_ENV_FILE || path.join(AVA_HOME, ".env"),
    AVA_ENV_FILE: process.env.AVA_ENV_FILE || path.join(AVA_HOME, ".env"),
  };

  runningOpsId = cmd.id;
  sendOps("ava:ops-start", {
    id: cmd.id,
    label: cmd.label,
    detail: `${bin} scripts/${cmd.script} ${(cmd.args || []).join(" ")}`.trim(),
  });
  appendLine(
    `$ node scripts/${cmd.script}${(cmd.args || []).length ? ` ${cmd.args.join(" ")}` : ""}`,
  );

  return await new Promise((resolve) => {
    const child = spawn(bin, args, {
      cwd: AVA_CORE,
      env: childEnv,
      stdio: ["ignore", "pipe", "pipe"],
    });
    runningOps = child;
    const onChunk = (buf) => {
      for (const line of buf.toString("utf8").split(/\r?\n/)) {
        if (line.length) appendLine(line);
      }
    };
    child.stdout?.on("data", onChunk);
    child.stderr?.on("data", onChunk);
    child.on("error", (err) => {
      appendLine(`spawn error: ${err.message}`);
      runningOps = null;
      runningOpsId = null;
      sendOps("ava:ops-done", { id: cmd.id, code: 1 });
      resolve({ ok: false, detail: err.message });
    });
    child.on("close", (code, signal) => {
      appendLine(signal ? `← signal ${signal}` : `← exit ${code ?? "?"}`);
      runningOps = null;
      runningOpsId = null;
      sendOps("ava:ops-done", { id: cmd.id, code: code ?? 1, signal });
      resolve({
        ok: (code ?? 1) === 0,
        detail: signal ? `signal_${signal}` : `exit_${code}`,
      });
    });
  });
});
