const $ = (id) => document.getElementById(id);

let presets = [];
let discordReply = null;
let telegramReply = null;

document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    $(`page-${btn.dataset.page}`).classList.add("active");
  });
});

function renderHistory(el, messages, { replyId = null, onPick = null } = {}) {
  el.innerHTML = (messages || [])
    .map((m) => {
      const id = m.id ? String(m.id) : "";
      const who = escapeHtml(m.who || "?");
      const clickable = id && onPick ? " clickable" : "";
      const selected = id && replyId === id ? " msg-reply-target" : "";
      const dataId = id ? ` data-id="${escapeHtml(id)}" data-who="${who}"` : "";
      return `<div class="msg${clickable}${selected}"${dataId}><span class="who">${who}</span>: ${escapeHtml(m.text || "")}</div>`;
    })
    .join("") || "<div class='msg'>(no messages)</div>";

  if (onPick) {
    el.querySelectorAll(".msg.clickable").forEach((node) => {
      node.addEventListener("click", () => {
        onPick({ id: node.dataset.id, who: node.dataset.who });
      });
    });
  }
  el.scrollTop = el.scrollHeight;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function setReplyBar({ barId, whoId, clearId, reply }) {
  const bar = $(barId);
  const whoEl = $(whoId);
  if (!bar || !whoEl) return;
  if (reply?.id) {
    bar.classList.remove("hidden");
    const shortId = reply.id.length > 8 ? `…${reply.id.slice(-6)}` : reply.id;
    whoEl.textContent = `@${reply.who} (${shortId})`;
  } else {
    bar.classList.add("hidden");
    whoEl.textContent = "?";
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
    opt.dataset.key = p.key;
    sel.appendChild(opt);
  }
}

function applyPreset() {
  const id = $("post-preset").value;
  if (id) $("post-channel").value = id;
}

async function boot() {
  const st = await window.avaDesktop.envStatus();
  $("settings-status").textContent = JSON.stringify(st, null, 2);
  if (st.operatorChatId) $("telegram-chat").value = st.operatorChatId;

  const presetRes = await window.avaDesktop.listPresets();
  presets = presetRes.presets || [];
  fillPresets($("post-surface").value);
  // Default post target: updates
  const updates = presets.find((p) => p.key === "updates");
  if (updates) {
    $("post-surface").value = "discord";
    fillPresets("discord");
    $("post-preset").value = updates.id;
    $("post-channel").value = updates.id;
  }

  const ch = await window.avaDesktop.listDiscordChannels();
  const sel = $("discord-channel");
  sel.innerHTML = "";
  for (const c of ch.channels || []) {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = `#${c.name}`;
    sel.appendChild(opt);
  }
  const prefer = (ch.channels || []).find((c) =>
    /development|admins|updates|general/i.test(c.name),
  );
  if (prefer) sel.value = prefer.id;

  await refreshDiscord();
  await refreshTelegram();
}

function pickDiscordReply(pick) {
  discordReply = pick;
  setReplyBar({
    barId: "discord-reply-bar",
    whoId: "discord-reply-who",
    reply: discordReply,
  });
  $("discord-history").querySelectorAll(".msg").forEach((node) => {
    node.classList.toggle("msg-reply-target", node.dataset.id === pick.id);
  });
  $("discord-draft").focus();
}

function pickTelegramReply(pick) {
  if (!pick.id) return;
  telegramReply = pick;
  setReplyBar({
    barId: "telegram-reply-bar",
    whoId: "telegram-reply-who",
    reply: telegramReply,
  });
  $("telegram-history").querySelectorAll(".msg").forEach((node) => {
    node.classList.toggle("msg-reply-target", node.dataset.id === pick.id);
  });
  $("telegram-draft").focus();
}

async function refreshDiscord() {
  const channelId = $("discord-channel").value;
  const hist = await window.avaDesktop.history({ surface: "discord", channelId });
  renderHistory($("discord-history"), hist.messages, {
    replyId: discordReply?.id || null,
    onPick: pickDiscordReply,
  });
  $("discord-status").textContent = hist.ok
    ? `loaded ${hist.messages?.length || 0} msgs${discordReply?.id ? " · reply set" : ""}`
    : hist.detail || "fail";
}

async function refreshTelegram() {
  const channelId = $("telegram-chat").value.trim();
  const hist = await window.avaDesktop.history({ surface: "telegram", channelId });
  renderHistory($("telegram-history"), hist.messages, {
    replyId: telegramReply?.id || null,
    onPick: pickTelegramReply,
  });
  $("telegram-status").textContent = `context ${hist.messages?.length || 0} msgs (local ring + send)`;
}

$("post-surface").onchange = () => {
  fillPresets($("post-surface").value);
  $("post-channel").value = "";
  if ($("post-surface").value === "telegram") {
    window.avaDesktop.envStatus().then((st) => {
      if (st.operatorChatId) $("post-channel").value = st.operatorChatId;
    });
  }
};

$("post-preset").onchange = applyPreset;

$("post-clear").onclick = () => {
  $("post-draft").value = "";
  $("post-ref").value = "";
  $("post-status").textContent = "";
};

$("post-send").onclick = async () => {
  const surface = $("post-surface").value;
  let channelId = $("post-channel").value.trim();
  const text = $("post-draft").value.trim();
  const refId = $("post-ref").value.trim();
  const rewrite = $("post-rewrite").checked;

  if (!channelId) {
    $("post-status").textContent = "Need a channel / chat ID (or pick a preset).";
    return;
  }
  const asPreset = presets.find(
    (p) => p.key === channelId.toLowerCase() || p.id === channelId,
  );
  if (asPreset) {
    channelId = asPreset.id;
    $("post-surface").value = asPreset.surface;
    $("post-channel").value = asPreset.id;
  }
  if (!text) {
    $("post-status").textContent = "Type a message first.";
    return;
  }

  $("post-status").textContent = rewrite ? "rewriting + posting…" : "posting as Ava…";
  try {
    const r = await window.avaDesktop.post({
      surface: $("post-surface").value,
      channelId,
      text,
      refId: refId || undefined,
      rewrite,
    });
    $("post-status").textContent = [
      `sent as Ava (${r.surface})`,
      `channel ${r.channelId}`,
      r.id ? `id ${r.id}` : null,
      refId ? `reply to ${refId}` : null,
      `via ${r.via}`,
      "",
      r.text,
    ]
      .filter(Boolean)
      .join("\n");
    $("post-draft").value = "";
  } catch (err) {
    $("post-status").textContent = String(err.message || err);
  }
};

$("post-draft").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    $("post-send").click();
  }
});

$("discord-reply-clear").onclick = () => {
  discordReply = null;
  setReplyBar({
    barId: "discord-reply-bar",
    whoId: "discord-reply-who",
    reply: null,
  });
  refreshDiscord();
};

$("telegram-reply-clear").onclick = () => {
  telegramReply = null;
  setReplyBar({
    barId: "telegram-reply-bar",
    whoId: "telegram-reply-who",
    reply: null,
  });
  refreshTelegram();
};

$("discord-refresh").onclick = refreshDiscord;
$("telegram-refresh").onclick = refreshTelegram;
$("discord-channel").onchange = () => {
  discordReply = null;
  setReplyBar({
    barId: "discord-reply-bar",
    whoId: "discord-reply-who",
    reply: null,
  });
  refreshDiscord();
};

$("discord-send").onclick = async () => {
  const text = $("discord-draft").value.trim();
  if (!text) return;
  const rewrite = $("discord-rewrite").checked;
  $("discord-status").textContent = rewrite ? "rewriting + sending…" : "sending as Ava…";
  try {
    const r = await window.avaDesktop.send({
      surface: "discord",
      channelId: $("discord-channel").value,
      text,
      refId: discordReply?.id || undefined,
      rewrite,
    });
    $("discord-draft").value = "";
    discordReply = null;
    setReplyBar({
      barId: "discord-reply-bar",
      whoId: "discord-reply-who",
      reply: null,
    });
    $("discord-status").textContent = [
      `sent (${r.via})`,
      r.id ? `id ${r.id}` : null,
      "",
      r.text || r.rewritten || "",
    ]
      .filter(Boolean)
      .join("\n");
    await refreshDiscord();
  } catch (err) {
    $("discord-status").textContent = String(err.message || err);
  }
};

$("telegram-send").onclick = async () => {
  const text = $("telegram-draft").value.trim();
  if (!text) return;
  const rewrite = $("telegram-rewrite").checked;
  $("telegram-status").textContent = rewrite ? "rewriting + sending…" : "sending as Ava…";
  try {
    const r = await window.avaDesktop.send({
      surface: "telegram",
      channelId: $("telegram-chat").value.trim(),
      text,
      refId: telegramReply?.id || undefined,
      rewrite,
    });
    $("telegram-draft").value = "";
    telegramReply = null;
    setReplyBar({
      barId: "telegram-reply-bar",
      whoId: "telegram-reply-who",
      reply: null,
    });
    $("telegram-status").textContent = [
      `sent (${r.via})`,
      r.id ? `id ${r.id}` : null,
      "",
      r.text || r.rewritten || "",
    ]
      .filter(Boolean)
      .join("\n");
    await refreshTelegram();
  } catch (err) {
    $("telegram-status").textContent = String(err.message || err);
  }
};

$("discord-draft").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    $("discord-send").click();
  }
});

$("telegram-draft").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    $("telegram-send").click();
  }
});

boot().catch((err) => {
  $("settings-status").textContent = String(err.message || err);
  $("post-status").textContent = String(err.message || err);
});
