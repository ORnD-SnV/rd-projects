# R&D Projects dashboard

One place for the R&D department's projects: status, engineer hours, costings, and design files.
It replaces the cycle of updating a Google Sheet by hand, downloading it and uploading it to Claude.

- **Sign in with Google** (company Workspace accounts only). Three roles: Supervisor, Engineer, Guest.
- **Google Sheet as the database.** People, the dashboard and Claude all work on the same sheet.
- **Time tracking** with a start/stop timer or manual entry: engineer, project, start, end, hours, activity.
- **Costings** against each project's three budget lines (development, tool investment, certification), plus product costing records.
- **Files** in Google Drive: SolidWorks parts, assemblies and drawings, STEP files, renders, test reports, costing sheets. Upload new files or link files already in an engineer's own Drive.
- **Works offline.** Every change is saved on the device first and sent when the connection returns.

There is no server to run. The app is a set of static files; all data stays in your Google Workspace.

## Try it now

Open `index.html` through any local web server and it starts in **demo mode** with invented sample data:

```
python3 -m http.server 8765
# then open http://localhost:8765
```

Demo mode needs no Google account. Pick a role on the sign-in screen to see what each role gets.

## Go live

Follow **[docs/SETUP.md](docs/SETUP.md)**. In short:

1. Push these files to a GitHub repository. The included workflow publishes them to GitHub Pages on every push.
2. Import `RD_Projects_Database.xlsx` into Google Sheets and create a shared Drive folder for files.
3. Create a Google sign-in client (about ten minutes, free) and enter four values in `config.js`.

## Let Claude update the sheet

See **[docs/CLAUDE_INSTRUCTIONS.md](docs/CLAUDE_INSTRUCTIONS.md)**. With the Google Sheets connector switched on, Claude can log hours,
post status updates and write weekly summaries directly in the sheet. The dashboard shows the result at its next sync.

## What each role can do

| | Supervisor | Engineer | Guest |
|---|---|---|---|
| See projects, status, updates, files | yes | yes | yes |
| See BIP values, budgets, costings | yes | yes | only if a supervisor allows it |
| See time logs and the team list | yes | yes | no |
| Add projects | yes | yes | no |
| Edit a project | any | their own | no |
| Log time, post updates, add costings and files | yes | yes | no |
| Edit or delete entries | anyone's | their own | no |
| Delete projects, manage people and roles | yes | no | no |

A company account that is not listed on the Team page signs in as a Guest.

### Where the limits are enforced

Roles are applied by the dashboard. The hard limits come from Google's own sharing settings:

- Someone with **Viewer** access to the sheet cannot change it by any route, so share the sheet as Viewer with other departments.
- Anyone who can open the Google Sheet directly can read every column in it, including finance figures. Hiding figures from
  guests in the dashboard does not hide them in the sheet itself. If that matters, do not share the sheet with those people.
- Engineers have Editor access to the sheet, so the difference between Engineer and Supervisor is a dashboard rule, not a Google one.

## How offline and sync work

1. A change appears on screen at once and is written to the browser's storage on that device.
2. It joins a queue. With a connection and a valid Google sign-in the queue is sent within a second.
3. Without a connection the queue waits. The top bar shows `Offline · 3 waiting`. Reopening the browser keeps the queue.
4. On reconnect the queue is sent and the latest sheet is loaded. Other people see offline changes only from this point.

When sending, the dashboard re-reads the tab and writes **only the cells that were edited**, found by each row's `id`.
So it is safe if rows were sorted or added meanwhile, and two people editing different fields of one project both keep their change.
If two people edit the same field, the later one to sync wins.

Files added offline are kept on the device and uploaded on reconnect. Very large files need the tab to stay open until the upload finishes.

## Project layout

```
index.html            the page
config.js             your four connection values (empty = demo mode)
css/app.css           styles, light and dark
js/core.js            utilities, device storage, table layout, role rules
js/backend-google.js  Google sign-in, Sheets and Drive calls
js/sync.js            offline queue, sync, demo backend, roles
js/ui.js              dialogs, forms, tables, charts
js/views-*.js         the screens
js/demo-data.js       invented sample data for demo mode
sw.js                 keeps the app available offline
docs/                 setup guide and Claude instructions
tests/                browser tests (npm install, then npm test with the local server running)
.github/workflows/    automatic publishing to GitHub Pages
```

No build step and no dependencies at run time. Fonts are IBM Plex (SIL Open Font License, see `fonts/OFL-LICENSE.txt`).
