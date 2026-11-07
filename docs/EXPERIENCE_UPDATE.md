# Trading journal experience update

This update stays local at **http://127.0.0.1:5176**. It does not change the IndexedDB database name, browser origin, Mac launcher, authentication, or backup format. No real trading records are included.

## Safe Mac update using Download ZIP

1. Open the current journal using your existing launcher and your usual **Brave profile**. In Settings, **Export Backup** and keep that ZIP somewhere safe outside the journal folder. Finish and save any open trade or checklist.
2. Review this update's single pull request on GitHub. Merge it into `main` when you are ready; it has not been merged for you.
3. Use **Stop Trading Journal**. Keep your existing installed journal folder, its name and its location: your working launcher points there.
4. On [your repository](https://github.com/jonfrancis73-hub/trading-journal-template), select **main**, then **Code → Download ZIP**. Double-click the downloaded ZIP in Finder. This extracted folder is the update source, not a replacement installation.
5. Open Terminal. Type `cd ` (including the space), drag your **existing installed journal folder** from Finder into Terminal, then press Return.
6. Type `update_source=` with no space after `=`, drag the **newly extracted ZIP folder** into Terminal, then press Return. This sets a temporary Terminal variable to the update source.
7. Copy the update into the existing installation by pasting this command:

   ```bash
   rsync -av --exclude='.git' --exclude='node_modules' --exclude='.env*' --exclude='dist' --exclude='.DS_Store' "$update_source/" ./
   ```

   This updates source files in place. It preserves local environment settings, dependencies, Git metadata and files that exist only in your installation. It does not delete files or access browser storage. Do not reverse the source and destination.
8. In the same Terminal, run these commands one at a time. Wait for each to finish:

   ```bash
   npm ci
   npm test
   npm run build
   npm run security:sweep
   ```

   The existing Node.js installation should be sufficient. If it reports an unsupported Node version, install the current Node.js LTS from [nodejs.org](https://nodejs.org), reopen Terminal, and return to the existing journal folder.
9. Open your existing **Trading Journal** launcher. Keep using your usual Brave profile at **http://127.0.0.1:5176**. Refresh the page. Confirm your accounts, trades, screenshots and notes appear, then export another backup.

**Do not delete the installed journal, clear Brave site data, switch profiles, use a private window, or change the address to `localhost`.** Updating source files does not require importing a backup. If records seem missing, first check the exact address and Brave profile. Keep both exported backups; do not clear storage to troubleshoot.

The Mac launcher files are unchanged, so reinstalling the launcher is unnecessary. Linux automation verifies its portable lifecycle and exact Brave launch command; native Finder/Dock/Brave behavior still needs a check on your Mac.

## Using the changes

- **Add Trade:** choose the primary account, enter its net P&L, and tick additional active accounts in Account executions. Enter each additional account's actual net P&L; it starts blank deliberately. UK entry/exit times and actual exit can differ per account. Shared notes, screenshots, setup and review answers are copied into independent records. The existing journal has no position-size or separate commission fields; P&L remains net of fees.
- **Discipline:** click Yes, No or N/A. Click the selected answer again to leave it unanswered. Save before switching date or account. Renamed questions keep their identifiers. The retired account-confirmation answer remains in old records/backups but contributes to no current compliance calculation.
- **Individual rules:** green/red/grey widths use Yes/No/N/A divided by total recorded answers. Unanswered is listed separately. Compliance remains Yes / (Yes + No), with N/A and unanswered excluded.
- **Risk Management:** daily loss limits remain independent, defaulting to $500. The underlying session is fixed at 07:30–12:00 UK wall time, including daylight-saving transitions. Legacy per-account session settings remain stored but no longer control compliance. Historical bars show the maximum cumulative realised loss against the current account limit. A confirmed intraday hit remains red even after recovery. Missing/ambiguous exit chronology or missing numeric results produces Unknown unless the available net result already proves a hit. Unrealised and non-executed entries do not enter realised analytics.
- **Dashboard / Analytics:** both use the same calendar, with unrestricted month navigation, account filtering, daily totals, execution counts and trade review links. All Accounts counts each actual account execution once. Playbooks, Daily Journal, Settings and editable trading rules remain accessible.

## Empra Score

This is an original deterministic score, unrelated to any proprietary scoring system. It needs **at least 20 realised executions, including at least 3 wins and 3 losses** in the selected account scope. Otherwise it shows **Not enough data**.

The score is the rounded equal-weight mean of:

1. Win rate (wins / decided win-or-loss outcomes × 100).
2. Profit factor / 2 × 100, capped at 100 (gross profit / absolute gross loss).
3. Average win / absolute average loss / 2 × 100, capped at 100.

Breakeven executions count toward the 20-result minimum but do not count as wins or losses. Example: 50% win rate, profit factor 2 and win/loss ratio 2 gives `round((50 + 100 + 100) / 3) = 83`. It describes recorded performance and is not a forecast.

## Save and backup behavior

New one-account and multi-account submissions have an idempotency identifier; every execution also has a unique trade ID. All selected accounts and numeric results are validated before persistence. The full next journal and its ZIP recovery snapshot commit in **one IndexedDB transaction**. A failed ZIP preparation or aborted write leaves both unchanged. The Save button also has a synchronous in-flight guard. Retrying the same submission does not create duplicates. Later edits address one trade ID only.

The existing schema and version-1/version-2 ZIP import paths remain supported. No destructive migration is needed: old question IDs and hidden risk settings stay stored. Manual export, repeated import/conflict checks, rolling recovery snapshots and screenshot restoration remain available.

## Developer verification

Use isolated synthetic data only; never run these browser tests against your personal Brave profile:

```bash
npm test
npm run build
npm run security:sweep
npm run stress
npm run test:e2e
npm run test:accounts
npm run test:risk-discipline
npm run test:experience
npm run stress:browser
```

Browser suites use Playwright Chromium. Install its browser with `npx playwright install chromium` if needed, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to an installed Chromium executable. The experience suite covers differing account results, duplicate-click prevention, forced transaction abort, retry idempotency, independent editing, manual/automatic backup recovery, both calendars, account metrics and mobile navigation. The heavy suite uses 500 synthetic trades with screenshots.

### Verification results for this update

- 59 unit tests passed, including account execution preparation, original score calculations, checklist history and risk uncertainty.
- All five Chromium browser suites passed: trade/backup smoke, accounts, risk/discipline, experience, and heavy stress. Responsive checks include 320, 390, 768, 1024 and 1440/1600 pixel widths. Checklist checks cover Yes/No/N/A, deselection and persistence. The risk suite also crosses local midnight with the panel open.
- The heavy browser run passed with 500 synthetic trades and screenshots. Trade Log renders 50 cards initially, offers Load more, and searches/filters the whole history.
- Production build and security sweep passed. Dependency audit found zero vulnerabilities. Server stress passed 200 requests at concurrency 20.
- Native macOS UI and the installed Brave browser were not available in this Linux test environment. The existing launcher files, fixed origin, storage database and schema version are unchanged; portable launcher tests passed.
