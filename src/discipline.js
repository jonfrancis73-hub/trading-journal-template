import { parseMoney } from "./journalRules.js";
import { dailyRisk, executed } from "./risk.js";
export const RULES = [
  ["deskBefore", "Before", "Am I trading from my desk?"],
  ["reviewed", "Before", "Have I reviewed my trading rules?"],
  ["prepared", "Before", "Am I emotionally prepared to trade?"],
  ["sessionChecked", "Before", "Am I within my permitted trading session?"],
  [
    "lossChecked",
    "Before",
    "Have I confirmed risk sizing relative to account P&L?",
  ],
  [
    "stopped",
    "After",
    "Did I stop trading after reaching each traded account’s daily realised-loss limit?",
  ],
  [
    "sessionFollowed",
    "After",
    "Did I only execute trades within my permitted trading hours?",
  ],
  ["deskAfter", "After", "Did I trade from my desk?"],
  ["journalled", "After", "Did I journal all my trades?"],
  ["planFollowed", "After", "Did I follow my trading plan?"],
];
export function checklistStats(record = {}) {
  const values = RULES.map(([id]) => record.answers?.[id]);
  const applicable = values.filter((v) => v === "yes" || v === "no");
  const yes = applicable.filter((v) => v === "yes").length;
  const answered = values.filter((v) => ["yes", "no", "na"].includes(v)).length;
  return {
    yes,
    applicable: applicable.length,
    answered,
    complete: answered === RULES.length,
    percent: applicable.length ? (yes / applicable.length) * 100 : null,
    compliant:
      answered === RULES.length &&
      applicable.length > 0 &&
      yes === applicable.length,
  };
}
export function disciplineAnalytics(
  records,
  trades,
  account,
  through = "9999-12-31",
) {
  const own = (
    account
      ? records.filter((r) => r.accountId === account.id)
      : globalDiscipline(records)
  ).filter((r) => r.date <= through);
  const dates = [
    ...new Set([
      ...own.map((r) => r.date),
      ...trades
        .filter(
          (t) =>
            (!account || t.accountId === account.id) &&
            executed(t) &&
            t.realised !== false &&
            t.date <= through,
        )
        .map((t) => t.date),
    ]),
  ].sort();
  const days = dates.map((date) => {
    const record = own.find((r) => r.date === date);
    return {
      date,
      record,
      ...checklistStats(record?.conflicts?.length ? {} : record),
      pnl: account
        ? dailyRisk(trades, account, date).pnl
        : trades
            .filter(
              (t) => executed(t) && t.realised !== false && t.date === date,
            )
            .reduce((n, t) => n + parseMoney(t.pnl), 0),
    };
  });
  const applicable = days.reduce((s, d) => s + d.applicable, 0),
    yes = days.reduce((s, d) => s + d.yes, 0);
  const rules = RULES.map(([id, , label]) => {
    const values = own
      .map((r) => (r.conflicts?.length ? undefined : r.answers?.[id]))
      .filter((v) => v === "yes" || v === "no");
    const broken = values.filter((v) => v === "no").length;
    const na = own.filter(
      (r) => !r.conflicts?.length && r.answers?.[id] === "na",
    ).length;
    return {
      id,
      label,
      broken,
      yes: values.length - broken,
      na,
      unanswered: own.length - values.length - na,
      total: values.length + na,
      answered: values.length,
      percent: values.length
        ? ((values.length - broken) / values.length) * 100
        : null,
    };
  });
  let streak = 0,
    best = 0;
  for (const d of days) {
    streak = d.compliant ? streak + 1 : 0;
    best = Math.max(best, streak);
  }
  const group = (predicate) => {
    const rows = days.filter(predicate);
    return {
      days: rows.length,
      pnl: rows.reduce((s, d) => s + d.pnl, 0),
      average: rows.length
        ? rows.reduce((s, d) => s + d.pnl, 0) / rows.length
        : null,
    };
  };
  return {
    days,
    rules,
    percent: applicable ? (yes / applicable) * 100 : null,
    fullyCompliant: days.filter((d) => d.compliant).length,
    incomplete: days.filter((d) => !d.complete).length,
    streak,
    best,
    compliant: group((d) => d.compliant),
    noncompliant: group((d) => d.complete && d.applicable > 0 && !d.compliant),
  };
}

// Legacy account records remain intact; only an unambiguous global view enters analytics.
export function globalDiscipline(records = []) {
  return [...new Set(records.map((r) => r.date))].sort().map((date) => {
    const originals = records.filter((r) => r.date === date),
      global = originals.find((r) => !r.accountId);
    if (global)
      return { ...global, originals: originals.filter((r) => r.accountId) };
    const answers = {},
      conflicts = [];
    for (const [id] of RULES) {
      const values = [
        ...new Set(
          originals
            .map((r) => (r.conflicts?.length ? undefined : r.answers?.[id]))
            .filter(Boolean),
        ),
      ];
      if (values.length > 1) conflicts.push(id);
      else if (values.length) answers[id] = values[0];
    }
    return {
      id: `discipline:global:${date}`,
      date,
      answers,
      notes: originals
        .map((r) => r.notes)
        .filter(Boolean)
        .join("\n\n"),
      originals,
      conflicts,
    };
  });
}
