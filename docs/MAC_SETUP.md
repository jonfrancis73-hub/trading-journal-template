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

## Phase 2: Multiple Funded Accounts

Before updating, export a ZIP backup and keep it outside your browser. Follow the merge/update steps above in your existing repository folder; do not clone into a new folder unless you intentionally want another installation.

After restarting:

1. Open **Accounts**. Existing trades are linked to their original account names using permanent account IDs. A recovery snapshot is created before migration. Names that were typed into old tickets are preserved as accounts; no trade history is deleted.
2. Click **Add Account**, enter its name and **Starting Balance**, then **Save Accounts**. The balance should be the initial balance before the trades recorded in the journal.
3. Choose an individual account or **All Accounts** in the top selector. Dashboard statistics, charts, reports, calendar and trade history follow this selection. All Accounts includes archived history and counts each recorded trade once.
4. When adding a trade, choose its account. In All Accounts, choose explicitly when more than one account exists. Use net realised P&L (after fees); the app does not import live broker equity or unrealised positions.
5. To move one trade, open Trade Log, click its edit button and change **Account**. For incomplete older tickets or an entire account history, open Accounts, choose **Move history from** and **Move history to**, check the trade count, and confirm **Move … trades**. A recovery snapshot is created first; screenshots and notes remain intact.
6. To rename, change the account name and save. To archive, click **Archive**, then **Save Accounts**. Archived accounts stay in the selector and All Accounts; click **Reactivate** and save to use one for new trades again.
7. Export another ZIP after checking the migrated accounts and balances.

**Daily realised P&L stays separate per account.** A −$500 result in Account A and +$300 in Account B remain separate; All Accounts shows −$200. “Today” uses your Mac/browser's local calendar date and the dates on your trades. This phase records results only; it does not enforce the $500 loss rule or add Phase 3/4 functionality.

Backups include all accounts, balances, archive states, trades, notes and screenshots regardless of the selected account. Older version 1 ZIP backups are migrated on import. Importing an unchanged backup repeatedly does not duplicate trades. If an existing record has changed since the backup, import stops with a conflict message and leaves the journal unchanged. Export your current data and open the backup in a separate browser profile to inspect it safely. Do not clear your main browser's site data to resolve a conflict.

The latest automatic snapshot can also be explicitly restored in Settings after confirmation; the current journal gets a recovery snapshot first. If loading fails, the app offers recovery controls instead of opening an empty journal that could overwrite your saved records.

For developer browser checks (synthetic data and isolated profiles only):

```bash
npx playwright install chromium
npm run test:e2e
npm run test:accounts
```
