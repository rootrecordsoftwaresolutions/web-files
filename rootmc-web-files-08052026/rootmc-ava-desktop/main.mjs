/**
 * Ava Ivy desktop — Electron main.
 * Pages: Post (manual) | Discord | Telegram | Settings
 */
import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadDesktopEnv,
  fetchDiscordHistory,
  fetchTelegramHistory,
  listDiscordTextChannels,
  listPostPresets,
  postAsAva,
} from "./lib/avaBridge.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTEXT_LIMIT = 42;

function createWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 860,
    minHeight: 560,
    title: "Ava Ivy",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
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

ipcMain.handle("ava:list-presets", async () => listPostPresets());

ipcMain.handle("ava:history", async (_e, { surface, channelId }) => {
  const env = await loadDesktopEnv();
  if (surface === "telegram") {
    return fetchTelegramHistory(env, channelId || env.operatorChatId, CONTEXT_LIMIT);
  }
  if (surface === "slack") {
    return { ok: true, messages: [], detail: "slack_history_not_in_desktop" };
  }
  return fetchDiscordHistory(env, channelId, CONTEXT_LIMIT);
});

ipcMain.handle("ava:send", async (_e, { surface, channelId, text, refId, rewrite }) => {
  const env = await loadDesktopEnv();
  return postAsAva(env, {
    surface,
    channelId,
    text,
    refId,
    // Chat panes default to rewrite; Post tab can force direct.
    rewrite: rewrite !== false,
  });
});

ipcMain.handle("ava:post", async (_e, { surface, channelId, text, refId, rewrite }) => {
  const env = await loadDesktopEnv();
  return postAsAva(env, {
    surface,
    channelId,
    text,
    refId,
    rewrite: Boolean(rewrite),
  });
});
