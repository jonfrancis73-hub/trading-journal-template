import { money, pnlTone } from "./format.js";
export default function ReportBars({ groups, performance = false }) {
  const values = groups.map((g) => (performance ? g.netPnl : g.count)),
    min = Math.min(0, ...values),
    max = Math.max(1, ...values),
    span = max - min;
  const height = Math.max(180, groups.length * 40 + 70),
    x = (n) => 150 + ((n - min) / span) * 400;
  const ticks = performance
    ? Array.from({ length: 5 }, (_, i) => min + (span * i) / 4)
    : Array.from(
        new Set([
          0,
          Math.ceil(max / 4),
          Math.ceil(max / 2),
          Math.ceil((max * 3) / 4),
          max,
        ]),
      );
  return (
    <section className="panel">
      <h3>{performance ? "Net performance" : "Execution distribution"}</h3>
      <div className="report-chart-scroll">
        <svg
          viewBox={`0 0 680 ${height}`}
          role="img"
          aria-label={
            performance
              ? "Realised net P&L by category"
              : "Number of executions by category"
          }
        >
          {ticks.map((n) => (
            <g key={n}>
              <line
                x1={x(n)}
                x2={x(n)}
                y1="20"
                y2={height - 45}
                stroke="#38303f"
                strokeDasharray="3 4"
              />
              <text x={x(n)} y={height - 20} textAnchor="middle">
                {performance ? money(n) : n}
              </text>
            </g>
          ))}
          <line x1={x(0)} x2={x(0)} y1="20" y2={height - 45} stroke="#b099d8" />
          {groups.map((g, i) => {
            const value = values[i],
              label = performance ? money(value) : `${value} executions`;
            return (
              <g key={g.key}>
                <text x="140" y={44 + i * 40} textAnchor="end">
                  {g.key.length > 21 ? g.key.slice(0, 20) + "…" : g.key}
                  <title>{g.key}</title>
                </text>
                <rect
                  tabIndex="0"
                  aria-label={`${g.key}: ${label}`}
                  x={Math.min(x(0), x(value))}
                  y={28 + i * 40}
                  width={Math.max(2, Math.abs(x(value) - x(0)))}
                  height="24"
                  className={performance ? pnlTone(value) : "distribution"}
                >
                  <title>
                    {g.key}: {label}
                  </title>
                </rect>
                <text x="565" y={44 + i * 40}>
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}
