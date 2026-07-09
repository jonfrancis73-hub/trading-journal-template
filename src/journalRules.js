export const ASSETS = ['MNQ', 'NQ', 'MES', 'ES'];
export const DIRECTIONS = ['Long', 'Short', 'No Trade'];
export const OUTCOMES = ['Win', 'Loss', 'BE', 'Missed', 'No Trade'];
export const RATINGS = ['A+', 'A', 'B+', 'B', 'C', 'Mistake'];

export const JOURNAL_TEMPLATES = [
  {
    id: 'execution',
    label: 'Execution Review',
    body: [
      'Setup:',
      'Entry reason:',
      'Exit reason:',
      'Management:',
      'Did I follow the plan?',
      'Lesson:',
    ].join('\n'),
  },
  {
    id: 'loss',
    label: 'Loss Recap',
    body: [
      'What made this a valid idea?',
      'Where did the loss actually come from?',
      'Was the stop planned or emotional?',
      'What rule prevents this next time?',
    ].join('\n'),
  },
  {
    id: 'missed',
    label: 'Missed Trade',
    body: [
      'What was the setup?',
      'Why did I miss it?',
      'Was the entry model present?',
      'What will I do next time this appears?',
    ].join('\n'),
  },
  {
    id: 'weekly',
    label: 'Weekly Review',
    body: [
      'Best setup this week:',
      'Most expensive mistake:',
      'What I repeated well:',
      'What I must stop doing:',
      'One focus for next week:',
    ].join('\n'),
  },
];

const SETUP_TERMS = [
  { key: 'SMT', pattern: /\bsmt\b/i },
  { key: 'IFVG', pattern: /\bifvg\b/i },
  { key: 'FVG', pattern: /\bfvg\b/i },
  { key: 'MSS/BOS', pattern: /\b(mss|bos|break of structure|market structure shift)\b/i },
  { key: 'liquidity sweep', pattern: /\b(liquidity|sweep|bsl|ssl|buy side|sell side)\b/i },
  { key: 'macro window', pattern: /\b(macro|killzone|kz|9:30|10am|ny|london)\b/i },
  { key: 'draw on liquidity', pattern: /\b(draw on liquidity|draw|pd array|premium|discount|equal highs|equal lows)\b/i },
];

const SECOND_TRADE_PATTERN = /\b(second trade|second entry|second attempt|re-?entry|re-?entered|another trade|again|revenge|one more|make it back|overtrade)\b/i;

const EXECUTION_TERMS = [
  { key: 'entry timing', pattern: /\b(entry|entered|limit|market order|confirmation|trigger)\b/i },
  { key: 'stop management', pattern: /\b(moved|move|tightened|be|breakeven|stop|sl|risk)\b/i },
  { key: 'target management', pattern: /\b(tp|target|partial|runner|exit|held|closed)\b/i },
  { key: 'near miss', pattern: /\b(missed fill|1 tick|one tick|near tp|almost tapped|almost hit)\b/i },
];

const PSYCHOLOGY_TERMS = [
  { key: 'FOMO', pattern: /\b(fomo|chased|chase|rushed|forced)\b/i },
  { key: 'revenge / second trade', pattern: SECOND_TRADE_PATTERN },
  { key: 'hesitation', pattern: /\b(hesitat|scared|nervous|afraid|doubt|freeze)\b/i },
  { key: 'discipline issue', pattern: /\b(broke rule|mistake|impulsive|tilt|impatient)\b/i },
];

const POSITIVE_TERMS = [
  { key: 'waited for confirmation', pattern: /\b(waited|patient|confirmation|confirmed|model entry|planned|clean entry)\b/i },
  { key: 'respected the plan', pattern: /\b(respected|followed|stuck to|only took|one trade|no revenge)\b/i },
  { key: 'managed risk', pattern: /\b(risk|stop|invalid|protected|partial|scaled)\b/i },
];

const MISTAKE_TERMS = [
  { key: 'early stop movement', pattern: /\b(moved|move|tightened|be|breakeven|stop|sl)\b/i },
  { key: 'chase entry', pattern: /\b(fomo|chased|chase|market order|rushed|forced)\b/i },
  { key: 'second-trade risk', pattern: SECOND_TRADE_PATTERN },
  { key: 'unclear target', pattern: /\b(ath|all time high|no target|no targets|mid trade|low quality)\b/i },
  { key: 'near-miss reaction', pattern: /\b(missed fill|1 tick|one tick|near tp|almost tapped|almost hit)\b/i },
];

const LESSON_TERMS = [
  { key: 'next time', pattern: /\b(next time|should have|need to|lesson|rule for next|remember to|avoid)\b/i },
];

const TRADE_MANAGEMENT_TERMS = [
  { key: 'held too long', pattern: /\b(held too long|gave back|round trip|didn'?t take profit)\b/i },
  { key: 'exited early', pattern: /\b(exited early|closed early|cut early|too early)\b/i },
  { key: 'good management', pattern: /\b(took partial|partial|scaled|held runner|trailed|managed well)\b/i },
];

export function normalizeRR(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.replace(/\s+/g, '').replace(/,+/g, '.').replace(/r+$/i, '');
}

export function normalizeTimeInput(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const compact = raw.replace(/\s+/g, '').replace(/[.]/gu, ':');
  const colonMatch = compact.match(/^(\d{1,2}):(\d{1,2})$/u);
  const digitMatch = compact.match(/^(\d{1,2})(\d{2})$/u);
  const match = colonMatch || digitMatch;
  if (!match) return raw;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours > 23 || minutes > 59) return raw;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function parseMoney(value) {
  const number = Number(String(value || '').replace(/[$,+\s]/g, ''));
  return Number.isFinite(number) ? number : 0;
}

export function hasPnlValue(value) {
  return String(value ?? '').trim() !== '';
}

export function normalizeOutcome(trade = {}) {
  const raw = String(trade.outcome || '').trim().toLowerCase().replace(/[_-]+/g, ' ');
  if (hasPnlValue(trade.pnl)) {
    const pnl = parseMoney(trade.pnl);
    if (pnl > 0) return 'Win';
    if (pnl < 0) return 'Loss';
    return 'BE';
  }
  if (['be', 'breakeven', 'break even'].includes(raw)) return 'BE';
  if (raw === 'win') return 'Win';
  if (raw === 'loss') return 'Loss';
  if (raw === 'missed') return 'Missed';
  if (raw === 'no trade') return 'No Trade';
  return trade.outcome || '';
}

export function parseRR(value) {
  const number = Number(normalizeRR(value));
  return Number.isFinite(number) ? number : 0;
}

export function calculateStats(trades = []) {
  const tradeOutcomes = trades.map((trade) => ({ ...trade, outcome: normalizeOutcome(trade) }));
  const totalTrades = tradeOutcomes.filter((trade) => ['Win', 'Loss', 'BE'].includes(trade.outcome)).length;
  const wins = tradeOutcomes.filter((trade) => trade.outcome === 'Win');
  const losses = tradeOutcomes.filter((trade) => trade.outcome === 'Loss');
  const decided = tradeOutcomes.filter((trade) => ['Win', 'Loss'].includes(trade.outcome));
  const netPnl = tradeOutcomes.reduce((sum, trade) => sum + parseMoney(trade.pnl), 0);
  const rrValues = tradeOutcomes.map((trade) => parseRR(trade.rr)).filter((rr) => rr > 0);
  const winAmounts = wins.map((trade) => parseMoney(trade.pnl)).filter((pnl) => pnl > 0);
  const lossAmounts = losses.map((trade) => parseMoney(trade.pnl)).filter((pnl) => pnl < 0);
  const avg = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

  return {
    totalTrades,
    netPnl,
    winRate: decided.length ? (wins.length / decided.length) * 100 : 0,
    avgRR: avg(rrValues),
    averageWin: avg(winAmounts),
    averageLoss: avg(lossAmounts),
    reviewedRate: totalTrades ? (tradeOutcomes.filter((trade) => ['Win', 'Loss', 'BE'].includes(trade.outcome) && (trade.sections || trade.note)).length / totalTrades) * 100 : 0,
  };
}

export function generateTitle(trade) {
  const date = trade.date || new Date().toISOString().slice(0, 10);
  return `${trade.asset || 'Trade'} ${trade.direction || ''} - ${date} - ${trade.outcome || 'Draft'}`.replace(/\s+/g, ' ').trim();
}

export function detectTags(note) {
  const text = note || '';
  const tags = [];
  const add = (label, pattern) => {
    if (pattern.test(text)) tags.push(label);
  };
  add('Stop management', /\b(moved|move|tightened|touch(ed)?|be|breakeven|stop|sl)\b/i);
  add('FOMO / chase', /\b(fomo|chased|chase|market order|rushed|forced)\b/i);
  add('Second-trade risk', SECOND_TRADE_PATTERN);
  add('Near-miss', /\b(missed fill|1 tick|one tick|near tp|almost tapped|almost hit)\b/i);
  add('No clear target / ATH', /\b(ath|all time high|no target|no targets|mid trade|low quality)\b/i);
  return tags;
}

export function detectSetupConfirmations(note) {
  const text = note || '';
  return SETUP_TERMS.filter((term) => term.pattern.test(text)).map((term) => term.key);
}

function detectTerms(note, terms) {
  const text = note || '';
  return terms.filter((term) => term.pattern.test(text)).map((term) => term.key);
}

export function generateFollowups(note, trade) {
  const text = note || '';
  if (!text.trim()) return [];
  const questions = [];
  const hasQuestion = (id) => questions.some((q) => q.id === id);
  const add = (question) => {
    if (!hasQuestion(question.id)) questions.push(question);
  };

  if (/\b(moved|move|tightened|touch(ed)?|be|breakeven|stop|sl)\b/i.test(text)) {
    add({ id: 'stopReason', label: 'Why did you move or manage the stop there?', placeholder: 'Structure reason, fear reason, or rule-based reason.' });
  }
  if (/\b(fomo|chased|chase|market order|rushed|forced)\b/i.test(text)) {
    add({ id: 'modelEntry', label: 'Was the entry inside your model, or did you chase?', placeholder: 'Example: First entry was model, second entry was chase.' });
  }
  if (SECOND_TRADE_PATTERN.test(text)) {
    add({ id: 'tradeNumber', label: 'Was this trade allowed by your one-trade / second-trade rule?', placeholder: 'Example: Not allowed. It was a second trade after the planned idea.' });
  }
  if (/\b(missed fill|1 tick|one tick|near tp|almost tapped|almost hit)\b/i.test(text)) {
    add({ id: 'cooldown', label: 'What did you do after the near-miss moment?', placeholder: 'Pause, re-enter, chase, or skip.' });
  }
  if (/\b(ath|all time high|no target|no targets|mid trade|low quality)\b/i.test(text)) {
    add({ id: 'liquidityDraw', label: 'What was the exact draw on liquidity before entry?', placeholder: 'Example: Not clear. ATH conditions and no clean target.' });
  }

  const mentionedSetup = detectSetupConfirmations(text);
  if (text.trim() && mentionedSetup.length < 2 && trade.outcome !== 'No Trade') {
    add({ id: 'confirmations', label: 'What made this a valid setup?', placeholder: 'Example: bearish SMT, SSL sweep, MSS, IFVG, NY macro.' });
  }
  if (/\b(held too long|gave back|round trip|exited early|closed early|partial|runner|target|tp)\b/i.test(text)) {
    add({ id: 'management', label: 'How was the trade managed after entry?', placeholder: 'Example: Took partial at 1, then moved stop too early.' });
  }
  if (trade.outcome === 'Missed') {
    add({ id: 'missedReason', label: 'Why was this trade missed?', placeholder: 'Example: Hesitated after confirmation, then price left without me.' });
  }
  if (trade.outcome === 'No Trade') {
    add({ id: 'noTradeReason', label: 'Why was there no trade?', placeholder: 'Example: No clean draw, no model confirmation, or protected discipline.' });
  }
  if (trade.outcome === 'Win' && !/\b(what worked|worked|good|clean|patient|waited|followed|respected)\b/i.test(text)) {
    add({ id: 'repeat', label: 'What should you repeat from this win?', placeholder: 'Example: Waited for sweep + MSS + IFVG before entering.' });
  }
  if ((trade.outcome === 'Loss' || trade.rating === 'Mistake') && !/\b(lesson|next time|should have|mistake|rule)\b/i.test(text)) {
    add({ id: 'lesson', label: 'What is the one rule for next time?', placeholder: 'Example: No second entry after the planned setup is done.' });
  }

  return questions.slice(0, 4);
}

function cleanSentence(value) {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  if (!text) return '';
  return /[.!?]$/.test(text) ? text : text + '.';
}

function joinParts(parts) {
  return parts.map(cleanSentence).filter(Boolean).join(' ');
}

function answerText(answers, key) {
  return cleanSentence(answers?.[key]);
}

function splitFragments(value) {
  return String(value || '')
    .split(/[\n.;]+/u)
    .map((part) => part.trim().replace(/\s+/g, ' '))
    .filter(Boolean);
}

function relevantFragments(note, terms, limit = 2) {
  const fragments = splitFragments(note);
  return fragments
    .filter((fragment) => terms.some((term) => term.pattern.test(fragment)))
    .slice(0, limit);
}

function formatLines(lines, fallback) {
  const cleaned = lines.map(cleanSentence).filter(Boolean);
  return cleaned.length ? cleaned.join('\n') : fallback;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function formatBullets(lines, fallback) {
  const cleaned = unique(lines.map(cleanSentence).filter(Boolean));
  return cleaned.length ? cleaned.map((line) => '- ' + line).join('\n') : fallback;
}

function detectedTermLine(label, terms) {
  return terms.length ? `${label}: ${terms.join(', ')}.` : '';
}

function setupLine(setupConfirmations) {
  return setupConfirmations.length ? `Confirmed in your note: ${setupConfirmations.join(', ')}.` : '';
}

function followupLines(items) {
  return Object.entries(items)
    .filter(([, value]) => Boolean(value))
    .map(([label, value]) => `${label}: ${value}`);
}

export function applyJournalTemplate(note, templateId) {
  const template = JOURNAL_TEMPLATES.find((item) => item.id === templateId);
  if (!template) return note || '';
  const current = String(note || '').trim();
  return current ? `${current}\n\n${template.body}` : template.body;
}

function improveRules(tags, answers) {
  const rules = [];
  if (tags.includes('Stop management')) {
    rules.push('Stop rule: only move to BE when structure changes, not because price is close to TP or the trade feels uncomfortable.');
  }
  if (tags.includes('FOMO / chase')) {
    rules.push('Entry rule: no chase entry after the model trigger is gone; either the setup is present or the trade is skipped.');
  }
  if (tags.includes('Second-trade risk')) {
    rules.push('Frequency rule: decide before the session whether a second trade is allowed, then stop when the planned idea is done.');
  }
  if (tags.includes('Near-miss')) {
    rules.push('Cooldown rule: after a missed fill or near TP event, pause before re-entry instead of reacting immediately.');
  }
  if (tags.includes('No clear target / ATH')) {
    rules.push('Liquidity rule: do not take ATH or no-target trades unless the draw on liquidity is explicit before entry.');
  }

  return rules.concat(followupLines({
    'Your entry answer': answers.modelEntry,
    'Your trade-frequency answer': answers.tradeNumber,
    'Your stop answer': answers.stopReason,
    'Your cooldown answer': answers.cooldown,
    'Your liquidity answer': answers.liquidityDraw,
    'Your management answer': answers.management,
    'Missed-trade reason': answers.missedReason,
    'No-trade reason': answers.noTradeReason,
    'Repeat rule': answers.repeat,
    'Next-time rule': answers.lesson,
  }));
}

export function buildJournalDraft(trade, answers = {}) {
  const rr = normalizeRR(trade.rr);
  const pnl = String(trade.pnl || '').trim();
  const tags = detectTags(trade.note);
  const title = generateTitle({ ...trade, rr });
  const setupConfirmations = detectSetupConfirmations(trade.note);
  const setupFragments = relevantFragments(trade.note, SETUP_TERMS, 2);
  const executionClues = detectTerms(trade.note, EXECUTION_TERMS);
  const executionFragments = relevantFragments(trade.note, EXECUTION_TERMS, 2);
  const psychologyClues = detectTerms(trade.note, PSYCHOLOGY_TERMS);
  const psychologyFragments = relevantFragments(trade.note, PSYCHOLOGY_TERMS, 2);
  const positiveClues = detectTerms(trade.note, POSITIVE_TERMS);
  const positiveFragments = relevantFragments(trade.note, POSITIVE_TERMS, 2);
  const mistakeClues = detectTerms(trade.note, MISTAKE_TERMS);
  const lessonFragments = relevantFragments(trade.note, LESSON_TERMS, 3);
  const managementClues = detectTerms(trade.note, TRADE_MANAGEMENT_TERMS);
  const managementFragments = relevantFragments(trade.note, TRADE_MANAGEMENT_TERMS, 2);
  const confirmations = answerText(answers, 'confirmations');
  const modelEntry = answerText(answers, 'modelEntry');
  const tradeNumber = answerText(answers, 'tradeNumber');
  const stopReason = answerText(answers, 'stopReason');
  const cooldown = answerText(answers, 'cooldown');
  const liquidityDraw = answerText(answers, 'liquidityDraw');
  const management = answerText(answers, 'management');
  const missedReason = answerText(answers, 'missedReason');
  const noTradeReason = answerText(answers, 'noTradeReason');
  const repeat = answerText(answers, 'repeat');
  const lesson = answerText(answers, 'lesson');

  const summaryLines = [
    `${trade.asset} ${trade.direction} on ${trade.date}: ${trade.outcome}. RR: ${rr || 'not specified'}. P&L: ${pnl || 'not specified'}. Rating: ${trade.rating || 'not specified'}.`,
    setupConfirmations.length ? `Main setup evidence captured: ${setupConfirmations.join(', ')}.` : '',
    tags.length ? `Primary review focus: ${tags.join(', ')}.` : '',
  ];

  const setup = formatBullets([
    setupLine(setupConfirmations),
    confirmations ? 'Extra confirmation context: ' + confirmations : '',
    setupFragments.length ? 'Exact setup notes: ' + setupFragments.join(' / ') + '.' : '',
  ], 'Main confirmations were not specified.');

  const executionParts = [
    executionFragments.length ? 'Execution notes: ' + executionFragments.join(' / ') + '.' : '',
    detectedTermLine('Execution themes', executionClues),
    detectedTermLine('Management read', managementClues),
    managementFragments.length ? 'Management notes: ' + managementFragments.join(' / ') + '.' : '',
    ...followupLines({
      'Entry answer': modelEntry,
      'Trade count answer': tradeNumber,
      'Stop answer': stopReason,
      'Cooldown answer': cooldown,
      'Management answer': management,
    }),
  ];

  const psychologyParts = [
    tags.length ? 'Pressure points: ' + tags.join(', ') + '.' : '',
    detectedTermLine('Behavior pattern', psychologyClues),
    psychologyFragments.length ? 'Moment to review: ' + psychologyFragments.join(' / ') + '.' : '',
    liquidityDraw ? 'Liquidity answer: ' + liquidityDraw : '',
    missedReason ? 'Missed-trade reason: ' + missedReason : '',
    noTradeReason ? 'No-trade reason: ' + noTradeReason : '',
  ];

  const workedParts = [];
  if (setupConfirmations.length) workedParts.push('You documented the setup evidence clearly: ' + setupConfirmations.join(', ') + '.');
  if (positiveClues.length) workedParts.push('Positive process signals: ' + positiveClues.join(', ') + '.');
  if (positiveFragments.length) workedParts.push('Exact positive note: ' + positiveFragments.join(' / ') + '.');
  if (repeat) workedParts.push('Repeat this: ' + repeat);
  if (trade.rating && ['A+', 'A', 'B+'].includes(trade.rating)) workedParts.push('The trade was rated ' + trade.rating + ', so identify which part of the process deserves to be repeated.');

  const improveParts = [
    detectedTermLine('Detected issue pattern', mistakeClues),
    lessonFragments.length ? 'Lesson from your note: ' + lessonFragments.join(' / ') + '.' : '',
    lesson ? 'Next-time rule: ' + lesson : '',
    !setupConfirmations.length && !confirmations ? 'Process rule: write the exact setup confirmations before judging the trade.' : '',
    ...improveRules(tags, { modelEntry, tradeNumber, stopReason, cooldown, liquidityDraw, management, missedReason, noTradeReason, repeat, lesson }),
  ];

  return {
    title,
    rr,
    tags,
    sections: {
      'Trade Summary': formatLines(summaryLines, 'Trade summary was not specified.'),
      Setup: setup,
      Execution: formatBullets(executionParts, 'Execution detail was not specified beyond the raw note.'),
      Psychology: formatBullets(psychologyParts, 'No specific psychology pattern was stated.'),
      'What Worked': formatBullets(workedParts, 'What worked was not specified.'),
      'What To Improve': formatBullets(improveParts, 'Improvement point was not specified.'),
      'Raw Note': trade.note?.trim() || 'No raw note provided.',
    },
  };
}

export function validateTrade(trade, screenshot) {
  const errors = [];
  const hasScreenshot = Array.isArray(screenshot) ? screenshot.length > 0 : Boolean(screenshot);
  if (!hasScreenshot) errors.push('Add at least one screenshot.');
  if (!trade.date) errors.push('Choose a date.');
  if (!trade.asset) errors.push('Choose an asset.');
  if (!trade.direction) errors.push('Choose a direction.');
  if (!trade.outcome) errors.push('Choose an outcome.');
  if (!String(trade.pnl || '').trim()) errors.push('Enter P&L.');
  if (!String(trade.rr || '').trim()) errors.push('Enter RR.');
  if (!trade.rating) errors.push('Choose a rating.');
  if (!String(trade.note || '').trim()) errors.push('Add a messy note.');
  return errors;
}
