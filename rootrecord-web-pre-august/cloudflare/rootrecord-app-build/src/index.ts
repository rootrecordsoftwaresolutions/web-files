export interface Env {
  APP_BUILD_REQUEST_WEBHOOK_URL?: string;
  APP_BUILD_REQUEST_WEBHOOK_BEARER?: string;
  APP_BUILD_DISCORD_BOT_TOKEN?: string;
  APP_BUILD_DISCORD_DM_USER_ID?: string;
  APP_BUILD_IOS_WAITLIST_CHANNEL_ID?: string;
  APP_BUILD_VISITING_HAWAII_WAITLIST_CHANNEL_ID?: string;
}

type AppBuildRequestPayload = {
  name: string;
  company?: string;
  email: string;
  phone?: string;
  preferredContact: string;
  timezone?: string;
  projectName?: string;
  purpose: string;
  users: string;
  platforms: string;
  features: string;
  integrations?: string;
  design?: string;
  examples?: string;
  timeline: string;
  budget?: string;
  support: string;
  notes?: string;
};

type IosWaitlistPayload = {
  name?: string;
  email: string;
  product: string;
  notes?: string;
};

type VisitingHawaiiWaitlistPayload = {
  name?: string;
  email: string;
  homeIsland?: string;
  travelWhen?: string;
  platform?: string;
  notes?: string;
};

const DEFAULT_IOS_WAITLIST_CHANNEL_ID = "1509812977069592676";

function clampText(value: unknown, max: number): string {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, max);
}

function isEmailLike(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function formatDiscordMessage(p: AppBuildRequestPayload, meta: Record<string, string>) {
  const lines: string[] = [];
  lines.push("**New app build request**");
  lines.push("");
  lines.push(`**Name:** ${p.name}`);
  if (p.company) lines.push(`**Company:** ${p.company}`);
  lines.push(`**Email:** ${p.email}`);
  if (p.phone) lines.push(`**Phone:** ${p.phone}`);
  lines.push(`**Preferred contact:** ${p.preferredContact}`);
  if (p.timezone) lines.push(`**Timezone:** ${p.timezone}`);
  if (p.projectName) lines.push(`**Project name:** ${p.projectName}`);
  lines.push(`**Platforms:** ${p.platforms}`);
  lines.push(`**Timeline:** ${p.timeline}`);
  if (p.budget) lines.push(`**Budget:** ${p.budget}`);
  lines.push(`**Ongoing support:** ${p.support}`);
  lines.push("");
  lines.push("**Purpose**");
  lines.push(purposeSafe(p.purpose));
  lines.push("");
  lines.push("**Users / roles**");
  lines.push(purposeSafe(p.users));
  lines.push("");
  lines.push("**Key features**");
  lines.push(purposeSafe(p.features));
  if (p.integrations) {
    lines.push("");
    lines.push("**Integrations**");
    lines.push(purposeSafe(p.integrations));
  }
  if (p.design) {
    lines.push("");
    lines.push("**Design / branding**");
    lines.push(purposeSafe(p.design));
  }
  if (p.examples) {
    lines.push("");
    lines.push("**Examples**");
    lines.push(purposeSafe(p.examples));
  }
  if (p.notes) {
    lines.push("");
    lines.push("**Notes**");
    lines.push(purposeSafe(p.notes));
  }
  lines.push("");
  lines.push(`_Meta: ip=${meta.ip || "?"}, ua=${meta.ua || "?"}, ref=${meta.ref || "?"}_`);
  return lines.join("\n");
}

function purposeSafe(s: string) {
  return clampText(s, 1800);
}

function chunkDiscordContent(text: string, max = 1900): string[] {
  const out: string[] = [];
  let s = text.replace(/\r\n/g, "\n");
  while (s.length > 0) {
    if (s.length <= max) {
      out.push(s);
      break;
    }
    let cut = s.lastIndexOf("\n", max);
    if (cut < 200) cut = max;
    out.push(s.slice(0, cut).trimEnd());
    s = s.slice(cut).trimStart();
  }
  return out;
}

function normalizeDiscordBotToken(raw: string): string {
  let t = String(raw || "").trim();
  if (/^bot\s+/i.test(t)) t = t.replace(/^bot\s+/i, "").trim();
  return t;
}

function isDiscordSnowflake(id: string): boolean {
  return /^\d{10,25}$/.test(id);
}

async function sendDiscordDmChunks(botToken: string, recipientUserId: string, fullText: string): Promise<Response> {
  const auth = `Bot ${botToken}`;
  const dmRes = await fetch("https://discord.com/api/v10/users/@me/channels", {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ recipient_id: recipientUserId }),
  });
  if (!dmRes.ok) return dmRes;

  const dm = (await dmRes.json().catch(() => null)) as { id?: string } | null;
  const channelId = dm && typeof dm.id === "string" ? dm.id : "";
  if (!channelId) return new Response("bad_dm_channel", { status: 502 });

  const chunks = chunkDiscordContent(fullText, 1900);
  for (const chunk of chunks) {
    const msgRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: chunk }),
    });
    if (!msgRes.ok) return msgRes;
  }
  return new Response(null, { status: 204 });
}

async function sendDiscordChannelChunks(botToken: string, channelId: string, fullText: string): Promise<Response> {
  const chunks = chunkDiscordContent(fullText, 1900);
  for (const chunk of chunks) {
    const msgRes = await fetch(`https://discord.com/api/v10/channels/${encodeURIComponent(channelId)}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: chunk }),
    });
    if (!msgRes.ok) return msgRes;
  }
  return new Response(null, { status: 204 });
}

function json(status: number, body: unknown, cors: HeadersInit) {
  const h = new Headers(cors);
  h.set("Content-Type", "application/json; charset=utf-8");
  h.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(body), { status, headers: h });
}

function corsForRequest(request: Request): Headers {
  const origin = request.headers.get("Origin") || "";
  const allowed = /^https:\/\/(www\.)?rootrecord\.info$/i.test(origin);
  const h = new Headers();
  h.set("Access-Control-Allow-Origin", allowed ? origin : "https://rootrecord.info");
  h.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  h.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  h.set("Access-Control-Max-Age", "86400");
  return h;
}

function clientMeta(request: Request): Record<string, string> {
  const ip =
    request.headers.get("X-Rootrecord-Client-IP") ||
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "";
  const ua = request.headers.get("X-Rootrecord-Client-UA") || request.headers.get("User-Agent") || "";
  const ref = request.headers.get("X-Rootrecord-Client-Referer") || request.headers.get("Referer") || "";
  return { ip, ua, ref };
}

async function handlePost(request: Request, env: Env): Promise<Response> {
  const cors = corsForRequest(request);
  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return json(415, { error: "Expected application/json" }, cors);
  }

  let incoming: unknown;
  try {
    incoming = await request.json();
  } catch {
    return json(400, { error: "Invalid JSON" }, cors);
  }

  const p: AppBuildRequestPayload = {
    name: clampText((incoming as Record<string, unknown>)?.name, 120),
    company: clampText((incoming as Record<string, unknown>)?.company, 160),
    email: clampText((incoming as Record<string, unknown>)?.email, 200),
    phone: clampText((incoming as Record<string, unknown>)?.phone, 60),
    preferredContact: clampText((incoming as Record<string, unknown>)?.preferredContact, 40) || "email",
    timezone: clampText((incoming as Record<string, unknown>)?.timezone, 80),
    projectName: clampText((incoming as Record<string, unknown>)?.projectName, 160),
    purpose: clampText((incoming as Record<string, unknown>)?.purpose, 4000),
    users: clampText((incoming as Record<string, unknown>)?.users, 3000),
    platforms: clampText((incoming as Record<string, unknown>)?.platforms, 80),
    features: clampText((incoming as Record<string, unknown>)?.features, 6000),
    integrations: clampText((incoming as Record<string, unknown>)?.integrations, 4000),
    design: clampText((incoming as Record<string, unknown>)?.design, 3000),
    examples: clampText((incoming as Record<string, unknown>)?.examples, 3000),
    timeline: clampText((incoming as Record<string, unknown>)?.timeline, 40),
    budget: clampText((incoming as Record<string, unknown>)?.budget, 40),
    support: clampText((incoming as Record<string, unknown>)?.support, 40),
    notes: clampText((incoming as Record<string, unknown>)?.notes, 4000),
  };

  if (!p.name) return json(400, { error: "Name is required" }, cors);
  if (!p.email) return json(400, { error: "Email is required" }, cors);
  if (!isEmailLike(p.email)) return json(400, { error: "Email looks invalid" }, cors);
  if (!p.purpose) return json(400, { error: "Purpose is required" }, cors);
  if (!p.users) return json(400, { error: "Users / roles is required" }, cors);
  if (!p.platforms) return json(400, { error: "Platforms is required" }, cors);
  if (!p.features) return json(400, { error: "Key features is required" }, cors);
  if (!p.timeline) return json(400, { error: "Timeline is required" }, cors);
  if (!p.support) return json(400, { error: "Support selection is required" }, cors);

  const webhookUrl = String(env.APP_BUILD_REQUEST_WEBHOOK_URL || "").trim();
  const botToken = normalizeDiscordBotToken(String(env.APP_BUILD_DISCORD_BOT_TOKEN || ""));
  const dmUserId = String(env.APP_BUILD_DISCORD_DM_USER_ID || "").trim();

  if (!webhookUrl && (!botToken || !dmUserId)) {
    return json(
      503,
      {
        error:
          "Submission not configured: set APP_BUILD_REQUEST_WEBHOOK_URL and/or APP_BUILD_DISCORD_BOT_TOKEN + APP_BUILD_DISCORD_DM_USER_ID.",
      },
      cors,
    );
  }

  if (dmUserId && !isDiscordSnowflake(dmUserId)) {
    return json(503, { error: "APP_BUILD_DISCORD_DM_USER_ID must be your numeric Discord user ID (snowflake)." }, cors);
  }

  const meta = clientMeta(request);

  const headers = new Headers({ "Content-Type": "application/json" });
  const bearer = String(env.APP_BUILD_REQUEST_WEBHOOK_BEARER || "").trim();
  if (bearer) headers.set("Authorization", `Bearer ${bearer}`);

  const fullDiscordText = formatDiscordMessage(p, meta);

  if (webhookUrl) {
    const isDiscord = /(?:discord\.com|discordapp\.com)\/api\/webhooks\//i.test(webhookUrl);
    if (isDiscord) {
      const chunks = chunkDiscordContent(fullDiscordText, 1900);
      for (const chunk of chunks) {
        const upstream = await fetch(webhookUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({ content: chunk }),
        });
        if (!upstream.ok) {
          const text = await upstream.text().catch(() => "");
          return json(502, { error: "Discord webhook failed", status: upstream.status, detail: text.slice(0, 500) }, cors);
        }
      }
    } else {
      const upstreamBody = { type: "app_build_request", receivedAt: new Date().toISOString(), meta, payload: p };
      const upstream = await fetch(webhookUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(upstreamBody),
      });
      if (!upstream.ok) {
        const text = await upstream.text().catch(() => "");
        return json(502, { error: "Upstream webhook failed", status: upstream.status, detail: text.slice(0, 500) }, cors);
      }
    }
  }

  if (botToken && dmUserId) {
    const dmRes = await sendDiscordDmChunks(botToken, dmUserId, fullDiscordText);
    if (!dmRes.ok) {
      const text = await dmRes.text().catch(() => "");
      return json(
        502,
        {
          error: "Discord DM delivery failed (check bot token, user ID, and that the bot can DM you).",
          status: dmRes.status,
          detail: text.slice(0, 500),
        },
        cors,
      );
    }
  }

  return json(200, { ok: true }, cors);
}

function formatIosWaitlistMessage(p: IosWaitlistPayload, meta: Record<string, string>) {
  const lines: string[] = [];
  lines.push("**New iOS waitlist signup**");
  lines.push("");
  if (p.name) lines.push(`**Name:** ${p.name}`);
  lines.push(`**Email:** ${p.email}`);
  lines.push(`**Product:** ${p.product}`);
  if (p.notes) {
    lines.push("");
    lines.push("**Notes**");
    lines.push(purposeSafe(p.notes));
  }
  lines.push("");
  lines.push(`_Meta: ip=${meta.ip || "?"}, ua=${meta.ua || "?"}, ref=${meta.ref || "?"}_`);
  return lines.join("\n");
}

async function handleIosWaitlistPost(request: Request, env: Env): Promise<Response> {
  const cors = corsForRequest(request);
  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return json(415, { error: "Expected application/json" }, cors);
  }

  let incoming: Record<string, unknown>;
  try {
    incoming = (await request.json()) as Record<string, unknown>;
  } catch {
    return json(400, { error: "Invalid JSON" }, cors);
  }

  const p: IosWaitlistPayload = {
    name: clampText(incoming.name, 120),
    email: clampText(incoming.email, 200),
    product: clampText(incoming.product, 120) || "All RootRecord iOS apps",
    notes: clampText(incoming.notes, 1200),
  };

  if (!p.email) return json(400, { error: "Email is required" }, cors);
  if (!isEmailLike(p.email)) return json(400, { error: "Email looks invalid" }, cors);

  const botToken = normalizeDiscordBotToken(String(env.APP_BUILD_DISCORD_BOT_TOKEN || ""));
  const channelId = String(env.APP_BUILD_IOS_WAITLIST_CHANNEL_ID || DEFAULT_IOS_WAITLIST_CHANNEL_ID).trim();
  if (!botToken) return json(503, { error: "iOS waitlist is not configured: missing Discord bot token." }, cors);
  if (!isDiscordSnowflake(channelId)) return json(503, { error: "iOS waitlist Discord channel id is invalid." }, cors);

  const res = await sendDiscordChannelChunks(botToken, channelId, formatIosWaitlistMessage(p, clientMeta(request)));
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return json(
      502,
      {
        error: "Discord channel delivery failed.",
        status: res.status,
        detail: text.slice(0, 500),
      },
      cors,
    );
  }

  return json(200, { ok: true }, cors);
}

function formatVisitingHawaiiWaitlistMessage(p: VisitingHawaiiWaitlistPayload, meta: Record<string, string>) {
  const lines: string[] = [];
  lines.push("**New Visiting Hawaiʻi waitlist signup**");
  lines.push("");
  if (p.name) lines.push(`**Name:** ${p.name}`);
  lines.push(`**Email:** ${p.email}`);
  if (p.homeIsland) lines.push(`**Island focus:** ${p.homeIsland}`);
  if (p.travelWhen) lines.push(`**Travel timing:** ${p.travelWhen}`);
  if (p.platform) lines.push(`**Platform interest:** ${p.platform}`);
  if (p.notes) {
    lines.push("");
    lines.push("**Notes**");
    lines.push(purposeSafe(p.notes));
  }
  lines.push("");
  lines.push(`_Meta: ip=${meta.ip || "?"}, ua=${meta.ua || "?"}, ref=${meta.ref || "?"}_`);
  return lines.join("\n");
}

async function handleVisitingHawaiiWaitlistPost(request: Request, env: Env): Promise<Response> {
  const cors = corsForRequest(request);
  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return json(415, { error: "Expected application/json" }, cors);
  }

  let incoming: Record<string, unknown>;
  try {
    incoming = (await request.json()) as Record<string, unknown>;
  } catch {
    return json(400, { error: "Invalid JSON" }, cors);
  }

  const p: VisitingHawaiiWaitlistPayload = {
    name: clampText(incoming.name, 120),
    email: clampText(incoming.email, 200),
    homeIsland: clampText(incoming.homeIsland, 80),
    travelWhen: clampText(incoming.travelWhen, 120),
    platform: clampText(incoming.platform, 80),
    notes: clampText(incoming.notes, 1200),
  };

  if (!p.email) return json(400, { error: "Email is required" }, cors);
  if (!isEmailLike(p.email)) return json(400, { error: "Email looks invalid" }, cors);

  const botToken = normalizeDiscordBotToken(String(env.APP_BUILD_DISCORD_BOT_TOKEN || ""));
  const channelId = String(
    env.APP_BUILD_VISITING_HAWAII_WAITLIST_CHANNEL_ID || env.APP_BUILD_IOS_WAITLIST_CHANNEL_ID || DEFAULT_IOS_WAITLIST_CHANNEL_ID,
  ).trim();
  if (!botToken) return json(503, { error: "Waitlist is not configured: missing Discord bot token." }, cors);
  if (!isDiscordSnowflake(channelId)) return json(503, { error: "Waitlist Discord channel id is invalid." }, cors);

  const res = await sendDiscordChannelChunks(botToken, channelId, formatVisitingHawaiiWaitlistMessage(p, clientMeta(request)));
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return json(
      502,
      {
        error: "Discord channel delivery failed.",
        status: res.status,
        detail: text.slice(0, 500),
      },
      cors,
    );
  }

  return json(200, { ok: true }, cors);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsForRequest(request) });
    }

    if (request.method === "POST" && path === "/ios-waitlist") {
      return handleIosWaitlistPost(request, env);
    }

    if (request.method === "POST" && path === "/visiting-hawaii-waitlist") {
      return handleVisitingHawaiiWaitlistPost(request, env);
    }

    if (request.method === "POST" && (path === "/" || path === "/submit")) {
      return handlePost(request, env);
    }

    if (request.method === "GET" && path === "/") {
      const h = corsForRequest(request);
      h.set("Content-Type", "text/plain; charset=utf-8");
      return new Response("rootrecord-app-build: POST JSON to /, /submit, /ios-waitlist, or /visiting-hawaii-waitlist", {
        status: 200,
        headers: h,
      });
    }

    return new Response("Not found", { status: 404, headers: corsForRequest(request) });
  },
};
