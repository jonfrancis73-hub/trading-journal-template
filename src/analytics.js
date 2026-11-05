import { normalizeOutcome, normalizeTimeInput, parseMoney, parseRR } from './journalRules.js';

export const SESSION_OPTIONS = ['Asia', 'London', 'NY AM', 'NY PM', 'Other'];
export const REVIEW_STATUSES = ['needs_review', 'reviewed', 'archived'];

export function normalizeReviewStatus(trade = {}) {
  if (REVIEW_STATUSES.includes(trade.reviewStatus)) return trade.reviewStatus;
  if (REVIEW_STATUSES.includes(trade.review_status)) return trade.review_status;
  if (trade.reviewed === true) return 'reviewed';
  if (trade.reviewed === false) return 'needs_review';
  return 'needs_review';
}

export function normalizeTags(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(isMeaningfulTag);
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(isMeaningfulTag);
}

function isMeaningfulTag(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return Boolean(normalized) && !['none', 'no mistake', 'no mistakes', 'n/a', 'na', 'null'].includes(normalized);
}

function tradeTags(trade, camelKey, snakeKey) {
  const camelValue = trade?.[camelKey];
  const hasCamelValue = Array.isArray(camelValue) ? camelValue.length > 0 : String(camelValue || '').trim();
  return hasCamelValue ? normalizeTags(camelValue) : normalizeTags(trade?.[snakeKey]);
}

export function isCountableTrade(trade = {}) {
  return ['Win', 'Loss', 'BE'].includes(normalizeOutcome(trade));
}

export function filterTrades(trades = [], filters = {}) {
  return trades.filter((trade) => {
    const date = String(trade.date || '');
    if (filters.startDate && date < filters.startDate) return false;
    if (filters.endDate && date > filters.endDate) return false;
    if (filters.accountId && trade.accountId !== filters.accountId) return false;
    if (filters.account && (trade.account || 'Personal') !== filters.account) return false;
    if (filters.asset && trade.asset !== filters.asset) return false;
    if (filters.outcome && normalizeOutcome(trade) !== filters.outcome) return false;
    if (filters.session && trade.session !== filters.session) return false;
    if (filters.direction && trade.direction !== filters.direction) return false;
    if (filters.playbookId && (trade.playbookId || trade.playbook_id || '') !== filters.playbookId) return false;
    if (filters.emotion && String(trade.emotion || '') !== filters.emotion) return false;
    if (filters.reviewStatus && normalizeReviewStatus(trade) !== filters.reviewStatus) return false;
    if (filters.setupTag && !tradeTags(trade, 'setupTags', 'setup_tags').includes(filters.setupTag)) return false;
    if (filters.mistakeTag && !tradeTags(trade, 'mistakeTags', 'mistake_tags').includes(filters.mistakeTag)) return false;
    return true;
  });
}

export function equityPoints(trades = []) {
  return trades
    .filter(isCountableTrade)
    .slice()
    .sort((a, b) => `${a.date || ''}-${a.createdAt || a.created_at || ''}`.localeCompare(`${b.date || ''}-${b.createdAt || b.created_at || ''}`))
    .reduce((points, trade, index) => {
      const value = (points[index - 1]?.value || 0) + parseMoney(trade.pnl);
      return points.concat({ index, date: trade.date, tradeId: trade.id, value, pnl: parseMoney(trade.pnl) });
    }, []);
}

export function equityPointsByPeriod(trades = [], period = 'total') {
  const countable = trades
    .filter(isCountableTrade)
    .slice()
    .sort((a, b) => `${a.date || ''}-${a.createdAt || a.created_at || ''}`.localeCompare(`${b.date || ''}-${b.createdAt || b.created_at || ''}`));

  if (period === 'total') {
    return equityPoints(countable).map((point, index) => ({
      ...point,
      index,
      label: point.date || `Trade ${index + 1}`,
      trades: 1,
    }));
  }

  const groups = new Map();
  for (const trade of countable) {
    const key = equityPeriodKey(trade.date, period);
    const current = groups.get(key.value) || {
      key: key.value,
      label: key.label,
      sortKey: key.sortKey,
      pnl: 0,
      trades: 0,
    };
    current.pnl += parseMoney(trade.pnl);
    current.trades += 1;
    groups.set(key.value, current);
  }

  return [...groups.values()]
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .reduce((points, group, index) => {
      const value = (points[index - 1]?.value || 0) + group.pnl;
      return points.concat({
        index,
        date: group.key,
        label: group.label,
        value,
        pnl: group.pnl,
        trades: group.trades,
      });
    }, []);
}

function equityPeriodKey(dateValue = '', period = 'daily') {
  const date = normalizedDate(dateValue);
  if (period === 'monthly') {
    const value = date ? date.slice(0, 7) : 'Undated';
    return { value, label: value, sortKey: value };
  }
  if (period === 'weekly') {
    const start = weekStart(date);
    const value = start || 'Undated';
    return { value, label: start ? `Week of ${start}` : 'Undated', sortKey: value };
  }
  const value = date || 'Undated';
  return { value, label: value, sortKey: value };
}

function normalizedDate(dateValue = '') {
  const match = String(dateValue || '').match(/^(\d{4})-(\d{2})-(\d{2})/u);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
}

function weekStart(dateValue = '') {
  const date = normalizedDate(dateValue);
  if (!date) return '';
  const [year, month, day] = date.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() - dayOfWeek + 1);
  return utc.toISOString().slice(0, 10);
}

export function calculateAdvancedStats(trades = []) {
  const outcomes = analyzedTrades(trades);
  const wins = outcomes.filter((trade) => trade.outcome === 'Win');
  const losses = outcomes.filter((trade) => trade.outcome === 'Loss');
  const breakeven = outcomes.filter((trade) => trade.outcome === 'BE');
  const decided = outcomes.filter((trade) => ['Win', 'Loss'].includes(trade.outcome));
  const netPnl = outcomes.reduce((sum, trade) => sum + trade.pnlValue, 0);
  const grossProfit = wins.reduce((sum, trade) => sum + Math.max(0, trade.pnlValue), 0);
  const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + Math.min(0, trade.pnlValue), 0));
  const rrValues = outcomes.map((trade) => parseRR(trade.rr)).filter((rr) => rr > 0);
  const points = equityPoints(outcomes);
  const drawdown = maxDrawdownDetails(points);
  const days = calendarStats(outcomes);
  const sortedDays = days.slice().sort((a, b) => a.netPnl - b.netPnl);
  const profitableDays = days.filter((day) => day.netPnl > 0);
  const losingDays = days.filter((day) => day.netPnl < 0);
  const flatDays = days.filter((day) => day.netPnl === 0);
  const winAmounts = wins.map((trade) => trade.pnlValue).filter((pnl) => pnl > 0);
  const lossAmounts = losses.map((trade) => trade.pnlValue).filter((pnl) => pnl < 0);
  const averageWin = avg(winAmounts);
  const averageLoss = avg(lossAmounts);
  const streaks = streakSummary(outcomes);
  const holdValues = outcomes.map((trade) => trade.holdMinutes).filter((minutes) => Number.isFinite(minutes));

  return {
    totalTrades: outcomes.length,
    wins: wins.length,
    losses: losses.length,
    breakeven: breakeven.length,
    decidedTrades: decided.length,
    netPnl,
    grossProfit,
    grossLoss,
    winRate: decided.length ? (wins.length / decided.length) * 100 : 0,
    lossRate: decided.length ? (losses.length / decided.length) * 100 : 0,
    breakevenRate: outcomes.length ? (breakeven.length / outcomes.length) * 100 : 0,
    avgRR: avg(rrValues),
    averageWin,
    averageLoss,
    averageTrade: outcomes.length ? netPnl / outcomes.length : 0,
    medianPnl: median(outcomes.map((trade) => trade.pnlValue)),
    expectancy: outcomes.length ? netPnl / outcomes.length : 0,
    profitFactor: grossLoss ? grossProfit / grossLoss : grossProfit ? Infinity : 0,
    payoffRatio: Math.abs(averageLoss) ? averageWin / Math.abs(averageLoss) : averageWin ? Infinity : 0,
    maxDrawdown: drawdown.amount,
    maxDrawdownStart: drawdown.start,
    maxDrawdownEnd: drawdown.end,
    maxDrawdownLength: drawdown.length,
    bestDay: sortedDays.at(-1) || null,
    worstDay: sortedDays[0] || null,
    tradingDays: days.length,
    profitableDays: profitableDays.length,
    losingDays: losingDays.length,
    flatDays: flatDays.length,
    dailyWinRate: days.length ? (profitableDays.length / days.length) * 100 : 0,
    averageDailyPnl: avg(days.map((day) => day.netPnl)),
    currentStreak: currentStreak(outcomes),
    longestWinStreak: streaks.longestWinStreak,
    longestLossStreak: streaks.longestLossStreak,
    bestTrade: outcomes.slice().sort((a, b) => b.pnlValue - a.pnlValue)[0] || null,
    worstTrade: outcomes.slice().sort((a, b) => a.pnlValue - b.pnlValue)[0] || null,
    largestWin: wins.slice().sort((a, b) => b.pnlValue - a.pnlValue)[0] || null,
    largestLoss: losses.slice().sort((a, b) => a.pnlValue - b.pnlValue)[0] || null,
    averageHoldMinutes: avg(holdValues),
    holdTimeCoverage: outcomes.length ? (holdValues.length / outcomes.length) * 100 : 0,
    entryTimeCoverage: outcomes.length ? (outcomes.filter((trade) => trade.entryMinutes !== null).length / outcomes.length) * 100 : 0,
    equity: points,
    reviewedRate: outcomes.length ? (outcomes.filter((trade) => normalizeReviewStatus(trade) === 'reviewed').length / outcomes.length) * 100 : 0,
  };
}

export function groupBreakdown(trades = [], key) {
  const groups = new Map();
  for (const trade of trades.filter(isCountableTrade)) {
    const values = groupValues(trade, key);
    for (const value of values) {
      if (!groups.has(value)) groups.set(value, []);
      groups.get(value).push(trade);
    }
  }
  return [...groups.entries()]
    .map(([label, items]) => ({ label, trades: items.length, stats: calculateAdvancedStats(items) }))
    .sort((a, b) => b.stats.netPnl - a.stats.netPnl);
}

export function analyticsBreakdowns(trades = []) {
  return {
    asset: groupBreakdown(trades, 'asset'),
    direction: groupBreakdown(trades, 'direction'),
    account: groupBreakdown(trades, 'account'),
    session: groupBreakdown(trades, 'session'),
    playbook: groupBreakdown(trades, 'playbook'),
    setupName: groupBreakdown(trades, 'setupName'),
    setupTag: groupBreakdown(trades, 'setupTag'),
    mistakeTag: groupBreakdown(trades, 'mistakeTag'),
    emotion: groupBreakdown(trades, 'emotion'),
    rating: groupBreakdown(trades, 'rating'),
    weekday: groupBreakdown(trades, 'weekday'),
    month: groupBreakdown(trades, 'month'),
  };
}

export function dataQualityReport(trades = []) {
  const countable = analyzedTrades(trades);
  const total = countable.length;
  const coverage = (predicate) => (total ? (countable.filter(predicate).length / total) * 100 : 0);

  const items = [
    {
      label: 'Screenshots',
      value: coverage(hasScreenshots),
      detail: `${countable.filter(hasScreenshots).length}/${total} trades have chart proof.`,
    },
    {
      label: 'Setup Tags',
      value: coverage((trade) => tradeTags(trade, 'setupTags', 'setup_tags').length > 0 || Boolean(trade.setupName || trade.setup_name)),
      detail: `${countable.filter((trade) => tradeTags(trade, 'setupTags', 'setup_tags').length > 0 || Boolean(trade.setupName || trade.setup_name)).length}/${total} trades have a setup label.`,
    },
    {
      label: 'Mistake Tags',
      value: coverage((trade) => tradeTags(trade, 'mistakeTags', 'mistake_tags').length > 0),
      detail: `${countable.filter((trade) => tradeTags(trade, 'mistakeTags', 'mistake_tags').length > 0).length}/${total} trades identify mistakes.`,
    },
    {
      label: 'Entry Time',
      value: coverage((trade) => trade.entryMinutes !== null),
      detail: `${countable.filter((trade) => trade.entryMinutes !== null).length}/${total} trades can be used for time-of-day edge.`,
    },
    {
      label: 'Plan Score',
      value: coverage((trade) => numericOrNull(trade.followedPlanScore ?? trade.followed_plan_score) !== null),
      detail: `${countable.filter((trade) => numericOrNull(trade.followedPlanScore ?? trade.followed_plan_score) !== null).length}/${total} trades have execution discipline scored.`,
    },
    {
      label: 'Notes',
      value: coverage(hasJournalNote),
      detail: `${countable.filter(hasJournalNote).length}/${total} trades have written context.`,
    },
  ];

  return {
    totalTrades: total,
    score: items.length ? avg(items.map((item) => item.value)) : 0,
    items: items.map((item) => ({ ...item, tone: qualityTone(item.value) })),
  };
}

export function edgeSummary(trades = []) {
  const countable = analyzedTrades(trades);
  const total = countable.length;
  const minSample = total >= 20 ? 5 : total >= 10 ? 3 : total >= 5 ? 2 : 1;
  const breakdowns = analyticsBreakdowns(countable);
  const candidates = edgeCandidates(breakdowns, minSample);
  const bestEdge = candidates
    .filter((row) => !row.isCleanup && row.stats.expectancy > 0)
    .sort((a, b) => b.stats.expectancy - a.stats.expectancy || b.stats.netPnl - a.stats.netPnl)[0] || null;
  const biggestLeak = candidates
    .filter((row) => !row.isCleanup && row.stats.expectancy < 0)
    .sort((a, b) => a.stats.expectancy - b.stats.expectancy || a.stats.netPnl - b.stats.netPnl)[0] || null;
  const dataGap = candidates
    .filter((row) => row.isCleanup)
    .sort((a, b) => b.trades - a.trades)[0] || null;
  const momentum = recentMomentum(countable);

  return {
    totalTrades: total,
    minSample,
    bestEdge: bestEdge ? summarizeEdge(bestEdge) : null,
    biggestLeak: biggestLeak ? summarizeEdge(biggestLeak) : null,
    dataGap: dataGap ? summarizeEdge(dataGap) : null,
    momentum,
  };
}

export function calendarStats(trades = []) {
  const days = new Map();
  for (const trade of trades.filter(isCountableTrade)) {
    const day = trade.date || 'Undated';
    const current = days.get(day) || { date: day, netPnl: 0, trades: 0, wins: 0, losses: 0, breakeven: 0 };
    const outcome = normalizeOutcome(trade);
    current.netPnl += parseMoney(trade.pnl);
    current.trades += 1;
    if (outcome === 'Win') current.wins += 1;
    if (outcome === 'Loss') current.losses += 1;
    if (outcome === 'BE') current.breakeven += 1;
    days.set(day, current);
  }
  return [...days.values()].sort((a, b) => b.date.localeCompare(a.date));
}

export function reviewQueue(trades = []) {
  const countable = trades.filter(isCountableTrade);
  const byPnlDesc = countable.slice().sort((a, b) => parseMoney(b.pnl) - parseMoney(a.pnl));
  const mistakes = new Map();
  for (const trade of countable) {
    for (const tag of tradeTags(trade, 'mistakeTags', 'mistake_tags')) {
      mistakes.set(tag, (mistakes.get(tag) || 0) + 1);
    }
  }
  return {
    needsReview: countable.filter((trade) => normalizeReviewStatus(trade) === 'needs_review').slice(0, 10),
    biggestWins: byPnlDesc.filter((trade) => parseMoney(trade.pnl) > 0).slice(0, 5),
    biggestLosses: byPnlDesc.filter((trade) => parseMoney(trade.pnl) < 0).slice(-5).reverse(),
    planBreaks: countable
      .filter((trade) => Number.isFinite(Number(trade.followedPlanScore ?? trade.followed_plan_score)) && Number(trade.followedPlanScore ?? trade.followed_plan_score) < 70)
      .sort((a, b) => Number(a.followedPlanScore ?? a.followed_plan_score) - Number(b.followedPlanScore ?? b.followed_plan_score))
      .slice(0, 8),
    repeatedMistakes: [...mistakes.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count).slice(0, 8),
    recentBreakeven: countable.filter((trade) => normalizeOutcome(trade) === 'BE').slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 5),
  };
}

export function plannedVsActualStats(trades = []) {
  const rows = analyzedTrades(trades).map((trade) => {
    const plannedTarget = numericOrNull(trade.plannedTarget ?? trade.planned_target);
    const plannedStop = numericOrNull(trade.plannedStop ?? trade.planned_stop);
    const actualExit = numericOrNull(trade.actualExit ?? trade.actual_exit);
    const followedPlanScore = numericOrNull(trade.followedPlanScore ?? trade.followed_plan_score);
    const plannedRange = plannedTarget !== null && plannedStop !== null ? Math.abs(plannedTarget - plannedStop) : null;
    const actualFromStop = actualExit !== null && plannedStop !== null ? Math.abs(actualExit - plannedStop) : null;
    const plannedCapture = plannedRange && actualFromStop !== null ? (actualFromStop / plannedRange) * 100 : null;
    return {
      ...trade,
      plannedTarget,
      plannedStop,
      actualExit,
      followedPlanScore,
      plannedCapture,
      hasPlanPrices: plannedTarget !== null && plannedStop !== null && actualExit !== null,
    };
  });
  const plannedRows = rows.filter((row) => row.hasPlanPrices);
  const scoreRows = rows.filter((row) => row.followedPlanScore !== null);
  const brokenPlanRows = rows.filter((row) => row.followedPlanScore !== null && row.followedPlanScore < 70);
  return {
    trades: rows.length,
    plannedTrades: plannedRows.length,
    planCoverage: rows.length ? (plannedRows.length / rows.length) * 100 : 0,
    scoreCoverage: rows.length ? (scoreRows.length / rows.length) * 100 : 0,
    averageFollowedPlanScore: avg(scoreRows.map((row) => row.followedPlanScore)),
    brokenPlanCount: brokenPlanRows.length,
    brokenPlanRate: scoreRows.length ? (brokenPlanRows.length / scoreRows.length) * 100 : 0,
    averagePlannedCapture: avg(plannedRows.map((row) => row.plannedCapture).filter((value) => Number.isFinite(value))),
    bestPlanTrade: scoreRows.slice().sort((a, b) => b.followedPlanScore - a.followedPlanScore)[0] || null,
    worstPlanTrade: scoreRows.slice().sort((a, b) => a.followedPlanScore - b.followedPlanScore)[0] || null,
  };
}

export function distributionBuckets(trades = [], metric = 'pnl') {
  const bucketDefs = metric === 'rr' ? [
    { label: '0', test: (value) => value === 0 },
    { label: '0.1-0.9', test: (value) => value > 0 && value < 1 },
    { label: '1-1.49', test: (value) => value >= 1 && value < 1.5 },
    { label: '1.5-1.99', test: (value) => value >= 1.5 && value < 2 },
    { label: '2-2.99', test: (value) => value >= 2 && value < 3 },
    { label: '3+', test: (value) => value >= 3 },
  ] : [
    { label: '-$1000 or worse', test: (value) => value <= -1000 },
    { label: '-$999 to -$500', test: (value) => value > -1000 && value <= -500 },
    { label: '-$499 to -$100', test: (value) => value > -500 && value <= -100 },
    { label: '-$99 to -$1', test: (value) => value > -100 && value < 0 },
    { label: '$0', test: (value) => value === 0 },
    { label: '+$1 to +$99', test: (value) => value > 0 && value < 100 },
    { label: '+$100 to +$499', test: (value) => value >= 100 && value < 500 },
    { label: '+$500 to +$999', test: (value) => value >= 500 && value < 1000 },
    { label: '+$1000 or better', test: (value) => value >= 1000 },
  ];

  const buckets = bucketDefs.map((bucket) => ({ ...bucket, items: [] }));
  for (const trade of analyzedTrades(trades)) {
    const value = metric === 'rr' ? trade.rrValue : trade.pnlValue;
    const bucket = buckets.find((item) => item.test(value));
    if (bucket) bucket.items.push(trade);
  }

  return buckets
    .filter((bucket) => bucket.items.length)
    .map((bucket) => ({ label: bucket.label, trades: bucket.items.length, stats: calculateAdvancedStats(bucket.items) }));
}

export function timeOfDayBreakdown(trades = []) {
  const groups = new Map();
  for (const trade of analyzedTrades(trades)) {
    const label = trade.entryMinutes === null ? 'No entry time' : `${String(Math.floor(trade.entryMinutes / 60)).padStart(2, '0')}:00`;
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(trade);
  }
  return [...groups.entries()]
    .map(([label, items]) => ({ label, trades: items.length, stats: calculateAdvancedStats(items) }))
    .sort((a, b) => timeLabelSort(a.label) - timeLabelSort(b.label));
}

export function holdingTimeBreakdown(trades = []) {
  const buckets = [
    { label: '0-5m', test: (value) => value !== null && value <= 5 },
    { label: '6-15m', test: (value) => value !== null && value > 5 && value <= 15 },
    { label: '16-30m', test: (value) => value !== null && value > 15 && value <= 30 },
    { label: '31-60m', test: (value) => value !== null && value > 30 && value <= 60 },
    { label: '1-2h', test: (value) => value !== null && value > 60 && value <= 120 },
    { label: '2h+', test: (value) => value !== null && value > 120 },
    { label: 'No hold time', test: (value) => value === null },
  ].map((bucket) => ({ ...bucket, items: [] }));

  for (const trade of analyzedTrades(trades)) {
    const bucket = buckets.find((item) => item.test(trade.holdMinutes));
    if (bucket) bucket.items.push(trade);
  }

  return buckets
    .filter((bucket) => bucket.items.length)
    .map((bucket) => ({ label: bucket.label, trades: bucket.items.length, stats: calculateAdvancedStats(bucket.items) }));
}

export function crossAnalysisMatrix(trades = [], rowKey, columnKey) {
  const rowGroups = new Map();
  const columns = [];
  const columnSet = new Set();

  for (const trade of trades.filter(isCountableTrade)) {
    const rowValues = groupValues(trade, rowKey);
    const columnValues = groupValues(trade, columnKey);
    for (const column of columnValues) {
      if (!columnSet.has(column)) {
        columnSet.add(column);
        columns.push(column);
      }
    }
    for (const row of rowValues) {
      if (!rowGroups.has(row)) rowGroups.set(row, new Map());
      for (const column of columnValues) {
        const columnMap = rowGroups.get(row);
        if (!columnMap.has(column)) columnMap.set(column, []);
        columnMap.get(column).push(trade);
      }
    }
  }

  const sortedColumns = sortColumns(columns, columnKey);
  const rows = [...rowGroups.entries()].map(([label, columnMap]) => {
    const rowTrades = [...columnMap.values()].flat();
    return {
      label,
      stats: calculateAdvancedStats(rowTrades),
      columns: sortedColumns.map((column) => {
        const items = columnMap.get(column) || [];
        return { label: column, trades: items.length, stats: calculateAdvancedStats(items) };
      }),
    };
  }).sort((a, b) => b.stats.netPnl - a.stats.netPnl);

  return { columns: sortedColumns, rows };
}

export function focusAreas(trades = []) {
  const stats = calculateAdvancedStats(trades);
  if (!stats.totalTrades) {
    return [{ tone: 'neutral', title: 'Build the sample size', value: 'No trades', detail: 'Add trades with screenshots, setup tags, sessions, and outcomes before judging performance.' }];
  }

  const areas = [];
  const breakdowns = analyticsBreakdowns(trades);
  const worstMistake = breakdowns.mistakeTag
    .filter((row) => row.label !== 'No mistake tag' && row.trades >= 2)
    .sort((a, b) => a.stats.netPnl - b.stats.netPnl)[0];
  if (worstMistake && worstMistake.stats.netPnl < 0) {
    areas.push({
      tone: 'red',
      title: 'Most expensive mistake',
      value: worstMistake.label,
      metric: worstMistake.stats.netPnl,
      detail: `${worstMistake.trades} trades, ${round(worstMistake.stats.expectancy)} average expectancy.`,
    });
  }

  const weakSession = breakdowns.session
    .filter((row) => row.label !== 'Unspecified' && row.trades >= 2)
    .sort((a, b) => a.stats.expectancy - b.stats.expectancy)[0];
  if (weakSession && weakSession.stats.expectancy < 0) {
    areas.push({
      tone: 'red',
      title: 'Weakest session',
      value: weakSession.label,
      metric: weakSession.stats.netPnl,
      detail: `${weakSession.trades} trades, ${round(weakSession.stats.winRate)}% win rate.`,
    });
  }

  const bestSetup = breakdowns.setupTag
    .filter((row) => row.label !== 'No setup tag' && row.trades >= 2)
    .sort((a, b) => b.stats.expectancy - a.stats.expectancy)[0];
  if (bestSetup && bestSetup.stats.expectancy > 0) {
    areas.push({
      tone: 'green',
      title: 'Best repeatable setup',
      value: bestSetup.label,
      metric: bestSetup.stats.expectancy,
      detail: `${bestSetup.trades} trades, ${round(bestSetup.stats.profitFactor)} profit factor.`,
    });
  }

  if (stats.reviewedRate < 70) {
    areas.push({
      tone: 'amber',
      title: 'Review discipline',
      value: `${round(stats.reviewedRate)}% reviewed`,
      metric: stats.totalTrades - Math.round((stats.reviewedRate / 100) * stats.totalTrades),
      detail: 'Review rate is under 70%. Clear the needs-review queue before adding more complexity.',
    });
  }

  if (stats.longestLossStreak >= 3) {
    areas.push({
      tone: 'red',
      title: 'Loss streak risk',
      value: `${stats.longestLossStreak} losses`,
      metric: stats.longestLossStreak,
      detail: 'Add a cooldown rule after repeated losses and compare results after the next sample.',
    });
  }

  if (stats.entryTimeCoverage < 65) {
    areas.push({
      tone: 'amber',
      title: 'Missing timing data',
      value: `${round(stats.entryTimeCoverage)}% coverage`,
      metric: stats.entryTimeCoverage,
      detail: 'Entry time is needed to find your best and worst trading windows.',
    });
  }

  return areas.slice(0, 6);
}

function analyzedTrades(trades = []) {
  return trades.filter(isCountableTrade).map((trade) => {
    const entryMinutes = minutesOfDay(trade.entryTime || trade.entry_time);
    const exitMinutes = minutesOfDay(trade.exitTime || trade.exit_time);
    const holdMinutes = durationMinutes(entryMinutes, exitMinutes);
    return {
      ...trade,
      outcome: normalizeOutcome(trade),
      pnlValue: parseMoney(trade.pnl),
      rrValue: parseRR(trade.rr),
      entryMinutes,
      exitMinutes,
      holdMinutes,
    };
  });
}

function edgeCandidates(breakdowns, minSample) {
  const config = [
    ['Asset', breakdowns.asset],
    ['Session', breakdowns.session],
    ['Playbook', breakdowns.playbook],
    ['Setup', breakdowns.setupName],
    ['Setup tag', breakdowns.setupTag],
    ['Mistake', breakdowns.mistakeTag],
    ['Emotion', breakdowns.emotion],
    ['Rating', breakdowns.rating],
    ['Day', breakdowns.weekday],
  ];

  return config.flatMap(([type, rows]) => rows
    .filter((row) => row.trades >= minSample)
    .map((row) => ({
      ...row,
      type,
      isCleanup: /^no |^unspecified$/iu.test(String(row.label || '')),
    })));
}

function summarizeEdge(row) {
  return {
    type: row.type,
    label: row.label,
    trades: row.trades,
    netPnl: row.stats.netPnl,
    expectancy: row.stats.expectancy,
    winRate: row.stats.winRate,
    profitFactor: row.stats.profitFactor,
  };
}

function recentMomentum(trades = []) {
  const sorted = trades.slice().sort((a, b) => `${a.date || ''}-${a.createdAt || a.created_at || ''}`.localeCompare(`${b.date || ''}-${b.createdAt || b.created_at || ''}`));
  const sampleSize = Math.min(10, Math.max(1, Math.floor(sorted.length / 2)));
  if (sorted.length < 2) {
    return {
      sampleSize: sorted.length,
      current: calculateAdvancedStats(sorted),
      previous: null,
      netPnlDelta: 0,
      expectancyDelta: 0,
      winRateDelta: 0,
    };
  }

  const currentTrades = sorted.slice(-sampleSize);
  const previousTrades = sorted.slice(-sampleSize * 2, -sampleSize);
  const current = calculateAdvancedStats(currentTrades);
  const previous = previousTrades.length ? calculateAdvancedStats(previousTrades) : null;

  return {
    sampleSize,
    current,
    previous,
    netPnlDelta: previous ? current.netPnl - previous.netPnl : current.netPnl,
    expectancyDelta: previous ? current.expectancy - previous.expectancy : current.expectancy,
    winRateDelta: previous ? current.winRate - previous.winRate : current.winRate,
  };
}

function hasScreenshots(trade) {
  return Array.isArray(trade.screenshots) && trade.screenshots.some((shot) => shot?.url || shot?.previewUrl || shot?.path || shot?.storagePath || shot?.storage_path || shot?.dataUrl);
}

function hasJournalNote(trade) {
  const sections = trade.sections && typeof trade.sections === 'object' ? Object.values(trade.sections).join(' ') : '';
  return Boolean(String(trade.note || trade.rawNote || trade.raw_note || trade.lesson || sections || '').trim());
}

function qualityTone(value) {
  if (value >= 75) return 'green';
  if (value >= 45) return 'amber';
  return 'red';
}

function avg(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function median(values) {
  const sorted = values.filter((value) => Number.isFinite(value)).slice().sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function round(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}

function minutesOfDay(value) {
  const match = normalizeTimeInput(value).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function durationMinutes(entryMinutes, exitMinutes) {
  if (entryMinutes === null || exitMinutes === null) return null;
  const duration = exitMinutes - entryMinutes;
  return duration >= 0 ? duration : duration + 24 * 60;
}

function maxDrawdownDetails(points = []) {
  let peak = { value: 0, date: null, index: -1 };
  let worst = { amount: 0, start: null, end: null, length: 0 };
  for (const point of points) {
    if (point.value > peak.value) peak = point;
    const amount = point.value - peak.value;
    if (amount < worst.amount) {
      worst = {
        amount,
        start: peak.date || null,
        end: point.date || null,
        length: Math.max(0, point.index - peak.index),
      };
    }
  }
  return worst;
}

function currentStreak(trades) {
  const sorted = trades.slice().sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  let type = '';
  let count = 0;
  for (const trade of sorted) {
    const outcome = normalizeOutcome(trade);
    if (!['Win', 'Loss'].includes(outcome)) continue;
    if (outcome !== type) {
      type = outcome;
      count = 1;
    } else {
      count += 1;
    }
  }
  return { type, count };
}

function streakSummary(trades) {
  const sorted = trades.slice().sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  let activeType = '';
  let activeCount = 0;
  let longestWinStreak = 0;
  let longestLossStreak = 0;

  for (const trade of sorted) {
    const outcome = normalizeOutcome(trade);
    if (!['Win', 'Loss'].includes(outcome)) {
      activeType = '';
      activeCount = 0;
      continue;
    }
    if (outcome === activeType) {
      activeCount += 1;
    } else {
      activeType = outcome;
      activeCount = 1;
    }
    if (outcome === 'Win') longestWinStreak = Math.max(longestWinStreak, activeCount);
    if (outcome === 'Loss') longestLossStreak = Math.max(longestLossStreak, activeCount);
  }

  return { longestWinStreak, longestLossStreak };
}

function groupValues(trade, key) {
  if (key === 'setupTag') {
    const tags = tradeTags(trade, 'setupTags', 'setup_tags');
    return tags.length ? tags : ['No setup tag'];
  }
  if (key === 'mistakeTag') {
    const tags = tradeTags(trade, 'mistakeTags', 'mistake_tags');
    return tags.length ? tags : ['No mistake tag'];
  }
  if (key === 'outcome') return [normalizeOutcome(trade) || 'Unspecified'];
  if (key === 'emotion') return [trade.emotion || 'No emotion'];
  if (key === 'playbook') return [trade.playbookName || trade.playbook_name || trade.playbook || 'No playbook'];
  if (key === 'setupName') return [trade.setupName || trade.setup_name || 'No setup'];
  if (key === 'entryHour') {
    const minutes = minutesOfDay(trade.entryTime || trade.entry_time);
    return [minutes === null ? 'No entry time' : `${String(Math.floor(minutes / 60)).padStart(2, '0')}:00`];
  }
  if (key === 'holdTime') {
    const hold = durationMinutes(minutesOfDay(trade.entryTime || trade.entry_time), minutesOfDay(trade.exitTime || trade.exit_time));
    if (hold === null) return ['No hold time'];
    if (hold <= 5) return ['0-5m'];
    if (hold <= 15) return ['6-15m'];
    if (hold <= 30) return ['16-30m'];
    if (hold <= 60) return ['31-60m'];
    if (hold <= 120) return ['1-2h'];
    return ['2h+'];
  }
  if (key === 'weekday') {
    const date = trade.date ? new Date(`${trade.date}T00:00:00`) : null;
    return [date && !Number.isNaN(date.valueOf()) ? date.toLocaleDateString('en-US', { weekday: 'long' }) : 'Undated'];
  }
  if (key === 'month') return [String(trade.date || '').slice(0, 7) || 'Undated'];
  return [trade[key] || (key === 'account' ? 'Personal' : 'Unspecified')];
}

function numericOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function timeLabelSort(label) {
  if (label === 'No entry time') return 99;
  return Number(label.slice(0, 2));
}

function sortColumns(columns, key) {
  const preferred = {
    outcome: ['Win', 'Loss', 'BE', 'Missed', 'No Trade', 'Unspecified'],
    direction: ['Long', 'Short', 'No Trade', 'Unspecified'],
    session: SESSION_OPTIONS.concat('Unspecified'),
    holdTime: ['0-5m', '6-15m', '16-30m', '31-60m', '1-2h', '2h+', 'No hold time'],
  }[key];

  if (preferred) {
    return columns.slice().sort((a, b) => {
      const aIndex = preferred.indexOf(a);
      const bIndex = preferred.indexOf(b);
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex) || String(a).localeCompare(String(b));
    });
  }

  if (key === 'entryHour') return columns.slice().sort((a, b) => timeLabelSort(a) - timeLabelSort(b));
  return columns.slice().sort((a, b) => String(a).localeCompare(String(b)));
}
