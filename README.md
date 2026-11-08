# Trading Journal Template

A local-first trading journal that runs on your own computer.

This template is designed for traders who want a screenshot-first review workflow without paying for a hosted backend. Trades, screenshots, analytics, backups, and settings are saved in your browser on your machine.

## What You Get

- Dashboard with net P&L, win rate, expectancy, profit factor, drawdown, and equity curve.
- Add Trade workflow with multiple screenshots, notes, setup tags, mistake tags, emotion, RR, and rating.
- Trade Log with searchable cards and dedicated trade review pages.
- Analytics for performance, calendar, setups, mistakes, sessions, emotions, and planned-vs-actual review.
- Local ZIP backup export/import plus rolling automatic recovery backups.

## Privacy Model

- No login.
- No invite code.
- No external account.
- No hosted database.
- No screenshot upload.
- No paid API.
- Optional Notion import runs through your own local `.env.local`; it is not required.

Your data is stored locally in browser IndexedDB. The app keeps recent automatic recovery snapshots in the same browser, but exported ZIP backups are still the safest copy if you want to move data between browsers or protect against browser data cleanup.

## Quick Start

```bash
git clone <your-repo-url>
cd trading-journal-template
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:5176
```

## One-click Mac launcher

Already running the journal on your Mac? Install the native **Trading Journal** and **Stop Trading Journal** apps without replacing your working journal folder. See the [beginner-friendly Download ZIP instructions](docs/MAC_LAUNCHER.md). The launcher keeps `http://127.0.0.1:5176` and opens normal Brave Browser; keep using your original Brave profile.

## Optional Notion Import

Notion is optional. The app works without it.

To import an existing Notion trading database:

1. Create a Notion internal integration in your Notion workspace.
2. Share the target trading database with that integration.
3. Copy `.env.example` to `.env.local`.
4. Fill in:

```env
NOTION_TOKEN=your-own-notion-token
NOTION_DATABASE_ID=your-database-id
```

5. Restart `npm run dev`.
6. Open Settings, click `Check Connection`, then `Import From Notion`.

The importer reads database pages, recursively reads page blocks, downloads image/file screenshots into local browser storage, and saves imported trades by stable Notion page IDs so importing twice updates records instead of duplicating them.

## Use With Codex Or Claude Code

Paste this into your agent:

```text
Clone this repo, install dependencies, run the tests, start the local dev server, and tell me the local URL:
<your-repo-url>
```

The detailed agent instructions live in `AGENTS.md`.

## Backup And Restore

In the app:

1. Open Settings.
2. Click `Export Backup`.
3. Keep the downloaded `.zip` somewhere safe.
4. To restore, click `Import Backup` and choose that `.zip`.

Importing the same backup twice should not duplicate existing trades.

The app also creates rolling automatic backups after saves and before resets. Use `Download Latest Auto Backup` or `Restore Latest Auto Backup` in Settings if the local journal state gets corrupted. These automatic backups are still browser-local, so they are not a replacement for exported `.zip` files stored somewhere safe.

## Multiple Funded Accounts (Phase 2)

Use **Accounts** to create, rename, set initial balances, archive/reactivate, or move trade history between local trading accounts. Trades use permanent account IDs, so renaming never splits their history. The top selector filters the dashboard, reports, charts, calendar and trade log; **All Accounts** combines all recorded trades, including archived history, once each.

Existing saved trades and version 1 backups migrate without removing their notes or screenshots. New trades require an active account. ZIP exports always include every account and trade. Conflicting imports stop without replacing current records. Realised P&L must be entered net of fees; daily totals use the trade date and your browser's local date. Risk warnings and discipline tracking are available in the Risk Management and Discipline sections (Phases 3–4).

See [Mac update and account instructions](docs/MAC_SETUP.md#phase-2-multiple-funded-accounts).

## Development Commands

```bash
npm install
npm test
npm run build
npm run test:e2e
npm run test:accounts
npm run stress
npm run security:sweep
```

## GitHub Safety Check

Before publishing, run:

```bash
npm run security:sweep
```

The sweep checks that the public template does not contain private data files, service keys, migration scripts, or hosted-only project material.

## License

This template is source-available for personal use. See `LICENSE`.

## Risk management and discipline (Phases 3–4)

Select an individual account for **Risk Management**. **Discipline** now uses one personal checklist per date across every account. Daily net realised-loss limits default to $500 per account. The fixed session is 07:30–12:00 UK time (start included, noon excluded); hidden legacy session settings are preserved. Enter P&L **after all fees and commissions**, use the result's local calendar date, and record actual UK execution times. Open/unrealised results can be excluded from risk totals. Missing times remain unknown. Daily limits reset at this computer's local midnight; UK session status follows daylight saving automatically.

Discipline has one global before/after checklist and reflection per date. Legacy account checklists remain preserved; conflicting answers require review before saving a global checklist. Only Yes/No answers enter percentages; N/A is excluded, unanswered questions remain incomplete, and all-N/A days do not count as compliant. Recorded trade days without a checklist appear as incomplete and break compliance streaks. Streaks count consecutive recorded days, not calendar days. Historical risk reviews use current settings. This manually updated journal cannot block broker orders or detect unrecorded trades.

ZIP exports and rolling automatic backups include all accounts, risk settings and discipline records. Conflicting imports stop without overwriting current records. Use `npm run test:risk-discipline` for synthetic browser checks alongside the existing test commands. See [Mac ZIP installation](docs/MAC_SETUP.md#download-zip-installation-for-the-complete-application).

## Dashboard, multi-account capture and checklist update

See [the complete update guide](docs/EXPERIENCE_UPDATE.md) for the safe Download ZIP update using your existing Mac launcher, multi-account trade capture, original Empra Score formula, historical risk statuses, and verification commands.

## Comprehensive Version 2 update

See [Version 2 features and the beginner-friendly Mac Download ZIP guide](docs/VERSION_2_UPDATE.md). This update adds screenshot explanations, labelled financial charts, an outcome donut, weekly calendar totals, global discipline with conflict review, visible trade actions, an editable playbook flowchart, and Reports with a historical Daily Journal archive. Local storage, independent account risk, backups and your existing Brave launcher remain in place. Run `npm run test:v2` for the new synthetic browser suite.
