# One-click Mac launcher

This installs **Trading Journal.app** and **Stop Trading Journal.app** in your personal Applications folder. It uses your existing journal installation. No application update, dependency install, browser reset, backup import or data migration is performed by the installer.

The address stays **http://127.0.0.1:5176**. No private window, separate Brave data directory or replacement browser profile is created. Trades, screenshots, notes, checklists, accounts, settings and backups stay in the existing Brave storage. Nothing in the trading or storage code is changed by this feature.

## 1. Merge the pull request

Open the launcher pull request on GitHub. Click **Files changed** if you want to review it. Return to **Conversation**, click **Merge pull request**, then **Confirm merge**. If GitHub says checks must finish, wait for them first. The launcher PR targets `main`; merging this PR is all that is needed. It has not been merged for you.

## 2. Install or reinstall the updated launcher

If you already installed the launcher from PR #4, save your work and use **Stop Trading Journal** first. Then follow the steps below using the new ZIP after merging. Rerunning the installer updates the launcher helpers and both apps in place; it does not replace your trading journal folder. Existing Dock icons and aliases should keep working because the app names and locations stay the same.

Install **Brave Browser** from https://brave.com/download/ if it is not already installed. The launcher opens Brave directly, even when another browser is your default. If Brave cannot be opened, the app shows a clear error with installation guidance; it does not fall back to Chrome.

If your existing journal is in Brave, keep using that same Brave profile. If you previously used Chrome, export a backup from the journal in Chrome first. Chrome and Brave have separate storage: this launcher leaves Chrome records intact and does not transfer them automatically. To move those records intentionally, open the exact journal address in your usual Brave profile and import the exported ZIP in Settings. If Brave already contains journal data, export that too before importing; never clear site data to resolve a conflict.

1. Open https://github.com/jonfrancis73-hub/trading-journal-template.
2. Check that the branch selector says **main**. Click the green **Code** button, then **Download ZIP**.
3. Open **Downloads** in Finder. Double-click the ZIP to unpack it if necessary.
4. Open the newly unpacked folder, then its **macos** folder.
5. Double-click **Install Launcher.command**. Terminal opens for this one-time installation.
6. If asked to select a folder, select your **existing, working journal folder**, the one containing `package.json`. Normally it is **Documents → trading-journal-template**. The installer uses that location automatically when it exists. Do not select the newly downloaded copy merely because it has a similar name.
7. When installation finishes, Finder opens your personal **Applications** folder containing **Trading Journal** and **Stop Trading Journal**. Press Return in the installer Terminal to close it.

You do **not** need to copy the downloaded source over your working installation, run npm, or move/delete the existing journal. The downloaded ZIP supplies only the launcher helpers. After installation the downloaded copy can be discarded; keep your existing journal folder in place. If you move that folder later, run the installer again. If the old default folder still exists, rename it temporarily so the installer asks you to choose the new location.

If macOS blocks a downloaded command or app, first try Control-click → **Open**. If macOS still blocks it, attempt to open it once, then go to **System Settings → Privacy & Security → Open Anyway** for this specific file and confirm. Do this only for the files you downloaded from this repository; do not disable Gatekeeper globally. If macOS asks whether Terminal or the app may access Documents, allow it so it can read the existing journal installation.

**If Finder says you do not have permission to run the installer:** open Terminal once, type `bash ` (with a space), drag **Install Launcher.command** from Finder into Terminal, then press Return. This runs the installer without changing file permissions. No Terminal commands are needed for normal daily use.

## 3. Add your icon

- **Dock:** drag **Trading Journal.app** from your personal Applications folder to the left side of the Dock (among the other apps). Drag **Stop Trading Journal.app** there too if convenient. A single Dock click opens it.
- **Desktop:** select **Trading Journal.app** in Finder, choose **File → Make Alias**, then drag that alias onto the Desktop. Double-click the alias to launch. You can rename the alias to “Trading Journal”. Do the same for the Stop app if wanted.
- To find the apps later: in Finder choose **Go → Home**, then open **Applications**. This is your personal Applications folder, not necessarily the main system Applications folder.

## 4. Open the journal each day

1. If you use more than one Brave profile, open Brave and select the **same profile that already holds your journal**. Leave a window for that profile as the most recently active Brave window. The launcher asks Brave to open normally; Brave chooses the active/last-used profile. It cannot infer which profile contains your trades.
2. Click the Dock icon or double-click the Desktop alias.
3. Wait a few seconds. The launcher starts the local server if needed, waits for the journal page to respond, then opens Brave Browser at **http://127.0.0.1:5176**.

Repeated clicks reuse the server. It also reuses a journal you started manually. Another application occupying port 5176 causes an understandable error rather than switching to another address. The launcher works after a Mac restart: click the icon again. It does not start automatically at login and does not need Terminal to stay open.

If Brave shows an empty journal, check the **profile icon** and exact address first. Switch back to the original profile and reopen the exact address there. **Do not clear browser data, reset the journal or import a backup merely to fix a profile mismatch.** Source folders do not determine browser storage; the URL and Brave profile do.

## 5. Close safely

1. Save any open trade, settings or daily checklist and wait for the save confirmation. Unsaved form edits are not saved by stopping the server.
2. Close the journal tab in Brave.
3. Double-click **Stop Trading Journal.app** (or click its Dock icon). Wait for the “server stopped” message.

Closing the Brave tab alone leaves the server running. Closing the launcher app is also not a stop command: it exits after opening Brave. The Stop app stops only the child processes owned by this launcher, never every Node process on your Mac. It does not delete any browser records.

If the server was started manually with `npm run dev`, stop it with **Control-C in the original Terminal window**. The Stop app will explain this instead of killing an unrelated process. After that, use the launcher next time. Shutting down your Mac stops the local processes; save your edits first. Click the icon to start again after rebooting.

## Terminal fallback

After installing once, double-click **Open Journal.command** in the downloaded `macos` folder. It opens Terminal, uses exactly the same launcher and opens Brave. **Stop Journal.command** uses the same safe stop mechanism. You may copy these two command files onto your Desktop; they refer to the installed helpers. If execute permission is missing, use the same one-time `bash ` and drag-file method described above, or use the native apps instead.

## Troubleshooting

| Message or symptom | What to do |
| --- | --- |
| Node.js is missing | Install the current **LTS** from https://nodejs.org, then click the icon again. Standard Node, Homebrew, Volta, default fnm and nvm installations are supported. A custom version manager may need its Node installed in a standard location. |
| Journal folder cannot be located | Keep your existing folder in Documents, or rerun the installer and choose that folder as described above. Never clear Brave data. |
| Dependencies are missing | Select the working installation rather than the fresh downloaded ZIP. If the working installation really needs repair, open Terminal once, type `cd `, drag that **existing journal folder** into Terminal, press Return, then type `npm ci` and press Return. When it finishes, use the launcher again. This installs code dependencies; it does not clear Brave records. |
| Port 5176 is occupied | If an older journal Terminal is running, press Control-C there. Stop the other application using that port if it is unrelated. Never change the journal URL or port. |
| Server cannot start / times out | Use Stop Trading Journal, wait a few seconds, then try again. If a launcher was interrupted during startup, restart the Mac and try again; temporary startup locks are cleared at reboot. To read the log in Finder choose **Go → Go to Folder**, paste `~/Library/Application Support/Trading Journal Launcher`, and open `server.log`. |
| Brave Browser could not be opened | Install **Brave Browser** from https://brave.com/download/ or open it, select your usual journal profile, then retry. If the server already started, retrying reuses it. |
| Stop says started outside the launcher | Use Control-C in the Terminal where you originally ran `npm run dev`. |
| Wrong folder chosen | Rerun Install Launcher.command. The default is Documents/trading-journal-template; if that old folder exists but you want another installation, temporarily rename the old folder before rerunning so the folder chooser appears. |

The launcher fixes the Vite host/port explicitly and runs the same two development components as `npm run dev`: the local optional-import API and Vite. It does not install dependencies or update application code silently. The optional API's existing environment configuration is retained. It never runs an import or backup operation.

To remove the shortcuts, first use Stop Trading Journal, then remove the two apps/aliases and `~/Library/Application Support/Trading Journal Launcher`. Keep the existing project folder and Brave data. Removing these shortcuts does not remove your journal records.

## Developer validation and Mac acceptance checklist

Run `npm test`, `npm run build`, `npm run security:sweep`, and the existing browser checks. `test/macosLauncher.test.mjs` exercises the portable Node control flow using temporary homes/projects and synthetic servers on the fixed port. It covers unrelated-port refusal, simultaneous starts, reuse, stop, restart, startup failure, missing dependencies and missing project. Run tests with port 5176 free, in an isolated development environment. No real Brave profile is opened by these tests.

Native Finder, AppleScript compilation, macOS permissions, Dock behavior, Brave profile routing and reboot behavior must be checked on a Mac. Shell syntax checks and Linux lifecycle tests do not establish those behaviors. On the Mac verify installation, repeated/concurrent clicks, existing manual server reuse, Stop, relaunch, reboot/relaunch and the original Brave profile's records. Save and export a normal backup before any manual acceptance work. Never run automated synthetic browser tests against the user's real Brave profile.

Native macOS acceptance remains necessary: verify the missing-Brave error, then install/open Brave and confirm the launcher uses its usual profile at exactly http://127.0.0.1:5176. Existing automated checks cover lifecycle behavior and the exact Brave launch command without opening a real browser profile.
