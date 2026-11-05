import { validateRisk, riskSettings } from './risk.js';
import { RULES } from './discipline.js';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { normalizeReviewStatus, normalizeTags } from './analytics.js';
import { normalizeOutcome, normalizeRR, parseMoney } from './journalRules.js';

export const MAX_LOCAL_SCREENSHOTS = 10;

const DB_NAME = 'trading-journal-template';
const DB_VERSION = 1;
const STORE_NAME = 'kv';
const STORE_KEY = 'journal';
const AUTO_BACKUPS_KEY = 'autoBackups';
const MAX_AUTO_BACKUPS = 5;
const MAX_BACKUP_BYTES = 200 * 1024 * 1024;
const MAX_BACKUP_UNZIPPED_BYTES = 300 * 1024 * 1024;
const MAX_BACKUP_ENTRIES = 25_000;
const MAX_BACKUP_RECORDS = 5_000;
const MAX_BACKUP_SCREENSHOTS = 20_000;
const SAFE_IMAGE_MIME = /^(image\/png|image\/jpe?g|image\/webp|image\/gif)$/iu;

export const emptyLocalStore = {
  profile: {
    id: 'local-user',
    display_name: 'Local Trader',
    role: 'local',
    onboarding_completed_at: new Date().toISOString(),
  },
  accounts: [{ id: 'personal', name: 'Personal', startingBalance: 0 }],
  playbooks: [],
  trades: [],
  entries: [],
  analyses: [],
  discipline: [],
  settings: {
    appName: 'Trading Journal Template',
    createdAt: new Date().toISOString(),
    tradingRules: [],
  },
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function id(prefix = 'id') {
  return globalThis.crypto?.randomUUID?.() || `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open local journal database.'));
  });
}

async function readKey(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not read local journal data.'));
    tx.oncomplete = () => db.close();
  });
}

async function writeKey(key, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const request = tx.objectStore(STORE_NAME).put(value, key);
    tx.onabort = () => reject(tx.error || new Error('Local journal transaction was aborted.'));
    request.onerror = () => reject(request.error || new Error('Could not save local journal data.'));
    tx.oncomplete = () => { db.close(); resolve(); };
  });
}

async function deleteKey(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const request = tx.objectStore(STORE_NAME).delete(key);
    tx.onabort = () => reject(tx.error || new Error('Local journal transaction was aborted.'));
    request.onerror = () => reject(request.error || new Error('Could not clear local journal data.'));
    tx.oncomplete = () => { db.close(); resolve(); };
  });
}

export function normalizeStore(store = {}) {
  store = migrateAccounts(clone(store));
  store.accounts.forEach(a => { if (a.risk) validateRisk(riskSettings(a)); });
  return {
    ...clone(emptyLocalStore),
    ...clone(store),
    profile: { ...emptyLocalStore.profile, ...(store.profile || {}) },
    settings: { ...emptyLocalStore.settings, ...(store.settings || {}) },
    accounts: Array.isArray(store.accounts) && store.accounts.length ? store.accounts : clone(emptyLocalStore.accounts),
    playbooks: Array.isArray(store.playbooks) ? store.playbooks : [],
    trades: Array.isArray(store.trades) ? store.trades : [],
    entries: Array.isArray(store.entries) ? store.entries : [],
    analyses: Array.isArray(store.analyses) ? store.analyses : [],
    discipline: normalizeDiscipline(store.discipline || [], store.accounts),
  };
}

// Names are retained as legacy metadata; IDs are the permanent relationship.
export function migrateAccounts(store = {}) {
  const accounts = (store.accounts?.length ? store.accounts : clone(emptyLocalStore.accounts)).map((a, index) => ({ ...a, id: a.id || `legacy-account-${index}-${encodeURIComponent(a.name || 'Account')}`, archived: Boolean(a.archived) }));
  if (new Set(accounts.map(a => a.id)).size !== accounts.length) throw new Error('Duplicate account identifiers. Restore a valid backup.');
  const trades = (store.trades || []).map(trade => {
    let account = accounts.find(a => a.id === trade.accountId);
    if (!account && !trade.accountId) {
      const matches = accounts.filter(a => a.name === (trade.account || 'Personal'));
      if (matches.length === 1) account = matches[0];
    }
    if (!account) {
      account = { id: trade.accountId || `legacy-${encodeURIComponent(trade.account || 'Personal')}-${accounts.length}`, name: trade.account || 'Recovered Account', startingBalance: 0, archived: false };
      accounts.push(account);
    }
    return { ...trade, accountId: account.id };
  });
  return { ...store, accounts, trades, schemaVersion: 2 };
}

export async function requestPersistentStorage() {
  if (!navigator.storage?.persist) return { supported: false, persisted: false, estimate: null };
  const persisted = await navigator.storage.persisted();
  const granted = persisted || await navigator.storage.persist();
  const estimate = navigator.storage.estimate ? await navigator.storage.estimate() : null;
  return { supported: true, persisted: granted, estimate };
}

export async function storageEstimate() {
  return navigator.storage?.estimate ? navigator.storage.estimate() : null;
}

export async function loadLocalStore() {
  const saved = await readKey(STORE_KEY);
  if (!saved) {
    const fresh = normalizeStore(emptyLocalStore);
    await writeKey(STORE_KEY, fresh);
    return fresh;
  }
  const migrated = normalizeStore(saved);
  if (saved.schemaVersion !== 2) {
    await createLocalAutoBackup(saved, 'before_account_migration');
    await writeKey(STORE_KEY, migrated);
  }
  return migrated;
}

export async function writeLocalStore(store, options = {}) {
  const next = normalizeStore(store);
  await writeKey(STORE_KEY, next);
  if (options.autoBackup !== false) await createLocalAutoBackup(next, options.reason || 'autosave');
  return next;
}

export async function clearLocalStore() {
  const current = await readKey(STORE_KEY).catch(() => null);
  if (current) await createLocalAutoBackup(normalizeStore(current), 'before_reset');
  await deleteKey(STORE_KEY);
  return normalizeStore(emptyLocalStore);
}

export function limitLocalScreenshots(screenshots = []) {
  return screenshots.slice(0, MAX_LOCAL_SCREENSHOTS);
}

export function choosePrimaryScreenshotId(screenshots = [], primaryScreenshotId = '') {
  return screenshots.some((shot) => shot.id === primaryScreenshotId)
    ? primaryScreenshotId
    : screenshots.find((shot) => shot.kind !== 'news')?.id || screenshots[0]?.id || '';
}

export async function saveLocalTrade(store, trade) {
  const current = normalizeStore(store);
  const account = current.accounts.find(a => a.id === trade.accountId);
  const previous = current.trades.find(t => t.id === trade.id);
  if (!account || (account.archived && previous?.accountId !== account.id)) throw new Error('Select an active trading account.');
  const now = new Date().toISOString();
  const tradeId = trade.id || id('trade');
  const screenshots = limitLocalScreenshots(trade.screenshots || []).map((shot, index) => ({
    ...shot,
    id: shot.id || id('shot'),
    kind: shot.kind || 'execution',
    sortOrder: index,
    sort_order: index,
  }));
  const primaryScreenshotId = choosePrimaryScreenshotId(screenshots, trade.primaryScreenshotId);
  const nextTrade = {
    ...trade,
    id: tradeId,
    title: trade.title || `${trade.asset || 'Trade'} ${trade.direction || ''} - ${trade.date || todayString()} - ${normalizeOutcome(trade)}`.trim(),
    accountId: account.id,
    account: account.name,
    outcome: normalizeOutcome(trade),
    pnl: String(trade.pnl ?? ''),
    pnlValue: parseMoney(trade.pnl),
    rr: normalizeRR(trade.rr),
    setupTags: normalizeTags(trade.setupTags || trade.setup_tags),
    mistakeTags: normalizeTags(trade.mistakeTags || trade.mistake_tags),
    tags: normalizeTags(trade.tags),
    reviewStatus: normalizeReviewStatus(trade),
    reviewed: normalizeReviewStatus(trade) === 'reviewed',
    screenshots,
    primaryScreenshotId,
    createdAt: trade.createdAt || now,
    updatedAt: now,
  };
  const exists = current.trades.some((item) => item.id === tradeId);
  const trades = exists
    ? current.trades.map((item) => item.id === tradeId ? nextTrade : item)
    : current.trades.concat(nextTrade);
  return writeLocalStore({ ...current, trades }, { reason: exists ? 'trade_updated' : 'trade_created' });
}

export async function deleteLocalTrade(store, tradeId) {
  const current = normalizeStore(store);
  return writeLocalStore({ ...current, trades: current.trades.filter((trade) => trade.id !== tradeId) }, { reason: 'trade_deleted' });
}

function normalizeDiscipline(records, accounts) {
  if (!Array.isArray(records) || records.length > 5000) throw new Error('Invalid discipline records.');
  const keys = new Set();
  return records.map(r => {
    const key = `${r.accountId}:${r.date}`;
    if (!r.id || keys.has(key) || !accounts.some(a=>a.id===r.accountId) || !/^\d{4}-\d{2}-\d{2}$/.test(r.date) || new Date(`${r.date}T12:00:00Z`).toISOString().slice(0,10)!==r.date || !r.answers || typeof r.answers !== 'object' || Object.entries(r.answers).some(([id,v])=>!RULES.some(rule=>rule[0]===id)||!['','yes','no','na'].includes(v)) || typeof r.notes !== 'string') throw new Error('Invalid or duplicate discipline record.');
    keys.add(key); return r;
  });
}
export async function saveLocalDiscipline(store, record) {
  const current=normalizeStore(store);
  const previous=current.discipline.find(r=>r.accountId===record.accountId&&r.date===record.date);
  const next={...record,id:previous?.id||`discipline:${record.accountId}:${record.date}`};
  return writeLocalStore({...current,discipline:[...current.discipline.filter(r=>r.id!==next.id),next]}, {reason:'discipline_saved'});
}
export async function saveLocalAccounts(store, accounts = []) {
  const current = normalizeStore(store);
  const next = accounts.map(account => ({ ...account, ...(account.risk ? {risk: validateRisk(riskSettings(account))} : {}), name: String(account.name || '').trim(), id: account.id || id('account'), startingBalance: Number(account.startingBalance), archived: Boolean(account.archived) }));
  if (next.some(a => !a.name || !Number.isFinite(a.startingBalance) || a.startingBalance < 0)) throw new Error('Every account needs a name and a valid non-negative initial balance.');
  if (new Set(next.map(a => a.id)).size !== next.length) throw new Error('Account IDs must be unique.');
  if (current.accounts.some(a => !next.some(n => n.id === a.id))) throw new Error('Archive accounts instead of deleting them.');
  return writeLocalStore({ ...current, accounts: next }, { reason: 'accounts_saved' });
}

export async function assignLocalTrades(store, tradeIds, accountId) {
  const current = normalizeStore(store);
  const target = current.accounts.find(a => a.id === accountId && !a.archived);
  if (!target) throw new Error('Select an active destination account.');
  const selected = new Set(tradeIds);
  if (!selected.size || [...selected].some(id => !current.trades.some(t => t.id === id))) throw new Error('Select existing trades to move.');
  // Assignment changes only the relationship, even for incomplete legacy tickets.
  const trades = current.trades.map(t => selected.has(t.id) ? { ...t, accountId: target.id, account: target.name } : t);
  await createLocalAutoBackup(current, 'before_trade_assignment');
  return writeLocalStore({ ...current, trades }, { reason: 'trades_assigned' });
}

export async function saveLocalPlaybooks(store, playbooks = []) {
  const current = normalizeStore(store);
  const next = playbooks
    .filter((playbook) => String(playbook.name || '').trim())
    .map((playbook) => ({ ...playbook, id: playbook.id || id('playbook'), updatedAt: new Date().toISOString() }));
  return writeLocalStore({ ...current, playbooks: next }, { reason: 'playbooks_saved' });
}

export async function saveLocalSettings(store, settings = {}) {
  const current = normalizeStore(store);
  return writeLocalStore({
    ...current,
    settings: {
      ...current.settings,
      ...settings,
      updatedAt: new Date().toISOString(),
    },
  }, { reason: 'settings_saved' });
}

export async function saveLocalItem(store, collection, item) {
  if (!['entries', 'analyses'].includes(collection)) throw new Error(`Unsupported collection: ${collection}`);
  const current = normalizeStore(store);
  const nextItem = {
    ...item,
    id: item.id || id(collection),
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const exists = current[collection].some((entry) => entry.id === nextItem.id);
  const list = exists
    ? current[collection].map((entry) => entry.id === nextItem.id ? nextItem : entry)
    : current[collection].concat(nextItem);
  return writeLocalStore({ ...current, [collection]: list }, { reason: `${collection}_saved` });
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function safeFileName(value = 'screenshot.png') {
  return String(value).replace(/[^a-z0-9._-]+/giu, '-').replace(/^-+|-+$/gu, '') || 'screenshot.png';
}

function extensionForMime(mime = '') {
  if (/webp/iu.test(mime)) return 'webp';
  if (/jpe?g/iu.test(mime)) return 'jpg';
  if (/png/iu.test(mime)) return 'png';
  return 'png';
}

function dataUrlParts(dataUrl = '') {
  const match = /^data:([^;,]+);base64,(.*)$/u.exec(dataUrl);
  if (!match) return null;
  return { mime: match[1], base64: match[2] };
}

function dataUrlToBytes(dataUrl) {
  const parts = dataUrlParts(dataUrl);
  if (!parts) return null;
  const binary = atob(parts.base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return { bytes, mime: parts.mime };
}

function safeImageMime(mime = 'image/png') {
  return SAFE_IMAGE_MIME.test(mime) ? mime : 'image/png';
}

function bytesToDataUrl(bytes, mime = 'image/png') {
  const nextMime = safeImageMime(mime);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  return `data:${nextMime};base64,${btoa(binary)}`;
}

function backupManifest(store) {
  const manifest = normalizeStore(store);
  const files = {};
  manifest.trades = manifest.trades.map((trade) => ({
    ...trade,
    screenshots: (trade.screenshots || []).map((shot, index) => {
      if (!shot.dataUrl) return shot;
      const converted = dataUrlToBytes(shot.dataUrl);
      if (!converted) return shot;
      const ext = extensionForMime(converted.mime);
      const path = `screenshots/${trade.id}/${String(index + 1).padStart(2, '0')}-${safeFileName(shot.name || `${shot.id}.${ext}`)}`;
      files[path] = converted.bytes;
      return {
        ...shot,
        dataUrl: '',
        backupPath: path,
        type: shot.type || converted.mime,
      };
    }),
  }));
  return { manifest, files };
}

export async function exportLocalBackup(store) {
  const { manifest, files } = backupManifest(store);
  const entries = {
    'manifest.json': strToU8(JSON.stringify({
      version: 2,
      exportedAt: new Date().toISOString(),
      app: 'Trading Journal Template',
      store: manifest,
    }, null, 2)),
    ...files,
  };
  const zipped = zipSync(entries, { level: 6 });
  return new Blob([zipped], { type: 'application/zip' });
}

export async function importLocalBackup(file) {
  if (file.size > MAX_BACKUP_BYTES) throw new Error('Backup is larger than 200 MB. Import a smaller backup or split old screenshots into separate archives.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  let entryCount = 0;
  let unzippedBytes = 0;
  const entries = unzipSync(bytes, {
    filter(fileInfo) {
      entryCount += 1;
      if (entryCount > MAX_BACKUP_ENTRIES) throw new Error(`Backup has more than ${MAX_BACKUP_ENTRIES.toLocaleString()} files.`);
      unzippedBytes += Number(fileInfo.originalSize || fileInfo.size || 0);
      if (unzippedBytes > MAX_BACKUP_UNZIPPED_BYTES) throw new Error('Backup expands beyond 300 MB. Import a smaller backup.');
      return true;
    },
  });
  const actualUnzippedBytes = Object.values(entries).reduce((sum, entry) => sum + entry.length, 0);
  if (actualUnzippedBytes > MAX_BACKUP_UNZIPPED_BYTES) throw new Error('Backup expands beyond 300 MB. Import a smaller backup.');
  if (!entries['manifest.json']) throw new Error('Backup is missing manifest.json.');
  const manifest = JSON.parse(strFromU8(entries['manifest.json']));
  const incoming = normalizeStore(manifest.store || manifest);
  validateBackupStore(incoming);
  for (const collection of ['accounts', 'trades', 'entries', 'analyses', 'playbooks', 'discipline']) {
    const ids = incoming[collection].map(item => item.id).filter(Boolean);
    if (new Set(ids).size !== ids.length) throw new Error(`Backup contains duplicate ${collection} identifiers. Nothing was imported.`);
  }
  incoming.trades = incoming.trades.map((trade) => ({
    ...trade,
    screenshots: (trade.screenshots || []).map((shot) => {
      if (!shot.backupPath) return shot;
      if (!entries[shot.backupPath]) throw new Error(`Backup is missing screenshot file: ${shot.backupPath}. Nothing was imported.`);
      return {
        ...shot,
        dataUrl: bytesToDataUrl(entries[shot.backupPath], shot.type || 'image/png'),
      };
    }),
  }));
  return incoming;
}

function validateBackupStore(store) {
  const collections = ['accounts', 'playbooks', 'trades', 'entries', 'analyses'];
  for (const collection of collections) {
    if ((store[collection] || []).length > MAX_BACKUP_RECORDS) {
      throw new Error(`Backup has too many ${collection}. Import a smaller backup.`);
    }
  }
  const screenshotCount = (store.trades || []).reduce((sum, trade) => sum + (trade.screenshots || []).length, 0);
  if (screenshotCount > MAX_BACKUP_SCREENSHOTS) {
    throw new Error(`Backup has more than ${MAX_BACKUP_SCREENSHOTS.toLocaleString()} screenshots. Import a smaller backup.`);
  }
}

export function mergeBackupStores(currentStore, importedStore) {
  const current = normalizeStore(currentStore);
  const incoming = normalizeStore(importedStore);
  const isFresh = ['trades', 'entries', 'analyses', 'playbooks', 'discipline'].every(key => !current[key].length)
    && current.accounts.length === 1 && current.accounts[0].id === 'personal'
    && current.accounts[0].name === 'Personal' && !Number(current.accounts[0].startingBalance) && !current.accounts[0].archived;
  const canonical = value => JSON.stringify(value, (key, item) => {
    if (key === 'backupPath') return undefined;
    return item && !Array.isArray(item) && typeof item === 'object' ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item;
  });
  const mergeById = (left, right) => {
    const rows = new Map(left.map((item) => [item.id, item]));
    for (const item of right) {
      const key = item.id || id('import');
      if (rows.has(key) && canonical(rows.get(key)) !== canonical(item)) throw new Error(`Backup conflicts with existing record ${key}. Nothing was imported. Export the current journal first; restore in a separate browser profile to review the backup safely.`);
      if (!rows.has(key)) rows.set(key, item);
    }
    return [...rows.values()];
  };
  return {
    ...current,
    accounts: mergeById(isFresh ? [] : current.accounts, incoming.accounts),
    playbooks: mergeById(current.playbooks, incoming.playbooks),
    trades: mergeById(current.trades, incoming.trades),
    entries: mergeById(current.entries, incoming.entries),
    analyses: mergeById(current.analyses, incoming.analyses),
    discipline: mergeById(current.discipline, incoming.discipline),
    profile: isFresh ? incoming.profile : current.profile,
    settings: { ...(isFresh ? incoming.settings : current.settings), importedAt: new Date().toISOString() },
  };
}

export async function mergeImportedStore(currentStore, importedStore) {
  const next = mergeBackupStores(currentStore, importedStore);
  await createLocalAutoBackup(currentStore, 'before_import');
  return writeLocalStore(next, { reason: 'backup_imported' });
}

function backupSummary(store, blob, reason) {
  const normalized = normalizeStore(store);
  const shotCount = (normalized.trades || []).reduce((sum, trade) => sum + (trade.screenshots?.length || 0), 0);
  return {
    id: id('autobackup'),
    createdAt: new Date().toISOString(),
    reason,
    tradeCount: normalized.trades.length,
    shotCount,
    size: blob.size || 0,
  };
}

async function readLocalAutoBackups() {
  const backups = await readKey(AUTO_BACKUPS_KEY).catch(() => []);
  return Array.isArray(backups) ? backups : [];
}

export async function createLocalAutoBackup(store, reason = 'autosave') {
  const normalized = normalizeStore(store);
  const blob = await exportLocalBackup(normalized);
  const record = { ...backupSummary(normalized, blob, reason), blob };
  const backups = await readLocalAutoBackups();
  const next = [record, ...backups].slice(0, MAX_AUTO_BACKUPS);
  await writeKey(AUTO_BACKUPS_KEY, next);
  return record;
}

export async function listLocalAutoBackups() {
  const backups = await readLocalAutoBackups();
  return backups.map(({ blob, ...meta }) => meta);
}

export async function exportLocalAutoBackup(backupId = '') {
  const backups = await readLocalAutoBackups();
  const backup = backupId ? backups.find((item) => item.id === backupId) : backups[0];
  if (!backup?.blob) throw new Error('No automatic backup is available yet.');
  return backup.blob;
}

export async function restoreLocalAutoBackup(backupId = '') {
  const backups = await readLocalAutoBackups();
  const backup = backupId ? backups.find((item) => item.id === backupId) : backups[0];
  if (!backup?.blob) throw new Error('No automatic backup is available yet.');
  const imported = await importLocalBackup(backup.blob);
  const current = await readKey(STORE_KEY);
  if (current) await createLocalAutoBackup(current, 'before_restore');
  return writeLocalStore(imported, { reason: 'auto_backup_restored' });
}
