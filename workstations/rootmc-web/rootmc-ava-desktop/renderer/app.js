const $ = (id) => document.getElementById(id);

let presets = [];
let providers = [];
const providerSel = { discord: "dream", slack: "dream", telegram: "dream", post: "exact", core: "dream", feedback: "exact" };
const replies = { discord: null, slack: null, telegram: null };
/** Discord message currently loaded for PATCH edit (null = normal send). */
let discordEditId = null;
let discordHistoryCache = [];
const feedbackState = {
  items: [],
  selectedId: null,
  templates: [],
  busy: false,
  discordSel: null,
  slackSel: null,
  targets: {
    discord: "1532929974154166522",
    slack: "C0BLMGBVAMD",
  },
};
/** After summarize/preview fills the draft, Send posts as-is (no second Grok pass). */
const draftReadyExact = { discord: false, slack: false, telegram: false, post: false, feedback: false };
const surfaceBusy = { discord: false, slack: false, telegram: false, post: false, feedback: false };

const coreState = {
  sessionId: null,
  messages: [],
  lastQuestion: "",
  lastAnswer: "",
  enhanceText: "",
  enhanceProvider: "",
  busy: false,
  pending: false,
  pendingLabel: "",
};

document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    $(`page-${btn.dataset.page}`).classList.add("active");
    if (btn.dataset.page === "links") renderLinks();
    if (btn.dataset.page === "release") refreshRelease();
    if (btn.dataset.page === "crons") refreshCrons();
    if (btn.dataset.page === "core") refreshCoreStatus();
    if (btn.dataset.page === "feedback") refreshFeedbackPage();
  });
});

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const RESPONSE_LOG_KEY = "ava-ivy-response-log-v1";
const RESPONSE_LOG_LIMIT = 80;
const RESPONSE_LOG_SURFACES = ["discord", "slack", "telegram", "post", "core", "feedback"];

function loadResponseLogStore() {
  try {
    const raw = localStorage.getItem(RESPONSE_LOG_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const out = {};
    for (const s of RESPONSE_LOG_SURFACES) {
      out[s] = Array.isArray(parsed?.[s]) ? parsed[s] : [];
    }
    return out;
  } catch {
    return Object.fromEntries(RESPONSE_LOG_SURFACES.map((s) => [s, []]));
  }
}

function saveResponseLogStore(store) {
  try {
    localStorage.setItem(RESPONSE_LOG_KEY, JSON.stringify(store));
  } catch {
    /* quota / private mode */
  }
}

function formatLogTime(ts) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts || "");
  }
}

function renderResponseLog(surface) {
  const host = $(`${surface}-response-log`);
  const meta = $(`${surface}-response-log-meta`);
  if (!host) return;
  const store = loadResponseLogStore();
  const entries = store[surface] || [];
  if (meta) {
    meta.textContent = entries.length
      ? `${entries.length} saved · newest first · persists on this machine`
      : "No responses yet — rewrites, summaries, compares, and sends land here.";
  }
  if (!entries.length) {
    host.innerHTML = "<div class='msg meta'>(empty)</div>";
    return;
  }
  host.innerHTML = entries
    .map((e) => {
      const head = [
        `<span class="kind">${escapeHtml(e.kind || "response")}</span>`,
        e.provider ? `<span>${escapeHtml(e.provider)}</span>` : "",
        e.via ? `<span>${escapeHtml(e.via)}</span>` : "",
        `<span>${escapeHtml(formatLogTime(e.at))}</span>`,
      ]
        .filter(Boolean)
        .join("");
      return `<article class="response-log-entry"><div class="head">${head}</div><pre class="body">${escapeHtml(e.text || "")}</pre></article>`;
    })
    .join("");
}

function appendResponseLog(surface, { kind, text, provider = "", via = "", meta = "" } = {}) {
  const body = String(text || "").trim();
  if (!body || !RESPONSE_LOG_SURFACES.includes(surface)) return;
  const store = loadResponseLogStore();
  const entry = {
    at: Date.now(),
    kind: String(kind || "response"),
    provider: String(provider || ""),
    via: String(via || ""),
    meta: String(meta || ""),
    text: body.slice(0, 20000),
  };
  store[surface] = [entry, ...(store[surface] || [])].slice(0, RESPONSE_LOG_LIMIT);
  saveResponseLogStore(store);
  renderResponseLog(surface);
}

function clearResponseLog(surface) {
  const store = loadResponseLogStore();
  store[surface] = [];
  saveResponseLogStore(store);
  renderResponseLog(surface);
}

function autosizeDraft(el) {
  if (!el) return;
  el.style.height = "auto";
  const next = Math.max(160, Math.min(el.scrollHeight + 4, Math.floor(window.innerHeight * 0.55)));
  el.style.height = `${next}px`;
}

function wireDraftAutosize(id) {
  const el = $(id);
  if (!el) return;
  const run = () => autosizeDraft(el);
  el.addEventListener("input", run);
  run();
}

function renderHistory(el, messages, { replyId = null, onPick = null, surface = null } = {}) {
  el.innerHTML = (messages || [])
    .map((m) => {
      const id = m.id ? String(m.id) : "";
      const who = escapeHtml(m.who || "?");
      const clickable = id && onPick ? " clickable" : "";
      const selected = id && replyId === id ? " msg-reply-target" : "";
      const selfCls = m.self ? " msg-self" : "";
      const dataId = id
        ? ` data-id="${escapeHtml(id)}" data-who="${who}" data-self="${m.self ? "1" : "0"}" data-text="${escapeHtml(String(m.text || "").slice(0, 2000))}"`
        : "";
      const badge = m.self ? ` <span class="hint-inline">(ava)</span>` : "";
      return `<div class="msg${clickable}${selected}${selfCls}"${dataId}><span class="who">${who}</span>${badge}: ${escapeHtml(m.text || "")}</div>`;
    })
    .join("") || "<div class='msg'>(no messages)</div>";

  if (onPick) {
    el.querySelectorAll(".msg.clickable").forEach((node) => {
      node.addEventListener("click", () => {
        onPick({
          id: node.dataset.id,
          who: node.dataset.who,
          self: node.dataset.self === "1",
          text: node.dataset.text || "",
          surface,
        });
      });
    });
  }
  el.scrollTop = el.scrollHeight;
}

function setDiscordEditMode(on) {
  const save = $("discord-save-edit");
  const cancel = $("discord-cancel-edit");
  const send = $("discord-send");
  if (save) save.classList.toggle("hidden", !on);
  if (cancel) cancel.classList.toggle("hidden", !on);
  if (send) send.classList.toggle("hidden", on);
}

function updateDiscordSelectionBar(pick) {
  const editBtn = $("discord-edit-load");
  const delBtn = $("discord-delete");
  const canEdit = Boolean(pick?.id && pick.self);
  // Delete: Ava's own always; others try (needs Manage Messages)
  const canDelete = Boolean(pick?.id);
  if (editBtn) editBtn.classList.toggle("hidden", !canEdit);
  if (delBtn) delBtn.classList.toggle("hidden", !canDelete);
}

function setReplyBar(surface, reply) {
  replies[surface] = reply;
  const bar = $(`${surface}-reply-bar`);
  const whoEl = $(`${surface}-reply-who`);
  if (!bar || !whoEl) return;
  if (reply?.id) {
    bar.classList.remove("hidden");
    const shortId = reply.id.length > 8 ? `…${reply.id.slice(-6)}` : reply.id;
    const tag = reply.self ? "ava" : "msg";
    whoEl.textContent = `${tag} @${reply.who} (${shortId})`;
  } else {
    bar.classList.add("hidden");
    whoEl.textContent = "?";
  }
  if (surface === "discord") {
    updateDiscordSelectionBar(reply);
    if (!reply?.id) {
      discordEditId = null;
      setDiscordEditMode(false);
    }
  }
}

function fillSelect(sel, items, { placeholder, nameFn } = {}) {
  sel.innerHTML = "";
  if (placeholder) {
    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = placeholder;
    sel.appendChild(blank);
  }
  for (const item of items || []) {
    const opt = document.createElement("option");
    opt.value = item.id;
    opt.textContent = nameFn ? nameFn(item) : item.name || item.id;
    sel.appendChild(opt);
  }
}

function fillPresets(surface) {
  const sel = $("post-preset");
  const filtered = presets.filter((p) => p.surface === surface);
  sel.innerHTML = "";
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "(pick preset or type ID below)";
  sel.appendChild(blank);
  for (const p of filtered) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = `${p.key} — ${p.label}`;
    sel.appendChild(opt);
  }
}

function markDraftReadyExact(surface, draftId) {
  draftReadyExact[surface] = true;
  const el = $(draftId);
  if (!el || el.dataset.readyBound) return;
  el.dataset.readyBound = "1";
  el.addEventListener("input", () => {
    draftReadyExact[surface] = false;
  });
}

function stripRewritePreamble(text) {
  return String(text || "")
    .replace(
      /^(here'?s\s+(the\s+)?(rewritten|revised|updated)\s+(message|reply|draft|version)[^\n]*:\s*)/i,
      "",
    )
    .replace(/^(rewritten\s+(message|reply)\s+in\s+ava[^\n]*:\s*)/i, "")
    .trim();
}

function renderProviders(containerId, surfaceKey) {
  const host = $(containerId);
  if (!host) return;
  host.innerHTML = "";
  const list = providers.length
    ? providers
    : [
        { id: "exact", label: "Exactly the same" },
        { id: "dream", label: "Dream / Grok" },
        { id: "cursor", label: "Cursor" },
        { id: "ollama", label: "Ollama" },
        { id: "google", label: "Google" },
      ];
  for (const p of list) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = p.label || p.id;
    btn.title = p.detail || p.model || p.id;
    if (p.configured === false) btn.style.opacity = "0.45";
    if (providerSel[surfaceKey] === p.id) btn.classList.add("active-provider");
    btn.addEventListener("click", () => {
      providerSel[surfaceKey] = p.id;
      // Choosing a rewrite provider means Send may rewrite again.
      if (p.id !== "exact" && draftReadyExact[surfaceKey] != null) {
        draftReadyExact[surfaceKey] = false;
      }
      host.querySelectorAll("button").forEach((b) => b.classList.remove("active-provider"));
      btn.classList.add("active-provider");
    });
    host.appendChild(btn);
  }
}

function showCompare(elId, results) {
  const el = $(elId);
  if (!el) return;
  el.classList.add("show");
  el.textContent = (results || [])
    .map((r) => {
      const head = `── ${r.provider || "?"} · ${r.via || ""}${r.detail ? ` · ${r.detail}` : ""}`;
      return `${head}\n${r.text || "(empty)"}\n`;
    })
    .join("\n");
}

function discordChannelId() {
  const priv = $("discord-private").value;
  return priv || $("discord-channel").value;
}

async function refreshDiscord() {
  const channelId = discordChannelId();
  const hist = await window.avaDesktop.history({
    surface: "discord",
    channelId,
    limit: 150,
  });
  discordHistoryCache = hist.messages || [];
  renderHistory($("discord-history"), hist.messages, {
    replyId: replies.discord?.id || null,
    surface: "discord",
    onPick: (pick) => {
      // Prefer full text from cache (dataset HTML-escapes)
      const full = discordHistoryCache.find((m) => String(m.id) === String(pick.id));
      const merged = {
        ...pick,
        text: full?.text ?? pick.text ?? "",
        self: full?.self ?? pick.self,
      };
      setReplyBar("discord", merged);
      $("discord-history").querySelectorAll(".msg").forEach((node) => {
        node.classList.toggle("msg-reply-target", node.dataset.id === pick.id);
      });
      // Ava messages: auto-load into draft for edit (can't copy from history easily)
      if (merged.self && merged.id) {
        discordEditId = merged.id;
        $("discord-draft").value = merged.text || "";
        autosizeDraft($("discord-draft"));
        draftReadyExact.discord = true;
        setDiscordEditMode(true);
        $("discord-status").textContent = `editing …${String(merged.id).slice(-6)} — change text, then Save edit`;
      } else {
        // Others: reply target only
        if (discordEditId) {
          discordEditId = null;
          setDiscordEditMode(false);
        }
      }
      $("discord-draft").focus();
    },
  });
  $("discord-status").textContent = hist.ok
    ? `loaded ${hist.messages?.length || 0} msgs${hist.botName ? ` · bot ${hist.botName}` : ""}`
    : hist.detail || "fail";
}

async function loadDiscordEdit() {
  const pick = replies.discord;
  if (!pick?.id || !pick.self) {
    $("discord-status").textContent = "select an Ava message to edit";
    return;
  }
  const full = discordHistoryCache.find((m) => String(m.id) === String(pick.id));
  const text = full?.text ?? pick.text ?? "";
  discordEditId = pick.id;
  $("discord-draft").value = text;
  autosizeDraft($("discord-draft"));
  draftReadyExact.discord = true;
  setDiscordEditMode(true);
  replies.discord = { ...pick, text };
  $("discord-status").textContent = `editing message …${String(pick.id).slice(-6)} — Save edit or Cancel`;
  $("discord-draft").focus();
}

async function saveDiscordEdit() {
  const channelId = discordChannelId();
  const text = ($("discord-draft").value || "").trim();
  if (!discordEditId || !channelId || !text) {
    $("discord-status").textContent = "need selected Ava message + text";
    return;
  }
  if (surfaceBusy.discord) {
    $("discord-status").textContent = "busy";
    return;
  }
  surfaceBusy.discord = true;
  $("discord-status").textContent = "saving edit…";
  try {
    const r = await window.avaDesktop.discordEdit({
      channelId,
      messageId: discordEditId,
      text,
    });
    if (!r?.ok) {
      $("discord-status").textContent = `edit failed · ${r?.detail || "?"}`;
      return;
    }
    appendResponseLog("discord", {
      kind: "edit",
      text,
      provider: "exact",
      via: "discord-patch",
      meta: `id ${r.id || discordEditId}`,
    });
    discordEditId = null;
    setDiscordEditMode(false);
    $("discord-draft").value = "";
    setReplyBar("discord", null);
    $("discord-status").textContent = `edited · ${r.id || "?"}`;
    await refreshDiscord();
  } catch (err) {
    $("discord-status").textContent = String(err.message || err);
  } finally {
    surfaceBusy.discord = false;
  }
}

function cancelDiscordEdit() {
  discordEditId = null;
  setDiscordEditMode(false);
  $("discord-status").textContent = "edit cancelled";
}

async function deleteDiscordSelected() {
  const pick = replies.discord;
  const channelId = discordChannelId();
  if (!pick?.id || !channelId) {
    $("discord-status").textContent = "select a message to delete";
    return;
  }
  const label = pick.self ? "Ava's message" : `message from ${pick.who}`;
  if (!confirm(`Delete ${label} (…${String(pick.id).slice(-6)})?\n\nBots can always delete their own. Others need Manage Messages.`)) {
    return;
  }
  if (surfaceBusy.discord) return;
  surfaceBusy.discord = true;
  $("discord-status").textContent = "deleting…";
  try {
    const r = await window.avaDesktop.discordDelete({
      channelId,
      messageId: pick.id,
    });
    if (!r?.ok) {
      $("discord-status").textContent = `delete failed · ${r?.detail || "?"}`;
      return;
    }
    appendResponseLog("discord", {
      kind: "delete",
      text: pick.text || `(deleted ${pick.id})`,
      provider: "exact",
      via: "discord-delete",
      meta: `id ${pick.id}`,
    });
    if (discordEditId === pick.id) {
      discordEditId = null;
      setDiscordEditMode(false);
      $("discord-draft").value = "";
    }
    setReplyBar("discord", null);
    $("discord-status").textContent = `deleted · ${pick.id}`;
    await refreshDiscord();
  } catch (err) {
    $("discord-status").textContent = String(err.message || err);
  } finally {
    surfaceBusy.discord = false;
  }
}

async function refreshSlack() {
  const channelId = $("slack-channel").value;
  const hist = await window.avaDesktop.history({
    surface: "slack",
    channelId,
    limit: 150,
  });
  renderHistory($("slack-history"), hist.messages, {
    replyId: replies.slack?.id || null,
    onPick: (pick) => {
      setReplyBar("slack", pick);
      $("slack-draft").focus();
    },
  });
  $("slack-status").textContent = hist.ok
    ? `loaded ${hist.messages?.length || 0} msgs`
    : hist.detail || "fail";
}

async function refreshTelegram() {
  const channelId = $("telegram-chat").value.trim();
  const hist = await window.avaDesktop.history({
    surface: "telegram",
    channelId,
    limit: 150,
  });
  renderHistory($("telegram-history"), hist.messages, {
    replyId: replies.telegram?.id || null,
    onPick: (pick) => {
      setReplyBar("telegram", pick);
      $("telegram-draft").focus();
    },
  });
  $("telegram-status").textContent = `context ${hist.messages?.length || 0} msgs${hist.detail ? ` · ${hist.detail}` : ""}`;
}

async function refreshPostHistory() {
  const surface = $("post-surface").value;
  let channelId = $("post-channel").value.trim();
  const asPreset = presets.find(
    (p) => p.key === channelId.toLowerCase() || p.id === channelId,
  );
  if (asPreset) channelId = asPreset.id;
  const meta = $("post-history-meta");
  const host = $("post-history");
  if (!channelId) {
    host.innerHTML = "";
    meta.textContent = "Pick a channel first.";
    return;
  }
  meta.textContent = "loading…";
  try {
    const hist = await window.avaDesktop.history({
      surface,
      channelId,
      limit: 150,
    });
    renderHistory(host, hist.messages, {
      onPick: (pick) => {
        if (pick?.id) $("post-ref").value = String(pick.id);
        $("post-draft").focus();
      },
    });
    const n = hist.messages?.length || 0;
    meta.textContent = hist.ok
      ? `${n} msgs · ${hist.detail || surface}`
      : hist.detail || "fail";
  } catch (err) {
    host.innerHTML = "";
    meta.textContent = String(err.message || err);
  }
}

async function previewRewrite(surface, draftId, channelId, statusId, compareId, compare = false) {
  const text = $(draftId).value.trim();
  if (!text) {
    $(statusId).textContent = "Type a draft first.";
    return;
  }
  $(statusId).textContent = compare ? "comparing providers…" : `rewriting via ${providerSel[surface]}…`;
  try {
    const r = await window.avaDesktop.rewritePreview({
      surface: surface === "post" ? $("post-surface").value : surface,
      channelId,
      text,
      provider: providerSel[surface],
      compare,
    });
    if (compare && r.results) {
      showCompare(compareId, r.results);
      $(statusId).textContent = `compared ${r.results.length} providers`;
      const blob = (r.results || [])
        .map((x) => `── ${x.provider || "?"} · ${x.via || ""}\n${x.text || ""}`)
        .join("\n\n");
      appendResponseLog(surface, {
        kind: "compare",
        text: blob,
        provider: "all",
        via: "compare",
      });
      return;
    }
    if (r.text) {
      $(draftId).value = stripRewritePreamble(r.text);
      autosizeDraft($(draftId));
      markDraftReadyExact(surface, draftId);
      appendResponseLog(surface, {
        kind: "rewrite",
        text: $(draftId).value,
        provider: r.provider || providerSel[surface],
        via: r.via || "",
      });
    }
    $(statusId).textContent = `preview · ${r.provider || providerSel[surface]} · ${r.via || ""}${r.detail ? ` · ${r.detail}` : ""} · Send will post as-is`;
  } catch (err) {
    $(statusId).textContent = String(err.message || err);
  }
}

async function summarizeSurface(surface, channelId, draftId, statusId) {
  if (!channelId) {
    $(statusId).textContent = "Pick a channel first.";
    return;
  }
  if (surfaceBusy[surface]) {
    $(statusId).textContent = "busy — wait for the current job";
    return;
  }
  surfaceBusy[surface] = true;
  $(statusId).textContent = "summarizing last 50–100 messages…";
  try {
    const r = await window.avaDesktop.summarize({
      surface,
      channelId,
      provider: providerSel[surface] === "exact" ? "dream" : providerSel[surface],
      limit: 150,
    });
    if (!r.ok) {
      $(statusId).textContent = r.detail || "summarize failed";
      return;
    }
    $(draftId).value = stripRewritePreamble(r.text || "");
    autosizeDraft($(draftId));
    markDraftReadyExact(surface, draftId);
    appendResponseLog(surface, {
      kind: "summary",
      text: $(draftId).value,
      provider: r.provider || "",
      via: r.via || "",
      meta: `${r.messageCount || "?"} msgs`,
    });
    $(statusId).textContent = `summary · ${r.messageCount || "?"} msgs · ${r.provider || ""} · ${r.via || ""} · Send will post as-is`;
  } catch (err) {
    $(statusId).textContent = String(err.message || err);
  } finally {
    surfaceBusy[surface] = false;
  }
}

async function sendSurface(surface, draftId, channelId, statusId) {
  const text = $(draftId).value.trim();
  if (surface === "discord" && discordEditId) {
    $(statusId).textContent = "in edit mode — use Save edit (or Cancel edit)";
    return;
  }
  if (!channelId || !text) {
    $(statusId).textContent = "Need channel + text.";
    return;
  }
  if (surfaceBusy[surface]) {
    $(statusId).textContent = "already sending — ignored double click";
    return;
  }
  const provider = providerSel[surface];
  // Don't run Dream/Grok a second time after Summarize / Preview already filled the draft.
  const rewrite = provider !== "exact" && !draftReadyExact[surface];
  surfaceBusy[surface] = true;
  $(statusId).textContent = rewrite
    ? `sending via ${provider}…`
    : draftReadyExact[surface]
      ? "sending exact (already rewritten — no second Grok pass)…"
      : "sending exact…";
  try {
    const r = await window.avaDesktop.send({
      surface,
      channelId,
      text,
      refId: replies[surface]?.id || undefined,
      rewrite,
      provider: rewrite ? provider : "exact",
    });
    draftReadyExact[surface] = false;
    appendResponseLog(surface, {
      kind: "send",
      text: r.text || text,
      provider: r.provider || (rewrite ? provider : "exact"),
      via: r.via || "",
      meta: r.id ? `id ${r.id}` : "",
    });
    $(statusId).textContent = `sent · ${r.provider || provider} · ${r.via || ""} · id ${r.id || "?"}`;
    $(draftId).value = "";
    autosizeDraft($(draftId));
    setReplyBar(surface, null);
    if (surface === "discord") await refreshDiscord();
    if (surface === "slack") await refreshSlack();
    if (surface === "telegram") await refreshTelegram();
  } catch (err) {
    $(statusId).textContent = String(err.message || err);
  } finally {
    surfaceBusy[surface] = false;
  }
}

function fmtMs(ms) {
  if (ms == null) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.round(m / 60)}h`;
}

function fmtAge(ts) {
  if (!ts) return "never";
  return `${fmtMs(Date.now() - Number(ts))} ago`;
}

async function refreshCrons() {
  const meta = $("cron-meta");
  const host = $("cron-table");
  meta.textContent = "Loading cron status…";
  try {
    const st = await window.avaDesktop.cronStatus();
    if (!st?.ok && !st?.jobs) {
      meta.textContent =
        st?.detail ||
        "cron API unavailable — is Ava brain up on :8787? Try Refresh.";
      host.innerHTML = "";
      $("cron-status").textContent = JSON.stringify(st, null, 2);
      return;
    }
    meta.textContent = [
      st.started ? "runner: active" : "runner: idle/not started yet",
      st.runnerEnvDisabled ? "AVA_CRON_RUNNER=0" : null,
      `${(st.jobs || []).length} jobs`,
      `${(st.jobs || []).filter((j) => j.running).length} running`,
      `${(st.jobs || []).filter((j) => j.disabled).length} disabled`,
    ]
      .filter(Boolean)
      .join(" · ");

    host.innerHTML = "";
    for (const job of st.jobs || []) {
      const row = document.createElement("div");
      row.className = `cron-row${job.disabled ? " disabled" : ""}`;
      row.innerHTML = `
        <div>
          <div class="id">${escapeHtml(job.id)}</div>
          <div class="muted">${escapeHtml(job.cronHint || "")}</div>
        </div>
        <div>every ${fmtMs(job.everyMs)}</div>
        <div>${job.running ? "running" : job.disabled ? "disabled" : "scheduled"}</div>
        <div class="muted">last ${fmtAge(job.lastFiredAt)}${job.dueInMs != null ? ` · due ${fmtMs(job.dueInMs)}` : ""}</div>
        <div class="actions"></div>
      `;
      const actions = row.querySelector(".actions");
      const runBtn = document.createElement("button");
      runBtn.type = "button";
      runBtn.textContent = "Run now";
      runBtn.onclick = async () => {
        $("cron-status").textContent = `running ${job.id}…`;
        const r = await window.avaDesktop.cronRun(job.id);
        $("cron-status").textContent = JSON.stringify(r, null, 2).slice(0, 2000);
        await refreshCrons();
      };
      const tog = document.createElement("button");
      tog.type = "button";
      tog.textContent = job.disabled ? "Enable" : "Disable";
      tog.onclick = async () => {
        await window.avaDesktop.cronConfig({
          toggleId: job.id,
          enabled: job.disabled,
        });
        await refreshCrons();
      };
      const every = document.createElement("button");
      every.type = "button";
      every.textContent = "Set interval";
      every.onclick = async () => {
        const raw = window.prompt(
          `Interval ms for ${job.id} (blank = default ${job.baseEveryMs})`,
          String(job.everyMs || job.baseEveryMs || ""),
        );
        if (raw == null) return;
        const n = Number(raw);
        await window.avaDesktop.cronConfig({
          setEveryMs: { id: job.id, everyMs: Number.isFinite(n) ? n : 0 },
        });
        await refreshCrons();
      };
      actions.append(runBtn, tog, every);
      host.appendChild(row);
    }
    $("cron-status").textContent = "";
  } catch (err) {
    meta.textContent = String(err.message || err);
    $("cron-status").textContent =
      "Brain must be up on http://127.0.0.1:8787 — use the Desktop shortcut or ~/ava/bin/start-ava-desktop.sh";
  }
}

/* ——— Terminal (from prior work) ——— */
let opsBusy = false;
const confirmHints = new Map();

function terminalAppend(line) {
  const el = $("terminal-out");
  el.textContent += `${line}\n`;
  el.scrollTop = el.scrollHeight;
}

function setOpsBusy(busy, label = "idle") {
  opsBusy = busy;
  const run = $("terminal-run-label");
  run.textContent = label;
  run.classList.toggle("busy", busy);
  run.classList.toggle("idle", !busy);
  $("terminal-commands")
    .querySelectorAll(".cmd-btn")
    .forEach((btn) => {
      btn.disabled = busy;
    });
  $("terminal-cancel").disabled = !busy;
}

async function runOpsCommand(id) {
  if (opsBusy) return;
  const hint = confirmHints.get(id);
  if (hint && !window.confirm(hint)) return;
  setOpsBusy(true, `running · ${id}`);
  try {
    const r = await window.avaDesktop.opsRun(id);
    if (!r?.ok && r?.detail) terminalAppend(`! ${r.detail}`);
  } catch (err) {
    terminalAppend(`! ${err?.message || err}`);
    setOpsBusy(false, "idle");
  }
}

async function bootTerminal() {
  const catalog = await window.avaDesktop.opsCatalog();
  const host = $("terminal-commands");
  host.innerHTML = "";
  confirmHints.clear();
  for (const group of catalog.groups || []) {
    const section = document.createElement("section");
    section.className = "cmd-group";
    const h2 = document.createElement("h2");
    h2.textContent = group.label;
    section.appendChild(h2);
    const grid = document.createElement("div");
    grid.className = "cmd-grid";
    for (const cmd of group.commands || []) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cmd-btn";
      if (group.id === "danger") btn.classList.add("danger");
      else if (cmd.confirm) btn.classList.add("warn");
      btn.dataset.id = cmd.id;
      btn.dataset.search = `${cmd.label} ${cmd.detail} ${cmd.id}`.toLowerCase();
      btn.innerHTML = `<span class="cmd-label">${escapeHtml(cmd.label)}</span><span class="cmd-detail">${escapeHtml(cmd.detail || "")}</span>`;
      if (cmd.confirm) confirmHints.set(cmd.id, String(cmd.confirm));
      btn.addEventListener("click", () => runOpsCommand(cmd.id));
      grid.appendChild(btn);
    }
    section.appendChild(grid);
    host.appendChild(section);
  }
  terminalAppend("Ava terminal ready.");
  if (catalog.core) terminalAppend(`core → ${catalog.core}`);
  window.avaDesktop.onOpsStart((p) => {
    setOpsBusy(true, p?.label || p?.id || "running");
    if (p?.detail) terminalAppend(`# ${p.detail}`);
  });
  window.avaDesktop.onOpsLine((p) => {
    if (p?.line != null) terminalAppend(p.line);
  });
  window.avaDesktop.onOpsDone((p) => {
    setOpsBusy(false, "idle");
    terminalAppend(p?.code ? `# failed (${p.code})` : "# done");
  });
  $("terminal-clear").onclick = () => {
    $("terminal-out").textContent = "";
  };
  $("terminal-cancel").onclick = async () => {
    const r = await window.avaDesktop.opsCancel();
    terminalAppend(r?.ok ? "# cancel signaled" : `# cancel failed`);
  };
  $("terminal-cancel").disabled = true;
  $("terminal-filter").oninput = () => {
    const q = $("terminal-filter").value.trim().toLowerCase();
    host.querySelectorAll(".cmd-group").forEach((group) => {
      let any = false;
      group.querySelectorAll(".cmd-btn").forEach((btn) => {
        const show = !q || (btn.dataset.search || "").includes(q);
        btn.classList.toggle("hidden", !show);
        if (show) any = true;
      });
      group.classList.toggle("hidden", !any);
    });
  };
}

async function boot() {
  const st = await window.avaDesktop.envStatus();
  $("settings-status").textContent = JSON.stringify(st, null, 2);

  const prov = await window.avaDesktop.rewriteProviders();
  providers = prov.providers || [];
  $("settings-providers").textContent = JSON.stringify(providers, null, 2);
  renderProviders("discord-providers", "discord");
  renderProviders("slack-providers", "slack");
  renderProviders("telegram-providers", "telegram");
  renderProviders("post-providers", "post");
  renderProviders("feedback-providers", "feedback");
  try {
    const ft = await window.avaDesktop.feedbackTargets();
    fillFeedbackTemplates(ft?.templates || []);
    if (ft?.targets?.discordDevelopment?.id) {
      feedbackState.targets.discord = ft.targets.discordDevelopment.id;
    }
    if (ft?.targets?.slackFeedback?.id) {
      feedbackState.targets.slack = ft.targets.slackFeedback.id;
    }
  } catch {
    fillFeedbackTemplates([]);
  }
  {
    const prev = providers;
    providers = (providers || []).filter((p) => !["exact", "ollama"].includes(p.id));
    if (!providers.length) {
      providers = [
        { id: "dream", label: "Dream / Grok" },
        { id: "cursor", label: "Cursor" },
        { id: "google", label: "Google / Gemini" },
      ];
    }
    if (!providerSel.core || providerSel.core === "ollama") providerSel.core = "dream";
    renderProviders("core-providers", "core");
    providers = prev;
  }
  renderCoreHistory();
  refreshCoreStatus().catch(() => {});
  for (const s of RESPONSE_LOG_SURFACES) renderResponseLog(s);
  document.querySelectorAll("[data-log-clear]").forEach((btn) => {
    btn.addEventListener("click", () => clearResponseLog(btn.dataset.logClear));
  });
  for (const id of [
    "discord-draft",
    "slack-draft",
    "telegram-draft",
    "post-draft",
    "core-draft",
    "feedback-draft",
  ]) {
    wireDraftAutosize(id);
  }

  await bootTerminal();

  const presetRes = await window.avaDesktop.listPresets();
  presets = presetRes.presets || [];
  fillPresets($("post-surface").value);
  const updates = presets.find((p) => p.key === "updates");
  if (updates) {
    $("post-surface").value = "discord";
    fillPresets("discord");
    $("post-preset").value = updates.id;
    $("post-channel").value = updates.id;
  }

  const guild = await window.avaDesktop.listDiscordChannels();
  fillSelect($("discord-channel"), guild.channels || [], {
    nameFn: (c) => `#${c.name}`,
  });
  const priv = await window.avaDesktop.listDiscordPrivate();
  fillSelect($("discord-private"), priv.channels || [], {
    placeholder: "(none — use guild)",
    nameFn: (c) => c.name,
  });
  const prefer = (guild.channels || []).find((c) =>
    /development|admins|updates|general/i.test(c.name),
  );
  if (prefer) $("discord-channel").value = prefer.id;

  const slack = await window.avaDesktop.listSlackChannels();
  fillSelect($("slack-channel"), slack.channels || [], {
    nameFn: (c) => `${c.private ? "🔒" : "#"}${c.name}`,
  });

  const tg = await window.avaDesktop.listTelegramChats();
  fillSelect($("telegram-chat"), tg.channels || [], {
    nameFn: (c) => c.name,
  });

  await refreshDiscord();
  await refreshSlack();
  await refreshTelegram();
  await refreshCrons();
}

/* bindings */
$("discord-channel").onchange = () => {
  $("discord-private").value = "";
  refreshDiscord();
};
$("discord-private").onchange = () => refreshDiscord();
$("discord-refresh").onclick = () => refreshDiscord();
$("discord-reply-clear").onclick = () => setReplyBar("discord", null);
$("discord-edit-load").onclick = () => loadDiscordEdit();
$("discord-delete").onclick = () => deleteDiscordSelected();
$("discord-save-edit").onclick = () => saveDiscordEdit();
$("discord-cancel-edit").onclick = () => cancelDiscordEdit();
$("discord-preview").onclick = () =>
  previewRewrite("discord", "discord-draft", discordChannelId(), "discord-status", "discord-compare");
$("discord-compare").onclick = () =>
  previewRewrite("discord", "discord-draft", discordChannelId(), "discord-status", "discord-compare", true);
$("discord-summarize").onclick = () =>
  summarizeSurface("discord", discordChannelId(), "discord-draft", "discord-status");
$("discord-send").onclick = () =>
  sendSurface("discord", "discord-draft", discordChannelId(), "discord-status");

$("slack-channel").onchange = () => refreshSlack();
$("slack-refresh").onclick = () => refreshSlack();
$("slack-reply-clear").onclick = () => setReplyBar("slack", null);
$("slack-preview").onclick = () =>
  previewRewrite("slack", "slack-draft", $("slack-channel").value, "slack-status", "slack-compare");
$("slack-compare").onclick = () =>
  previewRewrite("slack", "slack-draft", $("slack-channel").value, "slack-status", "slack-compare", true);
$("slack-summarize").onclick = () =>
  summarizeSurface("slack", $("slack-channel").value, "slack-draft", "slack-status");
$("slack-send").onclick = () =>
  sendSurface("slack", "slack-draft", $("slack-channel").value, "slack-status");

$("telegram-chat").onchange = () => refreshTelegram();
$("telegram-refresh").onclick = () => refreshTelegram();
$("telegram-reply-clear").onclick = () => setReplyBar("telegram", null);
$("telegram-preview").onclick = () =>
  previewRewrite(
    "telegram",
    "telegram-draft",
    $("telegram-chat").value,
    "telegram-status",
    "telegram-compare",
  );
$("telegram-compare").onclick = () =>
  previewRewrite(
    "telegram",
    "telegram-draft",
    $("telegram-chat").value,
    "telegram-status",
    "telegram-compare",
    true,
  );
$("telegram-summarize").onclick = () =>
  summarizeSurface("telegram", $("telegram-chat").value, "telegram-draft", "telegram-status");
$("telegram-send").onclick = () =>
  sendSurface("telegram", "telegram-draft", $("telegram-chat").value, "telegram-status");

$("post-surface").onchange = () => {
  fillPresets($("post-surface").value);
  $("post-channel").value = "";
  $("post-history").innerHTML = "";
  $("post-history-meta").textContent = "";
};
$("post-preset").onchange = () => {
  if ($("post-preset").value) $("post-channel").value = $("post-preset").value;
  refreshPostHistory();
};
$("post-channel").onchange = () => refreshPostHistory();
$("post-refresh-history").onclick = () => refreshPostHistory();
$("post-clear").onclick = () => {
  $("post-draft").value = "";
  $("post-ref").value = "";
  $("post-status").textContent = "";
};
$("post-preview").onclick = () =>
  previewRewrite("post", "post-draft", $("post-channel").value, "post-status", "post-compare");
$("post-compare").onclick = () =>
  previewRewrite("post", "post-draft", $("post-channel").value, "post-status", "post-compare", true);
$("post-send").onclick = async () => {
  let channelId = $("post-channel").value.trim();
  const text = $("post-draft").value.trim();
  const asPreset = presets.find(
    (p) => p.key === channelId.toLowerCase() || p.id === channelId,
  );
  if (asPreset) {
    channelId = asPreset.id;
    $("post-surface").value = asPreset.surface;
  }
  if (!channelId || !text) {
    $("post-status").textContent = "Need channel + message.";
    return;
  }
  if (surfaceBusy.post) {
    $("post-status").textContent = "already posting — ignored double click";
    return;
  }
  const provider = providerSel.post;
  const rewrite = provider !== "exact" && !draftReadyExact.post;
  surfaceBusy.post = true;
  $("post-status").textContent = rewrite
    ? `posting via ${provider}…`
    : draftReadyExact.post
      ? "posting exact (already rewritten)…"
      : "posting…";
  try {
    const r = await window.avaDesktop.post({
      surface: $("post-surface").value,
      channelId,
      text,
      refId: $("post-ref").value.trim() || undefined,
      rewrite,
      provider: rewrite ? provider : "exact",
    });
    draftReadyExact.post = false;
    $("post-status").textContent = `sent · ${r.provider || provider} · ${r.via || ""} · ${r.id || ""}`;
    appendResponseLog("post", {
      kind: "send",
      text: r.text || text,
      provider: r.provider || (rewrite ? provider : "exact"),
      via: r.via || "",
      meta: r.id ? `id ${r.id}` : "",
    });
    await refreshPostHistory();
  } catch (err) {
    $("post-status").textContent = String(err.message || err);
  } finally {
    surfaceBusy.post = false;
  }
};

$("cron-refresh").onclick = () => refreshCrons();
$("cron-catchup").onclick = () => runOpsCommand("cron-catchup");

let releaseKind = "plugins";

function fmtSize(n) {
  const x = Number(n) || 0;
  if (x < 1024) return `${x} B`;
  if (x < 1024 * 1024) return `${(x / 1024).toFixed(1)} KB`;
  return `${(x / 1024 / 1024).toFixed(1)} MB`;
}

function selectedReleaseTargets() {
  return [...document.querySelectorAll("#release-targets input[type=checkbox]:checked")].map(
    (el) => el.value,
  );
}

function setReleaseKind(kind) {
  releaseKind = kind === "apps" ? "apps" : "plugins";
  $("release-kind-plugins")?.classList.toggle("primary", releaseKind === "plugins");
  $("release-kind-apps")?.classList.toggle("primary", releaseKind === "apps");
  refreshRelease();
}

async function refreshRelease() {
  const meta = $("release-meta");
  const log = $("release-log");
  const targetsEl = $("release-targets");
  const artsEl = $("release-arts");
  if (!meta || !targetsEl) return;
  meta.textContent = `Loading ${releaseKind}…`;
  try {
    const data = await window.avaDesktop.releaseStatus(releaseKind);
    if (!data?.ok) {
      meta.textContent = data?.detail || "failed";
      log.textContent = data?.hint || data?.detail || "Private API unreachable — is Ava :8787 up?";
      return;
    }
    const s = data.status || {};
    const busy = !!data.busy;
    meta.textContent =
      `${releaseKind} · ${busy ? "running" : s.state || "idle"}` +
      (s.action ? ` · ${s.action}` : "") +
      (data.javaReady ? " · JDK ok" : " · JDK missing") +
      (data.sync?.copied != null ? ` · synced ${data.sync.copied}` : "");
    const prev = new Set(selectedReleaseTargets());
    targetsEl.innerHTML =
      (data.targets || [])
        .map((t) => {
          const ver = t.version
            ? escapeHtml(t.version)
            : t.versionCode != null
              ? `code ${t.versionCode}`
              : "—";
          const checked = prev.has(t.id) ? " checked" : "";
          return `<label><input type="checkbox" value="${escapeHtml(t.id)}"${checked}/><span><div>${escapeHtml(t.label || t.id)}</div><div class="ver">${ver}</div></span></label>`;
        })
        .join("") || `<div class="hint-inline">No targets on disk.</div>`;
    artsEl.innerHTML =
      (data.artifacts || [])
        .map((a) => {
          const href = a.url || (data.public?.public ? `${data.public.public}${a.publicRel || ""}` : "");
          const name = href
            ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener">${escapeHtml(a.name)}</a>`
            : escapeHtml(a.name);
          return `<div class="row"><span>${name}</span><span class="meta">${escapeHtml(fmtSize(a.size))}</span></div>`;
        })
        .join("") || `<div class="hint-inline">No artifacts yet — build or sync publicfiles.</div>`;
    log.textContent = (s.logTail && s.logTail.trim()) || (busy ? "Running…" : "Idle.");
    ["release-bump", "release-build", "release-release"].forEach((id) => {
      if ($(id)) $(id).disabled = busy;
    });
  } catch (err) {
    meta.textContent = String(err.message || err);
  }
}

async function runRelease(action) {
  const log = $("release-log");
  ["release-bump", "release-build", "release-release"].forEach((id) => {
    if ($(id)) $(id).disabled = true;
  });
  log.textContent = `Starting ${action}…`;
  try {
    const r = await window.avaDesktop.releaseAction(releaseKind, action, selectedReleaseTargets());
    if (!r?.ok && !r?.accepted) {
      log.textContent = r?.detail || r?.error || "request failed";
    }
  } catch (err) {
    log.textContent = String(err.message || err);
  }
  refreshRelease();
}

$("release-kind-plugins")?.addEventListener("click", () => setReleaseKind("plugins"));
$("release-kind-apps")?.addEventListener("click", () => setReleaseKind("apps"));
$("release-refresh")?.addEventListener("click", () => refreshRelease());
$("release-bump")?.addEventListener("click", () => runRelease("bump"));
$("release-build")?.addEventListener("click", () => runRelease("build"));
$("release-release")?.addEventListener("click", () => runRelease("release"));
$("release-files-link")?.addEventListener("click", (ev) => {
  ev.preventDefault();
  window.avaDesktop.openLink("https://ava.rootmc.net/publicfiles/");
});

async function renderLinks() {
  const host = $("links-catalog");
  const status = $("links-status");
  if (!host) return;
  host.innerHTML = "";
  status.textContent = "loading…";
  try {
    const data = await window.avaDesktop.listLinks();
    if (!data?.ok) {
      status.textContent = data?.detail || "failed to load links";
      return;
    }
    for (const group of data.groups || []) {
      const section = document.createElement("section");
      section.className = "links-group";
      const h3 = document.createElement("h3");
      h3.textContent = group.label || group.id;
      section.appendChild(h3);
      const grid = document.createElement("div");
      grid.className = "links-grid";
      for (const link of group.links || []) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "link-card";
        btn.innerHTML =
          `<span class="title">${escapeHtml(link.title || "Link")}</span>` +
          `<span class="url">${escapeHtml(link.url || "")}</span>` +
          (link.note ? `<span class="note">${escapeHtml(link.note)}</span>` : "");
        btn.onclick = async () => {
          status.textContent = `opening ${link.url}…`;
          const r = await window.avaDesktop.openLink(link.url);
          status.textContent = r?.ok ? `opened · ${link.title}` : `open failed · ${r?.detail || "?"}`;
        };
        grid.appendChild(btn);
      }
      section.appendChild(grid);
      host.appendChild(section);
    }
    const count = (data.groups || []).reduce((n, g) => n + (g.links?.length || 0), 0);
    status.textContent = `${count} links · ${data.groups?.length || 0} groups`;
  } catch (err) {
    status.textContent = String(err.message || err);
  }
}

$("links-refresh").onclick = () => renderLinks();

function renderCoreHistory() {
  const el = $("core-history");
  if (!el) return;
  if (!coreState.messages.length && !coreState.pending) {
    el.innerHTML = "<div class='msg meta'>Start a 1:1 turn — replies train Ava core on this host.</div>";
    return;
  }
  const rows = coreState.messages.map((m) => {
    const role = m.role === "assistant" ? "ava" : "you";
    const who = m.role === "assistant" ? "Ava" : "You";
    return `<div class="msg ${role}"><span class="who">${who}</span>: ${escapeHtml(m.content || "")}</div>`;
  });
  if (coreState.pending) {
    rows.push(
      `<div class="msg ava typing" aria-live="polite"><span class="who">Ava</span>: <span class="typing-label">is typing</span><span class="typing-dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="typing-elapsed">${escapeHtml(coreState.pendingLabel || "")}</span></div>`,
    );
  }
  el.innerHTML = rows.join("");
  el.scrollTop = el.scrollHeight;
}

function coreContextForEnhance() {
  return coreState.messages.slice(-12).map((m) => ({
    who: m.role === "assistant" ? "Ava" : "You",
    text: m.content || "",
  }));
}

let coreTick = null;

function stopCoreTick() {
  if (coreTick) {
    clearInterval(coreTick);
    coreTick = null;
  }
  coreState.pending = false;
  coreState.pendingLabel = "";
  const cancel = $("core-cancel");
  if (cancel) cancel.disabled = true;
}

function setCoreBusy(busy, label) {
  coreState.busy = Boolean(busy);
  const send = $("core-send");
  const enh = $("core-enhance");
  const cancel = $("core-cancel");
  if (send) send.disabled = coreState.busy;
  if (enh) enh.disabled = coreState.busy;
  if (cancel) cancel.disabled = !coreState.busy;
  if (label) $("core-status").textContent = label;
}

async function refreshCoreStatus() {
  const meta = $("core-meta");
  const status = $("core-status");
  try {
    const st = await window.avaDesktop.coreStatus();
    if (Array.isArray(st.providers) && st.providers.length) {
      providers = [
        ...providers.filter((p) => !st.providers.some((x) => x.id === p.id)),
        ...st.providers,
      ];
      const enhanceList = (st.providers || []).filter((p) => p.id !== "ollama");
      if (enhanceList.length) {
        const host = $("core-providers");
        if (host) {
          const prev = providers;
          providers = enhanceList;
          renderProviders("core-providers", "core");
          providers = prev;
        }
      }
    } else {
      renderProviders("core-providers", "core");
    }
    const sid = coreState.sessionId
      ? ` · session ${coreState.sessionId.slice(0, 8)}…`
      : "";
    if (meta) {
      meta.textContent = st.ok
        ? `Ollama ready · ${st.model || "ava-ivy"} @ ${st.baseUrl || "local"} (direct)${sid}`
        : `Ollama down · ${st.detail || "unreachable"} — start ollama / ava-ivy`;
    }
    if (status && !coreState.busy) {
      status.textContent = st.ok
        ? `ready · ${st.model || "?"} · direct`
        : `status · ${st.detail || "fail"}`;
    }
  } catch (err) {
    if (meta) meta.textContent = String(err.message || err);
  }
}

async function sendCoreChat() {
  const draft = ($("core-draft").value || "").trim();
  if (!draft) {
    $("core-status").textContent = "type a message first";
    return;
  }
  if (coreState.busy) return;

  const prior = coreState.messages.slice();
  coreState.messages = [...prior, { role: "user", content: draft }];
  coreState.pending = true;
  coreState.pendingLabel = "0s";
  $("core-draft").value = "";
  renderCoreHistory();

  const started = Date.now();
  stopCoreTick();
  coreState.pending = true;
  setCoreBusy(true, "Ava is typing…");
  coreTick = setInterval(() => {
    const sec = Math.round((Date.now() - started) / 1000);
    coreState.pendingLabel = `${sec}s`;
    $("core-status").textContent = `Ava is typing… ${sec}s`;
    renderCoreHistory();
  }, 1000);

  try {
    const res = await window.avaDesktop.coreChat({
      text: draft,
      messages: prior,
      sessionId: coreState.sessionId,
      save: true,
    });
    stopCoreTick();
    if (!res?.ok) {
      // keep the user message; show failure
      coreState.messages = prior.concat([{ role: "user", content: draft }]);
      renderCoreHistory();
      $("core-status").textContent = `fail · ${res?.detail || "unknown"} · ${res?.ms ? `${res.ms}ms` : ""}`;
      return;
    }
    coreState.sessionId = res.sessionId || coreState.sessionId;
    coreState.lastQuestion = draft;
    coreState.lastAnswer = res.reply || "";
    coreState.messages = Array.isArray(res.messages)
      ? res.messages
      : [
          ...prior,
          { role: "user", content: draft },
          { role: "assistant", content: res.reply || "" },
        ];
    renderCoreHistory();
    appendResponseLog("core", {
      kind: "core",
      text: `You: ${draft}\n\nAva: ${res.reply || ""}`,
      provider: res.model || "ollama",
      via: res.direct ? "direct" : "ava",
      meta: res.ms ? `${res.ms}ms` : "",
    });
    $("core-status").textContent = `ok · ${res.model || "ollama"} · ${res.ms || "?"}ms · ${res.saved ? "saved" : "unsaved"} · direct`;
    refreshCoreStatus();
  } catch (err) {
    stopCoreTick();
    coreState.messages = prior.concat([{ role: "user", content: draft }]);
    renderCoreHistory();
    $("core-status").textContent = String(err.message || err);
  } finally {
    stopCoreTick();
    setCoreBusy(false);
    renderCoreHistory();
  }
}

async function cancelCoreChat() {
  $("core-status").textContent = "cancelling…";
  try {
    await window.avaDesktop.coreCancel();
  } catch {
    /* ignore */
  }
}

$("core-cancel")?.addEventListener("click", () => cancelCoreChat());

async function enhanceCoreReply() {
  if (!coreState.lastAnswer) {
    $("core-status").textContent = "send a turn first — nothing to enhance";
    return;
  }
  if (coreState.busy) return;
  const provider = providerSel.core || "dream";
  setCoreBusy(true, `enhancing via ${provider}…`);
  $("core-enhance-out").classList.remove("show");
  try {
    const res = await window.avaDesktop.coreEnhance({
      draft: coreState.lastAnswer,
      context: coreContextForEnhance(),
      provider,
      sessionId: coreState.sessionId,
      save: true,
    });
    if (!res?.ok) {
      $("core-status").textContent = `enhance fail · ${res?.detail || "?"}`;
      return;
    }
    coreState.enhanceText = res.text || "";
    coreState.enhanceProvider = res.provider || provider;
    const out = $("core-enhance-out");
    out.classList.add("show");
    out.textContent = `── ${res.provider || provider} · ${res.via || ""}\n${res.text || ""}`;
    appendResponseLog("core", {
      kind: "enhance",
      text: res.text || "",
      provider: res.provider || provider,
      via: res.via || "",
    });
    $("core-status").textContent = `enhanced · ${res.provider || provider}`;
  } catch (err) {
    $("core-status").textContent = String(err.message || err);
  } finally {
    setCoreBusy(false);
  }
}

function applyCoreEnhance() {
  if (!coreState.enhanceText) {
    $("core-status").textContent = "run Enhance first";
    return;
  }
  // Replace last assistant message with enhanced text
  for (let i = coreState.messages.length - 1; i >= 0; i--) {
    if (coreState.messages[i].role === "assistant") {
      coreState.messages[i] = {
        role: "assistant",
        content: coreState.enhanceText,
      };
      break;
    }
  }
  coreState.lastAnswer = coreState.enhanceText;
  renderCoreHistory();
  $("core-status").textContent = `applied · ${coreState.enhanceProvider || "enhance"} as Ava reply (local view)`;
}

async function markCoreGold(useEnhance) {
  const question = coreState.lastQuestion;
  const answer = useEnhance && coreState.enhanceText
    ? coreState.enhanceText
    : coreState.lastAnswer;
  if (!question || !answer) {
    $("core-status").textContent = "need a completed turn to mark gold";
    return;
  }
  try {
    const res = await window.avaDesktop.coreGold({
      question,
      answer,
      sessionId: coreState.sessionId,
      provider: useEnhance ? coreState.enhanceProvider || "enhance" : "ollama",
    });
    $("core-status").textContent = res?.ok
      ? `gold saved · ${useEnhance ? "enhance pair" : "last turn"}`
      : `gold fail · ${res?.detail || "?"}`;
  } catch (err) {
    $("core-status").textContent = String(err.message || err);
  }
}

function clearCoreChat() {
  coreState.messages = [];
  coreState.lastQuestion = "";
  coreState.lastAnswer = "";
  coreState.enhanceText = "";
  coreState.enhanceProvider = "";
  $("core-enhance-out").classList.remove("show");
  $("core-enhance-out").textContent = "";
  renderCoreHistory();
  $("core-status").textContent = "cleared (session kept)";
}

function newCoreSession() {
  coreState.sessionId = null;
  clearCoreChat();
  $("core-status").textContent = "new session";
  refreshCoreStatus();
}

$("core-send")?.addEventListener("click", () => sendCoreChat());
$("core-draft")?.addEventListener("keydown", (ev) => {
  if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) {
    ev.preventDefault();
    sendCoreChat();
  }
});
$("core-refresh-status")?.addEventListener("click", () => refreshCoreStatus());
$("core-clear")?.addEventListener("click", () => clearCoreChat());
$("core-new-session")?.addEventListener("click", () => newCoreSession());
$("core-enhance")?.addEventListener("click", () => enhanceCoreReply());
$("core-enhance-apply")?.addEventListener("click", () => applyCoreEnhance());
$("core-mark-gold")?.addEventListener("click", () => markCoreGold(false));
$("core-enhance-gold")?.addEventListener("click", () => markCoreGold(true));

function feedbackSelected() {
  return (feedbackState.items || []).find(
    (x) => String(x.id) === String(feedbackState.selectedId),
  );
}

function feedbackProcessedStamp(elapsedSec = 0) {
  const when = new Date().toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
  return `Feedback was fully processed on ${when} ${elapsedSec} Seconds ago`;
}

function updateFeedbackSelMeta() {
  const el = $("feedback-sel-meta");
  if (!el) return;
  const d = feedbackState.discordSel;
  const s = feedbackState.slackSel;
  const bits = [];
  if (d?.id) bits.push(`Discord ${d.self ? "ava" : "msg"} …${String(d.id).slice(-6)}`);
  if (s?.id) bits.push(`Slack ${s.self ? "ava" : "msg"} ${s.id}`);
  el.textContent = bits.length ? bits.join(" · ") : "No message selected";
}

function renderFeedbackQueue() {
  const host = $("feedback-queue");
  if (!host) return;
  const rows = feedbackState.items || [];
  if (!rows.length) {
    host.innerHTML = "<div class='msg meta'>(queue empty or unavailable)</div>";
    return;
  }
  host.innerHTML = rows
    .map((fb) => {
      const id = String(fb.id || "");
      const who = escapeHtml(fb.minecraft_username || fb.player || fb.author || "?");
      const hostName = escapeHtml(fb.server_name || fb.server_id || "");
      const st = escapeHtml(fb.status || "");
      const msg = escapeHtml(String(fb.message || fb.body || "").slice(0, 500));
      const active = id && id === String(feedbackState.selectedId) ? " active" : "";
      return `<button type="button" class="feedback-item${active}" data-id="${escapeHtml(id)}"><div class="who">${who}</div><div class="meta">${hostName}${st ? ` · ${st}` : ""} · ${escapeHtml(id.slice(0, 8))}…</div><div class="body">${msg}</div></button>`;
    })
    .join("");
  host.querySelectorAll(".feedback-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      feedbackState.selectedId = btn.dataset.id;
      renderFeedbackQueue();
      $("feedback-status").textContent = `selected ${btn.dataset.id}`;
    });
  });
}

function fillFeedbackTemplates(templates) {
  const sel = $("feedback-template");
  if (!sel) return;
  feedbackState.templates = templates || [];
  sel.innerHTML = "";
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "(pick a template)";
  sel.appendChild(blank);
  for (const t of feedbackState.templates) {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.label || t.id;
    sel.appendChild(opt);
  }
  const quick = $("feedback-quick-templates");
  if (quick) {
    quick.innerHTML = (feedbackState.templates || [])
      .map(
        (t) =>
          `<button type="button" data-fb-tpl="${escapeHtml(t.id)}">${escapeHtml(t.label || t.id)}</button>`,
      )
      .join("");
    quick.querySelectorAll("button[data-fb-tpl]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const t = (feedbackState.templates || []).find((x) => x.id === btn.dataset.fbTpl);
        if (!t?.text) return;
        $("feedback-draft").value = t.text;
        autosizeDraft($("feedback-draft"));
        draftReadyExact.feedback = false;
        if ($("feedback-template")) $("feedback-template").value = t.id;
        $("feedback-status").textContent = `template · ${t.label}`;
      });
    });
  }
}

async function refreshFeedbackQueue() {
  const status = $("feedback-status-filter")?.value || "queued";
  $("feedback-status").textContent = `loading ${status}…`;
  try {
    const data = await window.avaDesktop.feedbackList({ status, limit: 50 });
    if (!data?.ok) {
      feedbackState.items = [];
      renderFeedbackQueue();
      $("feedback-meta").textContent = data?.detail || "queue unavailable";
      $("feedback-status").textContent = data?.detail || "fail";
      return;
    }
    feedbackState.items = data.feedback || [];
    renderFeedbackQueue();
    $("feedback-meta").textContent = `${feedbackState.items.length} ${status} · dual post → Discord #development + Slack #feedback`;
    $("feedback-status").textContent = `queue · ${feedbackState.items.length} ${status}`;
  } catch (err) {
    $("feedback-status").textContent = String(err.message || err);
  }
}

async function refreshFeedbackChannels() {
  $("feedback-status").textContent = "loading channel peeks…";
  try {
    const [d, s] = await Promise.all([
      window.avaDesktop.history({
        surface: "discord",
        channelId: feedbackState.targets.discord,
        limit: 40,
      }),
      window.avaDesktop.history({
        surface: "slack",
        channelId: feedbackState.targets.slack,
        limit: 40,
      }),
    ]);
    feedbackState._discordMsgs = d.messages || [];
    feedbackState._slackMsgs = s.messages || [];
    bindFeedbackDiscordHist();
    bindFeedbackSlackHist();
    updateFeedbackSelMeta();
    $("feedback-status").textContent = `channels · discord ${d.messages?.length || 0} · slack ${s.messages?.length || 0}`;
  } catch (err) {
    $("feedback-status").textContent = String(err.message || err);
  }
}

function bindFeedbackDiscordHist() {
  renderHistory($("feedback-discord-hist"), feedbackState._discordMsgs || [], {
    replyId: feedbackState.discordSel?.id || null,
    surface: "feedback-discord",
    onPick: (pick) => {
      feedbackState.discordSel = pick;
      updateFeedbackSelMeta();
      bindFeedbackDiscordHist();
      $("feedback-status").textContent = `discord sel · …${String(pick.id).slice(-6)}${pick.self ? " (ava)" : ""}`;
    },
  });
}

function bindFeedbackSlackHist() {
  renderHistory($("feedback-slack-hist"), feedbackState._slackMsgs || [], {
    replyId: feedbackState.slackSel?.id || null,
    surface: "feedback-slack",
    onPick: (pick) => {
      feedbackState.slackSel = pick;
      updateFeedbackSelMeta();
      bindFeedbackSlackHist();
      $("feedback-status").textContent = `slack sel · ${pick.id}${pick.self ? " (ava)" : ""}`;
    },
  });
}

async function refreshFeedbackPage() {
  await refreshFeedbackQueue();
  await refreshFeedbackChannels();
}

function loadFeedbackSelectedToDraft({ staffReply = false } = {}) {
  const fb = feedbackSelected();
  if (!fb) {
    $("feedback-status").textContent = "select a queue item first";
    return;
  }
  const who = fb.minecraft_username || fb.player || "?";
  const msg = String(fb.message || fb.body || "").trim();
  const body = staffReply
    ? `**Feedback reply** — ${who}\n\n> ${msg.replace(/\n/g, "\n> ")}\n\n`
    : `**Feedback** from **${who}** (${fb.server_name || fb.server_id || "server"})\n${msg}\n\n_id ${fb.id}_`;
  $("feedback-draft").value = body;
  autosizeDraft($("feedback-draft"));
  draftReadyExact.feedback = true;
  $("feedback-status").textContent = staffReply
    ? `draft staff reply · ${who}`
    : `loaded ${who} into draft`;
}

async function ackFeedbackSelected() {
  const fb = feedbackSelected();
  if (!fb?.id) {
    $("feedback-status").textContent = "select a queue item to ack";
    return;
  }
  const note = ($("feedback-draft").value || "").trim().slice(0, 500) ||
    `Acked from Ava Ivy Feedback page`;
  $("feedback-status").textContent = "acking…";
  try {
    const r = await window.avaDesktop.feedbackAck({ id: fb.id, note });
    appendResponseLog("feedback", {
      kind: "ack",
      text: note,
      provider: "exact",
      via: "governance",
      meta: `id ${fb.id}`,
    });
    $("feedback-status").textContent = r?.ok
      ? `acked · ${fb.id}`
      : `ack fail · ${r?.detail || "?"}`;
    await refreshFeedbackQueue();
  } catch (err) {
    $("feedback-status").textContent = String(err.message || err);
  }
}

async function ackAllVisibleFeedback() {
  const rows = (feedbackState.items || []).filter((x) => x?.id);
  if (!rows.length) {
    $("feedback-status").textContent = "nothing to ack";
    return;
  }
  if (!confirm(`Ack all ${rows.length} visible queue items?`)) return;
  $("feedback-status").textContent = `acking ${rows.length}…`;
  let ok = 0;
  for (const fb of rows) {
    try {
      const r = await window.avaDesktop.feedbackAck({
        id: fb.id,
        note: "Bulk ack from Ava Ivy Feedback",
      });
      if (r?.ok) ok += 1;
    } catch {
      /* continue */
    }
  }
  appendResponseLog("feedback", {
    kind: "ack-all",
    text: `Acked ${ok}/${rows.length}`,
    provider: "exact",
    via: "bulk",
    meta: `${ok} ok`,
  });
  $("feedback-status").textContent = `acked ${ok}/${rows.length}`;
  await refreshFeedbackQueue();
}

async function processFeedbackNextItem() {
  if (feedbackState.busy) return;
  feedbackState.busy = true;
  $("feedback-status").textContent = "processing next…";
  try {
    const r = await window.avaDesktop.feedbackProcessNext();
    if (r?.empty) {
      $("feedback-status").textContent = "queue empty";
      return;
    }
    if (!r?.ok) {
      $("feedback-status").textContent = `process fail · ${r?.detail || "?"}`;
      return;
    }
    const fb = r.feedback || r.item || null;
    if (fb) {
      feedbackState.selectedId = fb.id;
      const who = fb.minecraft_username || "?";
      const msg = String(fb.message || "").trim();
      $("feedback-draft").value = `**Feedback** from **${who}**\n${msg}\n\n_id ${fb.id}_`;
      autosizeDraft($("feedback-draft"));
      draftReadyExact.feedback = true;
      appendResponseLog("feedback", {
        kind: "process",
        text: $("feedback-draft").value,
        provider: "exact",
        via: "process-next",
        meta: `id ${fb.id}`,
      });
    }
    $("feedback-status").textContent = fb
      ? `processed · ${fb.id} — review draft, then dual post or ack`
      : "processed";
    await refreshFeedbackQueue();
  } catch (err) {
    $("feedback-status").textContent = String(err.message || err);
  } finally {
    feedbackState.busy = false;
  }
}

async function drainFeedbackQueue(times = 5) {
  for (let i = 0; i < times; i++) {
    await processFeedbackNextItem();
    if (($("feedback-status").textContent || "").includes("queue empty")) break;
  }
}

async function dualPostFeedbackDraft() {
  const text = ($("feedback-draft").value || "").trim();
  if (!text) {
    $("feedback-status").textContent = "type a message first";
    return;
  }
  if (surfaceBusy.feedback) {
    $("feedback-status").textContent = "already posting";
    return;
  }
  const provider = providerSel.feedback || "exact";
  const rewrite = provider !== "exact" && !draftReadyExact.feedback;
  surfaceBusy.feedback = true;
  $("feedback-status").textContent = rewrite
    ? `dual posting via ${provider}…`
    : "dual posting exact → Discord #development + Slack #feedback…";
  try {
    const r = await window.avaDesktop.feedbackDualPost({
      text,
      rewrite,
      provider: rewrite ? provider : "exact",
      includeDevFeed: Boolean($("feedback-also-devfeed")?.checked),
    });
    draftReadyExact.feedback = false;
    const lines = (r.results || [])
      .map((x) => `${x.ok ? "ok" : "fail"} · ${x.label}${x.id ? ` · ${x.id}` : ""}${x.detail ? ` · ${x.detail}` : ""}`)
      .join("\n");
    appendResponseLog("feedback", {
      kind: "dual-post",
      text,
      provider: rewrite ? provider : "exact",
      via: "dual",
      meta: `${r.posted || 0} posted`,
    });
    $("feedback-status").textContent = r?.ok
      ? `posted ${r.posted}/${(r.results || []).length}\n${lines}`
      : `dual post fail\n${lines || r?.detail || "?"}`;
    await refreshFeedbackChannels();
  } catch (err) {
    $("feedback-status").textContent = String(err.message || err);
  } finally {
    surfaceBusy.feedback = false;
  }
}

async function deleteFeedbackDiscordSelected() {
  const pick = feedbackState.discordSel;
  if (!pick?.id) {
    $("feedback-status").textContent = "select a Discord message first";
    return;
  }
  if (!confirm(`Delete Discord message …${String(pick.id).slice(-6)}?`)) return;
  $("feedback-status").textContent = "deleting discord…";
  try {
    const r = await window.avaDesktop.feedbackDeleteDiscord({ messageId: pick.id });
    appendResponseLog("feedback", {
      kind: "delete",
      text: pick.text || "",
      provider: "exact",
      via: "discord-delete",
      meta: r?.ok ? `ok ${pick.id}` : r?.detail || "fail",
    });
    feedbackState.discordSel = null;
    updateFeedbackSelMeta();
    $("feedback-status").textContent = r?.ok ? `deleted discord · ${pick.id}` : `delete fail · ${r?.detail || "?"}`;
    await refreshFeedbackChannels();
  } catch (err) {
    $("feedback-status").textContent = String(err.message || err);
  }
}

async function deleteFeedbackSlackSelected() {
  const pick = feedbackState.slackSel;
  if (!pick?.id) {
    $("feedback-status").textContent = "select a Slack message first";
    return;
  }
  if (!confirm(`Delete Slack message ${pick.id}?`)) return;
  $("feedback-status").textContent = "deleting slack…";
  try {
    const r = await window.avaDesktop.feedbackDeleteSlack({ messageTs: pick.id });
    appendResponseLog("feedback", {
      kind: "delete",
      text: pick.text || "",
      provider: "exact",
      via: "slack-delete",
      meta: r?.ok ? `ok ${pick.id}` : r?.detail || "fail",
    });
    feedbackState.slackSel = null;
    updateFeedbackSelMeta();
    $("feedback-status").textContent = r?.ok ? `deleted slack · ${pick.id}` : `delete fail · ${r?.detail || "?"}`;
    await refreshFeedbackChannels();
  } catch (err) {
    $("feedback-status").textContent = String(err.message || err);
  }
}

async function clearFeedbackDiscordOwn() {
  if (!confirm("Delete Ava's own messages in Discord #development (capped)? This cannot be undone.")) return;
  $("feedback-status").textContent = "clearing discord ava msgs…";
  try {
    const r = await window.avaDesktop.feedbackClearDiscord({});
    appendResponseLog("feedback", {
      kind: "clear",
      text: `Cleared Discord Ava msgs: ${r?.deleted || 0}`,
      provider: "exact",
      via: "clear-discord",
      meta: `deleted ${r?.deleted || 0} failed ${r?.failed || 0}`,
    });
    $("feedback-status").textContent = `discord clear · deleted ${r?.deleted || 0} · failed ${r?.failed || 0}`;
    await refreshFeedbackChannels();
  } catch (err) {
    $("feedback-status").textContent = String(err.message || err);
  }
}

async function clearFeedbackSlackOwn() {
  if (!confirm("Delete Ava's own messages in Slack #feedback (capped)? This cannot be undone.")) return;
  $("feedback-status").textContent = "clearing slack ava msgs…";
  try {
    const r = await window.avaDesktop.feedbackClearSlack({});
    appendResponseLog("feedback", {
      kind: "clear",
      text: `Cleared Slack Ava msgs: ${r?.deleted || 0}`,
      provider: "exact",
      via: "clear-slack",
      meta: `deleted ${r?.deleted || 0} failed ${r?.failed || 0}`,
    });
    $("feedback-status").textContent = `slack clear · deleted ${r?.deleted || 0} · failed ${r?.failed || 0}`;
    await refreshFeedbackChannels();
  } catch (err) {
    $("feedback-status").textContent = String(err.message || err);
  }
}

async function clearAllFeedbackAndStamp() {
  const clearDiscord = Boolean($("feedback-clear-discord-opt")?.checked);
  const clearSlack = Boolean($("feedback-clear-slack-opt")?.checked);
  if (!clearDiscord && !clearSlack) {
    $("feedback-status").textContent = "tick Discord and/or Slack to clear";
    return;
  }
  const bits = [
    clearDiscord ? "Discord #development Ava msgs" : null,
    clearSlack ? "Slack #feedback Ava msgs" : null,
  ]
    .filter(Boolean)
    .join(" + ");
  if (
    !confirm(
      `Clear all (${bits}), then dual-post:\n“Feedback was fully processed on TIMESTAMP Seconds ago”?\n\nCannot be undone.`,
    )
  ) {
    return;
  }
  if (surfaceBusy.feedback) {
    $("feedback-status").textContent = "busy";
    return;
  }
  surfaceBusy.feedback = true;
  $("feedback-status").textContent = "clear all + stamp…";
  try {
    const r = await window.avaDesktop.feedbackClearAll({
      clearDiscord,
      clearSlack,
      alsoDevFeed: Boolean($("feedback-also-devfeed")?.checked),
    });
    const dDel = r?.discord?.deleted ?? 0;
    const sDel = r?.slack?.deleted ?? 0;
    appendResponseLog("feedback", {
      kind: "clear-all",
      text: r?.text || feedbackProcessedStamp(r?.elapsedSec || 0),
      provider: "exact",
      via: "clear-all-stamp",
      meta: `discord −${dDel} · slack −${sDel} · stamp ${r?.ok ? "ok" : "fail"}`,
    });
    $("feedback-draft").value = r?.text || feedbackProcessedStamp(0);
    autosizeDraft($("feedback-draft"));
    draftReadyExact.feedback = true;
    $("feedback-status").textContent = [
      `clear-all · discord −${dDel} · slack −${sDel}`,
      r?.text || "",
      r?.stamp?.ok ? "stamp posted" : `stamp · ${r?.stamp?.detail || r?.detail || "fail"}`,
    ].join("\n");
    await refreshFeedbackChannels();
  } catch (err) {
    $("feedback-status").textContent = String(err.message || err);
  } finally {
    surfaceBusy.feedback = false;
  }
}

async function postFeedbackStampOnly() {
  const text = feedbackProcessedStamp(0);
  $("feedback-draft").value = text;
  autosizeDraft($("feedback-draft"));
  draftReadyExact.feedback = true;
  await dualPostFeedbackDraft();
}

$("feedback-refresh-queue")?.addEventListener("click", () => refreshFeedbackQueue());
$("feedback-refresh-channels")?.addEventListener("click", () => refreshFeedbackChannels());
$("feedback-refresh-all")?.addEventListener("click", () => refreshFeedbackPage());
$("feedback-process-next")?.addEventListener("click", () => processFeedbackNextItem());
$("feedback-process-drain")?.addEventListener("click", () => drainFeedbackQueue(5));
$("feedback-status-filter")?.addEventListener("change", () => refreshFeedbackQueue());
$("feedback-load-selected")?.addEventListener("click", () => loadFeedbackSelectedToDraft());
$("feedback-draft-from-item")?.addEventListener("click", () =>
  loadFeedbackSelectedToDraft({ staffReply: true }),
);
$("feedback-ack-selected")?.addEventListener("click", () => ackFeedbackSelected());
$("feedback-ack-all-queued")?.addEventListener("click", () => ackAllVisibleFeedback());
$("feedback-select-first")?.addEventListener("click", () => {
  const first = feedbackState.items?.[0];
  if (!first?.id) {
    $("feedback-status").textContent = "queue empty";
    return;
  }
  feedbackState.selectedId = first.id;
  renderFeedbackQueue();
  $("feedback-status").textContent = `selected ${first.id}`;
});
$("feedback-deselect")?.addEventListener("click", () => {
  feedbackState.selectedId = null;
  renderFeedbackQueue();
  $("feedback-status").textContent = "deselected";
});
$("feedback-copy-item")?.addEventListener("click", async () => {
  const fb = feedbackSelected();
  if (!fb) {
    $("feedback-status").textContent = "select a queue item first";
    return;
  }
  const text = `${fb.minecraft_username || "?"} · ${fb.message || fb.body || ""}`;
  try {
    await navigator.clipboard.writeText(text);
    $("feedback-status").textContent = "copied item";
  } catch {
    $("feedback-status").textContent = "clipboard failed";
  }
});
$("feedback-delete-discord")?.addEventListener("click", () => deleteFeedbackDiscordSelected());
$("feedback-delete-slack")?.addEventListener("click", () => deleteFeedbackSlackSelected());
$("feedback-clear-discord")?.addEventListener("click", () => clearFeedbackDiscordOwn());
$("feedback-clear-slack")?.addEventListener("click", () => clearFeedbackSlackOwn());
$("feedback-clear-all")?.addEventListener("click", () => clearAllFeedbackAndStamp());
$("feedback-clear-sel")?.addEventListener("click", () => {
  feedbackState.discordSel = null;
  feedbackState.slackSel = null;
  updateFeedbackSelMeta();
  bindFeedbackDiscordHist();
  bindFeedbackSlackHist();
  $("feedback-status").textContent = "selection cleared";
});
$("feedback-load-discord-sel")?.addEventListener("click", () => {
  const p = feedbackState.discordSel;
  if (!p?.id) {
    $("feedback-status").textContent = "select a Discord message";
    return;
  }
  $("feedback-draft").value = p.text || "";
  autosizeDraft($("feedback-draft"));
  draftReadyExact.feedback = true;
  $("feedback-status").textContent = "loaded discord → draft";
});
$("feedback-load-slack-sel")?.addEventListener("click", () => {
  const p = feedbackState.slackSel;
  if (!p?.id) {
    $("feedback-status").textContent = "select a Slack message";
    return;
  }
  $("feedback-draft").value = p.text || "";
  autosizeDraft($("feedback-draft"));
  draftReadyExact.feedback = true;
  $("feedback-status").textContent = "loaded slack → draft";
});
$("feedback-insert-stamp")?.addEventListener("click", () => {
  $("feedback-draft").value = feedbackProcessedStamp(0);
  autosizeDraft($("feedback-draft"));
  draftReadyExact.feedback = true;
  $("feedback-status").textContent = "inserted processed stamp";
});
$("feedback-insert-now")?.addEventListener("click", () => {
  const ta = $("feedback-draft");
  const stamp = new Date().toISOString();
  ta.value = `${ta.value || ""}${ta.value ? "\n" : ""}${stamp}`;
  autosizeDraft(ta);
  $("feedback-status").textContent = "inserted ISO timestamp";
});
$("feedback-insert-triage")?.addEventListener("click", () => {
  const t = (feedbackState.templates || []).find((x) => x.id === "triage");
  if (!t?.text) return;
  $("feedback-draft").value = t.text;
  autosizeDraft($("feedback-draft"));
  $("feedback-status").textContent = "inserted triage header";
});
$("feedback-insert-digest")?.addEventListener("click", () => {
  const t = (feedbackState.templates || []).find((x) => x.id === "digest");
  if (!t?.text) return;
  $("feedback-draft").value = t.text;
  autosizeDraft($("feedback-draft"));
  $("feedback-status").textContent = "inserted digest header";
});
$("feedback-append-nl")?.addEventListener("click", () => {
  const ta = $("feedback-draft");
  ta.value = `${ta.value || ""}\n\n`;
  autosizeDraft(ta);
});
$("feedback-uppercase")?.addEventListener("click", () => {
  const ta = $("feedback-draft");
  ta.value = String(ta.value || "").toUpperCase();
  autosizeDraft(ta);
});
$("feedback-trim")?.addEventListener("click", () => {
  const ta = $("feedback-draft");
  ta.value = String(ta.value || "").trim();
  autosizeDraft(ta);
});
$("feedback-copy-draft")?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("feedback-draft").value || "");
    $("feedback-status").textContent = "draft copied";
  } catch {
    $("feedback-status").textContent = "clipboard failed";
  }
});
$("feedback-post-stamp")?.addEventListener("click", () => postFeedbackStampOnly());
$("feedback-clear")?.addEventListener("click", () => {
  $("feedback-draft").value = "";
  draftReadyExact.feedback = false;
  autosizeDraft($("feedback-draft"));
  $("feedback-status").textContent = "cleared";
});
$("feedback-template")?.addEventListener("change", () => {
  const id = $("feedback-template").value;
  const t = (feedbackState.templates || []).find((x) => x.id === id);
  if (!t?.text) return;
  $("feedback-draft").value = t.text;
  autosizeDraft($("feedback-draft"));
  draftReadyExact.feedback = false;
  $("feedback-status").textContent = `template · ${t.label}`;
});
$("feedback-preview")?.addEventListener("click", () =>
  previewRewrite(
    "feedback",
    "feedback-draft",
    feedbackState.targets.discord,
    "feedback-status",
    null,
  ),
);
$("feedback-dual-post")?.addEventListener("click", () => dualPostFeedbackDraft());

boot().catch((err) => {
  $("settings-status").textContent = String(err.message || err);
});
