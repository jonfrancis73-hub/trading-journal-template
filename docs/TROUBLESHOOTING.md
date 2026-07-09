# Troubleshooting

## The App Does Not Open

Run `npm run dev` again and confirm the terminal shows `http://127.0.0.1:5176`.

## Port 5176 Is Busy

Close the other app using that port or change the port in `vite.config.js`.

## Optional Notion Import Does Not Connect

Confirm:

- You started the app with `npm run dev`, not only `npm run client`.
- `.env.local` contains `NOTION_TOKEN` and `NOTION_DATABASE_ID`.
- The Notion database is shared with your Notion integration.
- You restarted the app after editing `.env.local`.

The journal works without Notion. Only use this if you are importing old Notion notes.

## Screenshots Do Not Save

Use a modern Chromium, Safari, Firefox, or Edge browser. Export backups often from Settings.

## Data Disappeared

First try Settings -> `Restore Latest Auto Backup`. If browser data was cleared, restore from the latest exported `.zip` backup in Settings.

## Backup Import Is Rejected

Backups over 200 MB are blocked to protect the browser from freezing. Export smaller backups or remove old screenshot-heavy trades before moving data.

## Install Fails

Try:

```bash
rm -rf node_modules
npm install
```

On Windows PowerShell:

```powershell
Remove-Item -Recurse -Force node_modules
npm install
```
