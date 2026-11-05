import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const port = '5197';
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', port], { stdio: 'ignore' });
let browser;
try {
  browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, args: ['--no-sandbox'] } : {});
  // Fresh non-persistent context: no real journal or browser profile is accessed.
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  page.on('dialog', d => d.accept());
  for (let i = 0; i < 60; i++) {
    try { await page.goto(base); break; } catch { await new Promise(r => setTimeout(r, 250)); }
  }
  await expect(page.getByLabel('View account')).toBeVisible();
  await page.getByRole('button', { name: 'Accounts', exact: true }).click();
  await page.getByRole('button', { name: 'Add Account', exact: true }).click();
  await page.getByLabel('Account Name', { exact: true }).nth(1).fill('Account A');
  await page.getByLabel('Starting Balance').nth(1).fill('50000');
  await page.getByRole('button', { name: 'Add Account', exact: true }).click();
  await page.getByLabel('Account Name', { exact: true }).nth(2).fill('Account B');
  await page.getByLabel('Starting Balance').nth(2).fill('25000');
  await page.getByRole('button', { name: 'Save Accounts', exact: true }).click();
  await expect(page.getByLabel('View account').locator('option')).toHaveCount(4);
  const ids = await page.evaluate(async () => {
    const j = await import('/src/localJournal.js');
    let store = await j.loadLocalStore();
    const a = store.accounts.find(a => a.name === 'Account A').id;
    const b = store.accounts.find(a => a.name === 'Account B').id;
    for (const invalid of [[], store.accounts.map(a => ({ ...a, startingBalance: -1 }))]) { let rejected = false; try { await j.saveLocalAccounts(store, invalid); } catch { rejected = true; } if (!rejected) throw new Error('Unsafe account change accepted'); }
    const date = new Date().toLocaleDateString('en-CA');
    const synthetic = { date, asset: 'MNQ', direction: 'Long', rr: '1', rating: 'A', note: 'Synthetic account test note', screenshots: [{ id: 's', name: 'synthetic.png', type: 'image/png', dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=' }] };
    store = await j.saveLocalTrade(store, { ...synthetic, id: 'test-a', accountId: a, pnl: '-500', outcome: 'Loss' });
    store = await j.saveLocalTrade(store, { ...synthetic, id: 'test-b', accountId: b, pnl: '300', outcome: 'Win' });
    let rejected = false;
    try { await j.saveLocalTrade(store, { ...synthetic, pnl: '999' }); } catch { rejected = true; }
    if (!rejected) throw new Error('Missing account was accepted');
    return { a, b };
  });
  await page.goto(base);
  const metric = label => page.locator('.metric-card').filter({ has: page.locator('span', { hasText: label }) }).locator('strong');
  await page.getByLabel('View account').selectOption(ids.a);
  await expect(metric(/^Net P&L$/)).toHaveText('-$500');
  await expect(metric('Today’s Realised P&L')).toHaveText('-$500');
  await expect(metric('Account Balance')).toHaveText('+$49,500');
  await page.getByLabel('View account').selectOption(ids.b);
  await expect(metric(/^Net P&L$/)).toHaveText('+$300');
  await expect(metric('Today’s Realised P&L')).toHaveText('+$300');
  await page.getByLabel('View account').selectOption('');
  await expect(metric(/^Net P&L$/)).toHaveText('-$200');
  await page.getByRole('button', { name: 'Trade Log', exact: true }).click();
  await expect(page.locator('.trade-card')).toHaveCount(2);
  await page.getByLabel('View account').selectOption(ids.a);
  await expect(page.locator('.trade-card')).toHaveCount(1);
  await page.getByTitle('Review trade').click();
  await page.getByLabel('View account').selectOption(ids.b);
  await expect(page).toHaveURL(`${base}/app`);
  await expect(metric(/^Net P&L$/)).toHaveText('+$300');
  await page.getByRole('button', { name: 'Trade Log', exact: true }).click();
  await page.getByLabel('View account').selectOption(ids.a);
  // Reassign an existing trade through the real editor; its note and screenshot survive.
  await page.getByTitle('Edit trade').click();
  await page.getByLabel('Trade account', { exact: true }).selectOption(ids.b);
  await page.getByRole('button', { name: /Review Check and save/ }).click();
  await page.getByRole('button', { name: /Save Trade/ }).click();
  await expect(page.getByText('Trade saved.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Accounts', exact: true }).click();
  await page.getByLabel('Account Name', { exact: true }).nth(2).fill('Renamed B');
  await page.getByRole('button', { name: 'Archive', exact: true }).nth(2).click();
  await page.getByRole('button', { name: 'Save Accounts', exact: true }).click();
  await expect(page.getByLabel('View account').locator(`option[value="${ids.b}"]`)).toHaveText('Renamed B (archived)');
  await page.getByLabel('View account').selectOption(ids.b);
  await page.getByRole('button', { name: 'Trade Log', exact: true }).click();
  await expect(page.locator('.trade-card')).toHaveCount(2);
  const result = await page.evaluate(async ({ a, b }) => {
    const j = await import('/src/localJournal.js');
    const s = await j.loadLocalStore();
    if (s.trades.find(t => t.id === 'test-a').screenshots.length !== 1) throw new Error('Screenshot lost');
    let rejected = false;
    try { await j.saveLocalTrade(s, { id: 'new', accountId: b, pnl: '20' }); } catch { rejected = true; }
    if (!rejected) throw new Error('New trade on archived account accepted');
    const restored = await j.importLocalBackup(await j.exportLocalBackup(s));
    await j.clearLocalStore();
    await j.mergeImportedStore(await j.loadLocalStore(), restored);
    const again = await j.mergeImportedStore(await j.loadLocalStore(), restored);
    return { count: again.trades.length, accounts: again.accounts.length, accountId: again.trades.find(t => t.id === 'test-a').accountId };
  }, ids);
  assert.equal(result.count, 2);
  assert.equal(result.accounts, 3);
  assert.equal(result.accountId, ids.b);
  await page.goto(`${base}/app/accounts`);
  await page.getByLabel('Move history from').selectOption(ids.b);
  await page.getByLabel('Move history to').selectOption(ids.a);
  await page.getByRole('button', { name: 'Move 2 trades', exact: true }).click();
  await expect(page.getByText('Trades assigned.', { exact: true })).toBeVisible();
  assert.equal(await page.evaluate(async id => { const j = await import('/src/localJournal.js'); return (await j.loadLocalStore()).trades.every(t => t.accountId === id && t.screenshots.length === 1); }, ids.a), true);
  await page.evaluate(async b => { const j = await import('/src/localJournal.js'); const before = (await j.listLocalAutoBackups()).find(x => x.reason === 'before_trade_assignment'); if (!before) throw new Error('Assignment recovery snapshot missing'); const restored = await j.restoreLocalAutoBackup(before.id); if (!restored.trades.every(t => t.accountId === b)) throw new Error('Automatic snapshot did not restore associations'); if (!(await j.listLocalAutoBackups()).some(x => x.reason === 'before_restore')) throw new Error('Pre-restore snapshot missing'); }, ids.b);
  await page.goto(base);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
  await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => { const r = indexedDB.open('trading-journal-template', 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    await new Promise((resolve, reject) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put({ accounts: [{ id: 'legacy-account', name: 'Legacy', startingBalance: 100 }], trades: [{ id: 'legacy-trade', account: 'Legacy', outcome: 'Win', pnl: '20', note: 'Synthetic legacy note', screenshots: [{ id: 'old-shot', dataUrl: 'data:image/png;base64,AA==' }] }] }, 'journal'); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
    db.close();
  });
  await page.reload();
  const migrated = await page.evaluate(async () => { const j = await import('/src/localJournal.js'); const store = await j.loadLocalStore(); return { store, backups: await j.listLocalAutoBackups() }; });
  assert.equal(migrated.store.schemaVersion, 2);
  assert.equal(migrated.store.trades[0].accountId, 'legacy-account');
  assert.equal(migrated.store.trades[0].note, 'Synthetic legacy note');
  assert.equal(migrated.store.trades[0].screenshots[0].dataUrl, 'data:image/png;base64,AA==');
  assert(migrated.backups.some(b => b.reason === 'before_account_migration'));
  await page.goto(`${base}/app/playbooks`);
  await page.getByRole('button', { name: 'Add Playbook', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Synthetic plan');
  await page.getByRole('button', { name: 'Save Playbooks', exact: true }).click();
  await expect(page.getByText('Playbooks saved.', { exact: true })).toBeVisible();
  assert.deepEqual(pageErrors, []);
  console.log('Multi-account browser checks passed: create, rename, archive, switching, reassignment, daily analytics, ZIP restoration, repeated import, mobile.');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
