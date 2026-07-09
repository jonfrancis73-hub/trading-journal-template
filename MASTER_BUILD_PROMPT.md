# Master Build Prompt

Use this prompt with Codex or Claude Code if you want an agent to set up or rebuild this template.

```text
You are building a local-first trading journal from this GitHub repo.

Requirements:
- React + Vite app.
- No login.
- No invite code.
- No required external backend.
- Store all data locally in browser IndexedDB.
- Store screenshots locally after compression.
- Support multiple screenshots per trade.
- Support ZIP backup export/import plus rolling automatic local recovery backups.
- Keep Notion import optional. If the user wants it, use local `.env.local` values only: `NOTION_TOKEN` and `NOTION_DATABASE_ID`.
- Start with an empty clean journal.
- Keep dashboard, add trade, trade log, trade review, analytics reports, accounts, and settings.
- Run tests and security sweep before finishing.

Setup steps:
1. npm install
2. npm test
3. npm run build
4. npm run security:sweep
5. npm run dev

Success:
- The app opens at http://127.0.0.1:5176
- A user can create a trade with screenshot.
- The trade persists after refresh.
- Export/import backup works.
- Automatic backup creation, latest automatic backup download, and latest automatic backup restore work.
- No private data or hosted keys are present.
- Notion is not required for normal use.
```
