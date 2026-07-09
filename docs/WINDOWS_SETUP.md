# Windows Setup

1. Install Node.js LTS from `https://nodejs.org`.
2. Install Git from `https://git-scm.com`.
3. Open PowerShell.
4. Run:

```powershell
git clone <repo-url>
cd trading-journal-template
npm install
npm test
npm run build
npm run dev
```

5. Open `http://127.0.0.1:5176`.

## If PowerShell Blocks Scripts

Run:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Then reopen PowerShell and try again.
