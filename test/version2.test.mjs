import test from "node:test";
import assert from "node:assert/strict";
import { money, pnlTone } from "../src/format.js";
import { calendarCells, calendarWeek } from "../src/calendar.js";
import {
  globalDiscipline,
  disciplineAnalytics,
  RULES,
} from "../src/discipline.js";
import {
  normalizeStore,
  prepareAccountExecutions,
  prepareLocalTrade,
  exportLocalBackup,
  importLocalBackup,
} from "../src/localJournal.js";
import { flowNodes } from "../src/flow.js";
import { reportKey } from "../src/reporting.js";
const accounts = [
  { id: "a", name: "A" },
  { id: "b", name: "B" },
];
const answers = Object.fromEntries(RULES.map(([id]) => [id, "yes"]));
const records = [
  {
    id: "old-a",
    accountId: "a",
    date: "2026-11-06",
    answers,
    notes: "First original",
  },
  {
    id: "old-b",
    accountId: "b",
    date: "2026-11-06",
    answers: { ...answers, deskBefore: "no" },
    notes: "Second original",
  },
];
test("money presentation preserves signs, cents and exact breakeven status", () => {
  assert.equal(money(1000), "$1,000");
  assert.equal(money(-500), "-$500");
  assert.equal(money(0), "$0");
  assert.equal(money(-0), "$0");
  assert.equal(money(12.34), "$12.34");
  assert.deepEqual(
    [pnlTone(1), pnlTone(-1), pnlTone(0)],
    ["green", "red", "blue"],
  );
});
test("Sunday calendar rows include adjacent-month executions once and retain monthly scope", () => {
  const cells = calendarCells("2026-10");
  assert.equal(cells[0].date, "2026-09-27");
  const days = [
    { date: "2026-09-30", netPnl: -50, trades: 1 },
    { date: "2026-10-01", netPnl: 100, trades: 2 },
    { date: "2026-11-01", netPnl: 33, trades: 1 },
  ];
  assert.deepEqual(calendarWeek(cells, 6, days), {
    start: "2026-09-27",
    end: "2026-10-03",
    pnl: 50,
    count: 3,
  });
  const weeks = cells
    .filter((_, i) => i % 7 === 6)
    .map((_, i) => calendarWeek(cells, i * 7 + 6, days));
  assert.equal(
    weeks.reduce((n, w) => n + w.pnl, 0),
    83,
  );
  assert.equal(
    weeks.reduce((n, w) => n + w.count, 0),
    4,
  );
  assert.equal(
    days
      .filter((d) => d.date.startsWith("2026-10"))
      .reduce((n, d) => n + d.netPnl, 0),
    100,
  );
});
test("global migration preserves conflicting originals and excludes unresolved answers from compliance", () => {
  const before = JSON.stringify(records),
    view = globalDiscipline(records);
  assert.equal(view.length, 1);
  assert.deepEqual(view[0].conflicts, ["deskBefore"]);
  assert.equal(view[0].answers.deskBefore, undefined);
  assert.equal(view[0].originals.length, 2);
  assert.equal(JSON.stringify(records), before);
  const trades = accounts.map((a, i) => ({
    id: a.id,
    accountId: a.id,
    date: "2026-11-06",
    pnl: i ? "-20" : "100",
    outcome: i ? "Loss" : "Win",
  }));
  let a = disciplineAnalytics(records, trades, null);
  assert.equal(a.days.length, 1);
  assert.equal(a.days[0].pnl, 80);
  assert.equal(a.fullyCompliant, 0);
  const resolved = {
    id: "discipline:global:2026-11-06",
    accountId: null,
    date: "2026-11-06",
    answers,
    notes: "Resolved",
  };
  a = disciplineAnalytics(
    [...records, resolved, { ...resolved, id: "next", date: "2026-11-07" }],
    [
      ...trades,
      {
        id: "open",
        date: "2026-11-06",
        accountId: "a",
        pnl: 999,
        realised: false,
      },
    ],
    null,
  );
  assert.equal(a.days[0].pnl, 80);
  assert.equal(a.fullyCompliant, 2);
  assert.equal(a.streak, 2);
  assert.equal(a.compliant.days, 2);
  assert.throws(
    () =>
      normalizeStore({
        accounts,
        discipline: [
          resolved,
          { ...resolved, id: "duplicate", accountId: undefined },
        ],
      }),
    /duplicate/,
  );
});
test("compatible legacy answers merge once and retain original notes", () => {
  const v = globalDiscipline(records.map((r) => ({ ...r, answers })));
  assert.equal(v[0].conflicts.length, 0);
  assert.match(v[0].notes, /First original/);
  assert.match(v[0].notes, /Second original/);
  assert.equal(
    disciplineAnalytics(
      records.map((r) => ({ ...r, answers })),
      [],
      null,
    ).fullyCompliant,
    1,
  );
});
test("annotations, flowcharts, global and original discipline survive ZIP and independent account editing", async () => {
  const long = "Weekly context\n\nA detailed paragraph with spaces.\n".repeat(
    400,
  );
  const shared = {
    date: "2026-11-06",
    asset: "MNQ",
    direction: "Long",
    note: "  Original\n\n\nnotes  ",
    screenshots: [
      {
        id: "first",
        name: "one.png",
        type: "image/png",
        kind: "context",
        explanation: long,
        dataUrl: "data:image/png;base64,iVBORw0KGgo=",
      },
      {
        id: "second",
        name: "two.png",
        type: "image/png",
        kind: "execution",
        explanation: "Execution\nconfirmation",
        dataUrl: "data:image/png;base64,iVBORw0KGgo=",
      },
    ],
  };
  let s = prepareAccountExecutions(
    normalizeStore({ accounts }),
    shared,
    [
      { accountId: "a", pnl: "100" },
      { accountId: "b", pnl: "-50" },
    ],
    "v2",
  );
  s = prepareLocalTrade(s, {
    ...s.trades[0],
    screenshots: [
      { ...s.trades[0].screenshots[1], explanation: "Changed only here" },
      s.trades[0].screenshots[0],
    ],
  });
  assert.equal(
    s.trades[1].screenshots[1].explanation,
    "Execution\nconfirmation",
  );
  assert.equal(s.trades[0].screenshots[1].id, "first");
  assert.equal(s.trades[0].screenshots[1].explanation, long);
  s.playbooks = [
    {
      id: "p",
      name: "Plan",
      setupRules: ["Original setup"],
      nodes: [
        {
          id: "decision",
          type: "decision",
          title: "Conditions met?",
          description: "Line one\nLine two",
          yes: "entry",
          no: "stop",
        },
        { id: "entry", type: "process", title: "Entry" },
        { id: "stop", type: "end", title: "No Trade" },
      ],
    },
  ];
  s.discipline = [
    ...records,
    { id: "global", date: "2026-11-06", answers, notes: "Personal reflection" },
  ];
  const round = await importLocalBackup(await exportLocalBackup(s));
  assert.deepEqual(
    round.trades.map((t) => ({
      ...t,
      screenshots: t.screenshots.map(({ backupPath, ...shot }) => shot),
    })),
    s.trades,
  );
  assert.deepEqual(round.playbooks, s.playbooks);
  assert.deepEqual(round.discipline, s.discipline);
});
test("flowchart migration preserves all legacy rule categories and multiline content", () => {
  const p = {
    setupRules: ["Sweep first", "Wait for confirmation"],
    entryChecklist: ["Enter with care"],
    invalidationRules: ["Stop here"],
    managementRules: ["Manage risk"],
    mistakeWarnings: ["Do not chase"],
    exampleNotes: "First line\nSecond line",
  };
  const nodes = flowNodes(p);
  assert.equal(nodes.length, 7);
  assert.equal(nodes.at(-1).description, p.exampleNotes);
  assert.equal(nodes[0].next, nodes[1].id);
  assert.equal(nodes[3].type, "process");
  assert.deepEqual(p.setupRules, ["Sweep first", "Wait for confirmation"]);
});
test("report grouping handles Sunday boundaries, UK entry windows, missing duration and overnight trades", () => {
  const t = {
    date: "2026-11-01",
    entryTime: "23:50",
    exitTime: "00:10",
    asset: "MNQ",
    strategy: "London Draw",
  };
  assert.equal(reportKey(t, "Days"), "Sunday");
  assert.equal(reportKey(t, "Weeks"), "2026-11-01");
  assert.equal(reportKey(t, "Months"), "2026-11");
  assert.equal(reportKey(t, "Duration"), "15–59 minutes");
  assert.equal(reportKey({ ...t, exitTime: "" }, "Duration"), "Not Available");
  assert.equal(
    reportKey({ ...t, entryTime: "" }, "Entry time"),
    "Not Available",
  );
  assert.equal(reportKey(t, "Instruments"), "MNQ");
});

test("older screenshots acquire distinct stable identifiers without changing images or notes", () => {
  const input = {
    accounts,
    trades: [
      {
        id: "old",
        accountId: "a",
        note: "Keep original",
        screenshots: [
          { name: "one.png", dataUrl: "data:image/png;base64,AA==" },
          { name: "two.png", dataUrl: "data:image/png;base64,AQ==" },
          { id: "duplicate", name: "three.png" },
          { id: "duplicate", name: "four.png" },
        ],
      },
    ],
  };
  const first = normalizeStore(input),
    second = normalizeStore(first);
  assert.equal(new Set(first.trades[0].screenshots.map((s) => s.id)).size, 4);
  assert.deepEqual(first, second);
  assert.equal(
    first.trades[0].screenshots[1].dataUrl,
    input.trades[0].screenshots[1].dataUrl,
  );
  assert.equal(input.trades[0].screenshots[0].id, undefined);
});

test("legacy ZIP metadata differences do not prevent repeated import; changed annotations still conflict", async () => {
  const { mergeBackupStores } = await import("../src/localJournal.js");
  const s = normalizeStore({
    accounts,
    trades: [
      {
        id: "old",
        accountId: "a",
        screenshots: [
          {
            id: "s",
            dataUrl: "data:image/png;base64,AA==",
            explanation: "Original\nExplanation",
          },
        ],
      },
      { id: "no-shot", accountId: "b", pnl: "0" },
    ],
  });
  const backup = await importLocalBackup(await exportLocalBackup(s));
  const merged = mergeBackupStores(mergeBackupStores(s, backup), backup);
  assert.equal(merged.trades.length, 2);
  assert.equal(
    merged.trades[0].screenshots[0].explanation,
    "Original\nExplanation",
  );
  backup.trades[0].screenshots[0].explanation = "Conflicting edit";
  assert.throws(() => mergeBackupStores(s, backup), /conflict/);
});

test("historical conflicts remain discoverable without executions and never qualify as compliant", () => {
  const a = disciplineAnalytics(records, [], null);
  assert.equal(a.days.length, 1);
  assert.equal(a.incomplete, 1);
  assert.equal(a.days[0].record.conflicts.length, 1);
  assert.equal(a.percent, null);
  assert.equal(
    a.rules.every((r) => r.answered === 0),
    true,
  );
});
