import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const e2ePort = process.env.E2E_PORT || '5194';
const baseUrl = process.env.E2E_BASE_URL || `http://127.0.0.1:${e2ePort}`;
const shouldStartServer = !process.env.E2E_BASE_URL;

const pngBytes = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64',
);

function startServer() {
  if (!shouldStartServer) return null;
  const child = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', e2ePort], {
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

async function assertNoOverflow(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  if (overflow) throw new Error(`${label} has horizontal overflow.`);
}

async function deleteDatabase(page) {
  await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase('trading-journal-template');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  }));
}

async function main() {
  const server = startServer();
  const browser = await chromium.launch();
  const tempDir = await mkdtemp(path.join(tmpdir(), 'journal-template-e2e-'));
  const screenshotPath = path.join(tempDir, 'chart.png');
  await writeFile(screenshotPath, pngBytes);

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  try {
    await waitForServer(page);
    await deleteDatabase(page);
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForSelector('text=Trading Journal Template', { timeout: 15000 });
    await assertNoOverflow(page, 'Desktop app');

    await page.getByRole('button', { name: /Add Trade/u }).first().click();
    await page.getByLabel('P&L', { exact: true }).fill('+450');
    await page.getByLabel('RR').fill('2');
    await page.getByRole('button', { name: /Screenshots/u }).click();
    await page.locator('input[type="file"]').first().setInputFiles(screenshotPath);
    await page.getByRole('button', { name: /Notes/u }).click();
    await page.getByLabel('Messy Note').fill('Clean execution. Waited for the setup, followed the plan, and managed the trade well.');
    await page.getByRole('button', { name: /Review Check and save/u }).click();
    await page.getByRole('button', { name: /Save Trade/u }).click();
    await page.waitForSelector('text=Trade saved.', { timeout: 15000 });
    await page.getByRole('button', { name: /Dashboard/u }).click();
    const equityLine = await page.locator('svg[aria-label="Cumulative P&L chart"] path.equity-line').getAttribute('d');
    if (!equityLine || !/\sL\s/u.test(equityLine)) {
      throw new Error('Single-trade equity chart did not render a visible line segment.');
    }

    await page.getByRole('button', { name: /Trade Log/u }).click();
    await page.waitForSelector('text=MNQ Short', { timeout: 15000 });
    await page.getByTitle('Review trade').first().click();
    await page.waitForSelector('text=Trade Review', { timeout: 15000 });
    await page.waitForSelector('img[alt*="chart"], img[alt*="screenshot"], img[alt*="Trade screenshot"]', { timeout: 15000 });

    await page.getByRole('button', { name: /Settings/u }).click();
    await page.waitForSelector('text=Automatic Backups', { timeout: 15000 });
    if (!/[1-5] saved/u.test(await page.locator('body').innerText())) {
      throw new Error('Automatic backup count did not update after saving a trade.');
    }
    const autoDownload = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /Download Latest Auto Backup/u }).click(),
    ]).then(([item]) => item);
    if (!autoDownload.suggestedFilename().endsWith('.zip')) {
      throw new Error('Automatic backup export did not download a ZIP file.');
    }

    const download = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /Export Backup/u }).first().click(),
    ]).then(([item]) => item);
    const backupPath = path.join(tempDir, 'backup.zip');
    await download.saveAs(backupPath);

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: /Clear Local Data/u }).click();
    await page.waitForSelector('text=Journal cleared.', { timeout: 15000 });
    await page.getByRole('button', { name: /Trade Log/u }).click();
    if (/MNQ Short/u.test(await page.locator('body').innerText())) throw new Error('Trade remained after clearing local data.');

    await page.getByRole('button', { name: /Settings/u }).click();
    await page.locator('input[accept=".zip,application/zip"]').setInputFiles(backupPath);
    await page.waitForSelector('text=Backup imported.', { timeout: 15000 });
    await page.getByRole('button', { name: /Trade Log/u }).click();
    await page.waitForSelector('text=MNQ Short', { timeout: 15000 });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await assertNoOverflow(page, 'Mobile app');

    console.log('Local e2e smoke check passed.');
  } finally {
    await browser.close();
    if (server) server.kill('SIGTERM');
  }
}

main().catch((error) => {
  console.error(`Local e2e smoke check failed: ${error.message}`);
  process.exit(1);
});
