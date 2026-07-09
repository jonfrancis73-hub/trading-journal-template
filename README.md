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

## Development Commands

```bash
npm install
npm test
npm run build
npm run test:e2e
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
