import { lookup } from 'node:dns/promises';

const NOTION_VERSION = '2022-06-28';
const MAX_IMAGES_PER_TRADE = 10;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

function notionConfig() {
  const token = process.env.NOTION_TOKEN || process.env.NOTION_API_KEY || '';
  const databaseId = process.env.NOTION_DATABASE_ID || '';
  return {
    token,
    databaseId,
    configured: Boolean(token && databaseId),
  };
}

function envError() {
  const error = new Error('Notion import is not configured. Add NOTION_TOKEN and NOTION_DATABASE_ID to .env.local, then restart the app.');
  error.status = 400;
  error.code = 'NOTION_NOT_CONFIGURED';
  error.missing = ['NOTION_TOKEN', 'NOTION_DATABASE_ID'].filter((key) => !process.env[key] && !(key === 'NOTION_TOKEN' && process.env.NOTION_API_KEY));
  return error;
}

async function notionRequest(path, options = {}) {
  const config = notionConfig();
  if (!config.configured) throw envError();
  const response = await fetch(`https://api.notion.com/v1${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${config.token}`,
      'notion-version': NOTION_VERSION,
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const error = new Error(data.message || 'Notion request failed.');
    error.status = response.status;
    error.code = data.code || null;
    error.details = data;
    throw error;
  }
  return data;
}

function richTextPlain(items = []) {
  return items.map((item) => item.plain_text || item.text?.content || '').join('').trim();
}

function propertyValue(property) {
  if (!property) return '';
  switch (property.type) {
    case 'title':
      return richTextPlain(property.title);
    case 'rich_text':
      return richTextPlain(property.rich_text);
    case 'select':
      return property.select?.name || '';
    case 'status':
      return property.status?.name || '';
    case 'multi_select':
      return (property.multi_select || []).map((item) => item.name).join(', ');
    case 'number':
      return property.number ?? '';
    case 'date':
      return property.date?.start || '';
    case 'checkbox':
      return property.checkbox ? 'Yes' : 'No';
    case 'email':
      return property.email || '';
    case 'phone_number':
      return property.phone_number || '';
    case 'url':
      return property.url || '';
    case 'formula':
      return propertyValue(property.formula);
    case 'rollup':
      if (property.rollup?.type === 'number') return property.rollup.number ?? '';
      if (property.rollup?.type === 'array') return property.rollup.array.map(propertyValue).filter(Boolean).join(', ');
      return '';
    default:
      return '';
  }
}

function propertyByName(properties = {}, candidates = []) {
  const entries = Object.entries(properties);
  for (const candidate of candidates) {
    const direct = entries.find(([name]) => name.toLowerCase() === candidate.toLowerCase());
    if (direct) return direct[1];
  }
  for (const candidate of candidates) {
    const loose = entries.find(([name]) => name.toLowerCase().includes(candidate.toLowerCase()));
    if (loose) return loose[1];
  }
  return null;
}

function getText(properties, candidates) {
  return String(propertyValue(propertyByName(properties, candidates)) ?? '').trim();
}

function normalizeMoney(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const number = Number(raw.replace(/[$,+\s]/gu, ''));
  return Number.isFinite(number) ? String(number) : raw;
}

function moneyNumber(value) {
  const number = Number(String(value ?? '').replace(/[$,+\s]/gu, ''));
  return Number.isFinite(number) ? number : 0;
}

function normalizeRR(value) {
  return String(value ?? '').trim().replace(/\s+/gu, '').replace(/,+/gu, '.').replace(/r+$/iu, '');
}

function normalizeOutcome(value, pnl) {
  const raw = String(value || '').trim().toLowerCase().replace(/[_-]+/gu, ' ');
  if (raw.includes('win')) return 'Win';
  if (raw.includes('loss')) return 'Loss';
  if (['be', 'break even', 'breakeven'].includes(raw)) return 'BE';
  if (raw.includes('miss')) return 'Missed';
  if (raw.includes('no trade')) return 'No Trade';
  if (String(pnl ?? '').trim()) {
    const number = moneyNumber(pnl);
    if (number > 0) return 'Win';
    if (number < 0) return 'Loss';
    return 'BE';
  }
  return '';
}

function normalizeDirection(value) {
  const raw = String(value || '').toLowerCase();
  const hasLong = raw.includes('long');
  const hasShort = raw.includes('short');
  if (hasLong && hasShort) return 'Short, Long';
  if (hasLong) return 'Long';
  if (hasShort) return 'Short';
  if (raw.includes('no trade')) return 'No Trade';
  return String(value || '').trim();
}

function blockText(block) {
  const data = block?.[block.type] || {};
  const text = richTextPlain(data.rich_text || data.text || []);
  const caption = richTextPlain(data.caption || []);
  return [text, caption].filter(Boolean).join(' - ');
}

function fileNameFromUrl(url, fallback) {
  try {
    const parsed = new URL(url);
    const last = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || '');
    return last || fallback;
  } catch {
    return fallback;
  }
}

function blockImage(block) {
  if (!['image', 'file'].includes(block.type)) return null;
  const data = block[block.type];
  const file = data?.type === 'file' ? data.file : data?.type === 'external' ? data.external : null;
  const url = file?.url;
  if (!url) return null;
  const caption = richTextPlain(data.caption || []);
  return {
    id: block.id,
    url,
    caption,
    name: caption || fileNameFromUrl(url, `${block.type}-${block.id}.png`),
  };
}

function propertyFiles(properties = {}) {
  const files = [];
  for (const [propertyName, property] of Object.entries(properties)) {
    if (property.type !== 'files') continue;
    for (const fileItem of property.files || []) {
      const file = fileItem.type === 'file' ? fileItem.file : fileItem.type === 'external' ? fileItem.external : null;
      if (file?.url) {
        files.push({
          id: `${property.id || propertyName}-${fileItem.name || files.length}`,
          url: file.url,
          caption: propertyName,
          name: fileItem.name || fileNameFromUrl(file.url, `${propertyName}-${files.length + 1}.png`),
        });
      }
    }
  }
  return files;
}

async function listDatabasePages() {
  const { databaseId } = notionConfig();
  const pages = [];
  let cursor = undefined;
  do {
    const body = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const data = await notionRequest(`/databases/${databaseId}/query`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    pages.push(...(data.results || []).filter((page) => page.object === 'page'));
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  return pages;
}

async function listBlockChildren(blockId) {
  const blocks = [];
  let cursor = undefined;
  do {
    const suffix = cursor ? `&start_cursor=${encodeURIComponent(cursor)}` : '';
    const data = await notionRequest(`/blocks/${blockId}/children?page_size=100${suffix}`, { method: 'GET' });
    blocks.push(...(data.results || []));
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  return blocks;
}

async function collectPageContent(pageId, depth = 0) {
  if (depth > 4) return { textLines: [], images: [] };
  const children = await listBlockChildren(pageId);
  const textLines = [];
  const images = [];
  for (const block of children) {
    const text = blockText(block);
    if (text) textLines.push(text);
    const image = blockImage(block);
    if (image) images.push(image);
    if (block.has_children) {
      const nested = await collectPageContent(block.id, depth + 1);
      textLines.push(...nested.textLines);
      images.push(...nested.images);
    }
  }
  return { textLines, images };
}

function imageKind(image) {
  const text = `${image.caption || ''} ${image.name || ''}`.toLowerCase();
  if (/\b(news|calendar|fomc|cpi|nfp|employment|unemployment|fed|powell|pmi|claims)\b/u.test(text)) return 'news';
  if (/\b(context|htf|bias|daily|4h|1h)\b/u.test(text)) return 'context';
  return 'execution';
}

function isPrivateIpv4(hostname) {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/u);
  if (!match) return false;
  const octets = match.slice(1).map(Number);
  if (octets.some((octet) => octet < 0 || octet > 255)) return true;
  const [a, b] = octets;
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    a === 0
  );
}

function isUnsafeIpv6Literal(hostname) {
  if (!hostname.startsWith('[') || !hostname.endsWith(']')) return false;
  const value = hostname.slice(1, -1).toLowerCase();
  return (
    value === '::1' ||
    value === '0:0:0:0:0:0:0:1' ||
    value.startsWith('fc') ||
    value.startsWith('fd') ||
    value.startsWith('fe80') ||
    value.startsWith('::ffff:')
  );
}

function isMetadataHostname(hostname) {
  return [
    'metadata',
    'metadata.google.internal',
    'metadata.azure.com',
    'instance-data',
  ].includes(hostname);
}

function assertSafeImageUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('image URL is invalid');
  }
  const hostname = parsed.hostname.toLowerCase();
  const unsafeHost = (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === '::1' ||
    hostname === '[::1]' ||
    hostname === '0:0:0:0:0:0:0:1' ||
    isUnsafeIpv6Literal(hostname) ||
    isMetadataHostname(hostname) ||
    isPrivateIpv4(hostname)
  );
  if (parsed.protocol !== 'https:') throw new Error('image URL must use HTTPS');
  if (unsafeHost) throw new Error('image URL points to a local or private address');
  return parsed.toString();
}

async function assertSafeImageUrlForFetch(url) {
  const safeUrl = assertSafeImageUrl(url);
  const parsed = new URL(safeUrl);
  const hostname = parsed.hostname.toLowerCase();
  if (!isPrivateIpv4(hostname) && !hostname.startsWith('[')) {
    const addresses = await lookup(hostname, { all: true, verbatim: true }).catch((error) => {
      throw new Error(`image host could not be resolved: ${error.message}`);
    });
    if (addresses.some((entry) => isPrivateIpv4(entry.address) || isUnsafeIpv6Literal(`[${entry.address}]`))) {
      throw new Error('image URL resolves to a local or private address');
    }
  }
  return safeUrl;
}

async function downloadImage(image, pageId, index, warnings) {
  const safeUrl = await assertSafeImageUrlForFetch(image.url);
  const response = await fetch(safeUrl);
  if (!response.ok) throw new Error(`image request failed with ${response.status}`);
  const contentType = response.headers.get('content-type') || 'image/png';
  if (!contentType.startsWith('image/')) throw new Error(`unsupported file type ${contentType}`);
  const length = Number(response.headers.get('content-length') || 0);
  if (length > MAX_IMAGE_BYTES) throw new Error('image is larger than 12 MB');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error('image is larger than 12 MB');
  return {
    id: `notion-${pageId}-${image.id || index}`,
    name: image.name || `notion-screenshot-${index + 1}.png`,
    kind: imageKind(image),
    sortOrder: index,
    sort_order: index,
    dataUrl: `data:${contentType};base64,${bytes.toString('base64')}`,
    source: 'notion',
  };
}

async function downloadScreenshots(images, pageId, warnings) {
  const unique = [];
  const seen = new Set();
  for (const image of images) {
    if (!image.url || seen.has(image.url)) continue;
    seen.add(image.url);
    unique.push(image);
  }
  if (unique.length > MAX_IMAGES_PER_TRADE) {
    warnings.push(`Notion page ${pageId} has ${unique.length} images. Imported the first ${MAX_IMAGES_PER_TRADE}.`);
  }
  const screenshots = [];
  for (const [index, image] of unique.slice(0, MAX_IMAGES_PER_TRADE).entries()) {
    try {
      screenshots.push(await downloadImage(image, pageId, index, warnings));
    } catch (error) {
      warnings.push(`Could not import image "${image.name || image.url}" from page ${pageId}: ${error.message}`);
    }
  }
  return screenshots;
}

function buildSections({ trade, rawNote, setupText, entryReason, exitReason, lesson }) {
  const confirmations = setupText || trade.strategy || 'Main confirmations were not specified.';
  return {
    'Trade Summary': `${trade.asset || 'Trade'} ${trade.direction || ''} on ${trade.date || 'unspecified date'}. Outcome: ${trade.outcome || 'Unspecified'}. RR: ${trade.rr || 'not specified'}. P&L: ${trade.pnl || 'not specified'}. Rating: ${trade.rating || 'not specified'}.`.replace(/\s+/gu, ' ').trim(),
    Setup: confirmations,
    Execution: [entryReason && `Entry: ${entryReason}`, exitReason && `Exit: ${exitReason}`].filter(Boolean).join('\n') || 'Execution detail was not specified beyond the raw note.',
    Psychology: trade.emotion ? `Emotion noted: ${trade.emotion}.` : 'No specific psychology pattern was stated.',
    'What Worked': trade.rating && ['A+', 'A', 'B+'].includes(trade.rating) ? `Rated ${trade.rating}. Repeat the process elements that made this trade clean.` : 'No clear positive process note was specified.',
    'What To Improve': lesson || 'Write the exact rule or behavior to improve after reviewing this trade.',
    'Raw Note': rawNote || 'No raw note provided.',
  };
}

async function pageToTrade(page, warnings = []) {
  const properties = page.properties || {};
  const content = await collectPageContent(page.id);
  const propertyImages = propertyFiles(properties);
  const title = getText(properties, ['Name', 'Title', 'Trade', 'Trade Name']) || 'Notion Trade';
  const dateRaw = getText(properties, ['Date', 'Trade Date', 'Day']) || page.created_time || '';
  const pnl = normalizeMoney(getText(properties, ['PNL', 'P&L', 'P/L', 'Profit', 'Net P&L', 'Net']));
  const outcome = normalizeOutcome(getText(properties, ['Outcome', 'Result', 'Status']), pnl);
  const setupText = getText(properties, ['Setup', 'Strategy', 'Playbook', 'Model']);
  const noteProperty = getText(properties, ['Notes', 'Note', 'Journal', 'Raw Note', 'Reflection']);
  const rawNote = [noteProperty, ...content.textLines].filter(Boolean).join('\n').trim();
  const screenshots = await downloadScreenshots([...propertyImages, ...content.images], page.id, warnings);
  const trade = {
    id: `notion-${page.id}`,
    notionPageId: page.id,
    notionUrl: page.url || '',
    importedFrom: 'notion',
    title,
    date: String(dateRaw).slice(0, 10),
    asset: getText(properties, ['Asset', 'Symbol', 'Ticker', 'Market']) || '',
    account: getText(properties, ['Account']) || 'Personal',
    direction: normalizeDirection(getText(properties, ['Direction', 'Bias', 'Side'])),
    outcome,
    pnl,
    rr: normalizeRR(getText(properties, ['RR', 'R', 'Risk Reward', 'R:R'])),
    rating: getText(properties, ['Rating', 'Grade', 'Quality']),
    session: getText(properties, ['Session']),
    strategy: setupText,
    setupName: setupText,
    emotion: getText(properties, ['Emotion', 'Mood']),
    setupTags: getText(properties, ['Setup Tags', 'Setups']).split(',').map((tag) => tag.trim()).filter(Boolean),
    mistakeTags: getText(properties, ['Mistake Tags', 'Mistakes']).split(',').map((tag) => tag.trim()).filter(Boolean),
    entryReason: getText(properties, ['Entry Reason', 'Entry']),
    exitReason: getText(properties, ['Exit Reason', 'Exit']),
    lesson: getText(properties, ['Lesson', 'Improvement', 'Next Rule']),
    note: rawNote,
    raw_note: rawNote,
    reviewStatus: 'needs_review',
    reviewed: false,
    screenshots,
    primaryScreenshotId: screenshots.find((shot) => shot.kind === 'execution')?.id || screenshots[0]?.id || '',
    createdAt: page.created_time || new Date().toISOString(),
    updatedAt: page.last_edited_time || new Date().toISOString(),
  };
  trade.sections = buildSections({
    trade,
    rawNote,
    setupText,
    entryReason: trade.entryReason,
    exitReason: trade.exitReason,
    lesson: trade.lesson,
  });
  return trade;
}

async function importNotionDatabase() {
  const warnings = [];
  const pages = await listDatabasePages();
  const trades = [];
  for (const page of pages) {
    try {
      trades.push(await pageToTrade(page, warnings));
    } catch (error) {
      warnings.push(`Skipped page ${page.id}: ${error.message}`);
    }
  }
  trades.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  return { imported: trades.length, totalPages: pages.length, warnings, trades };
}

async function handleNotionRoute(req, res, helpers) {
  const { sendJson } = helpers;
  if (req.method === 'GET' && req.url.startsWith('/api/notion/status')) {
    const config = notionConfig();
    return sendJson(req, res, 200, {
      configured: config.configured,
      hasToken: Boolean(config.token),
      hasDatabaseId: Boolean(config.databaseId),
    });
  }
  if (req.method === 'POST' && req.url.startsWith('/api/notion/test')) {
    const { databaseId } = notionConfig();
    const database = await notionRequest(`/databases/${databaseId}`, { method: 'GET' });
    return sendJson(req, res, 200, {
      ok: true,
      title: richTextPlain(database.title || []) || 'Untitled database',
      propertyCount: Object.keys(database.properties || {}).length,
    });
  }
  if (req.method === 'POST' && req.url.startsWith('/api/notion/import')) {
    const result = await importNotionDatabase();
    return sendJson(req, res, 200, { ok: true, ...result });
  }
  return false;
}

export {
  blockText,
  assertSafeImageUrl,
  handleNotionRoute,
  importNotionDatabase,
  normalizeOutcome,
  pageToTrade,
  propertyValue,
  richTextPlain,
};
