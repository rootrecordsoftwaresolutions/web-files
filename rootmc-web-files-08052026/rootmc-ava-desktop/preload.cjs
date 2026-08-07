const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("avaDesktop", {
  envStatus: () => ipcRenderer.invoke("ava:env-status"),
  listDiscordChannels: () => ipcRenderer.invoke("ava:list-discord-channels"),
  listPresets: () => ipcRenderer.invoke("ava:list-presets"),
  history: (opts) => ipcRenderer.invoke("ava:history", opts),
  send: (opts) => ipcRenderer.invoke("ava:send", opts),
  post: (opts) => ipcRenderer.invoke("ava:post", opts),
});
