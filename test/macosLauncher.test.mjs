import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { validateProject, URL, openBraveBrowser } from '../macos/launcher.mjs';

const delay = ms => new Promise(r => setTimeout(r, ms));

test('opens Brave directly at the exact origin using the normal profile', () => {
  let calls = 0;
  openBraveBrowser(URL, (executable, args, options) => {
    calls++;
    assert.equal(executable, '/usr/bin/open');
    assert.deepEqual(args, ['-a', 'Brave Browser', 'http://127.0.0.1:5176']);
    assert.deepEqual(options, { stdio: 'pipe' });
  });
  assert.equal(calls, 1);
  assert.throws(() => openBraveBrowser(URL, () => { throw new Error('application not found'); }), /application not found/);
});

test('launcher recognizes this project and rejects unrelated/missing folders', () => {
  assert.equal(validateProject(process.cwd()), true);
  assert.equal(validateProject(os.tmpdir()), false);
  assert.equal(validateProject('/missing-journal-folder'), false);
  assert.equal(URL, 'http://127.0.0.1:5176');
});

test('portable launcher lifecycle: concurrent cold starts, reuse, stop, restart and errors', { timeout: 60000 }, async () => {
  // Synthetic servers only; no browser is opened and no real journal data is used.
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'journal-launcher-test-'));
  const helper = path.join(temp, 'helper');
  const project = path.join(temp, 'existing journal with spaces');
  fs.mkdirSync(helper);
  fs.copyFileSync('macos/launcher.mjs', path.join(helper, 'launcher.mjs'));
  for (const dir of ['server', 'scripts', 'src', 'node_modules/vite/bin']) fs.mkdirSync(path.join(project, dir), { recursive: true });
  fs.writeFileSync(path.join(project, 'package.json'), '{"name":"trading-journal-template"}');
  for (const file of ['scripts/dev.mjs', 'src/main.jsx', 'vite.config.js']) fs.writeFileSync(path.join(project, file), '');
  fs.writeFileSync(path.join(helper, 'project.txt'), project);
  const vite = path.join(project, 'node_modules/vite/bin/vite.js');
  const count = path.join(temp, 'starts');
  fs.writeFileSync(path.join(project, 'server/index.js'), 'setInterval(()=>{},1000);');
  const fakeServer = `const http=require('node:http'),fs=require('node:fs');
    fs.appendFileSync(${JSON.stringify(count)},'start\\n');
    http.createServer((req,res)=>{res.end('<title>Trading Journal Template</title><script src="/src/main.jsx"></script>')}).listen(5176,'127.0.0.1');`;
  fs.writeFileSync(vite, fakeServer);
  const moduleURL = pathToFileURL(path.join(helper, 'launcher.mjs')).href;
  async function command(action, browserFails = false) {
    return new Promise(resolve => {
      const code = `import {run} from ${JSON.stringify(moduleURL)}; run(${JSON.stringify(action)},url=>{if(${browserFails})throw Error('missing Brave');console.log('BRAVE '+url)}).catch(e=>{console.error(e.message);process.exitCode=1});`;
      const child = spawn(process.execPath, ['--input-type=module', '-e', code], { env: { ...process.env, HOME: temp }, stdio: ['ignore', 'pipe', 'pipe'] });
      let output = '';
      child.stdout.on('data', data => { output += data; });
      child.stderr.on('data', data => { output += data; });
      child.on('exit', code => resolve({ code, output }));
    });
  }
  const external = http.createServer((req, res) => res.end('unrelated app'));
  try {
    // Refuse to interfere with a machine already using the required port.
    await new Promise((resolve, reject) => { external.once('error', reject); external.listen(5176, '127.0.0.1', resolve); });
    const conflict = await command('start');
    assert.equal(conflict.code, 1);
    assert.match(conflict.output, /occupied/);
    assert.equal(fs.existsSync(count), false);
    await new Promise(resolve => external.close(resolve));
    // An existing journal is reused without claiming ownership of its process.
    const manual = http.createServer((req, res) => res.end('<title>Trading Journal Template</title><script src="/src/main.jsx"></script>'));
    await new Promise(resolve => manual.listen(5176, '127.0.0.1', resolve));
    try {
      assert.equal((await command('start')).code, 0);
      assert.match((await command('stop')).output, /outside the launcher/);
      assert.equal(manual.listening, true);
      assert.equal(fs.existsSync(count), false);
      assert.match((await command('start', true)).output, /Brave Browser could not be opened/);
    } finally { await new Promise(resolve => manual.close(resolve)); }
    const results = await Promise.all([command('start'), command('start'), command('start')]);
    for (const result of results) { assert.equal(result.code, 0, result.output); assert.match(result.output, /BRAVE http:\/\/127\.0\.0\.1:5176/); }
    assert.equal(fs.readFileSync(count, 'utf8').trim().split('\n').length, 1);
    assert.equal((await command('start')).code, 0);
    assert.equal(fs.readFileSync(count, 'utf8').trim().split('\n').length, 1);
    assert.match((await command('stop')).output, /server stopped/);
    await delay(300);
    assert.match((await command('stop')).output, /already stopped/);
    assert.equal((await command('start')).code, 0);
    assert.equal(fs.readFileSync(count, 'utf8').trim().split('\n').length, 2);
    await command('stop');
    await delay(300);
    fs.writeFileSync(vite, 'process.exit(2);');
    const failure = await command('start');
    assert.equal(failure.code, 1);
    assert.match(failure.output, /stopped/);
    await command('stop');
    await delay(300);
    fs.unlinkSync(vite);
    assert.match((await command('start')).output, /dependencies are missing/);
    fs.writeFileSync(path.join(helper, 'project.txt'), path.join(temp, 'missing'));
    assert.match((await command('start')).output, /folder cannot be located/);
  } finally {
    await command('stop');
    external.close();
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
