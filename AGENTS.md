# Agent Setup Guide

You are helping a user run their own local trading journal.

## Goal

Install, test, and start this local-first React app. Do not ask the user for backend keys to run the core journal because this template does not need them.

Notion import is optional. Only ask for `NOTION_TOKEN` and `NOTION_DATABASE_ID` if the user specifically wants to import an existing Notion trading database.

## Rules

- Do not create account, auth, payment, hosted database, or external storage code.
- Do not add real trading data to the repo.
- Do not remove backup/export/import behavior or automatic recovery backups.
- Do not make Notion required; it must stay optional and local-token based.
- Keep the app generic unless the user asks to customize branding.

## Standard Setup

1. Confirm Node.js LTS is installed.
2. Run `npm install`.
3. Run `npm test`.
4. Run `npm run build`.
5. Run `npm run dev`.
6. Tell the user to open `http://127.0.0.1:5176`.

## Verification

Before calling the setup complete, verify:

- The app opens without login.
- The dashboard appears.
- Add Trade accepts a screenshot and messy note.
- Trade Log shows the saved trade.
- Settings can export/import a manual backup and download/restore the latest automatic backup.
- Settings does not attempt Notion import unless the user clicks `Check Connection` or `Import From Notion`.
- `npm run security:sweep` passes.

## Troubleshooting

- If port `5176` is busy, stop the other process or change the Vite port in `vite.config.js`.
- If screenshots disappear, tell the user to import their latest backup or check browser storage settings.
- If install fails, delete `node_modules`, keep `package-lock.json`, then run `npm install` again.
