import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';

const port = process.env.HEAVY_STRESS_PORT || '5196';
const baseUrl = process.env.HEAVY_STRESS_BASE_URL || `http://127.0.0.1:${port}`;
const tradeCount = Number(process.env.HEAVY_STRESS_TRADES || 500);
const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

function startServer() {
  if (process.env.HEAVY_STRESS_BASE_URL) return null;
  const child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', port], {
    cwd: process.cwd(),
    stdio: 'pipe',
    shell: false,
    env: process.env,
  });
  child.stderr.on('data', (chunk) => process.stderr.write(chunk));
  return child;
}

async function waitForServer(page) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 3000 });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error('Local dev server did not start.');
}

function makeTrade(index) {
  const day = String((index % 28) + 1).padStart(2, '0');
  const win = index % 4 !== 0;
  const be = index % 9 === 0;
  const outcome = be ? 'BE' : win ? 'Win' : 'Loss';
  const pnl = be ? '0' : win ? `+${100 + (index % 9) * 25}` : `-${75 + (index % 7) * 30}`;
  return {
    id: `stress-trade-${index}`,
    date: `2026-06-${day}`,
    asset: index % 2 ? 'MNQ' : 'ES',
    account: 'Personal',
    direction: index % 3 ? 'Long' : 'Short',
    outcome,
    pnl,
    rr: `${(1 + (index % 5) * 0.5).toFixed(1)}RR`,
    rating: ['A+', 'A', 'B+', 'B', 'C'][index % 5],
    strategy: index % 2 ? 'Opening model' : 'Continuation model',
    session: ['Asia', 'London', 'NY AM', 'NY PM'][index % 4],
    setupTags: index % 2 ? ['SMT', 'Sweep'] : ['FVG', 'MSS'],
    mistakeTags: win ? [] : ['Early exit'],
    emotion: win ? 'Calm' : 'Rushed',
    reviewStatus: index % 3 ? 'reviewed' : 'needs_review',
    reviewed: Boolean(index % 3),
    note: 'Stress test trade. Followed setup rules and logged enough detail to test reports and search.',
    sections: {
      'Trade Summary': 'Stress test trade summary.',
      Setup: 'Setup details were logged.',
      Execution: 'Execution was reviewed.',
      Psychology: win ? 'Calm.' : 'Rushed.',
      'What Worked': win ? 'Waited for confirmation.' : 'Logged the issue clearly.',
      'What To Improve': win ? 'Repeat the model.' : 'Slow down after first loss.',
      'Raw Note': 'Stress test trade. Followed setup rules and logged enough detail to test reports and search.',
    },
    screenshots: [{
      id: `stress-shot-${index}`,
      name: `stress-${index}.png`,
      type: 'image/png',
      kind: 'execution',
      dataUrl: tinyPng,
      size: 92,
    }],
    primaryScreenshotId: `stress-shot-${index}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function seedStressStore(page) {
  const trades = Array.from({ length: tradeCount }, (_, index) => makeTrade(index));
  await page.evaluate(async ({ seededTrades }) => {
    await new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase('trading-journal-template');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => resolve();
    });
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('trading-journal-template', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('kv');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put({
        profile: { id: 'local-user', display_name: 'Stress Tester', role: 'local', onboarding_completed_at: new Date().toISOString() },
        accounts: [{ id: 'personal', name: 'Personal', startingBalance: 0 }],
        playbooks: [{ id: 'pb-1', name: 'Opening model', session: 'NY AM', setupRules: ['Sweep first'], entryChecklist: ['Confirm displacement'] }],
        trades: seededTrades,
        entries: [],
        analyses: [],
        settings: { appName: 'Trading Journal Template' },
      }, 'journal');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, { seededTrades: trades });
}

async function assertNoOverflow(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  if (overflow) throw new Error(`${label} caused page horizontal overflow.`);
}

const server = startServer();
const browser = await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
const errors = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
page.on('console', (message) => {
  if (['error', 'warning'].includes(message.type())) errors.push(`${message.type()}: ${message.text()} ${message.location().url}`);
});
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));

try {
  await waitForServer(page);
  await seedStressStore(page);
  for (const route of ['/app', '/app/log', '/app/reports', '/app/accounts', `/app/trade/stress-trade-${tradeCount - 1}`]) {
    const start = performance.now();
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForSelector('text=Trading Journal Template', { timeout: 15000 });
    const elapsed = Math.round(performance.now() - start);
    await assertNoOverflow(page, route);
    if (elapsed > 5000) throw new Error(`${route} loaded too slowly: ${elapsed}ms.`);
  }

  await page.goto(`${baseUrl}/app/log`);
  await expect(page.locator('.trade-card')).toHaveCount(Math.min(50,tradeCount));
  if(tradeCount>50){await page.getByRole('button',{name:'Load more trades',exact:true}).click();await expect(page.locator('.trade-card')).toHaveCount(Math.min(100,tradeCount));}
  await page.getByPlaceholder('Search trades').fill('no-synthetic-match');await expect(page.locator('.trade-card')).toHaveCount(0);
  await page.getByPlaceholder('Search trades').fill('');await expect(page.locator('.trade-card')).toHaveCount(Math.min(50,tradeCount));

  await page.goto(`${baseUrl}/app/settings`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  const download = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Export Backup/u }).first().click(),
  ]).then(([item]) => item);
  if (!download.suggestedFilename().endsWith('.zip')) throw new Error('Backup export did not download a ZIP file.');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/app/log`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await assertNoOverflow(page, 'mobile log');

  const relevantErrors = errors.filter((entry) => !/favicon/iu.test(entry));
  if (relevantErrors.length) throw new Error(`Browser errors found:\n${relevantErrors.slice(0, 10).join('\n')}`);
  console.log(`Heavy browser stress passed: ${tradeCount} trades with screenshots.`);
} finally {
  await browser.close();
  if (server) server.kill('SIGTERM');
}
