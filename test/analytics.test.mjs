import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyticsBreakdowns,
  calculateAdvancedStats,
  calendarStats,
  crossAnalysisMatrix,
  dataQualityReport,
  distributionBuckets,
  edgeSummary,
  equityPointsByPeriod,
  filterTrades,
  focusAreas,
  holdingTimeBreakdown,
  normalizeReviewStatus,
  plannedVsActualStats,
  reviewQueue,
  timeOfDayBreakdown,
} from '../src/analytics.js';

const trades = [
  { id: '1', date: '2026-06-01', account: 'Personal', asset: 'MNQ', direction: 'Long', session: 'NY AM', entryTime: '09:31', exitTime: '09:45', emotion: 'Calm', outcome: 'Win', pnl: 500, rr: '2RR', setupTags: ['SMT'], mistakeTags: [], rating: 'A', reviewed: true, playbookId: 'pb1', playbookName: 'NY AM SMT', setupName: 'SMT sweep', plannedTarget: 100, plannedStop: 50, actualExit: 95, followedPlanScore: 90 },
  { id: '2', date: '2026-06-02', account: 'Personal', asset: 'MNQ', direction: 'Short', session: 'NY AM', entryTime: '10:05', exitTime: '10:10', emotion: 'Rushed', outcome: 'Loss', pnl: -200, rr: '1RR', setupTags: ['IFVG'], mistakeTags: ['Chase'], rating: 'Mistake', reviewed: false, playbookId: 'pb2', playbookName: 'IFVG Continuation', setupName: 'IFVG', plannedTarget: 120, plannedStop: 80, actualExit: 82, followedPlanScore: 45 },
  { id: '3', date: '2026-06-02', account: 'Funded', asset: 'ES', direction: 'Long', session: 'London', entryTime: '03:00', exitTime: '03:05', emotion: 'Patient', outcome: 'BE', pnl: 0, rr: '0RR', setupTags: ['SMT'], mistakeTags: ['Chase'], rating: 'B', reviewStatus: 'needs_review', playbookId: 'pb1', playbookName: 'NY AM SMT', setupName: 'SMT sweep', followedPlanScore: 70 },
  { id: '4', date: '2026-06-03', account: 'Funded', asset: 'ES', direction: 'Short', session: 'NY PM', entryTime: '13:10', exitTime: '13:45', emotion: 'Calm', outcome: 'Win', pnl: 300, rr: '1.5RR', setupTags: ['Sweep'], mistakeTags: [], rating: 'A', reviewStatus: 'reviewed', setupName: 'Sweep reversal' },
];

test('calculates production analytics stats', () => {
  const stats = calculateAdvancedStats(trades);

  assert.equal(stats.totalTrades, 4);
  assert.equal(stats.wins, 2);
  assert.equal(stats.losses, 1);
  assert.equal(stats.breakeven, 1);
  assert.equal(stats.netPnl, 600);
  assert.equal(stats.winRate, 66.66666666666666);
  assert.equal(stats.expectancy, 150);
  assert.equal(stats.profitFactor, 4);
  assert.equal(stats.payoffRatio, 2);
  assert.equal(stats.averageTrade, 150);
  assert.equal(stats.medianPnl, 150);
  assert.equal(stats.breakevenRate, 25);
  assert.equal(stats.grossProfit, 800);
  assert.equal(stats.grossLoss, 200);
  assert.equal(stats.maxDrawdown, -200);
  assert.equal(stats.maxDrawdownStart, '2026-06-01');
  assert.equal(stats.maxDrawdownEnd, '2026-06-02');
  assert.equal(stats.longestWinStreak, 1);
  assert.equal(stats.longestLossStreak, 1);
  assert.equal(stats.averageHoldMinutes, 14.75);
  assert.equal(stats.entryTimeCoverage, 100);
  assert.deepEqual(stats.currentStreak, { type: 'Win', count: 1 });
});

test('filters trades by production metadata', () => {
  assert.deepEqual(filterTrades(trades, { session: 'NY AM' }).map((trade) => trade.id), ['1', '2']);
  assert.deepEqual(filterTrades(trades, { setupTag: 'SMT' }).map((trade) => trade.id), ['1', '3']);
  assert.deepEqual(filterTrades(trades, { mistakeTag: 'Chase' }).map((trade) => trade.id), ['2', '3']);
  assert.deepEqual(filterTrades(trades, { reviewStatus: 'needs_review' }).map((trade) => trade.id), ['2', '3']);
  assert.deepEqual(filterTrades(trades, { direction: 'Short' }).map((trade) => trade.id), ['2', '4']);
  assert.deepEqual(filterTrades(trades, { playbookId: 'pb1' }).map((trade) => trade.id), ['1', '3']);
  assert.deepEqual(filterTrades(trades, { emotion: 'Calm' }).map((trade) => trade.id), ['1', '4']);
});

test('builds cumulative pnl points by daily, weekly, monthly, and total periods', () => {
  const periodTrades = [
    { id: 'a', date: '2026-06-01', outcome: 'Win', pnl: 100, createdAt: '09:00' },
    { id: 'b', date: '2026-06-01', outcome: 'Loss', pnl: -25, createdAt: '10:00' },
    { id: 'c', date: '2026-06-08', outcome: 'Win', pnl: 200, createdAt: '09:00' },
    { id: 'd', date: '2026-07-01', outcome: 'Loss', pnl: -50, createdAt: '09:00' },
  ];

  assert.deepEqual(equityPointsByPeriod(periodTrades, 'daily').map((point) => [point.label, point.pnl, point.value, point.trades]), [
    ['2026-06-01', 75, 75, 2],
    ['2026-06-08', 200, 275, 1],
    ['2026-07-01', -50, 225, 1],
  ]);
  assert.deepEqual(equityPointsByPeriod(periodTrades, 'weekly').map((point) => [point.label, point.pnl, point.value]), [
    ['Week of 2026-06-01', 75, 75],
    ['Week of 2026-06-08', 200, 275],
    ['Week of 2026-06-29', -50, 225],
  ]);
  assert.deepEqual(equityPointsByPeriod(periodTrades, 'monthly').map((point) => [point.label, point.pnl, point.value]), [
    ['2026-06', 275, 275],
    ['2026-07', -50, 225],
  ]);
  assert.deepEqual(equityPointsByPeriod(periodTrades, 'total').map((point) => point.value), [100, 75, 275, 225]);
});

test('builds breakdowns, calendar stats, and review queue', () => {
  const breakdowns = analyticsBreakdowns(trades);
  assert.equal(breakdowns.asset[0].label, 'MNQ');
  assert.ok(breakdowns.playbook.some((row) => row.label === 'NY AM SMT' && row.trades === 2));
  assert.ok(breakdowns.setupName.some((row) => row.label === 'SMT sweep' && row.trades === 2));
  assert.ok(breakdowns.setupTag.some((row) => row.label === 'SMT' && row.trades === 2));
  assert.ok(breakdowns.emotion.some((row) => row.label === 'Calm' && row.trades === 2));

  const days = calendarStats(trades);
  assert.equal(days.find((day) => day.date === '2026-06-02').trades, 2);
  assert.equal(days.find((day) => day.date === '2026-06-02').netPnl, -200);

  const queue = reviewQueue(trades);
  assert.deepEqual(queue.needsReview.map((trade) => trade.id), ['2', '3']);
  assert.deepEqual(queue.planBreaks.map((trade) => trade.id), ['2']);
  assert.deepEqual(queue.repeatedMistakes, [{ tag: 'Chase', count: 2 }]);
});

test('calculates planned versus actual report metrics', () => {
  const stats = plannedVsActualStats(trades);

  assert.equal(stats.trades, 4);
  assert.equal(stats.plannedTrades, 2);
  assert.equal(stats.planCoverage, 50);
  assert.equal(stats.scoreCoverage, 75);
  assert.equal(stats.averageFollowedPlanScore, 68.33333333333333);
  assert.equal(stats.brokenPlanCount, 1);
  assert.equal(stats.brokenPlanRate, 33.33333333333333);
  assert.equal(stats.averagePlannedCapture, 47.5);
  assert.equal(stats.bestPlanTrade.id, '1');
  assert.equal(stats.worstPlanTrade.id, '2');
});

test('builds risk distributions, timing breakdowns, matrices, and focus areas', () => {
  const pnlBuckets = distributionBuckets(trades, 'pnl');
  assert.ok(pnlBuckets.some((row) => row.label === '+$500 to +$999' && row.trades === 1));
  assert.ok(pnlBuckets.some((row) => row.label === '-$499 to -$100' && row.stats.netPnl === -200));

  const rrBuckets = distributionBuckets(trades, 'rr');
  assert.ok(rrBuckets.some((row) => row.label === '1.5-1.99' && row.trades === 1));

  const hours = timeOfDayBreakdown(trades);
  assert.deepEqual(hours.map((row) => row.label), ['03:00', '09:00', '10:00', '13:00']);
  assert.deepEqual(timeOfDayBreakdown([{ id: 'dot-time', date: '2026-06-04', outcome: 'Win', pnl: 100, entryTime: '10.18' }]).map((row) => row.label), ['10:00']);

  const holds = holdingTimeBreakdown(trades);
  assert.ok(holds.some((row) => row.label === '0-5m' && row.trades === 2));
  assert.ok(holds.some((row) => row.label === '31-60m' && row.trades === 1));

  const matrix = crossAnalysisMatrix(trades, 'session', 'outcome');
  const nyAm = matrix.rows.find((row) => row.label === 'NY AM');
  assert.equal(nyAm.columns.find((cell) => cell.label === 'Win').trades, 1);
  assert.equal(nyAm.columns.find((cell) => cell.label === 'Loss').stats.netPnl, -200);

  const focus = focusAreas(trades);
  assert.ok(focus.some((item) => item.title === 'Review discipline'));
  assert.ok(focus.some((item) => item.title === 'Best repeatable setup'));
});

test('builds actionable analytics summary and data quality report', () => {
  const quality = dataQualityReport(trades);
  assert.equal(quality.totalTrades, 4);
  assert.equal(quality.items.find((item) => item.label === 'Setup Tags').value, 100);
  assert.equal(quality.items.find((item) => item.label === 'Mistake Tags').value, 50);
  assert.equal(quality.items.find((item) => item.label === 'Entry Time').tone, 'green');
  assert.equal(quality.items.find((item) => item.label === 'Screenshots').tone, 'red');

  const summary = edgeSummary(trades);
  assert.equal(summary.totalTrades, 4);
  assert.equal(summary.minSample, 1);
  assert.ok(summary.bestEdge);
  assert.ok(summary.biggestLeak);
  assert.ok(summary.momentum.current.totalTrades > 0);
  assert.equal(summary.dataGap.label, 'No mistake tag');
});

test('normalizes legacy reviewed state to review status', () => {
  assert.equal(normalizeReviewStatus({ reviewed: true }), 'reviewed');
  assert.equal(normalizeReviewStatus({ reviewed: false }), 'needs_review');
  assert.equal(normalizeReviewStatus({ reviewStatus: 'archived' }), 'archived');
});
