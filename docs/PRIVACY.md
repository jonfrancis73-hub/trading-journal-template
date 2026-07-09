# Privacy

This template stores data locally in the user's browser.

It does not upload screenshots, trades, notes, or settings anywhere by default.

Optional Notion import is different:

- The user must provide their own Notion integration token in `.env.local`.
- The token stays on the local machine and is used by the local helper server.
- Imported screenshots are copied into local browser storage so the journal does not depend on expiring Notion file links.
- Notion import is never required for normal journal use.

Important limits:

- Browser storage can be cleared by the user, browser, or system cleanup tools.
- Private browsing mode is not safe for long-term journal storage.
- Automatic recovery backups are stored in the same browser, so they help with app mistakes or accidental resets but not with full browser-data deletion.
- Users should export ZIP backups from Settings and keep those backup files somewhere safe.
- Imported backup files larger than 200 MB are rejected to avoid freezing the browser.
