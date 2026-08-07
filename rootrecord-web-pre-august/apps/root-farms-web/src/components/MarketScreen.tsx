import { useEffect, useMemo, useState } from "react";
import { useGame } from "../contexts/GameContext";
import { formatRu } from "../game/format";
import {
  fetchDiceMarket,
  fetchMarketHiLoState,
  postDiceCancel,
  postDiceJoin,
  postDiceRequest,
  postMarketHiLoCashOut,
  postMarketHiLoGuess,
  postMarketHiLoStart,
  postMarketDonation,
  postMarketMonthlyPass,
  postMarketRouletteSpin,
  postMarketWheelSpin,
  type DiceMarketRequest,
  type MarketLimit,
  type MarketHiLoResponse,
  type MarketRouletteSpinResponse,
} from "../lib/farmsApi";

const ATOMIC_PER_ROOT = 100_000_000;
const MIN_DICE_STAKE = 100_000;
const MAX_DICE_STAKE = 100_000_000;
const MARKET_GAME_MIN_STAKE = 100_000;
const MARKET_GAME_MAX_STAKE = 10_000_000;
const WHEEL_SPIN_COST = 100_000;
const MONTHLY_PASS_COST = 150 * ATOMIC_PER_ROOT;
const ROULETTE_NUMBERS = Array.from({ length: 37 }, (_, i) => i);
const ROULETTE_RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const ROULETTE_TABLE_ROWS = [
  [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
  [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
  [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
];
const WHEEL_SEGMENTS = [
  ...Array.from({ length: 52 }, () => ({ label: "0.0001", className: "wheel-segment--common" })),
  ...Array.from({ length: 18 }, () => ({ label: "0.0005", className: "wheel-segment--small" })),
  ...Array.from({ length: 14 }, () => ({ label: "0.001", className: "wheel-segment--break-even" })),
  ...Array.from({ length: 10 }, () => ({ label: "0.0015", className: "wheel-segment--small-win" })),
  ...Array.from({ length: 4 }, () => ({ label: "0.0025", className: "wheel-segment--rare" })),
  { label: "0.01", className: "wheel-segment--rare" },
  { label: "1", className: "wheel-segment--jackpot" },
];

function parseRootsAmount(raw: string): number {
  const trimmed = raw.trim();
  if (!/^\d+(\.\d{0,8})?$/.test(trimmed)) return 0;
  const [whole, frac = ""] = trimmed.split(".");
  const wholeAtomic = Number(whole) * ATOMIC_PER_ROOT;
  const fracAtomic = Number((frac + "00000000").slice(0, 8));
  const total = wholeAtomic + fracAtomic;
  return Number.isFinite(total) ? Math.floor(total) : 0;
}

function formatDate(raw: string | null): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatSignedRu(n: number): string {
  if (n === 0) return formatRu(0);
  const sign = n > 0 ? "+" : "-";
  return `${sign}${formatRu(Math.abs(n))}`;
}

function cardSuitSymbol(suit: string): string {
  if (suit === "hearts") return "♥";
  if (suit === "diamonds") return "♦";
  if (suit === "clubs") return "♣";
  return "♠";
}

function cardRankOnly(label: string): string {
  return label.replace(/[♥♦♣♠]/g, "") || "?";
}

function rouletteNumberColor(n: number): "red" | "black" | "green" {
  if (n === 0) return "green";
  return ROULETTE_RED_NUMBERS.has(n) ? "red" : "black";
}

function resultLabel(req: DiceMarketRequest): string {
  if (req.status === "open") return "Open";
  if (req.status === "cancelled") return "Cancelled, stake refunded";
  if (req.status === "tie") return "Tie, both stakes refunded";
  return req.winner_label ? `${req.winner_label} won` : "Resolved";
}

function marketLimitText(limit?: MarketLimit): string {
  if (!limit) return "Wheel, roulette, and Hi-Lo: max bet 0.1 ROOTS, max payout 1 ROOT, rolling 24-hour wins/losses limit 1 ROOT.";
  const base = `${formatRu(limit.used)} of ${formatRu(limit.limit)} rolling wins/losses used.`;
  if (!limit.locked) return `${base} ${formatRu(limit.remaining)} left before a 24-hour Well lock.`;
  const until = limit.locked_until ? ` until ${formatDate(limit.locked_until)}` : "";
  return `${base} The Well is locked${until}.`;
}

export function MarketScreen() {
  const { rootLevel, balanceReady, spendableBalance, refreshServerBalance, handleInsufficientFunds } = useGame();
  const [stakeInput, setStakeInput] = useState("0.001");
  const [donationInput, setDonationInput] = useState("0.001");
  const [rouletteStakeInput, setRouletteStakeInput] = useState("0.001");
  const [rouletteBet, setRouletteBet] = useState("red");
  const [rouletteNumber, setRouletteNumber] = useState("7");
  const [rouletteNote, setRouletteNote] = useState("");
  const [rouletteResult, setRouletteResult] = useState<MarketRouletteSpinResponse | null>(null);
  const [hiLoStakeInput, setHiLoStakeInput] = useState("0.001");
  const [hiLoNote, setHiLoNote] = useState("");
  const [hiLoRound, setHiLoRound] = useState<MarketHiLoResponse | null>(null);
  const [hiLoLastDraw, setHiLoLastDraw] = useState<MarketHiLoResponse | null>(null);
  const [requests, setRequests] = useState<DiceMarketRequest[]>([]);
  const [marketLimit, setMarketLimit] = useState<MarketLimit | undefined>();
  const [note, setNote] = useState("");
  const [memberPassNote, setMemberPassNote] = useState("");
  const [wheelNote, setWheelNote] = useState("");
  const [wheelRotation, setWheelRotation] = useState(0);
  const [wheelPrize, setWheelPrize] = useState("");
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const stakeAtomic = useMemo(() => parseRootsAmount(stakeInput), [stakeInput]);
  const donationAtomic = useMemo(() => parseRootsAmount(donationInput), [donationInput]);
  const rouletteStakeAtomic = useMemo(() => parseRootsAmount(rouletteStakeInput), [rouletteStakeInput]);
  const hiLoStakeAtomic = useMemo(() => parseRootsAmount(hiLoStakeInput), [hiLoStakeInput]);
  const stakeValid = stakeAtomic >= MIN_DICE_STAKE && stakeAtomic <= MAX_DICE_STAKE;
  const donationValid = donationAtomic > 0;
  const rouletteStakeValid = rouletteStakeAtomic >= MARKET_GAME_MIN_STAKE && rouletteStakeAtomic <= MARKET_GAME_MAX_STAKE;
  const hiLoStakeValid = hiLoStakeAtomic >= MARKET_GAME_MIN_STAKE && hiLoStakeAtomic <= MARKET_GAME_MAX_STAKE;
  const mintLevelReady = rootLevel >= 30;

  const load = async () => {
    setLoading(true);
    const data = await fetchDiceMarket();
    const hiLoState = await fetchMarketHiLoState();
    if (data) {
      setRequests(data.requests);
      setMarketLimit(data.market_limit);
      setNote(data.detail || "");
    } else {
      setNote("Could not load The Well. Try again after reconnecting.");
    }
    if (hiLoState?.active) {
      setHiLoRound(hiLoState);
      setHiLoNote(hiLoState.detail || "Active Hi-Lo round restored.");
    }
    if (hiLoState?.market_limit) setMarketLimit(hiLoState.market_limit);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const applyMarketResponse = async (data: Awaited<ReturnType<typeof postDiceRequest>>) => {
    if (!data) {
      setNote("The Well action failed. Try again after reconnecting.");
      return;
    }
    setRequests(data.requests);
    setMarketLimit(data.market_limit);
    setNote(data.detail || "The Well updated.");
    await refreshServerBalance();
    if (data.detail?.toLowerCase().includes("insufficient")) {
      await handleInsufficientFunds();
    }
  };

  const createRequest = async () => {
    if (!stakeValid || busy) return;
    setBusy(true);
    try {
      await applyMarketResponse(await postDiceRequest(stakeAtomic));
    } finally {
      setBusy(false);
    }
  };

  const joinRequest = async (id: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await applyMarketResponse(await postDiceJoin(id));
    } finally {
      setBusy(false);
    }
  };

  const cancelRequest = async (id: string, stake: number) => {
    if (busy) return;
    const ok = window.confirm(`Cancel this dice request and refund ${formatRu(stake)}?`);
    if (!ok) return;
    setBusy(true);
    try {
      await applyMarketResponse(await postDiceCancel(id));
    } finally {
      setBusy(false);
    }
  };

  const donateToFarmers = async () => {
    if (!donationValid || busy) return;
    const ok = window.confirm(`Donate ${formatRu(donationAtomic)} split equally across all other Root Farms players?`);
    if (!ok) return;
    setBusy(true);
    try {
      await applyMarketResponse(await postMarketDonation(donationAtomic));
    } finally {
      setBusy(false);
    }
  };

  const buyMonthlyPass = async () => {
    if (busy) return;
    const ok = window.confirm(`Convert ${formatRu(MONTHLY_PASS_COST)} into a 30-day monthly membership pass?`);
    if (!ok) return;
    setBusy(true);
    setMemberPassNote("");
    try {
      const result = await postMarketMonthlyPass();
      if (!result) {
        setMemberPassNote("Monthly pass conversion failed. Try again after reconnecting.");
        return;
      }
      setMemberPassNote(result.detail || "Monthly membership pass active.");
      await refreshServerBalance();
      if (result.detail?.toLowerCase().includes("need ")) await handleInsufficientFunds();
    } finally {
      setBusy(false);
    }
  };

  const spinWheel = async () => {
    if (busy || wheelSpinning) return;
    setBusy(true);
    setWheelSpinning(true);
    setWheelNote("");
    setWheelPrize("");
    try {
      const result = await postMarketWheelSpin();
      if (!result) {
        setWheelNote("Wheel spin failed. Try again after reconnecting.");
        return;
      }
      if (result.detail) {
        setMarketLimit(result.market_limit);
        setWheelNote(result.detail);
        if (result.detail.toLowerCase().includes("insufficient")) await handleInsufficientFunds();
        return;
      }
      setMarketLimit(result.market_limit);
      const targetRotation = 360 - (result.visual_index * 360) / WHEEL_SEGMENTS.length;
      setWheelRotation((current) => current + 1440 + targetRotation);
      setWheelPrize(result.label || formatRu(result.prize));
      setWheelNote(`Cost ${formatRu(result.cost)} · prize ${formatRu(result.prize)} · net ${formatSignedRu(result.net)}`);
      await refreshServerBalance();
    } finally {
      window.setTimeout(() => setWheelSpinning(false), 1700);
      setBusy(false);
    }
  };

  const playRoulette = async () => {
    if (!rouletteStakeValid || busy) return;
    setBusy(true);
    setRouletteNote("");
    setRouletteResult(null);
    try {
      const result = await postMarketRouletteSpin(
        rouletteStakeAtomic,
        rouletteBet,
        rouletteBet === "straight" ? Math.max(0, Math.min(36, Math.floor(Number(rouletteNumber) || 0))) : undefined,
      );
      if (!result) {
        setRouletteNote("Roulette failed. Try again after reconnecting.");
        return;
      }
      if (result.detail) {
        setMarketLimit(result.market_limit);
        setRouletteNote(result.detail);
        if (result.detail.toLowerCase().includes("insufficient")) await handleInsufficientFunds();
        return;
      }
      const outcome = `${result.outcome_number} ${result.outcome_color}`;
      setRouletteResult(result);
      setMarketLimit(result.market_limit);
      setRouletteNote(
        `${result.won ? "Won" : "Lost"} on ${outcome}. Payout ${formatRu(result.payout)}${
          result.payout_capped ? " (1 ROOT cap)" : ""
        } · net ${formatSignedRu(result.net)}`,
      );
      await refreshServerBalance();
    } finally {
      setBusy(false);
    }
  };

  const startHiLo = async () => {
    if (!hiLoStakeValid || busy) return;
    setBusy(true);
    setHiLoNote("");
    setHiLoLastDraw(null);
    try {
      const result = await postMarketHiLoStart(hiLoStakeAtomic);
      if (!result) {
        setHiLoNote("Hi-Lo start failed. Try again after reconnecting.");
        return;
      }
      if (result.detail) {
        setHiLoNote(result.detail);
        if (result.detail.toLowerCase().includes("insufficient")) await handleInsufficientFunds();
      }
      setMarketLimit(result.market_limit);
      setHiLoRound(result.active ? result : null);
      await refreshServerBalance();
    } finally {
      setBusy(false);
    }
  };

  const guessHiLo = async (guess: "high" | "low") => {
    if (!hiLoRound?.active || busy) return;
    setBusy(true);
    setHiLoNote("");
    try {
      const result = await postMarketHiLoGuess(guess);
      if (!result) {
        setHiLoNote("Hi-Lo draw failed. Try again after reconnecting.");
        return;
      }
      setHiLoLastDraw(result);
      setHiLoRound(result.active ? result : null);
      setMarketLimit(result.market_limit);
      const outcome = result.tie ? "Push" : result.won ? "Correct" : "Bust";
      const next = result.next_label || result.current_label || "?";
      const bank = result.bank != null ? formatRu(result.bank) : formatRu(0);
      const net = result.net != null ? ` · net ${formatSignedRu(result.net)}` : "";
      setHiLoNote(`${outcome}: drew ${next}. Bank ${bank}${net}`);
      await refreshServerBalance();
    } finally {
      setBusy(false);
    }
  };

  const cashOutHiLo = async () => {
    if (!hiLoRound?.active || busy) return;
    setBusy(true);
    setHiLoNote("");
    try {
      const result = await postMarketHiLoCashOut();
      if (!result) {
        setHiLoNote("Hi-Lo cash out failed. Try again after reconnecting.");
        return;
      }
      setHiLoLastDraw(result);
      setHiLoRound(null);
      setMarketLimit(result.market_limit);
      const payout = result.payout ?? result.bank ?? 0;
      setHiLoNote(`Cashed out ${formatRu(payout)}${result.net != null ? ` · net ${formatSignedRu(result.net)}` : ""}`);
      await refreshServerBalance();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen market-screen">
      <header className="screen-header">
        <h1>The Well</h1>
        <p className="screen-lead">
          Gather around The Well to post ROOTS dice requests, spin the wheel, play roulette, try Hi-Lo, or donate to
          other farmers.
        </p>
        <p className="market-note market-note--warn">
          Game disclaimer: dice is player-to-player and excluded from house-game limits. Wheel, roulette, and Hi-Lo
          cap bets at 0.1 ROOTS, cap payouts at 1 ROOT, and lock for 24 hours after a rolling 1 ROOT in wins or losses.
          {" "}{marketLimitText(marketLimit)}
        </p>
      </header>

      <section className="market-panel market-panel--dice">
        <div className="market-panel-head">
          <div>
            <h2>Dice requests</h2>
            <p>Player-to-player dice. Minimum stake 0.001 ROOTS. Maximum stake 1 ROOTS.</p>
          </div>
          <div className="market-balance">
            <span>Available</span>
            <strong>{balanceReady ? formatRu(spendableBalance) : "Loading..."}</strong>
          </div>
        </div>

        <div className="dice-create-row">
          <label className="dice-stake-field">
            Stake
            <input
              value={stakeInput}
              inputMode="decimal"
              placeholder="0.001"
              onChange={(e) => setStakeInput(e.target.value)}
            />
          </label>
          <button type="button" className="btn btn-primary" disabled={busy || !stakeValid} onClick={() => void createRequest()}>
            {busy ? "Posting..." : `Post dice request (${stakeValid ? formatRu(stakeAtomic) : "invalid"})`}
          </button>
        </div>
        {!stakeValid ? <p className="market-note market-note--warn">Enter 0.001 to 1 ROOTS.</p> : null}
        {note ? <p className="market-note">{note}</p> : null}
      </section>

      <section className="market-panel market-panel--wheel">
        <div className="market-panel-head">
          <div>
            <h2>Spin the wheel</h2>
            <p>
              Costs {formatRu(WHEEL_SPIN_COST)} per spin. The wheel has 100 visual pegs, about 30% break-even or better,
              and a rare 1 ROOT jackpot.
            </p>
          </div>
          <span className="market-lock-badge">100 pegs</span>
        </div>
        <div className="wheel-layout">
          <div className="market-wheel-wrap">
            <div className="market-wheel-pointer" aria-hidden />
            <div className="market-wheel" style={{ transform: `rotate(${wheelRotation}deg)` }}>
              {WHEEL_SEGMENTS.map((segment, i) => (
                <span
                  key={i}
                  className={`wheel-segment ${segment.className}`}
                  style={{ transform: `rotate(${(i * 360) / WHEEL_SEGMENTS.length}deg) translateY(-8.25rem)` }}
                >
                  {segment.label}
                </span>
              ))}
            </div>
            <div className="market-wheel-center">ROOTS</div>
          </div>
          <div className="wheel-actions">
            <p className="market-note">
              Long-run return is about 93%, so The Well still has a small house edge while the spin can actually pay.
            </p>
            <button type="button" className="btn btn-primary" disabled={busy || wheelSpinning} onClick={() => void spinWheel()}>
              {wheelSpinning ? "Spinning..." : `Spin for ${formatRu(WHEEL_SPIN_COST)}`}
            </button>
            {wheelPrize ? <p className="wheel-prize">Landed on {wheelPrize}</p> : null}
            {wheelNote ? <p className="market-note">{wheelNote}</p> : null}
          </div>
        </div>
      </section>

      <section className="market-panel market-panel--roulette">
          <div className="market-panel-head">
            <div>
              <h2>Roulette table</h2>
              <p>
                Bet 0.001 to 0.1 ROOTS. Red/black, odd/even, and low/high pay 2x. Zero and straight numbers pay 36x
                before the 1 ROOT payout cap.
              </p>
            </div>
            <span className="market-lock-badge">0-36</span>
          </div>
          <div className="roulette-graphic" aria-label="Roulette table graphic">
            <div className="roulette-wheel-graphic">
              <div className={`roulette-ball roulette-ball--${rouletteResult?.outcome_color || "idle"}`}>
                {rouletteResult ? rouletteResult.outcome_number : "?"}
              </div>
            </div>
            <div className="roulette-felt">
              <button
                type="button"
                className={`roulette-cell roulette-cell--green${rouletteBet === "green" ? " roulette-cell--selected" : ""}`}
                onClick={() => setRouletteBet("green")}
              >
                0
              </button>
              <div className="roulette-number-grid">
                {ROULETTE_TABLE_ROWS.flat().map((n) => (
                  <button
                    type="button"
                    key={n}
                    className={`roulette-cell roulette-cell--${rouletteNumberColor(n)}${
                      rouletteBet === "straight" && rouletteNumber === String(n) ? " roulette-cell--selected" : ""
                    }`}
                    onClick={() => {
                      setRouletteBet("straight");
                      setRouletteNumber(String(n));
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="dice-create-row">
            <label className="dice-stake-field">
              Stake
              <input
                value={rouletteStakeInput}
                inputMode="decimal"
                placeholder="0.001"
                onChange={(e) => setRouletteStakeInput(e.target.value)}
              />
            </label>
            <label className="dice-stake-field">
              Bet
              <select value={rouletteBet} onChange={(e) => setRouletteBet(e.target.value)}>
                <option value="red">Red</option>
                <option value="black">Black</option>
                <option value="green">Zero</option>
                <option value="odd">Odd</option>
                <option value="even">Even</option>
                <option value="low">Low 1-18</option>
                <option value="high">High 19-36</option>
                <option value="straight">Straight number</option>
              </select>
            </label>
            {rouletteBet === "straight" ? (
              <label className="dice-stake-field dice-stake-field--small">
                Number
                <select value={rouletteNumber} onChange={(e) => setRouletteNumber(e.target.value)}>
                  {ROULETTE_NUMBERS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <button type="button" className="btn btn-primary" disabled={busy || !rouletteStakeValid} onClick={() => void playRoulette()}>
              {busy ? "Spinning..." : `Play roulette (${rouletteStakeValid ? formatRu(rouletteStakeAtomic) : "invalid"})`}
            </button>
          </div>
          {!rouletteStakeValid ? <p className="market-note market-note--warn">Enter 0.001 to 0.1 ROOTS.</p> : null}
          {rouletteNote ? <p className="market-result">{rouletteNote}</p> : null}
      </section>

      <section className="market-panel market-panel--hilo">
          <div className="market-panel-head">
            <div>
              <h2>Hi-Lo</h2>
              <p>
                Start with one real card face up. Each correct guess grows the round bank by 1.95x. Cash out anytime,
                but a wrong guess loses the bank. Round bank maxes at 1 ROOT.
              </p>
            </div>
            <span className="market-lock-badge">A-K</span>
          </div>
          <div className="hilo-table">
            <div className="playing-card playing-card--back" aria-label="Card deck">
              <span>ROOT</span>
            </div>
            <div
              className={`playing-card playing-card--${hiLoRound?.current_suit || hiLoLastDraw?.current_suit || "spades"}`}
              aria-label={`Current card ${hiLoRound?.current_label || hiLoLastDraw?.current_label || "not drawn"}`}
            >
              <span className="playing-card-rank">{cardRankOnly(hiLoRound?.current_label || hiLoLastDraw?.current_label || "?")}</span>
              <span className="playing-card-suit">{cardSuitSymbol(hiLoRound?.current_suit || hiLoLastDraw?.current_suit || "spades")}</span>
              <span className="playing-card-rank playing-card-rank--bottom">
                {cardRankOnly(hiLoRound?.current_label || hiLoLastDraw?.current_label || "?")}
              </span>
            </div>
            <div className="hilo-bank">
              <span>{hiLoRound?.active ? "Round bank" : "No active round"}</span>
              <strong>{formatRu(hiLoRound?.bank ?? 0)}</strong>
              {hiLoRound?.rounds ? <small>{hiLoRound.rounds} correct</small> : <small>Draw first card to start</small>}
            </div>
          </div>
          <div className={`dice-create-row${hiLoRound?.active ? " hilo-action-row" : ""}`}>
            {!hiLoRound?.active ? (
              <label className="dice-stake-field">
                Stake
                <input
                  value={hiLoStakeInput}
                  inputMode="decimal"
                  placeholder="0.001"
                  onChange={(e) => setHiLoStakeInput(e.target.value)}
                />
              </label>
            ) : null}
            {hiLoRound?.active ? (
              <>
                <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void guessHiLo("high")}>
                  {busy ? "Drawing..." : "Higher"}
                </button>
                <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void guessHiLo("low")}>
                  {busy ? "Drawing..." : "Lower"}
                </button>
                <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void cashOutHiLo()}>
                  Cash out {formatRu(hiLoRound.bank)}
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-primary" disabled={busy || !hiLoStakeValid} onClick={() => void startHiLo()}>
                {busy ? "Drawing..." : `Start Hi-Lo (${hiLoStakeValid ? formatRu(hiLoStakeAtomic) : "invalid"})`}
              </button>
            )}
          </div>
          {!hiLoRound?.active && !hiLoStakeValid ? <p className="market-note market-note--warn">Enter 0.001 to 0.1 ROOTS.</p> : null}
          {hiLoNote ? <p className="market-result">{hiLoNote}</p> : null}
      </section>

      <section className="market-panel market-panel--donate">
        <div className="market-panel-head">
          <div>
            <h2>Community donation</h2>
            <p>
              Donate internal ROOTS to The Well. The amount is split evenly across every other signed-in Root
              Farms account.
            </p>
          </div>
        </div>
        <div className="dice-create-row">
          <label className="dice-stake-field">
            Donation amount
            <input
              value={donationInput}
              inputMode="decimal"
              placeholder="0.001"
              onChange={(e) => setDonationInput(e.target.value)}
            />
          </label>
          <button type="button" className="btn btn-primary" disabled={busy || !donationValid} onClick={() => void donateToFarmers()}>
            {busy ? "Donating..." : `Donate to everyone (${donationValid ? formatRu(donationAtomic) : "invalid"})`}
          </button>
        </div>
      </section>

      <section className="market-panel market-panel--membership">
        <div className="market-panel-head">
          <div>
            <h2>Monthly membership pass</h2>
            <p>
              Convert {formatRu(MONTHLY_PASS_COST)} into a 30-day RootRecord monthly membership pass. This activates
              the Monthly Member Tree so players can earn the member perk through gameplay too.
            </p>
          </div>
          <span className="market-lock-badge">Member perk</span>
        </div>
        <div className="dice-create-row">
          <a className="btn btn-ghost" href="https://rootrecord.info/billing.html">
            Become a member
          </a>
          <button type="button" className="btn btn-primary" disabled={busy || !balanceReady} onClick={() => void buyMonthlyPass()}>
            {busy ? "Converting..." : `Convert ${formatRu(MONTHLY_PASS_COST)}`}
          </button>
        </div>
        {memberPassNote ? <p className="market-result">{memberPassNote}</p> : null}
      </section>

      <section className="market-section">
        <div className="section-head">
          <span>Dice board</span>
          <button type="button" className="btn btn-ghost btn-sm" disabled={loading || busy} onClick={() => void load()}>
            Refresh
          </button>
        </div>
        {loading ? (
          <p className="market-note">Loading The Well...</p>
        ) : requests.length === 0 ? (
          <article className="plot-card market-empty-card">
            <p className="plot-sub">No dice requests yet. Post the first one.</p>
          </article>
        ) : (
          <div className="market-dice-grid">
            {requests.map((req) => (
              <article key={req.id} className={`plot-card market-dice-card${req.status === "open" ? " market-dice-card--open" : ""}`}>
                <div className="plot-card-top">
                  <div className="plot-card-main">
                    <span className="plot-name">
                      {formatRu(req.stake)} dice request
                      {req.status === "open" ? <span className="plot-dot" aria-label="open" /> : null}
                    </span>
                    <span className="plot-sub plot-sub--sci">{req.creator_label}</span>
                    <span className="plot-sub">{formatDate(req.created_at)}</span>
                  </div>
                  <span className="plot-yield">
                    {req.status === "open" ? "D6" : `${req.creator_roll ?? "-"}-${req.joiner_roll ?? "-"}`}
                    <small>{req.status === "open" ? "open" : "rolls"}</small>
                  </span>
                </div>
                <p className={`market-result${req.status === "open" ? "" : " market-result--done"}`}>{resultLabel(req)}</p>
                {req.joiner_label ? <p className="plot-sub">Joined by {req.joiner_label}</p> : null}
                {req.status === "open" && req.can_join ? (
                  <button type="button" className="btn btn-primary btn-sm market-join-btn" disabled={busy} onClick={() => void joinRequest(req.id)}>
                    Join for {formatRu(req.stake)}
                  </button>
                ) : req.status === "open" && req.can_cancel ? (
                  <div className="market-dice-actions">
                    <p className="market-note">Waiting for another farmer to join.</p>
                    <button type="button" className="btn btn-ghost btn-sm market-join-btn" disabled={busy} onClick={() => void cancelRequest(req.id, req.stake)}>
                      Cancel and refund
                    </button>
                  </div>
                ) : req.status === "open" && req.is_mine ? (
                  <p className="market-note">Waiting for result.</p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className={`market-panel market-panel--mint${mintLevelReady ? "" : " market-panel--locked"}`}>
        <div className="market-panel-head">
          <div>
            <h2>Mint Machine</h2>
            <p>
              Coming soon for farm level 30. Combined root and vegetable plots plus row counts all contribute to this
              level.
            </p>
          </div>
          <span className="market-lock-badge">{mintLevelReady ? "Level 30 ready" : `Level ${rootLevel}/30`}</span>
        </div>
      </section>
    </div>
  );
}
