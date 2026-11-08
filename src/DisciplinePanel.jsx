import { parseMoney } from "./journalRules.js";
import { money, pnlTone } from "./format.js";
import React, { useState } from "react";
import {
  RULES,
  checklistStats,
  disciplineAnalytics,
  globalDiscipline,
} from "./discipline.js";
import { localDay, executed } from "./risk.js";
const percent = (n) =>
  n === null ? "No applicable answers" : `${n.toFixed(1)}%`;
export default function DisciplinePanel({
  store,
  accountId,
  onSave,
  onReview,
}) {
  const [date, setDate] = useState(localDay());
  const account = { id: null, name: "All funded accounts" };

  return (
    <DisciplineAccount
      key={date}
      {...{ store, account, date, setDate, onSave, onReview }}
    />
  );
}
function DisciplineAccount({
  store,
  account,
  date,
  setDate,
  onSave,
  onReview,
}) {
  const existing = globalDiscipline(store.discipline || []).find(
    (r) => r.date === date,
  );
  const [record, setRecord] = useState(
    existing || {
      id: `discipline:${account.id}:${date}`,
      accountId: account.id,
      date,
      answers: {},
      notes: "",
    },
  );
  const [message, setMessage] = useState("");
  const stats = checklistStats(record),
    analytics = disciplineAnalytics(
      store.discipline || [],
      store.trades,
      null,
      localDay(),
    );
  const risk = {
    pnl: store.trades
      .filter((t) => t.date === date && t.realised !== false && executed(t))
      .reduce((n, t) => n + parseMoney(t.pnl), 0),
  };
  return (
    <section className="panel discipline-panel">
      <h2>Discipline · {account.name}</h2>
      <p>
        Consistency first. Profit and loss never determine your compliance
        score.
      </p>
      <div className="metrics-grid">
        <div className="metric-card">
          <span>Overall rule compliance</span>
          <strong>{percent(analytics.percent)}</strong>
        </div>
        <div className="metric-card">
          <span>Fully compliant days</span>
          <strong>{analytics.fullyCompliant}</strong>
        </div>
        <div className="metric-card">
          <span>Current / best streak</span>
          <strong>
            {analytics.streak} / {analytics.best}
          </strong>
        </div>
        <div className="metric-card">
          <span>Incomplete days</span>
          <strong>{analytics.incomplete}</strong>
        </div>
      </div>

      <label>
        Trading day
        <input
          aria-label="Discipline trading day"
          type="date"
          max={localDay()}
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
        />
      </label>

      {existing?.originals?.length > 0 && (
        <details className="panel" open={existing.conflicts?.length > 0}>
          <summary>
            {existing.conflicts?.length
              ? "Conflicting historical checklists — review before saving"
              : "Original account checklists (preserved)"}
          </summary>
          {existing.originals.map((r) => (
            <article key={r.id}>
              <h4>
                {store.accounts.find((a) => a.id === r.accountId)?.name ||
                  r.accountId}
              </h4>
              {RULES.map(([id, , label]) => (
                <p key={id}>
                  {label}: {r.answers[id] || "Unanswered"}
                </p>
              ))}
              <p style={{ whiteSpace: "pre-wrap" }}>{r.notes}</p>
            </article>
          ))}
          <p>
            Select the correct daily answers below and save to resolve. Original
            records remain preserved.
          </p>
        </details>
      )}
      <h3>Daily checklist</h3>
      <p>
        {stats.complete ? "Completed" : "Incomplete"} · {stats.answered}/
        {RULES.length} answered · {percent(stats.percent)}
      </p>
      <progress
        aria-label="Checklist completion"
        max={RULES.length}
        value={stats.answered}
      />
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const { originals, conflicts, ...saved } = record;
            await onSave({
              ...saved,
              accountId: null,
              id: `discipline:global:${date}`,
            });
            setMessage("Checklist and reflection saved.");
          } catch (error) {
            setMessage(error.message);
          }
        }}
      >
        {["Before", "After"].map((phase) => (
          <fieldset key={phase}>
            <legend>{phase} trading</legend>
            {RULES.filter((r) => r[1] === phase).map(([id, , label]) => (
              <div className="checklist-row" key={id}>
                <span>{label}</span>
                <span className="answer-chips" role="group" aria-label={label}>
                  {[
                    ["yes", "Yes"],
                    ["no", "No"],
                    ["na", "N/A"],
                  ].map(([value, text]) => (
                    <button
                      type="button"
                      key={value}
                      aria-pressed={record.answers[id] === value}
                      className={`answer-chip ${value}`}
                      onClick={() => {
                        setMessage("Unsaved changes");
                        setRecord({
                          ...record,
                          answers: {
                            ...record.answers,
                            [id]: record.answers[id] === value ? "" : value,
                          },
                        });
                      }}
                    >
                      {record.answers[id] === value ? "✓ " : ""}
                      {text}
                    </button>
                  ))}
                </span>
              </div>
            ))}
          </fieldset>
        ))}
        <label>
          Daily reflection
          <textarea
            aria-label="Daily reflection"
            value={record.notes}
            onChange={(e) => {
              setMessage("Unsaved changes");
              setRecord({ ...record, notes: e.target.value });
            }}
          />
        </label>
        <button className="primary">Save Daily Checklist</button>
        <p role="status">{message}</p>
      </form>
      <h3>Trades and results for {date}</h3>
      <p>
        Net realised P&L:{" "}
        <span className={pnlTone(risk.pnl)}>{money(risk.pnl)}</span>. Compare
        this with your answers; recorded violations do not automatically change
        self-reported answers.
      </p>
      {store.trades
        .filter((t) => t.date === date)
        .map((t) => (
          <button
            className="secondary risk-history"
            key={t.id}
            onClick={() => onReview(t)}
          >
            {t.asset} · {t.entryTime || "Unknown execution time"} UK ·{" "}
            <span className={pnlTone(t.pnl)}>{money(t.pnl)}</span> net
          </button>
        ))}
      <h3>Compliance trends and history</h3>
      {analytics.days
        .slice()
        .reverse()
        .map((d) => (
          <button
            className="secondary risk-history"
            key={d.date}
            onClick={() => setDate(d.date)}
          >
            {d.date} · {percent(d.percent)} ·{" "}
            {d.record?.conflicts?.length
              ? "Review historical conflicts"
              : d.complete
                ? "Completed"
                : "Incomplete"}
            <progress
              aria-label={`Compliance ${d.date}`}
              max="100"
              value={d.percent || 0}
            />
          </button>
        ))}
      <h3>Individual rules · most frequently broken first</h3>
      {analytics.rules
        .slice()
        .sort((a, b) => b.broken - a.broken)
        .map((r) => (
          <div className="risk-history" key={r.id}>
            <strong>{r.label}</strong>
            <div
              className="stacked-bar"
              role="img"
              aria-label={`${r.yes} Yes, ${r.broken} No, ${r.na} N/A, ${r.unanswered} unanswered`}
            >
              {[
                ["yes", r.yes],
                ["no", r.broken],
                ["na", r.na],
              ].map(([kind, count]) => (
                <span
                  key={kind}
                  className={kind}
                  style={{ width: `${r.total ? (count / r.total) * 100 : 0}%` }}
                />
              ))}
            </div>
            <div className="rule-legend">
              {[
                ["yes", r.yes, "Yes"],
                ["no", r.broken, "No"],
                ["na", r.na, "N/A"],
              ].map(([kind, count, label]) => (
                <span key={kind}>
                  <i className={kind} />
                  {label}: {count} (
                  {r.total ? ((count / r.total) * 100).toFixed(1) : "0"}%)
                </span>
              ))}
              <span>{r.unanswered} unanswered</span>
            </div>
            <small>Compliance: {percent(r.percent)}</small>
          </div>
        ))}
      <h3>Performance comparison</h3>
      <p>
        Completed, applicable checklists only; incomplete and all-N/A days are
        excluded. This comparison shows association, not causation.
      </p>
      <div className="risk-history">
        Compliant: {analytics.compliant.days} days · total{" "}
        <span className={pnlTone(analytics.compliant.pnl)}>
          {money(analytics.compliant.pnl)}
        </span>{" "}
        · average{" "}
        {analytics.compliant.average === null ? (
          "N/A"
        ) : (
          <span className={pnlTone(analytics.compliant.average)}>
            {money(analytics.compliant.average)}
          </span>
        )}
      </div>
      <div className="risk-history">
        Non-compliant: {analytics.noncompliant.days} days · total{" "}
        <span className={pnlTone(analytics.noncompliant.pnl)}>
          {money(analytics.noncompliant.pnl)}
        </span>{" "}
        · average{" "}
        {analytics.noncompliant.average === null ? (
          "N/A"
        ) : (
          <span className={pnlTone(analytics.noncompliant.average)}>
            {money(analytics.noncompliant.average)}
          </span>
        )}
      </div>
    </section>
  );
}
