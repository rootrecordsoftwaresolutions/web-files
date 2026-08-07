import React, { useEffect, useState } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { api } from "../../lib/api";
import { ScreenHeader, PageContainer, Section, Spinner, Empty, Toast, useToast } from "../ui/Shell";
import { fmtMoney, fmtMoneyCompact, fmtHours, MONTHS_SHORT, isoNow, durationHours } from "../../lib/format";
import {
  computeDashboardRange,
  dashboardTimeZoneCaption,
  liveSessionHoursInRange,
  formatWeekRangeLabel,
} from "../../lib/dashboardRanges";
import { loadProgramSettingsLocal } from "../../lib/programSettings";
import { rechartsTooltipProps } from "../../lib/rechartsTooltipProps";
import { TrendingUp, AlertCircle, Code, Users, FileSearch, Zap, Square, Play, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

const ICON_MAP = { Code, Users, FileSearch, Zap, Play };

export default function Dashboard() {
  const { guest, user } = useAuth();
  const nav = useNavigate();
  const { toast, show, clear } = useToast();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [scope, setScope] = useState("year"); // year | month | week | today
  const [monthIdx, setMonthIdx] = useState(new Date().getMonth());
  const [weekOffset, setWeekOffset] = useState(0);
  const year = new Date().getFullYear();
  const [businessTimezone, setBusinessTimezone] = useState(() => loadProgramSettingsLocal().business_timezone || "system");

  // Quick actions state
  const [quickActions, setQuickActions] = useState([]);
  const [session, setSession] = useState(null);
  const [tickN, setTickN] = useState(0); // re-render every 30s while clocked in
  const needsSlidingRangeEnd = scope === "today" || scope === "year";

  const [start, end] = computeDashboardRange({
    scope,
    year,
    monthIdx,
    weekOffset,
    businessTimezone,
  });

  useEffect(() => {
    if (guest || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/settings");
        if (!cancelled && data && typeof data === "object" && typeof data.business_timezone === "string") {
          setBusinessTimezone(data.business_timezone);
        }
      } catch {
        /* keep local default */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [guest, user]);

  async function loadSummary() {
    if (guest || !user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [s, e] = computeDashboardRange({
        scope,
        year,
        monthIdx,
        weekOffset,
        businessTimezone,
      });
      const params = { start: s };
      if (e != null && e !== "") params.end = e;
      const { data } = await api.get("/dashboard/summary", { params });
      setSummary(data);
    } catch (e) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  async function loadQuickAndSession() {
    if (guest || !user) return;
    try {
      const [{ data: qa }, { data: s }] = await Promise.all([
        api.get("/quick-actions"),
        api.get("/time/session"),
      ]);
      setQuickActions(Array.isArray(qa) ? qa : []);
      setSession(s?.active ? s : null);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    loadSummary();
  }, [start, end, guest, user, scope, year, monthIdx, weekOffset, businessTimezone]); // eslint-disable-line

  useEffect(() => {
    if (guest || !user || !needsSlidingRangeEnd) return undefined;
    const id = setInterval(() => {
      loadSummary();
    }, 30_000);
    const onVis = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") loadSummary();
    };
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVis);
    };
  }, [guest, user, needsSlidingRangeEnd, scope, year, monthIdx, weekOffset, businessTimezone]); // eslint-disable-line

  useEffect(() => { loadQuickAndSession(); }, [guest, user]); // eslint-disable-line

  // Live timer: tick every 30s while clocked in
  useEffect(() => {
    if (!session) return;
    const t = setInterval(() => setTickN((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, [session]);

  async function runQuick(qa) {
    if (guest) return show("Sign in to track time", "error");
    if (session) return show("Already on the clock", "error");
    try {
      const { data } = await api.post(`/quick-actions/${qa.id}/run`);
      setSession(data);
      show(`Clocked in: ${qa.label}`, "success");
    } catch (e) {
      show("Could not start", "error");
    }
  }

  async function stopNow() {
    try {
      await api.post("/time/clock-out", { description: "" });
      setSession(null);
      show("Saved time entry", "success");
      loadSummary();
    } catch { show("Could not clock out", "error"); }
  }

  return (
    <>
      <ScreenHeader title="Dashboard" subtitle="Hours, income/expense, and category breakdown" back={false} />
      <PageContainer>
        {guest && (
          <div className="card p-4 border border-[rgba(244,63,94,0.3)] bg-[rgba(244,63,94,0.08)] mb-4 flex gap-3" data-testid="guest-banner">
            <AlertCircle size={20} className="text-[#FB7185] flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-[#FB7185] mb-0.5">Guest mode</p>
              <p className="text-ink-secondary">Sign in to save business data to your RootRecord account and unlock Pro reports.</p>
            </div>
          </div>
        )}

        {/* Active session banner */}
        {session && (
          <div data-testid="active-session-banner" className="card p-3 mb-3 flex items-center gap-3 border border-brand/30 bg-brand/10">
            <div className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center text-white animate-pulse">
              <Play size={16} fill="currentColor" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink-primary truncate">
                On the clock{session.description ? ` · ${session.description}` : ""}
              </p>
              <p className="text-xs text-brand-light font-semibold">
                {fmtHours(durationHours(session.started_at_utc, isoNow()))}
                <span className="hidden">{tickN}</span>
              </p>
            </div>
            <button data-testid="active-session-stop" onClick={stopNow} className="btn btn-danger min-h-[40px] px-3">
              <Square size={14} fill="currentColor" /> Stop
            </button>
          </div>
        )}

        {/* Quick actions */}
        {!guest && quickActions.length > 0 && !session && (
          <Section title="Quick actions">
            <div className="p-3 grid grid-cols-3 gap-2">
              {quickActions.slice(0, 6).map((qa) => {
                const Ico = ICON_MAP[qa.icon] || Zap;
                return (
                  <button
                    key={qa.id}
                    data-testid={`quick-action-${qa.id}`}
                    onClick={() => runQuick(qa)}
                    className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl bg-bg-elevated border border-strong hover:border-brand/40 active:scale-[0.97] transition min-h-[80px]"
                  >
                    <div className="w-8 h-8 rounded-lg bg-brand/15 text-brand flex items-center justify-center">
                      <Ico size={16} />
                    </div>
                    <span className="text-xs font-semibold text-ink-primary truncate max-w-full">{qa.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="px-3 pb-3 -mt-1">
              <button
                data-testid="manage-quick-actions"
                onClick={() => nav("/track")}
                className="text-[11px] text-ink-tertiary hover:text-ink-secondary"
              >
                Manage on Track →
              </button>
            </div>
          </Section>
        )}

        {/* scope */}
        <div className="card p-1 grid grid-cols-2 sm:grid-cols-4 gap-1 mb-3" data-testid="dashboard-scope">
          {[
            { id: "year", label: "Yearly" },
            { id: "month", label: "Monthly" },
            { id: "week", label: "Weekly" },
            { id: "today", label: "Today" },
          ].map((t) => (
            <button
              key={t.id}
              data-testid={`scope-${t.id}`}
              onClick={() => {
                setScope(t.id);
                if (t.id === "week") setWeekOffset(0);
              }}
              className={`py-2 rounded-xl text-sm font-semibold transition-colors min-h-[44px] ${
                scope === t.id ? "bg-bg-elevated text-ink-primary" : "text-ink-tertiary"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {scope === "month" && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4 pb-1 -mx-1 px-1">
            {MONTHS_SHORT.map((m, i) => (
              <button
                key={m}
                onClick={() => setMonthIdx(i)}
                data-testid={`month-${m.toLowerCase()}`}
                data-active={monthIdx === i}
                className="chip"
              >
                {m}
              </button>
            ))}
          </div>
        )}

        {scope === "week" && (
          <div className="flex items-center justify-between gap-2 mb-4 px-1">
            <button
              type="button"
              data-testid="week-prev"
              className="btn btn-ghost p-2 min-h-[44px]"
              aria-label="Previous week"
              onClick={() => setWeekOffset((w) => w - 1)}
            >
              <ChevronLeft size={20} />
            </button>
            <p className="text-xs text-ink-secondary text-center flex-1 font-medium" data-testid="week-range-label">
              {formatWeekRangeLabel(start, end, businessTimezone)}
            </p>
            <button
              type="button"
              data-testid="week-next"
              className="btn btn-ghost p-2 min-h-[44px]"
              aria-label="Next week"
              onClick={() => setWeekOffset((w) => w + 1)}
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}

        {scope === "today" && (
          <p className="text-xs text-ink-tertiary mb-4 px-1 text-center" data-testid="today-caption">
            Hours and money from midnight in <strong className="text-ink-secondary">{dashboardTimeZoneCaption(businessTimezone)}</strong> through now.
          </p>
        )}

        {loading ? <Spinner /> : error ? (
          <Empty title="Couldn't load dashboard">{error}</Empty>
        ) : guest || !summary ? (
          <Empty title="Nothing to show yet" icon={<TrendingUp size={32} />}>
            {guest ? "Sign in to view live totals." : "Start tracking time or add income/expenses."}
          </Empty>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <Kpi
                testid="kpi-hours"
                label="Hours"
                value={fmtHours((summary.hours || 0) + liveSessionHoursInRange(session, start, end ?? undefined))}
              />
              <Kpi testid="kpi-income" label="Income" value={fmtMoneyCompact(summary.income_cents)} fullValue={fmtMoney(summary.income_cents)} accent="income" />
              <Kpi testid="kpi-expenses" label="Expenses" value={fmtMoneyCompact(summary.expense_cents)} fullValue={fmtMoney(summary.expense_cents)} accent="expense" />
              <Kpi testid="kpi-net" label="Net" value={fmtMoneyCompact(summary.net_cents)} fullValue={fmtMoney(summary.net_cents)} accent={summary.net_cents >= 0 ? "income" : "expense"} bold />
            </div>

            <Section title="By category">
              <div className="p-4">
                {summary.breakdown.length === 0 ? (
                  <p className="text-sm text-ink-tertiary text-center py-8">No tracked time in this window yet.</p>
                ) : (
                  <>
                    <div style={{ width: "100%", height: 220 }}>
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie
                            data={summary.breakdown}
                            dataKey="hours"
                            nameKey="name"
                            innerRadius={45}
                            outerRadius={80}
                            paddingAngle={2}
                            stroke="none"
                          >
                            {summary.breakdown.map((b, i) => (
                              <Cell key={i} fill={b.color} />
                            ))}
                          </Pie>
                          <Tooltip {...rechartsTooltipProps} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ width: "100%", height: 200 }} className="mt-2">
                      <ResponsiveContainer>
                        <BarChart data={summary.breakdown} margin={{ top: 8, right: 8, left: -20, bottom: 8 }}>
                          <XAxis dataKey="name" tick={{ fill: "#687777", fontSize: 10 }} angle={-30} textAnchor="end" height={40} interval={0} />
                          <YAxis tick={{ fill: "#687777", fontSize: 10 }} />
                          <Tooltip {...rechartsTooltipProps} />
                          <Bar dataKey="hours" radius={[6, 6, 0, 0]}>
                            {summary.breakdown.map((b, i) => (
                              <Cell key={i} fill={b.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                )}
              </div>
            </Section>
          </>
        )}
      </PageContainer>
      <Toast message={toast.message} kind={toast.kind} onDone={clear} />
    </>
  );
}

function Kpi({ label, value, fullValue, accent, bold, testid }) {
  const color = accent === "income" ? "text-income" : accent === "expense" ? "text-expense" : "text-ink-primary";
  return (
    <div data-testid={testid} className="card p-4 flex flex-col min-w-0">
      <span className="label">{label}</span>
      <span
        className={`font-heading ${bold ? "text-2xl" : "text-xl"} font-bold ${color} mt-1 truncate tabular-nums leading-tight`}
        title={fullValue || value}
      >
        {value}
      </span>
    </div>
  );
}
