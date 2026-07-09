# Customize The Template

Common safe customizations:

- Change the app title in `index.html`.
- Change the header text in `src/App.jsx`.
- Adjust colors in `src/styles.css`.
- Add your own default assets in `src/journalRules.js`.
- Add or remove journal templates in `src/journalRules.js`.

Avoid changing:

- Backup export/import unless you also update tests.
- IndexedDB database name unless you want a fresh empty local database.
- Screenshot compression unless you test large images.
