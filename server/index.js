import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleNotionRoute } from './notion.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 8787);
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const DEFAULT_ALLOWED_ORIGINS = ['http://127.0.0.1:5176', 'http://localhost:5176'];

loadEnv(path.join(projectRoot, '.env.local'));
loadEnv(path.join(projectRoot, '.env'));

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/u);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const equalIndex = trimmed.indexOf('=');
    if (equalIndex === -1) continue;
    const key = trimmed.slice(0, equalIndex).trim();
    let value = trimmed.slice(equalIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function corsOrigin(req) {
  const requestOrigin = req.headers.origin || '';
  const configured = String(process.env.LOCAL_API_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowedOrigins = new Set(configured.length ? configured : DEFAULT_ALLOWED_ORIGINS);
  if (allowedOrigins.has(requestOrigin)) return requestOrigin;
  return DEFAULT_ALLOWED_ORIGINS[0];
}

function sendJson(req, res, status, data) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': corsOrigin(req),
    'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type',
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error('Request is too large.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function handleRequest(req, res) {
  if (req.method === 'OPTIONS') return sendJson(req, res, 200, { ok: true });
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === 'GET' && url.pathname === '/api/health') {
      return sendJson(req, res, 200, { ok: true });
    }
    if (url.pathname.startsWith('/api/notion/')) {
      const handled = await handleNotionRoute(req, res, { sendJson, readBody });
      if (handled !== false) return handled;
    }
    return sendJson(req, res, 404, { error: 'Not found' });
  } catch (error) {
    return sendJson(req, res, error.status || 500, {
      error: error.message || 'Something went wrong.',
      code: error.code || null,
      missing: error.missing || null,
      details: error.details || null,
    });
  }
}

export { corsOrigin, handleRequest };

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  http.createServer(handleRequest).listen(PORT, '127.0.0.1', () => {
    console.log(`Trading Journal local API running at http://127.0.0.1:${PORT}`);
  });
}
