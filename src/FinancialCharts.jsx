import { useEffect, useRef, useState, useId } from "react";
import { calendarStats, calculateAdvancedStats } from "./analytics.js";
import { money, pnlTone } from "./format.js";
export function FinancialChart({ trades, cumulative = false }) {
  const clip = useId().replace(/:/g, "");
  const ref = useRef(null),
    [width, setWidth] = useState(600);
  useEffect(() => {
    const o = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    if (ref.current) o.observe(ref.current);
    return () => o.disconnect();
  }, []);
  let sum = 0;
  const points = calendarStats(trades.filter((t) => t.realised !== false))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({ ...d, value: cumulative ? (sum += d.netPnl) : d.netPnl }));
  const values = [0, ...points.map((d) => d.value)],
    lo = Math.min(...values),
    hi = Math.max(...values),
    span = hi - lo || 1;
  const step = 10 ** Math.floor(Math.log10(span / 4)),
    interval = Math.ceil(span / 4 / step) * step;
  const min = Math.floor(lo / interval) * interval,
    max = Math.ceil(hi / interval) * interval || interval;
  const chartWidth = Math.max(350, width);
  const margin = Math.max(
    90,
    money(min).length * 7 + 20,
    money(max).length * 7 + 20,
  );
  const y = (n) => 210 - ((n - min) / (max - min)) * 180,
    x = (i) =>
      margin +
      ((i + 0.5) / Math.max(1, points.length)) * (chartWidth - margin - 20);
  const ticks = Array.from(
      { length: Math.round((max - min) / interval) + 1 },
      (_, i) => min + i * interval,
    ),
    stride = Math.max(
      1,
      Math.ceil(points.length / Math.max(2, Math.floor(width / 100))),
    );
  return (
    <div ref={ref} className="financial-chart">
      {!points.length ? (
        <p className="chart-empty">
          No realised trades yet. Your recorded results will appear here.
        </p>
      ) : (
        <svg
          viewBox={`0 0 ${chartWidth} 260`}
          role="img"
          aria-label={
            cumulative
              ? "Cumulative realised P&L by date"
              : "Daily realised P&L by date"
          }
        >
          {ticks.map((n) => (
            <g key={n}>
              <line
                x1={margin - 4}
                x2={chartWidth - 20}
                y1={y(n)}
                y2={y(n)}
                stroke={n === 0 ? "#b49ae9" : "#37323e"}
                strokeDasharray={n === 0 ? "" : "3 4"}
              />
              <text x={margin - 10} y={y(n) + 4} textAnchor="end">
                {money(n)}
              </text>
            </g>
          ))}
          {cumulative && (
            <>
              <defs>
                <clipPath id={`${clip}-positive`}>
                  <rect x="0" y="0" width={chartWidth} height={y(0)} />
                </clipPath>
                <clipPath id={`${clip}-negative`}>
                  <rect x="0" y={y(0)} width={chartWidth} height={260 - y(0)} />
                </clipPath>
              </defs>
              {[
                ["positive", "#55c7a1"],
                ["negative", "#ee7384"],
              ].map(([side, color]) => (
                <polyline
                  key={side}
                  points={points
                    .map((p, i) => `${x(i)},${y(p.value)}`)
                    .join(" ")}
                  clipPath={`url(#${clip}-${side})`}
                  fill="none"
                  stroke={color}
                  strokeWidth="2"
                />
              ))}
              {points.map((p, i) =>
                i > 0 && p.value === 0 && points[i - 1].value === 0 ? (
                  <line
                    key={p.date}
                    x1={x(i - 1)}
                    x2={x(i)}
                    y1={y(0)}
                    y2={y(0)}
                    stroke="#72a7ff"
                    strokeWidth="2"
                  />
                ) : null,
              )}
            </>
          )}
          {points.map((p, i) => (
            <g key={p.date}>
              {cumulative ? (
                <circle
                  tabIndex="0"
                  aria-label={`${p.date}: ${money(p.value)}`}
                  cx={x(i)}
                  cy={y(p.value)}
                  r="4"
                  className={pnlTone(p.value)}
                >
                  <title>
                    {p.date}: {money(p.value)}
                  </title>
                </circle>
              ) : (
                <rect
                  tabIndex="0"
                  aria-label={`${p.date}: ${money(p.value)}`}
                  x={x(i) - Math.min(15, 180 / points.length)}
                  width={Math.min(30, 360 / points.length)}
                  y={Math.min(y(0), y(p.value))}
                  height={Math.max(2, Math.abs(y(p.value) - y(0)))}
                  className={pnlTone(p.value)}
                >
                  <title>
                    {p.date}: {money(p.value)}
                  </title>
                </rect>
              )}
              {i % stride === 0 && (
                <text x={x(i)} y="238" textAnchor="middle">
                  {new Date(p.date + "T12:00:00Z").toLocaleDateString(
                    undefined,
                    {
                      month: "short",
                      day: "numeric",
                      year:
                        points[0]?.date.slice(0, 4) !==
                        points.at(-1)?.date.slice(0, 4)
                          ? "2-digit"
                          : undefined,
                    },
                  )}
                </text>
              )}
            </g>
          ))}
          <text x={chartWidth / 2} y="258" textAnchor="middle">
            Trading date
          </text>
        </svg>
      )}
    </div>
  );
}
export function OutcomeDonut({ trades }) {
  const s = calculateAdvancedStats(trades),
    total = s.wins + s.losses + s.breakeven;
  let offset = 0;
  return (
    <article className="metric-card outcome-card">
      <span>Win Rate</span>
      <strong>{s.decidedTrades ? `${s.winRate.toFixed(1)}%` : "—"}</strong>
      <svg
        viewBox="0 0 42 42"
        role="img"
        aria-label={`${s.wins} wins, ${s.losses} losses, ${s.breakeven} breakevens`}
      >
        <circle
          cx="21"
          cy="21"
          r="16"
          fill="none"
          stroke="#39313e"
          strokeWidth="5"
        />
        {[
          ["green", s.wins],
          ["red", s.losses],
          ["blue", s.breakeven],
        ].map(([tone, n]) => {
          const length = total ? (n / total) * 100 : 0;
          const start = offset;
          offset += length;
          return (
            <circle
              key={tone}
              cx="21"
              cy="21"
              r="16"
              pathLength="100"
              fill="none"
              strokeWidth="5"
              className={tone}
              strokeDasharray={`${length} ${100 - length}`}
              strokeDashoffset={-start}
              transform="rotate(-90 21 21)"
            >
              <title>
                {tone}: {n}
              </title>
            </circle>
          );
        })}
      </svg>
      <small>
        <span className="green">{s.wins} wins</span> ·{" "}
        <span className="red">{s.losses} losses</span> ·{" "}
        <span className="blue">{s.breakeven} breakevens</span>
      </small>
      <small>
        Headline excludes breakevens; ring includes all classified outcomes.
      </small>
    </article>
  );
}
