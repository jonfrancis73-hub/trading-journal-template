import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStore, mergeBackupStores, exportLocalBackup, importLocalBackup } from '../src/localJournal.js';
import { strToU8, zipSync } from 'fflate';
import { calculateAdvancedStats, calendarStats, equityPointsByPeriod, filterTrades } from '../src/analytics.js';

const accounts = [{ id: 'a', name: 'Account A', startingBalance: 50000 }, { id: 'b', name: 'Account B', startingBalance: 25000 }];
const trades = [{ id: 'loss', accountId: 'a', outcome: 'Loss', pnl: '-500', date: '2026-11-04', note: 'Synthetic note', screenshots: [] }, { id: 'win', accountId: 'b', outcome: 'Win', pnl: '300', date: '2026-11-04' }];

test('migration preserves notes, screenshots, IDs and legacy names, and is idempotent', () => {
  const shot = { id: 'shot', dataUrl: 'data:image/png;base64,AA==', kind: 'news' };
  const legacy = { accounts, trades: [{ id: 'legacy', account: 'Account A', pnl: '30', note: 'Synthetic messy note', screenshots: [shot] }, { id: 'other', account: 'Old Fund', pnl: '-20' }, { id: 'default', pnl: '0' }], entries: [{ id: 'note', text: 'Keep' }] };
  const migrated = normalizeStore(legacy);
  assert.equal(migrated.trades[0].accountId, 'a');
  assert.equal(migrated.trades[0].note, legacy.trades[0].note);
  assert.deepEqual(migrated.trades[0].screenshots, [shot]);
  assert.deepEqual(migrated.entries, legacy.entries);
  assert.equal(migrated.trades.length, 3);
  assert.equal(migrated.accounts.find(a => a.id === migrated.trades[1].accountId).name, 'Old Fund');
  assert.deepEqual(normalizeStore(migrated), migrated);
  assert.equal(legacy.trades[0].accountId, undefined);
});

test('account IDs isolate daily net, analytics and cumulative curves after rename or archive', () => {
  const a = filterTrades(trades, { accountId: 'a' });
  const b = filterTrades(trades, { accountId: 'b' });
  assert.equal(calendarStats(a)[0].netPnl, -500);
  assert.equal(calendarStats(b)[0].netPnl, 300);
  assert.equal(calculateAdvancedStats(a).averageLoss, -500);
  assert.equal(calculateAdvancedStats(b).averageWin, 300);
  assert.equal(calculateAdvancedStats(b).winRate, 100);
  assert.equal(calculateAdvancedStats(b).profitFactor, Infinity);
  assert.equal(equityPointsByPeriod(a, 'total').at(-1).value, -500);
  const renamed = normalizeStore({ accounts: accounts.map(a => ({ ...a, name: 'Renamed', archived: true })), trades });
  assert.equal(filterTrades(renamed.trades, { accountId: 'a' }).length, 1);
  assert.equal(calculateAdvancedStats(trades).netPnl, -200);
  assert.equal(calculateAdvancedStats(trades).totalTrades, 2);
});

test('multi-account backup round trip retains archives, balances, associations and screenshot bytes', async () => {
  const store = normalizeStore({ accounts: accounts.map(a => ({ ...a, archived: a.id === 'a' })), trades: trades.map(t => ({ ...t, screenshots: [{ id: 's', name: 'synthetic.png', type: 'image/png', dataUrl: 'data:image/png;base64,AA==' }] })) });
  const restored = await importLocalBackup(await exportLocalBackup(store));
  assert.deepEqual(restored.accounts, store.accounts);
  assert.deepEqual(restored.trades.map(t => t.accountId), ['a', 'b']);
  assert.equal(restored.trades[0].screenshots[0].dataUrl, store.trades[0].screenshots[0].dataUrl);
  const once = mergeBackupStores(store, restored);
  const twice = mergeBackupStores(once, restored);
  assert.equal(twice.trades.length, 2);
  assert.equal(calculateAdvancedStats(twice.trades).netPnl, -200);
});

test('conflicting backup imports abort without overwriting existing records', () => {
  const original = normalizeStore({ accounts, trades });
  const incoming = normalizeStore({ accounts, trades: [{ ...trades[0], pnl: '999' }] });
  assert.throws(() => mergeBackupStores(original, incoming), /Nothing was imported/);
  assert.equal(original.trades[0].pnl, '-500');
});


test('a fresh journal restores a renamed default account and backup settings', async () => {
  const incoming = normalizeStore({ accounts: [{ id: 'personal', name: 'Funded renamed', startingBalance: 50000, archived: true }], trades: [{ id: 'saved', accountId: 'personal', pnl: '100', outcome: 'Win' }], settings: { tradingRules: ['Synthetic custom rule'] } });
  const restored = mergeBackupStores(normalizeStore(), await importLocalBackup(await exportLocalBackup(incoming)));
  assert.equal(restored.accounts.length, 1);
  assert.equal(restored.accounts[0].name, 'Funded renamed');
  assert.deepEqual(restored.settings.tradingRules, ['Synthetic custom rule']);
  assert.equal(restored.trades[0].accountId, 'personal');
});


test('incomplete screenshot archives and duplicate trade IDs are rejected safely', async () => {
  const pack = store => new Blob([zipSync({ 'manifest.json': strToU8(JSON.stringify({ version: 1, store })) })]);
  await assert.rejects(() => importLocalBackup(pack({ accounts, trades: [{ id: 'missing-image', accountId: 'a', screenshots: [{ id: 's', backupPath: 'screenshots/missing.png' }] }] })), /missing screenshot file/);
  await assert.rejects(() => importLocalBackup(pack({ accounts, trades: [trades[0], trades[0]] })), /duplicate trades identifiers/);
});
