type Point = { day: string; total_circulation: number };

function fmtAxis(n: number): string {
  const v = Math.max(0, Math.floor(n));
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

export function EconomyCirculationChart({ series }: { series: Point[] }) {
  const pts = series.filter((p) => p?.day);
  if (!pts.length) {
    return <p className="economy-chart-empty">No circulation history yet.</p>;
  }

  const w = 640;
  const h = 160;
  const padL = 44;
  const padR = 8;
  const padT = 8;
  const padB = 28;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  const values = pts.map((p) => Math.max(0, Math.floor(p.total_circulation)));
  const minV = pts.length < 2 ? 0 : Math.min(...values);
  const maxV = Math.max(...values);
  const span = Math.max(1, maxV - minV);

  const coords = values.map((v, i) => {
    const x = padL + (pts.length === 1 ? innerW / 2 : (i / Math.max(1, pts.length - 1)) * innerW);
    const y = padT + innerH - ((v - minV) / span) * innerH;
    return { x, y, v, day: pts[i].day };
  });

  const lineD =
    coords.length >= 2
      ? coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ")
      : "";

  const areaD =
    coords.length >= 2
      ? `${lineD} L${coords[coords.length - 1].x.toFixed(1)},${(padT + innerH).toFixed(1)} L${coords[0].x.toFixed(1)},${(padT + innerH).toFixed(1)} Z`
      : "";

  return (
    <div className="economy-chart-wrap" aria-label="Internal circulation history">
      {pts.length < 2 ? (
        <p className="economy-chart-note">
          Daily history just started — check back after a few UTC days for a trend line.
        </p>
      ) : null}
      <svg viewBox={`0 0 ${w} ${h}`} className="economy-chart-svg" role="img">
        <line
          x1={padL}
          y1={padT + innerH}
          x2={w - padR}
          y2={padT + innerH}
          stroke="rgba(94,233,176,0.2)"
          strokeWidth="1"
        />
        <text x={padL - 4} y={padT + 10} textAnchor="end" className="economy-chart-axis">
          {fmtAxis(maxV)}
        </text>
        <text x={padL - 4} y={padT + innerH} textAnchor="end" className="economy-chart-axis">
          {fmtAxis(minV)}
        </text>
        {areaD ? <path d={areaD} fill="rgba(94,233,176,0.12)" /> : null}
        {lineD ? (
          <path d={lineD} fill="none" stroke="#5ee9b0" strokeWidth="2" strokeLinejoin="round" />
        ) : null}
        {coords.map((c) => (
          <g key={c.day}>
            <circle cx={c.x} cy={c.y} r={pts.length < 2 ? 6 : 3} fill="#5ee9b0" />
            <text x={c.x} y={h - 6} textAnchor="middle" className="economy-chart-axis">
              {c.day.slice(5)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
