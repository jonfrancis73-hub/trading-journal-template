import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import http from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

export const URL = 'http://127.0.0.1:5176';
const here = path.dirname(fileURLToPath(import.meta.url));
const support = path.join(os.homedir(), 'Library', 'Application Support', 'Trading Journal Launcher');
const logPath = path.join(support, 'server.log');
const homeKey = createHash('sha256').update(os.homedir()).digest('hex').slice(0, 12);
const socketDir = path.join('/tmp', `trading-journal-${process.getuid()}-${homeKey}`);
const socketPath = path.join(socketDir, 'control.sock');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export function validateProject(folder) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(folder, 'package.json'), 'utf8'));
    return pkg.name === 'trading-journal-template' && ['scripts/dev.mjs', 'server/index.js', 'src/main.jsx', 'vite.config.js'].every(p => fs.existsSync(path.join(folder, p)));
  } catch { return false; }
}

export function projectFolder() {
  const configured = path.join(here, 'project.txt');
  const folder = fs.existsSync(configured) ? fs.readFileSync(configured, 'utf8').trim() : path.join(os.homedir(), 'Documents', 'trading-journal-template');
  if (!validateProject(folder)) throw new Error('The trading journal folder cannot be located. Run Install Launcher.command again and select your existing journal folder. Your browser data has not been changed.');
  return folder;
}

export async function probe() {
  return new Promise(resolve => {
    const request = http.get(URL, { timeout: 1500 }, response => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { text += chunk; if (text.length > 100000) response.destroy(); });
      response.on('end', () => resolve(response.statusCode === 200 && text.includes('<title>Trading Journal Template</title>') && text.includes('/src/main.jsx') ? 'journal' : 'other'));
      response.on('error', () => resolve('other'));
    });
    request.on('timeout', () => request.destroy());
    request.on('error', error => resolve(error.code === 'ECONNREFUSED' ? 'absent' : 'other'));
  });
}

function control(action) {
  return new Promise((resolve, reject) => {
    const client = net.createConnection(socketPath);
    let data = '';
    client.setTimeout(10000, () => client.destroy(new Error('Launcher did not respond. Check server.log.')));
    client.on('connect', () => client.end(action + '\n'));
    client.on('data', chunk => { data += chunk; });
    client.on('end', () => { try { resolve(JSON.parse(data)); } catch { reject(new Error('Launcher returned an incomplete response. Try again.')); } });
    client.on('error', reject);
  });
}

async function supervisor() {
  // Binding this socket serializes simultaneous clicks before any children start.
  const children = [];
  let stopping = false;
  let failure = '';
  const server = net.createServer({ allowHalfOpen: true }, client => {
    client.once('data', async data => {
      if (data.toString().trim() === 'stop') {
        await shutdown();
        client.end(JSON.stringify({ stopped: true }));
        server.close(() => process.exit(0));
      } else client.end(JSON.stringify({ failure, stopping }));
    });
  });
  server.on('error', error => { console.error(error.message); process.exit(1); });
  await new Promise(resolve => server.listen(socketPath, resolve));
  fs.chmodSync(socketPath, 0o600);
  async function shutdown() {
    stopping = true;
    for (const child of children) if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    for (let i = 0; i < 50 && children.some(c => c.exitCode === null && c.signalCode === null); i++) await delay(100);
    for (const child of children) if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  }
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await shutdown(); server.close(() => process.exit(0)); });
  try {
    const folder = projectFolder();
    if (await probe() !== 'absent') throw new Error('Port 5176 is already occupied. No new server was started.');
    for (const script of ['server/index.js', 'node_modules/vite/bin/vite.js']) {
      const args = script.includes('/vite/') ? [script, '--host', '127.0.0.1', '--port', '5176', '--strictPort'] : [script];
      const child = spawn(process.execPath, args, { cwd: folder, stdio: 'inherit', env: process.env });
      children.push(child);
      const failed = async message => {
        if (stopping) return;
        failure = message;
        console.error(message);
        await shutdown();
        // Keep the error available briefly for the launching process.
        setTimeout(() => server.close(() => process.exit(1)), 5000).unref();
      };
      child.on('error', error => failed(error.message));
      child.on('exit', (code, signal) => failed(`${script} stopped (${signal || code}). See ${logPath}`));
    }
  } catch (error) {
    failure = error.message;
    setTimeout(() => server.close(() => process.exit(1)), 5000).unref();
  }
}

async function start(openChrome) {
  // Reuse an already-running journal even if Node dependencies were moved.
  const current = await probe();
  if (current === 'other') throw new Error('Port 5176 is occupied but is not responding as the trading journal. Stop the other application and try again. The launcher will never switch ports.');
  if (current !== 'journal') {
    const folder = projectFolder();
    if (!fs.existsSync(path.join(folder, 'node_modules/vite/bin/vite.js'))) throw new Error('Journal dependencies are missing. Follow the dependency instructions in docs/MAC_LAUNCHER.md, then try again.');
    let running = false;
    let ownsLock = false;
    const startLock = path.join(socketDir, 'starting');
    try { fs.mkdirSync(startLock); ownsLock = true; }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    try {
      try { const status = await control('status'); if (status.failure) throw new Error(status.failure); running = true; }
      catch (error) {
        if (!['ENOENT', 'ECONNREFUSED'].includes(error.code)) throw error;
        // A leftover socket after shutdown has no live owner. Never use PID files.
        if (ownsLock) fs.rmSync(socketPath, { force: true });
      }
      if (!running && ownsLock) {
        fs.mkdirSync(support, { recursive: true, mode: 0o700 });
        const log = fs.openSync(logPath, 'w', 0o600);
        const child = spawn(process.execPath, [fileURLToPath(import.meta.url), 'supervise'], { detached: true, stdio: ['ignore', log, log] });
        child.on('error', error => console.error(error.message));
        child.unref();
        fs.closeSync(log);
      }
      let ready = false;
      const deadline = Date.now() + 30000;
      while (Date.now() < deadline) {
        await delay(250);
        let status;
        try { status = await control('status'); } catch (error) { if (!['ENOENT', 'ECONNREFUSED'].includes(error.code)) throw error; }
        if (status?.failure || status?.stopping) throw new Error(status.failure || 'The journal is stopping. Try again shortly.');
        if (status && await probe() === 'journal') { ready = true; break; }
      }
      if (!ready) {
        if (ownsLock) await control('stop').catch(() => {});
        throw new Error(`The server could not start within 30 seconds. Check ${logPath}. No browser data was changed.`);
      }
    } finally { if (ownsLock) fs.rmdirSync(startLock); }
  }
  try { openChrome(URL); }
  catch { throw new Error(`Google Chrome could not be opened. Install or open Google Chrome, select your usual journal profile, and visit ${URL}.`); }
}

export async function run(action, openChrome = url => execFileSync('/usr/bin/open', ['-a', 'Google Chrome', url], { stdio: 'pipe' })) {
  fs.mkdirSync(socketDir, { recursive: true, mode: 0o700 });
  const stat = fs.lstatSync(socketDir);
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid()) throw new Error('Launcher control folder has an unexpected owner. Restart your Mac and try again.');
  fs.chmodSync(socketDir, 0o700);
  if (action === 'supervise') return supervisor();
  if (action === 'start') return start(openChrome);
  if (action !== 'stop') throw new Error('Unknown launcher action.');
  try { await control('stop'); console.log('Journal server stopped. Saved browser records remain in Chrome.'); }
  catch (error) {
    if (!['ENOENT', 'ECONNREFUSED'].includes(error.code)) throw error;
    console.log(await probe() === 'journal' ? 'This journal was started outside the launcher. Stop it with Control-C in its original Terminal window.' : 'The launcher is already stopped.');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const action = process.argv[2] || 'start';
  // The supervisor uses only portable Node APIs; the user-facing entry is Mac-only.
  if (process.platform !== 'darwin' && action !== 'supervise') {
    console.error('This launcher requires macOS.'); process.exitCode = 1;
  } else run(action).catch(error => { console.error(error.message); process.exitCode = 1; });
}
