# Open your trading journal on a Mac

## First-time setup

1. Install Google Chrome if you do not have it.
2. Go to https://nodejs.org and download the **LTS** macOS installer. Open the downloaded installer and follow its steps. Node.js includes npm. Use Node.js 24 LTS (the version verified for this journal), or a compatible newer LTS.
3. Open https://github.com/jonfrancis73-hub/trading-journal-template, select the **main** branch, and click **Code → Download ZIP**. Double-click the download in Finder, rename the extracted folder to `trading-journal-template`, and move it to **Documents**. If you already have a folder with that name, keep it separately rather than overwriting it.
4. Open **Terminal** using Spotlight (Command + Space, type Terminal, press Return).
5. Paste these commands and press Return:

```bash
cd "$HOME/Documents/trading-journal-template"
node --version
npm install
npm run dev
```

Wait for `Local: http://127.0.0.1:5176/`. Leave Terminal open while using the journal.

6. Open Google Chrome and enter **http://127.0.0.1:5176** in its address bar. Bookmark it with Command + D. No login or API keys are needed.

The server started by your coding assistant runs in a separate workspace. To use the journal on your Mac, you must start it on your Mac with the steps above. The local address only works while the app is running on that same computer.

## Each time you want to use it

Open Terminal and run:

```bash
cd "$HOME/Documents/trading-journal-template"
npm run dev
```

Then open your Chrome bookmark: http://127.0.0.1:5176.

To stop: return to Terminal and press **Control + C**. Stopping the server does not erase saved trades. You do not need to install dependencies again each day.

## Record and review a trade

1. Click **Add Trade**.
2. In **Ticket**, check the date, asset, direction, outcome, account, P&L, RR, rating, and any other relevant fields. P&L accepts a positive profit or negative loss. The starting defaults are examples; replace them with your trade details.
3. Click **Screenshots**, then **Add Screenshots** and choose your chart images (up to 10 per trade).
4. Click **Notes** and write in **Messy Note**. Add setup, mistake, and other review details as needed.
5. Click **Review**, check your entry, then click **Save Trade**.
6. Open **Trade Log** to find your trade and use its review button to inspect it.
7. Use **Dashboard** and **Analytics** to review results. The generated Smart Review is based on your entered data and built-in rules; no paid AI service is required.

## Protect your journal

Your journal is stored in Chrome's local browser database, not in GitHub or in the application folder. Always use the same Chrome profile and the exact address **http://127.0.0.1:5176**. `localhost`, a different port, a different browser, and another Chrome profile have separate storage. Avoid Incognito for the journal. Chrome Sync does not back up this journal database.

After each session, click the gear icon (**Settings**) and **Export Backup**. Keep the downloaded ZIP in a safe folder, ideally with an additional copy on an external drive or your own backup service. Do not upload personal trade backups to the public GitHub repository.

To move or recover your journal, open **Settings → Import Backup** and choose the exported ZIP without unzipping it. Reimporting the same backup is designed to avoid duplicate trades.

The journal retains up to five automatic recovery backups in the same browser. Settings offers **Download Latest Auto Backup** and **Restore Latest Auto Backup**. Restoring replaces the current journal with that snapshot; export your current journal first if needed. Browser cleanup can remove both the journal and its automatic backups, so keep exported files separately.

Notion import is optional. Leave it alone unless you specifically want to import a Notion database.

## If something goes wrong

- **Chrome cannot connect:** start `npm run dev` in Terminal and leave it running.
- **`node` or `npm` not found:** install Node.js LTS, close Terminal, reopen it, and try again.
- **Folder not found:** check that the extracted folder is named `trading-journal-template` and is inside Documents.
- **Port 5176 or 8787 already in use:** another copy may be running. Open http://127.0.0.1:5176 first; stop the old Terminal process with Control + C before restarting. Keep the same port so your browser sees the same journal storage.
- **Journal appears empty:** check the address and Chrome profile first. If necessary, import your exported backup.

## Alternative: download from GitHub

The repository is https://github.com/jonfrancis73-hub/trading-journal-template. Use **Code → Download ZIP**, extract it, rename the extracted folder to `trading-journal-template`, and put it in Documents.

If you already use Git, the initial download can instead be:

```bash
cd "$HOME/Documents"
git clone https://github.com/jonfrancis73-hub/trading-journal-template.git
```

Then follow the installation and startup steps above. Git is not needed for the Download ZIP route.
