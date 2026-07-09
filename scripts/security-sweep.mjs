import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const forbiddenPaths = [
  '.env',
  '.env.local',
  'data',
  'supabase',
  'src/cloudJournal.js',
  'scripts/migrate-local-journal.mjs',
  'scripts/repair-notion-screenshots.mjs',
  'scripts/import-notion-fetch-log-screenshots.mjs',
  'scripts/hosted-preflight.mjs',
  'scripts/hosted-rls-check.mjs',
  'scripts/hosted-cleanup-orphans.mjs',
  'scripts/install-autostart.mjs',
  'scripts/uninstall-autostart.mjs',
];

const forbiddenPathPatterns = [
  /^\.env(?:\.local|\.production|\.development|$)/u,
  /\.(?:png|jpe?g|webp|gif|zip|pdf|mov|mp4|sqlite|db)$/iu,
];

const forbiddenPatterns = [
  /SUPABASE_SERVICE_ROLE_KEY/u,
  /VITE_SUPABASE/u,
  /MANDO_MIGRATION/u,
  /@supabase\/supabase-js/u,
  /createClient\s*\(/u,
  new RegExp(['trade', 'journal', 'capture'].join('-'), 'u'),
  /data\/journal\.json/u,
  new RegExp([['ma', 'ndoj', 'ournal'].join(''), 'localhost'].join('\\.'), 'u'),
  new RegExp(['M', 'ando Journal'].join(''), 'u'),
  new RegExp(['M', "ando's"].join(''), 'u'),
  new RegExp(['m', 'ando@example\\.com'].join(''), 'u'),
  /\bsecret_[A-Za-z0-9]{20,}/u,
  /\bntn_[A-Za-z0-9]{20,}/u,
];

const ignoredDirs = new Set(['node_modules', 'dist', '.git']);
const ignoredFiles = new Set(['package-lock.json', '.gitignore', 'security-sweep.mjs']);

const failures = [];

for (const relativePath of forbiddenPaths) {
  if (existsSync(path.join(root, relativePath))) failures.push(`Forbidden path exists: ${relativePath}`);
}

function walk(directory) {
  for (const name of readdirSync(directory)) {
    if (ignoredDirs.has(name)) continue;
    const fullPath = path.join(directory, name);
    const relativePath = path.relative(root, fullPath);
    const stat = statSync(fullPath);
    for (const pattern of forbiddenPathPatterns) {
      if (pattern.test(relativePath)) failures.push(`Forbidden share artifact exists: ${relativePath}`);
    }
    if (stat.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (ignoredFiles.has(name)) continue;
    if (stat.size > 2_000_000) continue;
    const text = readFileSync(fullPath, 'utf8');
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(text)) failures.push(`${relativePath} contains forbidden pattern ${pattern}`);
    }
  }
}

walk(root);

if (failures.length) {
  console.error('Security sweep failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Security sweep passed: no private hosted/runtime material found.');
