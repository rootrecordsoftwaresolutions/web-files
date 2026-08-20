const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("avaDesktop", {
  envStatus: () => ipcRenderer.invoke("ava:env-status"),
  listDiscordChannels: () => ipcRenderer.invoke("ava:list-discord-channels"),
  listDiscordPrivate: () => ipcRenderer.invoke("ava:list-discord-private"),
  listSlackChannels: () => ipcRenderer.invoke("ava:list-slack-channels"),
  listTelegramChats: () => ipcRenderer.invoke("ava:list-telegram-chats"),
  listPresets: () => ipcRenderer.invoke("ava:list-presets"),
  history: (opts) => ipcRenderer.invoke("ava:history", opts),
  send: (opts) => ipcRenderer.invoke("ava:send", opts),
  post: (opts) => ipcRenderer.invoke("ava:post", opts),
  rewritePreview: (opts) => ipcRenderer.invoke("ava:rewrite-preview", opts),
  summarize: (opts) => ipcRenderer.invoke("ava:summarize", opts),
  rewriteProviders: () => ipcRenderer.invoke("ava:rewrite-providers"),
  coreStatus: () => ipcRenderer.invoke("ava:core-status"),
  coreChat: (opts) => ipcRenderer.invoke("ava:core-chat", opts),
  coreCancel: () => ipcRenderer.invoke("ava:core-cancel"),
  coreEnhance: (opts) => ipcRenderer.invoke("ava:core-enhance", opts),
  coreGold: (opts) => ipcRenderer.invoke("ava:core-gold", opts),
  discordEdit: (opts) => ipcRenderer.invoke("ava:discord-edit", opts),
  discordDelete: (opts) => ipcRenderer.invoke("ava:discord-delete", opts),
  feedbackTargets: () => ipcRenderer.invoke("ava:feedback-targets"),
  feedbackList: (opts) => ipcRenderer.invoke("ava:feedback-list", opts),
  feedbackProcessNext: () => ipcRenderer.invoke("ava:feedback-process-next"),
  feedbackAck: (opts) => ipcRenderer.invoke("ava:feedback-ack", opts),
  feedbackDualPost: (opts) => ipcRenderer.invoke("ava:feedback-dual-post", opts),
  feedbackDeleteDiscord: (opts) => ipcRenderer.invoke("ava:feedback-delete-discord", opts),
  feedbackDeleteSlack: (opts) => ipcRenderer.invoke("ava:feedback-delete-slack", opts),
  feedbackClearDiscord: (opts) => ipcRenderer.invoke("ava:feedback-clear-discord", opts),
  feedbackClearSlack: (opts) => ipcRenderer.invoke("ava:feedback-clear-slack", opts),
  feedbackClearAll: (opts) => ipcRenderer.invoke("ava:feedback-clear-all", opts),
  cronStatus: () => ipcRenderer.invoke("ava:cron-status"),
  cronRun: (id) => ipcRenderer.invoke("ava:cron-run", { id }),
  cronConfig: (body) => ipcRenderer.invoke("ava:cron-config", body),
  opsCatalog: () => ipcRenderer.invoke("ava:ops-catalog"),
  opsRun: (id) => ipcRenderer.invoke("ava:ops-run", { id }),
  opsCancel: () => ipcRenderer.invoke("ava:ops-cancel"),
  listLinks: () => ipcRenderer.invoke("ava:list-links"),
  openLink: (url) => ipcRenderer.invoke("ava:open-link", { url }),
  releaseStatus: (kind) => ipcRenderer.invoke("ava:release-status", { kind }),
  releaseAction: (kind, action, targets) =>
    ipcRenderer.invoke("ava:release-action", { kind, action, targets }),
  onOpsLine: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on("ava:ops-line", handler);
    return () => ipcRenderer.removeListener("ava:ops-line", handler);
  },
  onOpsStart: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on("ava:ops-start", handler);
    return () => ipcRenderer.removeListener("ava:ops-start", handler);
  },
  onOpsDone: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on("ava:ops-done", handler);
    return () => ipcRenderer.removeListener("ava:ops-done", handler);
  },
});
