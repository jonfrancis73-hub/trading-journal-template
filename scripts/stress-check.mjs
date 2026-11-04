import { spawn } from 'node:child_process';

const stressPort = process.env.STRESS_PORT || '5195';
const APP_URL = process.env.APP_URL || `http://127.0.0.1:${stressPort}`;
const REQUESTS = Number(process.env.REQUESTS || 200);
const CONCURRENCY = Number(process.env.CONCURRENCY || 20);
const PATHS = (process.env.PATHS || '/,/app,/app/log,/app/settings').split(',').map((path) => path.trim()).filter(Boolean);
const shouldStartServer = !process.env.APP_URL;

function startServer() {
  if (!shouldStartServer) return null;
  const child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', stressPort], {
    cwd: process.cwd(),
    stdio: 'pipe',
    shell: false,
    env: process.env,
  });
  child.stderr.on('data', (chunk) => process.stderr.write(chunk));
  return child;
}

async function waitForServer() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(APP_URL);
      if (response.ok) return;
    } catch {
      // Retry until the dev server is ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Local dev server did not start.');
}

async function check(pathname) {
  const response = await fetch(APP_URL + pathname);
  if (!response.ok) throw new Error(pathname + ' returned ' + response.status);
  return response.text();
}

async function worker(paths, failures) {
  while (paths.length) {
    const pathname = paths.pop();
    try {
      await check(pathname);
    } catch (error) {
      failures.push(error.message);
    }
  }
}

const server = startServer();
try {
  await waitForServer();
  const paths = Array.from({ length: REQUESTS }, (_, index) => PATHS[index % PATHS.length]);
  const failures = [];
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(paths, failures)));

  if (failures.length) {
    console.error('Stress check failed:');
    for (const failure of failures.slice(0, 10)) console.error('- ' + failure);
    process.exit(1);
  }

  console.log(`Stress check passed: ${REQUESTS} requests at concurrency ${CONCURRENCY}.`);
} finally {
  if (server) server.kill('SIGTERM');
}
