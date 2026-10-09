# Setup guide

About 30 to 40 minutes, once. You need: a GitHub account, and a Google Workspace account that may create a Google Cloud project
(any Workspace user can, unless your IT admin has switched this off).

The four values you collect on the way go into `config.js`:

| Value | Where it comes from |
|---|---|
| `spreadsheetId` | Step 2 |
| `driveFolderId` | Step 3 |
| `clientId` | Step 4 |
| `domain` | your company email domain, e.g. `yourcompany.com` |

## 1. Put the files on GitHub

1. Create a new repository, for example `rd-projects`.
   On GitHub's free plan the repository must be **public** for GitHub Pages to work. That is fine: the repository holds only the
   app, never your project data, and the values in `config.js` are not secrets. Use a private repository if you have a paid plan.
2. Upload every file and folder from this project, keeping the folder structure (including the hidden `.github` folder).
   Do **not** upload `RD_Projects_Database.xlsx` or any other data file.
3. In the repository: **Settings > Pages > Build and deployment > Source: GitHub Actions**.
4. Open the **Actions** tab. The "Deploy dashboard" run finishes in about a minute and shows the site address,
   `https://<your-github-name>.github.io/<repository>/`. Opening it now shows the dashboard in demo mode.

From here on, any change pushed to `main` is published automatically.

## 2. Create the Google Sheet

1. Go to <https://sheets.new> to create an empty Google Sheet. Name it, for example, `R&D Projects DB`.
2. **File > Import > Upload**, choose `RD_Projects_Database.xlsx`, import location **Replace spreadsheet**.
   You now have the tabs Projects, TimeLogs, Costings, Files, Updates, Users, Settings, plus About and Import notes.
   Importing matters: an `.xlsx` file merely stored in Drive is not a Google Sheet and the dashboard cannot read it.
3. Read the **Import notes** tab. It lists the few dates and values from the old sheet that need a human decision.
4. Copy the sheet's id from its address: `https://docs.google.com/spreadsheets/d/`**`THIS-PART`**`/edit`.
5. **Share** the sheet:
   - R&D engineers and supervisors: **Editor**.
   - Other departments (guests): **Viewer**, either person by person or "Anyone at <company> with the link: Viewer".
     Read "Where the limits are enforced" in the README first: viewers can read every column of the sheet.

Starting without the workbook also works: leave the new sheet empty and the first supervisor to sign in gets the tabs created automatically.

## 3. Create the Drive folder for files

1. In Google Drive create a folder, for example `R&D Project Files`. A **shared drive** is best, because files then belong to the
   company and not to whoever uploaded them.
2. Share it: engineers **Contributor** (or Editor), guests **Viewer**.
3. Copy the folder id from its address: `https://drive.google.com/drive/folders/`**`THIS-PART`**.

The dashboard creates one sub-folder per project the first time a file is added to it.

## 4. Create the Google sign-in client

1. Go to <https://console.cloud.google.com/> and create a project, for example `rd-projects-dashboard`.
2. **APIs & Services > Library**: enable **Google Sheets API** and **Google Drive API**.
3. **Google Auth Platform** (older consoles call it "OAuth consent screen"):
   - App name: `R&D Projects`. Support email: yours.
   - **Audience: Internal.** This limits sign-in to your Workspace and means Google needs no app review.
4. **Google Auth Platform > Clients > Create client**:
   - Application type: **Web application**.
   - **Authorized JavaScript origins**: `https://<your-github-name>.github.io` (no path, no trailing slash).
     Add `http://localhost:8765` too if you want to test on your own computer.
   - Leave "Authorized redirect URIs" empty.
5. Copy the **Client ID** (it ends in `.apps.googleusercontent.com`). No client secret is needed.

Google says new settings can take from five minutes to a few hours to become active.

**What the app asks each person to allow:** "See, edit, create and delete all of your Google Drive files". It needs this to read
and write the shared sheet, upload into the shared folder, and let an engineer pick a file from their own Drive. The permission
stays inside that person's browser: there is no server, and the app only ever touches the project sheet, the project folder and
files the person explicitly picks. If your Workspace admin restricts apps with Drive access, ask them to mark this client ID as
trusted under **Admin console > Security > API controls > App access control**.

## 5. Fill in config.js

Edit `config.js` in the repository (the pencil icon on GitHub works) and commit:

```js
window.RD_CONFIG = {
  clientId: "1234567890-abc123.apps.googleusercontent.com",
  spreadsheetId: "1AbC...xyz",
  driveFolderId: "1DeF...uvw",
  domain: "yourcompany.com",
  admins: ["head.rnd@yourcompany.com"],
  appName: "R&D Projects",
  orgName: "Your Company R&D",
  currency: "LKR",
  pollSeconds: 45
};
```

`admins` is optional. People listed there are always supervisors. If it is empty and the Users tab has no supervisor yet,
the first person to sign in becomes the supervisor.

The Actions workflow republishes the site within a minute or two.

## 6. First run checklist

Do these once, signed in as the supervisor, to confirm everything is wired up. The app's logic is covered by automated tests
against a stand-in for Google; this checklist is the test against your real Google account.

1. Open the site and **Sign in with Google**. Approve the permission screen. You should land on the Overview with your projects.
2. **Settings > Connection** should say the sheet has every tab and column. If it lists something missing, press
   **Add missing tabs and columns**.
3. **Team**: add each engineer with their company email and the **short name exactly as written in the Engineer column**
   (the page lists the names it found that have no account yet). Add guests the same way with the Guest role, or leave them
   unlisted: any company account not in the list is a Guest.
4. **Time**: start a timer on a project, stop it, and check the new row on the sheet's TimeLogs tab.
5. **Files**: upload a small file to a project and check it appears in the Drive folder under a sub-folder named after the project.
6. **Offline**: switch off Wi-Fi, add a time entry (the top bar shows `Offline · 1 waiting`), switch Wi-Fi back on and
   watch it change to `Saved`. Check the row arrived in the sheet.
7. Ask one engineer and one guest to sign in and confirm they see what the role table in the README says.

## 7. Connect Claude

See [CLAUDE_INSTRUCTIONS.md](CLAUDE_INSTRUCTIONS.md).

## Installing on phones and laptops

Open the site in Chrome or Edge and choose **Install app** (or **Add to Home screen** on a phone). After one online visit the
dashboard opens without a connection.

## If something goes wrong

| What you see | What to do |
|---|---|
| The Google window does not open | Allow pop-ups for the site, then press the button again. |
| "Access blocked: authorisation error" / `origin_mismatch` | The site address is missing from Authorized JavaScript origins, or was entered with a path. Wait a few minutes after fixing it. |
| "This app is blocked" | Your Workspace admin restricts Drive apps. Ask them to trust the client ID (step 4). |
| "cannot open the project sheet" after signing in | The sheet is not shared with that person. |
| Top bar says `Reconnect` | Google sign-in lasts about an hour. It renews itself while you are clicking around; after the tab has sat idle, press Reconnect. Changes made meanwhile are kept and sent. |
| "Google refused the change" | That person has Viewer access to the sheet but an Engineer role. Share the sheet with them as Editor. |
| A row typed into the sheet does not appear | It has no `id`. Settings > Connection > **Give ids to rows without one**. |
| File uploads fail | `driveFolderId` is wrong, or the person cannot add files to that folder. |
| An old version keeps showing | Close all tabs of the site and open it again. The offline copy updates when a new version is published. |
