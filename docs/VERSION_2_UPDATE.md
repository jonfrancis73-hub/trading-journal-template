# Version 2 update and Mac installation guide

This is an update to the existing local journal. The browser address remains **http://127.0.0.1:5176**. Keep using the same installed journal folder, macOS launcher, Brave profile and browser storage.

## Update your existing Mac using Download ZIP

1. Open your current journal in your usual Brave profile. Save any unfinished work. Go to **Settings → Export Backup** and keep the downloaded ZIP somewhere safe outside the journal folder.
2. Review the Version 2 pull request on GitHub. After you choose to merge it, open [your repository](https://github.com/jonfrancis73-hub/trading-journal-template), select **main**, and choose **Code → Download ZIP**. The pull request is not merged automatically. To try it before merging, download the ZIP from the `feature/comprehensive-journal-v2` branch instead.
3. Double-click the downloaded ZIP in Finder to extract it. This new folder contains the source files to copy into your existing installation.
4. Use your existing **Stop Trading Journal** app. Keep the name and location of your installed journal folder: the launcher already points there.
5. Open Terminal. Type `cd ` (including the space), drag your **existing installed journal folder** from Finder into Terminal, and press Return.
6. Type `journal_update_source=` with no space after `=`, drag the **newly extracted ZIP folder** into Terminal, and press Return. This identifies the source folder for the next command.
7. Paste this command and press Return:

   ```bash
   rsync -av --exclude='.git' --exclude='node_modules' --exclude='.env*' --exclude='dist' --exclude='.DS_Store' "$journal_update_source/" ./
   ```

   It copies source files into your existing installation without deleting files that exist only there. It preserves your local environment settings and installed dependencies. The command does not access Brave storage.
8. In the same Terminal window, run these commands one at a time:

   ```bash
   npm ci
   npm test
   npm run build
   npm run security:sweep
   ```

   Wait for each command to finish. Your existing Node.js installation should work; if it reports an unsupported version, install the current Node.js LTS from [nodejs.org](https://nodejs.org), reopen Terminal and return to the existing journal folder.
9. Open your existing **Trading Journal** launcher. Refresh **http://127.0.0.1:5176** in your usual Brave profile. Confirm your accounts, screenshots, notes and trade history appear. Export another ZIP backup after checking the update.

There is no need to delete the existing journal folder, clear browser storage, remove your Brave profile or reinstall the launcher. Normally, updating source files requires no backup import. If records appear missing, first check the exact address and Brave profile; `localhost`, another port and a private window use different storage.

## Using Version 2

- **Dashboard:** both financial charts show dollar scales, a zero baseline, dates and exact recorded values on hover. Win rate remains wins divided by wins plus losses; the ring separately includes wins, losses and classified breakevens. Unclassified records do not become breakevens.
- **Money:** positive P&L uses green without a plus sign, negative P&L uses red with a minus sign, and exact zero uses blue. Numeric values, balances and exported P&L remain unchanged.
- **Discipline:** one personal checklist per date across all accounts. Account switching does not replace your draft. Choose Yes, No or N/A; clicking an active answer clears it. Save before changing dates. Compatible legacy answers are combined into a date-based view; original account records and reflections remain preserved. If historical answers conflict, select that day in history, expand the originals, choose the correct answers and save. Saving is blocked until conflicting answers are resolved. The originals remain in the archive and backups after resolution. Unresolved dates remain visible as incomplete and never qualify as compliant.
- **Calendar:** Dashboard and Analytics use the same Sunday–Saturday calendar and weekly totals. A weekly row includes all seven dates, including dates from an adjacent month. The monthly total includes only the selected month. An empty week is grey; a week containing executions with zero net P&L is blue. Calendars scroll horizontally inside their panel on narrow screens.
- **Trade Log:** visible, labelled Review Trade, Mark Reviewed / Mark Not Reviewed, Edit Trade and Delete Trade controls. Delete still requires confirmation.
- **Add Trade:** defaults to London / London Draw. Select a playbook and one or more execution accounts. Net P&L remains independent for each account. New entries are realised; a legacy unrealised record stays excluded until explicitly converted in Edit Trade. Execution guidance is collapsed. Smart Review has been removed from entry, while historical generated sections and the separate coach summary remain available.
- **Screenshot explanations:** in the Screenshots step, select a thumbnail and enter its explanation. Blank explanations are allowed. Paragraphs remain intact. Move earlier/later changes the image order; Replace selected image retains the selected image's identifier, explanation and classification. Removing an image removes only that image's explanation. Multi-account submissions copy explanations; later edits apply to the account record being edited. In Trade Review, explanations switch with the selected image and sit alongside it on desktop or below it on mobile. Raw notes appear before the independently collapsible coach and journal sections.
- **Playbooks:** choose a saved playbook or add one. Edit the name and steps, descriptions, node types and connections with ordinary fields. Use Move up/down to reorder. Decision nodes have Yes/No connections; ordinary nodes have a Next connection. Save Playbooks persists the diagram. Review mode draws the actual connections between cards on desktop; mobile uses stacked cards and labelled connection links. Original setup, entry, invalidation, management, warning and example content remains available under Preserved original playbook details. Existing trade relationships keep their playbook IDs.
- **Reports:** replaces Daily Journal in navigation; Analytics remains separate. Filter by account, date, instrument, strategy or setup. Explore overview statistics, weekdays, weeks, months, UK entry-time windows, valid durations, instruments, strategies, setups and global discipline. Summary tables expose exact chart data. Discipline comparisons count each checklist date once, for dates with matching executions. Historical Daily Journal entries remain accessible in the expandable archive and remain in backups.

## Data handling and supported metrics

The IndexedDB database, origin and ZIP container format are unchanged. New fields are additive: screenshot explanations live on the screenshot object, and flowchart nodes/connections live on their playbook. Older screenshots without IDs receive deterministic, distinct identifiers without changing image bytes or notes. Original account checklists remain stored alongside explicitly saved global records; global analytics use a single date-based view and reject unresolved conflicts.

Manual ZIP exports and rolling recovery snapshots include annotations, flowcharts, original and global checklists, historical Daily Journal entries and existing data. Identical imports remain idempotent. Empty screenshot arrays and inferred MIME metadata are treated as equivalent during conflict comparison; changed descriptions, files, notes and other meaningful data still cause imports to stop safely.

Reports use recorded realised executions, not live equity, open positions, broker volume, commission estimates or invented execution prices. Missing times produce Not Available. A valid exit earlier than entry follows the existing overnight duration calculation. The existing RR field is shown as **Average recorded RR**. It does not establish signed realised R without a recorded risk denominator, so **Average realised R** is Not Available unless an explicit numeric `realisedR` or `realizedR` value is present. Actual net P&L continues to include fees already entered by the trader. Daily risk limits remain independently calculated per account, with the existing $500 default.

## Verification

Stop any running journal server before `npm test`: the portable launcher tests temporarily reserve port 5176. Use synthetic data in isolated Chromium contexts:

```bash
npm test
npm run build
npm run security:sweep
npm audit
npm run stress
npm run test:e2e
npm run test:accounts
npm run test:risk-discipline
npm run test:experience
npm run test:v2
npm run stress:browser
```

Browser suites can use Playwright's installed Chromium, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to an existing Chromium executable. They do not use your personal Brave profile.

The Version 2 browser suite covers chart ordering, outcome proportions, account scope, London defaults, annotation creation/reordering/replacement/deletion, independent edits, multi-account copying, raw note ordering, collapsed review sections, historical checklist conflicts/resolution, actual multiline typing/backspace, flowchart branches/reordering, report filters, the Daily Journal archive, ZIP/repeated import/recovery, and responsive layouts down to 320 pixels. Existing suites retain atomic-save rollback/retry, risk limits, local-midnight reset and launcher checks. Heavy browser stress uses 500 synthetic trades with screenshots; server stress uses 200 requests at concurrency 20.

Native macOS Finder/Dock and the installed Brave browser cannot be verified in this Linux environment. The launcher source and fixed application URL are preserved; portable launcher tests continue to run with the unit suite.

### Results in this change

- 69 unit tests passed.
- All six Chromium suites passed: smoke, accounts, risk/discipline, experience, Version 2 and heavy stress.
- Production build and security sweep passed. Dependency audit found zero vulnerabilities.
- Server stress passed 200 requests at concurrency 20; browser stress passed 500 synthetic trades with screenshots.
- Responsive checks include 320, 390, 768, 1024 and desktop widths. Native macOS/Brave UI remains untested on Linux.
