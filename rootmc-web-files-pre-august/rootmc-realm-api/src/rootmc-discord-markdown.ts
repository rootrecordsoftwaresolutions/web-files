/** Split long markdown for Discord message content (2000 char limit). */

import { sendChannelMessage } from "./discord-rootmc-api";

const DISCORD_CONTENT_MAX = 1900;

/** Fix Grok output that jams section headers onto prior lines (Discord needs blank lines around headers). */
export function normalizeDiscordMarkdown(text: string): string {
  let out = String(text || "").trim();
  if (!out) return "";
  out = out.replace(/\r\n/g, "\n");

  const sectionTitles = [
    "Executive Summary",
    "Highlights",
    "Server Reserve",
    "Watch Items",
    "Outlook",
    "Economy",
    "Towns",
    "Nations",
  ];
  for (const title of sectionTitles) {
    const esc = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`^(#{1,3}\\s+${esc})\\s+(?=[A-Za-z*-])`, "gm"), "$1\n\n");
    out = out.replace(new RegExp(`([^\\n])\\s+(#{1,3}\\s+${esc})\\b`, "g"), "$1\n\n$2");
  }

  out = out.replace(/([^\n])\n(#{1,3} +)/g, "$1\n\n$2");
  out = out.replace(/([^\n#])(#{1,3} +)/g, "$1\n\n$2");
  out = out.replace(/^(#{1,3} +[^\n]+?)\s+(- )/gm, "$1\n\n$2");
  while (/^(- [^\n]+?) - /m.test(out)) {
    out = out.replace(/^(- [^\n]+?) - /gm, "$1\n- ");
  }
  out = out.replace(/([.!?])\s+-\s+/g, "$1\n- ");
  out = out.replace(/(#{1,3} +[^\n]+)\n(?!\n)/g, "$1\n\n");
  out = out.replace(/\n{3,}/g, "\n\n");
  return out.trim();
}

/** Remove Grok ## Server Reserve blocks — daily summary appends reserve figures separately. */
export function stripServerReserveSection(text: string): string {
  let out = String(text || "").trim();
  if (!out) return "";
  out = out.replace(/\n?#{1,3}\s*Server Reserve\b[\s\S]*?(?=\n#{1,3}\s|\s*$)/gi, "");
  return normalizeDiscordMarkdown(out);
}

export function splitDiscordMarkdown(text: string, max = DISCORD_CONTENT_MAX): string[] {
  const chunks: string[] = [];
  let rest = text.trim();
  while (rest.length > 0) {
    if (rest.length <= max) {
      chunks.push(rest);
      break;
    }
    let cut = rest.lastIndexOf("\n\n", max);
    if (cut < max * 0.45) cut = rest.lastIndexOf("\n", max);
    if (cut < max * 0.45) cut = max;
    chunks.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  return chunks.filter(Boolean);
}

export async function sendChannelMarkdownReport(
  token: string,
  channelId: string,
  parts: string[],
): Promise<string | null> {
  let firstId: string | null = null;
  for (const part of parts) {
    const id = await sendChannelMessage(token, channelId, { content: part });
    if (!firstId && id) firstId = id;
    if (!id) return firstId;
  }
  return firstId;
}

export function formatBriefMarkdown(params: {
  title: string;
  dayKey: string;
  timelineBlock?: string;
  summary?: string;
  report: string;
  footer?: string;
}): string {
  const lines = [`# ${params.title}`, `*${params.dayKey} HST*`];
  const timeline = params.timelineBlock?.trim();
  if (timeline) {
    lines.push("", "### Server status", timeline);
  }
  if (params.summary?.trim()) {
    lines.push("", `> ${params.summary.trim()}`);
  }
  const report = normalizeDiscordMarkdown(params.report);
  if (report) lines.push("", report);
  if (params.footer?.trim()) {
    lines.push("", `— *${params.footer.trim()}*`);
  }
  return lines.join("\n");
}

export const ROOTMC_NO_CHANGE_REPORT_TEXT = "No new information to generate a new report.";
