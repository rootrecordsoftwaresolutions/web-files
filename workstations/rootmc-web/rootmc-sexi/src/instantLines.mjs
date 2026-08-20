/**
 * Instant canned Ava lines — fire before Root Server digs.
 * No LLM. Keeps Discord feeling alive while context generation runs.
 */

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function stampNow() {
  const unix = Math.floor(Date.now() / 1000);
  return `<t:${unix}:t>`;
}

/** Wake / back-from-break — fire immediately (append stamp in poller). */
export const AVA_WAKES = [
  "yo I'm back",
  "mm alright I'm up",
  "back — what do you need",
  "ok I'm here again",
  "woke up, hit me",
  "back online, gimme the ask",
  "I'm up. one sec if it's deep",
  "hello again — listening",
  "break's over, what's up",
  "kk I'm back on",
  "resurfaced. talk to me",
  "back in the chat",
  "mm waking up — go ahead",
  "I'm here. fire away",
  "alright I'm live again",
  "back. don't make me regret it",
  "up. ask clean if you want a fast answer",
  "I'm back — dig starts after this",
  "yo. break ended",
  "online. what we doing",
  "mm hey — I'm awake",
  "back at it",
  "I'm here now",
  "okok I'm up, talk",
  "returned. what's the problem",
];

/** Instant first ack — always fire right away on ping. */
export const AVA_ACKS = [
  "mmmm..... idk.... let me search that for you",
  "hmm wait — give me a sec, pulling it up…",
  "okok hold on, let me dig real quick…",
  "mmm not sure yet — searching…",
  "hang onnn… checking…",
  "one sec, let me look…",
  "ngl idk offhand — give me a moment…",
  "wait wait — searching that for you…",
  "kk — digging…",
  "sec, verifying against the files…",
  "bet — looking now",
  "on it, hold up",
  "lemme check the packs real quick",
  "pulling wiki + notes…",
  "okaay searching",
  "give me a beat",
  "mm digging files",
  "checking changelogs…",
  "one moment — accuracy over vibes",
  "hold — reading",
  "sec sec",
  "looking that up",
  "alright I'm on it",
  "grabbing context…",
  "mm wait I wanna get this right",
  "digging — don't spam me",
  "qk check…",
  "opening the notes…",
  "lemme verify before I yap",
  "searching RootMC side…",
  "pulling it…",
  "hang tight",
  "working",
  "on the hunt",
  "mmmm checking",
  "idk yet — searching",
  "gimme a sec to be accurate",
  "files first, then I answer",
  "brb in my brain",
  "loading the relevant bits…",
  "got the ping — digging",
  "aye, looking",
  "checking what we actually shipped…",
  "wiki peek incoming…",
  "notes check…",
  "log/wiki scan…",
  "real quick dig",
  "I gotchu — searching",
  "wait I need the real answer",
  "hold on I'm not guessing this",
];

/**
 * Transfer beat 2 — queue delay / taking longer than a snappy dig.
 * Fire when Root Server is busy or elapsed ~beat2.
 */
export const AVA_HOLD_2 = [
  "still digging — queue's moving",
  "mm this one's taking a sec longer",
  "still on it, not ghosting you",
  "transfer — deeper look",
  "hold up, still reading",
  "yeah still searching…",
  "almost — verifying",
  "still in the files",
  "patience, accuracy mode",
  "mmmm still pulling",
  "not done yet — keep hanging",
  "second pass…",
  "still cooking the answer",
  "queue hop — still yours",
  "taking a little longer, worth it",
  "still here, still digging",
  "one more check…",
  "transferring to a deeper dig",
  "brain's busy — you're next / in progress",
  "still working that ask",
  "mm wait almost",
  "don't leave — still on this",
  "longer dig than I hoped, stay",
  "still verifying against packs",
  "halfway-ish — hang on",
  "context's heavy, still going",
  "aye still searching",
  "not stuck — just careful",
  "second beat: still looking",
  "transfer 2 — keep waiting",
];

/**
 * Transfer beat 3 — deep queue / long generation.
 * Fire when 2nd–3rd job ahead or elapsed ~beat3.
 */
export const AVA_HOLD_3 = [
  "okay this is a long dig — still with you",
  "third beat: still working, not dead",
  "Root Server's chewing — hang tight",
  "queue was stacked — almost there",
  "yeah I know it's been a minute…",
  "still digging, swear",
  "long transfer — answer incoming",
  "heavy context, still processing",
  "mmmm almost done I hope",
  "last stretch — stay",
  "still on your ask, deep pass",
  "taking forever but I'd rather be right",
  "transfer 3 — final hold",
  "brain backlog cleared soon",
  "still alive, still searching",
  "long one — thanks for waiting",
  "deep dig mode, nearly back",
  "okay seriously still going",
  "not abandoned — just slow files",
  "final hold before I reply",
  "stacked asks ahead of / with you — almost",
  "patience tax — still digging",
  "mm yeah this needed the long path",
  "third ping of patience — still me",
  "coming, coming…",
];

/** When already 2+ jobs in the brain queue at ack time. */
export const AVA_QUEUE_WARN = [
  "heads up — I'm mid another dig, you're queued",
  "got you, but Root Server's busy — short wait",
  "you're 2nd in line — instant ack, real answer soon",
  "stacked ask — I'll get to you right after this",
  "queue transfer: you're next / near next",
  "busy brain — parked your ask, digging in order",
  "mm wait I'm finishing something else first",
  "ack'd — behind one job on the Root Server",
];

export function pickAck() {
  return pick(AVA_ACKS);
}

export function pickWake(includeStamp = true) {
  const line = pick(AVA_WAKES);
  return includeStamp ? `${line} — ${stampNow()}` : line;
}

export function pickHold(beat = 2) {
  if (beat >= 3) return pick(AVA_HOLD_3);
  return pick(AVA_HOLD_2);
}

export function pickQueueWarn() {
  return pick(AVA_QUEUE_WARN);
}

/**
 * Instant opener for a ping.
 * @param {{ fromBreak?: boolean, queueDepth?: number }} opts
 */
export function pickInstantOpen({ fromBreak = false, queueDepth = 0 } = {}) {
  if (fromBreak) return pickWake(true);
  if (queueDepth >= 2) return `${pickQueueWarn()} · ${pickAck()}`;
  if (queueDepth >= 1) return `${pickAck()} (someone else is mid-dig — you're queued)`;
  return pickAck();
}

/** Beat delays (ms). Faster when already queued. */
export function holdBeatDelays(queueDepth = 0) {
  if (queueDepth >= 2) return { beat2: 3_500, beat3: 10_000 };
  if (queueDepth >= 1) return { beat2: 5_000, beat3: 14_000 };
  return { beat2: 9_000, beat3: 22_000 };
}
