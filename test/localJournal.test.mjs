import test from 'node:test';
import assert from 'node:assert/strict';
import { strToU8, zipSync } from 'fflate';
import {
  choosePrimaryScreenshotId,
  emptyLocalStore,
  exportLocalBackup,
  importLocalBackup,
  limitLocalScreenshots,
} from '../src/localJournal.js';

const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

test('limits local screenshots to the public cap', () => {
  const shots = Array.from({ length: 12 }, (_, index) => ({ id: `shot-${index}` }));
  assert.equal(limitLocalScreenshots(shots).length, 10);
});

test('exports and imports a ZIP backup with screenshot data', async () => {
  const store = {
    ...emptyLocalStore,
    trades: [{
      id: 'trade-1',
      date: '2026-01-02',
      asset: 'MNQ',
      direction: 'Long',
      outcome: 'Win',
      pnl: '+100',
      rr: '1.5RR',
      rating: 'A',
      note: 'Clean local test trade.',
      screenshots: [{
        id: 'shot-1',
        name: 'chart.png',
        type: 'image/png',
        kind: 'execution',
        dataUrl: tinyPng,
      }],
    }],
  };
  const backup = await exportLocalBackup(store);
  assert.equal(backup.type, 'application/zip');

  const imported = await importLocalBackup(backup);
  assert.equal(imported.trades.length, 1);
  assert.equal(imported.trades[0].id, 'trade-1');
  assert.equal(imported.trades[0].screenshots.length, 1);
  assert.match(imported.trades[0].screenshots[0].dataUrl, /^data:image\/png;base64,/u);
});

test('rejects oversized backup imports before reading the file', async () => {
  const oversized = {
    size: 201 * 1024 * 1024,
    async arrayBuffer() {
      throw new Error('arrayBuffer should not be called for oversized backups');
    },
  };
  await assert.rejects(() => importLocalBackup(oversized), /larger than 200 MB/u);
});

test('backup import coerces unsafe screenshot MIME types to image/png', async () => {
  const manifest = {
    version: 1,
    store: {
      ...emptyLocalStore,
      trades: [{
        id: 'trade-unsafe-mime',
        date: '2026-01-02',
        asset: 'MNQ',
        direction: 'Long',
        outcome: 'Win',
        pnl: '+100',
        rr: '1.5',
        screenshots: [{
          id: 'shot-unsafe-mime',
          type: 'text/html',
          backupPath: 'screenshots/trade-unsafe-mime/01-chart.html',
        }],
      }],
    },
  };
  const zipped = zipSync({
    'manifest.json': strToU8(JSON.stringify(manifest)),
    'screenshots/trade-unsafe-mime/01-chart.html': strToU8('<script>alert(1)</script>'),
  });
  const imported = await importLocalBackup(new Blob([zipped], { type: 'application/zip' }));
  assert.match(imported.trades[0].screenshots[0].dataUrl, /^data:image\/png;base64,/u);
});

test('backup import rejects excessive record counts', async () => {
  const manifest = {
    version: 1,
    store: {
      ...emptyLocalStore,
      trades: Array.from({ length: 5001 }, (_, index) => ({
        id: `trade-${index}`,
        date: '2026-01-02',
        asset: 'MNQ',
        direction: 'Long',
        outcome: 'Win',
        pnl: '+1',
      })),
    },
  };
  const zipped = zipSync({ 'manifest.json': strToU8(JSON.stringify(manifest)) });
  await assert.rejects(() => importLocalBackup(new Blob([zipped], { type: 'application/zip' })), /too many trades/u);
});

test('primary screenshot selection repairs stale ids', () => {
  const screenshots = [{ id: 'shot-news', kind: 'news' }, { id: 'shot-execution', kind: 'execution' }];
  assert.equal(choosePrimaryScreenshotId(screenshots, 'shot-news'), 'shot-news');
  assert.equal(choosePrimaryScreenshotId(screenshots, 'removed-shot'), 'shot-execution');
  assert.equal(choosePrimaryScreenshotId([], 'removed-shot'), '');
});
