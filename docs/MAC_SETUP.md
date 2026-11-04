# Mac Setup

1. Install Node.js LTS from `https://nodejs.org`.
2. Install Git from `https://git-scm.com` or Apple developer tools.
3. Open Terminal.
4. Run:

```bash
git clone <repo-url>
cd trading-journal-template
npm install
npm test
npm run build
npm run dev
```

5. Open `http://127.0.0.1:5176`.

## Backup Habit

Export a backup from Settings after every serious review session.

## Update After Merging a Pull Request

1. In the running journal, open Settings and click **Export Backup**. Keep the ZIP.
2. On GitHub, open the pull request, review **Files changed**, then click **Merge pull request** and **Confirm merge**. The target branch should be `main`.
3. Stop the app in Terminal with Control-C. In your existing journal repository folder, run:

```bash
git status
# If you have local changes, commit or stash them before continuing.
git switch main
git pull --ff-only origin main
npm ci
npm test
npm run build
npm run dev
```

4. Open `http://127.0.0.1:5176` in the same browser and browser profile you used before, then refresh.

The journal's trades, notes, screenshots, and automatic backups remain in that browser's IndexedDB. Updating the source does not reset them. Keep the exact same URL (including hostname and port): `localhost` and `127.0.0.1` have separate browser storage. Do not clear site data. No login or external database is needed.
