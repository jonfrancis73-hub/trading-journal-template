import ReportBars from "./ReportBars.jsx";
import { reportKey, averageRealisedR } from "./reporting.js";
import { executed } from "./risk.js";
import { useState } from "react";
import {
  calculateAdvancedStats,
  calendarStats,
  isCountableTrade,
} from "./analytics.js";
import { disciplineAnalytics } from "./discipline.js";
import { money, pnlTone } from "./format.js";
import { FinancialChart } from "./FinancialCharts.jsx";
export default function Reports({ trades, discipline }) {
  const [category, setCategory] = useState("Overview"),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [asset, setAsset] = useState(""),
    [strategy, setStrategy] = useState(""),
    [setup, setSetup] = useState("");
  const rows = [...new Map(trades.map((t) => [t.id, t])).values()].filter(
    (t) =>
      isCountableTrade(t) &&
      executed(t) &&
      (!start || t.date >= start) &&
      (!end || t.date <= end) &&
      (!asset || t.asset === asset) &&
      (!strategy || t.strategy === strategy) &&
      (!setup || t.setupName === setup),
  );
  const stats = calculateAdvancedStats(rows),
    days = calendarStats(rows).sort((a, b) => a.date.localeCompare(b.date));
  const streak = (positive) => {
    let current = 0,
      best = 0;
    for (const d of days) {
      current = (positive ? d.netPnl > 0 : d.netPnl < 0) ? current + 1 : 0;
      best = Math.max(best, current);
    }
    return best;
  };
  const metrics = [
    ["Total realised net P&L", stats.netPnl, true],
    ["Gross profits", stats.grossProfit, true],
    ["Gross losses", -stats.grossLoss, true],
    ["Executed trades", rows.length],
    ["Wins", stats.wins],
    ["Losses", stats.losses],
    ["Breakevens", stats.breakeven],
    [
      "Win rate (decided trades)",
      stats.decidedTrades ? stats.winRate.toFixed(1) + "%" : "Not Available",
    ],
    [
      "Profit factor",
      Number.isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : "∞",
    ],
    ["Trade expectancy", stats.expectancy, true],
    ["Average winning trade", stats.averageWin, true],
    ["Average losing trade", stats.averageLoss, true],
    ["Average trade P&L", stats.averageTrade, true],
    ["Largest winning trade", stats.largestWin?.pnlValue, true],
    ["Largest losing trade", stats.largestLoss?.pnlValue, true],
    ["Best trading day", stats.bestDay?.netPnl, true],
    ["Worst trading day", stats.worstDay?.netPnl, true],
    ["Trading days", stats.tradingDays],
    ["Profitable days", stats.profitableDays],
    ["Losing days", stats.losingDays],
    ["Breakeven days", stats.flatDays],
    ["Average daily P&L", stats.averageDailyPnl, true],
    ["Consecutive winning trades", stats.longestWinStreak],
    ["Consecutive losing trades", stats.longestLossStreak],
    ["Consecutive profitable days", streak(true)],
    ["Consecutive losing days", streak(false)],
    ["Maximum drawdown", -stats.maxDrawdown, true],
    [
      "Average recorded RR",
      rows.some((t) => Number(t.rr) > 0)
        ? stats.avgRR.toFixed(2)
        : "Not Available",
    ],
    [
      "Average realised R",
      averageRealisedR(rows) === null
        ? "Not Available"
        : averageRealisedR(rows).toFixed(2) + "R",
    ],
    [
      "Average duration",
      stats.holdTimeCoverage
        ? stats.averageHoldMinutes.toFixed(1) + " minutes"
        : "Not Available",
    ],
  ];
  const groups = (
    category === "Days"
      ? [
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ]
      : [...new Set(rows.map((t) => reportKey(t, category)))]
  )
    .sort((a, b) =>
      category === "Days"
        ? [
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
          ].indexOf(a) -
          [
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
          ].indexOf(b)
        : a.localeCompare(b),
    )
    .map((key) => {
      const items = rows.filter((t) => reportKey(t, category) === key);
      return { key, count: items.length, ...calculateAdvancedStats(items) };
    });
  const compliance = disciplineAnalytics(
    discipline.filter(
      (r) =>
        (!start || r.date >= start) &&
        (!end || r.date <= end) &&
        days.some((d) => d.date === r.date),
    ),
    rows,
    null,
  );
  const scopedDays = compliance.days.filter(
    (d) =>
      (!start || d.date >= start) &&
      (!end || d.date <= end) &&
      days.some((x) => x.date === d.date),
  );
  return (
    <div className="screen-grid">
      <section className="panel">
        <div className="report-filters">
          <label>
            From
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
          {[
            ["Instrument", asset, setAsset, "asset"],
            ["Strategy", strategy, setStrategy, "strategy"],
            ["Setup", setup, setSetup, "setupName"],
          ].map(([label, value, set, key]) => (
            <label key={key}>
              {label}
              <select value={value} onChange={(e) => set(e.target.value)}>
                <option value="">All</option>
                {[...new Set(trades.map((t) => t[key]).filter(Boolean))].map(
                  (v) => (
                    <option key={v}>{v}</option>
                  ),
                )}
              </select>
            </label>
          ))}
        </div>
        <nav className="report-categories">
          {[
            "Overview",
            "Days",
            "Weeks",
            "Months",
            "Entry time",
            "Duration",
            "Instruments",
            "Strategies",
            "Setups",
            "Trading Discipline",
          ].map((c) => (
            <button
              key={c}
              className={category === c ? "primary" : "secondary"}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </nav>
      </section>
      {!rows.length && (
        <p className="panel">No realised executions match these filters.</p>
      )}
      {category === "Overview" ? (
        <>
          <section className="panel report-stats">
            {metrics.map(([label, value, isMoney]) => (
              <div key={label}>
                <span>{label}</span>
                <strong
                  className={
                    isMoney && value !== undefined ? pnlTone(value) : ""
                  }
                >
                  {value === undefined
                    ? "Not Available"
                    : isMoney
                      ? money(value)
                      : value}
                </strong>
              </div>
            ))}
          </section>
          <section className="panel">
            <h3>Cumulative net P&L</h3>
            <FinancialChart trades={rows} cumulative />
          </section>
          <section className="panel">
            <h3>Daily net P&L</h3>
            <FinancialChart trades={rows} />
          </section>
        </>
      ) : category === "Trading Discipline" ? (
        <section className="panel">
          <h3>Global discipline and selected trading results</h3>
          <p>
            One global checklist per date with matching executions. Unresolved
            conflicts, incomplete and all-N/A days do not qualify as compliant
            days. Association does not establish causation.
          </p>
          {["Compliant", "Non-compliant", "Incomplete"].map((label) => {
            const d = scopedDays.filter((d) =>
              label === "Compliant"
                ? d.compliant
                : label === "Non-compliant"
                  ? d.complete && d.applicable > 0 && !d.compliant
                  : !d.complete || !d.applicable,
            );
            const pnl = d.reduce((n, d) => n + d.pnl, 0);
            return (
              <p key={label}>
                {label}: {d.length} days ·{" "}
                <strong className={pnlTone(pnl)}>{money(pnl)}</strong>
              </p>
            );
          })}
          <h4>Compliance trends</h4>
          {scopedDays.map((d) => (
            <p key={d.date}>
              {d.date} ·{" "}
              {d.percent === null
                ? "Not Available"
                : d.percent.toFixed(1) + "%"}{" "}
              · {money(d.pnl)}
            </p>
          ))}
          <h4>Most frequently broken rules</h4>
          {compliance.rules
            .slice()
            .sort((a, b) => b.broken - a.broken)
            .map((r) => (
              <p key={r.id}>
                {r.label} — {r.broken} No answers
              </p>
            ))}
        </section>
      ) : (
        <>
          <div className="report-chart-grid">
            <ReportBars groups={groups} />
            <ReportBars groups={groups} performance />
          </div>
          <section className="panel table-scroll">
            <table>
              <caption>{category} summary</caption>
              <thead>
                <tr>
                  {[
                    "Category",
                    "Net P&L",
                    "Win rate",
                    "Gross profit",
                    "Gross loss",
                    "Trades",
                    "Average return",
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.key}>
                    <th>{g.key}</th>
                    <td className={pnlTone(g.netPnl)}>{money(g.netPnl)}</td>
                    <td>
                      {g.decidedTrades
                        ? g.winRate.toFixed(1) + "%"
                        : "Not Available"}
                    </td>
                    <td className={pnlTone(g.grossProfit)}>
                      {money(g.grossProfit)}
                    </td>
                    <td className={pnlTone(-g.grossLoss)}>
                      {money(-g.grossLoss)}
                    </td>
                    <td>{g.count}</td>
                    <td className={pnlTone(g.averageTrade)}>
                      {money(g.averageTrade)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
