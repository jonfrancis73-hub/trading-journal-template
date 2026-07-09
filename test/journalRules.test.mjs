import test from 'node:test';
import assert from 'node:assert/strict';
import { JOURNAL_TEMPLATES, applyJournalTemplate, buildJournalDraft, calculateStats, detectSetupConfirmations, generateFollowups, normalizeOutcome, normalizeRR, normalizeTimeInput, validateTrade } from '../src/journalRules.js';

test('normalizes RR notation to a plain number', () => {
  assert.equal(normalizeRR('1.5'), '1.5');
  assert.equal(normalizeRR('1.5r'), '1.5');
  assert.equal(normalizeRR('1.5RR'), '1.5');
  assert.equal(normalizeRR('1,5RR'), '1.5');
});

test('normalizes trade time inputs to colon format', () => {
  assert.equal(normalizeTimeInput('10.00'), '10:00');
  assert.equal(normalizeTimeInput('10.18'), '10:18');
  assert.equal(normalizeTimeInput('1000'), '10:00');
  assert.equal(normalizeTimeInput('9:5'), '09:05');
  assert.equal(normalizeTimeInput('24.00'), '24.00');
});

test('applies reusable journal templates without erasing existing notes', () => {
  assert.ok(JOURNAL_TEMPLATES.some((template) => template.id === 'execution'));
  const note = applyJournalTemplate('Original note.', 'execution');
  assert.match(note, /Original note\./);
  assert.match(note, /Entry reason:/);
  assert.equal(applyJournalTemplate('', 'loss').startsWith('What made this a valid idea?'), true);
});

test('does not ask setup followups before a note exists', () => {
  const questions = generateFollowups('', { outcome: 'Win' });
  assert.equal(questions.length, 0);
});

test('asks stop-management followup for BE and moved stop notes', () => {
  const questions = generateFollowups('I moved SL to BE because price almost tapped TP', { outcome: 'Win' });
  assert.ok(questions.some((question) => question.id === 'stopReason'));
  assert.ok(questions.some((question) => question.id === 'cooldown'));
});

test('asks FOMO and second-trade followups for revenge notes', () => {
  const questions = generateFollowups('Second trade was revenge, I chased with a market order', { outcome: 'Loss' });
  assert.ok(questions.some((question) => question.id === 'modelEntry'));
  assert.ok(questions.some((question) => question.id === 'tradeNumber'));
});

test('treats second entry language as second-trade risk', () => {
  const questions = generateFollowups('I chased a second entry after the first idea was done', { outcome: 'Loss' });
  const draft = buildJournalDraft({
    date: '2026-06-23',
    asset: 'MNQ',
    direction: 'Short',
    outcome: 'Loss',
    pnl: '-200',
    rr: '1',
    rating: 'Mistake',
    note: 'I chased a second entry after the first idea was done',
  }, {});
  assert.ok(questions.some((question) => question.id === 'tradeNumber'));
  assert.match(draft.sections.Psychology, /Second-trade risk/);
});

test('asks liquidity question for ATH no-target notes', () => {
  const questions = generateFollowups('Valid but mid trade near ATH with no targets', { outcome: 'Win' });
  assert.ok(questions.some((question) => question.id === 'liquidityDraw'));
});

test('asks outcome-aware followups instead of only keyword prompts', () => {
  const winQuestions = generateFollowups('SMT sweep MSS IFVG', { outcome: 'Win' });
  const lossQuestions = generateFollowups('SMT sweep MSS IFVG', { outcome: 'Loss' });
  const missedQuestions = generateFollowups('Setup was valid but I did not enter', { outcome: 'Missed' });

  assert.ok(winQuestions.some((question) => question.id === 'repeat'));
  assert.ok(lossQuestions.some((question) => question.id === 'lesson'));
  assert.ok(missedQuestions.some((question) => question.id === 'missedReason'));
});

test('draft preserves raw note and does not invent setup confirmations', () => {
  const draft = buildJournalDraft({
    date: '2026-06-23',
    asset: 'MNQ',
    direction: 'Short',
    outcome: 'Win',
    pnl: '450',
    rr: '1.5',
    rating: 'A',
    note: 'Clean entry but I got nervous near target.',
  }, {});
  assert.equal(draft.rr, '1.5');
  assert.equal(draft.sections.Setup, 'Main confirmations were not specified.');
  assert.equal(draft.sections['Raw Note'], 'Clean entry but I got nervous near target.');
});

test('draft extracts setup confirmations from messy notes', () => {
  const draft = buildJournalDraft({
    date: '2026-06-23',
    asset: 'MNQ',
    direction: 'Short',
    outcome: 'Win',
    pnl: '450',
    rr: '1.5',
    rating: 'A',
    note: 'Bearish SMT into NY macro. SSL sweep, MSS, then IFVG entry.',
  }, {});
  assert.deepEqual(detectSetupConfirmations('Bearish SMT, SSL sweep, MSS, IFVG'), ['SMT', 'IFVG', 'MSS/BOS', 'liquidity sweep']);
  assert.match(draft.sections.Setup, /Confirmed in your note: SMT, IFVG, MSS\/BOS, liquidity sweep, macro window/);
  assert.match(draft.sections.Setup, /Exact setup notes:/);
  assert.doesNotMatch(draft.sections.Setup, /not specified/i);
});

test('draft blends confirmation followup with setup clues', () => {
  const draft = buildJournalDraft({
    date: '2026-06-23',
    asset: 'MNQ',
    direction: 'Short',
    outcome: 'Win',
    pnl: '450',
    rr: '1.5',
    rating: 'A',
    note: 'IFVG entry after sweep.',
  }, { confirmations: 'Bearish SMT and macro timing were the main confirmations.' });
  assert.match(draft.sections.Setup, /Confirmed in your note: IFVG, liquidity sweep/);
  assert.match(draft.sections.Setup, /Extra confirmation context: Bearish SMT and macro timing were the main confirmations/);
});

test('draft creates cleaner deterministic review rules from messy behavior notes', () => {
  const draft = buildJournalDraft({
    date: '2026-06-23',
    asset: 'MNQ',
    direction: 'Short',
    outcome: 'Loss',
    pnl: '-200',
    rr: '1',
    rating: 'Mistake',
    note: 'Bearish SMT into NY macro. SSL sweep and MSS then IFVG. I moved SL to BE because price almost tapped TP. Then I chased a second entry near ATH with no target.',
  }, {
    stopReason: 'No, I moved it because I wanted to protect the win.',
    modelEntry: 'The first entry was model, the second was a chase.',
  });

  assert.match(draft.sections['Trade Summary'], /Main setup evidence captured: SMT, IFVG, MSS\/BOS, liquidity sweep, macro window/);
  assert.match(draft.sections.Execution, /- Execution notes:/);
  assert.match(draft.sections.Psychology, /- Pressure points: Stop management, FOMO \/ chase, Second-trade risk, Near-miss, No clear target \/ ATH/);
  assert.match(draft.sections['What To Improve'], /Stop rule: only move to BE when structure changes/);
  assert.match(draft.sections['What To Improve'], /Entry rule: no chase entry after the model trigger is gone/);
  assert.match(draft.sections['What To Improve'], /Liquidity rule: do not take ATH or no-target trades/);
  assert.match(draft.sections['What To Improve'], /Your entry answer: The first entry was model, the second was a chase/);
});

test('draft captures lesson and trade management notes from messy text', () => {
  const draft = buildJournalDraft({
    date: '2026-06-23',
    asset: 'MNQ',
    direction: 'Long',
    outcome: 'Win',
    pnl: '300',
    rr: '1.5',
    rating: 'B+',
    note: 'Good entry after sweep and MSS. I took partial at 1RR but exited early. Next time I need to hold the runner to the planned target.',
  }, {
    management: 'Partial was good, runner exit was too early.',
    repeat: 'Wait for sweep plus MSS before entry.',
  });

  assert.match(draft.sections.Execution, /Management read:/);
  assert.match(draft.sections.Execution, /Management answer: Partial was good/);
  assert.match(draft.sections['What Worked'], /Repeat this: Wait for sweep plus MSS/);
  assert.match(draft.sections['What To Improve'], /Lesson from your note: Next time I need to hold the runner/);
});

test('draft preserves non-invention fallback when note lacks setup details', () => {
  const draft = buildJournalDraft({
    date: '2026-06-23',
    asset: 'ES',
    direction: 'Long',
    outcome: 'BE',
    pnl: '0',
    rr: '0',
    rating: 'B',
    note: 'I managed risk but did not write the setup clearly.',
  }, {});

  assert.equal(draft.sections.Setup, 'Main confirmations were not specified.');
  assert.match(draft.sections['What To Improve'], /write the exact setup confirmations/i);
  assert.doesNotMatch(draft.sections.Setup, /SMT|IFVG|MSS|liquidity sweep/);
});

test('validates screenshot and required fields', () => {
  const errors = validateTrade({ date: '', asset: '', direction: '', outcome: '', pnl: '', rr: '', rating: '', note: '' }, []);
  assert.ok(errors.includes('Add at least one screenshot.'));
  assert.ok(errors.includes('Enter P&L.'));
  assert.ok(errors.includes('Enter RR.'));
});

test('calculates dashboard stats from local trades', () => {
  const stats = calculateStats([
    { outcome: 'Win', pnl: '+300', rr: '1.5RR', note: 'clean' },
    { outcome: 'Loss', pnl: '-100', rr: '1RR', note: 'mistake' },
    { outcome: 'BE', pnl: '0', rr: '0RR', note: 'flat' },
  ]);

  assert.equal(stats.totalTrades, 3);
  assert.equal(stats.netPnl, 200);
  assert.equal(stats.winRate, 50);
  assert.equal(stats.avgRR, 1.25);
  assert.equal(stats.averageWin, 300);
  assert.equal(stats.averageLoss, -100);
});

test('normalizes break-even outcomes and explicit zero P&L', () => {
  assert.equal(normalizeOutcome({ outcome: 'Breakeven', pnl: '' }), 'BE');
  assert.equal(normalizeOutcome({ outcome: 'Break-even', pnl: '' }), 'BE');
  assert.equal(normalizeOutcome({ outcome: 'Breakeven', pnl: 70 }), 'Win');
  assert.equal(normalizeOutcome({ outcome: 'Win', pnl: 0 }), 'BE');
  assert.equal(normalizeOutcome({ outcome: 'Win', pnl: -10 }), 'Loss');
  assert.equal(normalizeOutcome({ outcome: '', pnl: '0' }), 'BE');
  assert.equal(normalizeOutcome({ outcome: '', pnl: '' }), '');
});

test('dashboard stats count real trades, not blank journal pages', () => {
  const stats = calculateStats([
    { outcome: 'Win', pnl: '+100', rr: '1RR' },
    { outcome: 'Loss', pnl: '-50', rr: '1RR' },
    { outcome: '', pnl: '0', rr: '0RR' },
    { outcome: '', pnl: '', rr: '' },
  ]);

  assert.equal(stats.totalTrades, 3);
  assert.equal(stats.netPnl, 50);
  assert.equal(stats.winRate, 50);
});
