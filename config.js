/*
 * R&D Projects — connection settings.
 *
 * Leave clientId and spreadsheetId empty to run in DEMO MODE (sample data kept in
 * this browser only). Fill them in to connect the app to your Google Sheet.
 * Step-by-step instructions: docs/SETUP.md
 *
 * None of these values are secrets. The client ID only works from the web
 * addresses you allow in Google Cloud, and the sheet and folder are protected
 * by their own Google sharing settings.
 */
window.RD_CONFIG = {
  // Google Cloud → APIs & Services → Credentials → OAuth 2.0 Client ID (Web application)
  clientId: "",

  // The long id in the Google Sheet address: docs.google.com/spreadsheets/d/<THIS PART>/edit
  spreadsheetId: "",

  // The id in the Drive folder address: drive.google.com/drive/folders/<THIS PART>
  // Project files (SolidWorks, renders, documents) are uploaded into this folder.
  driveFolderId: "",

  // Your Google Workspace domain. Only accounts from this domain can sign in.
  domain: "",

  // Supervisors who are always admins, whatever the Users tab says.
  // Example: ["head.rnd@yourcompany.com"]
  admins: [],

  // Shown in the header and the browser tab.
  appName: "R&D Projects",
  orgName: "",

  currency: "LKR",

  // How often an open window checks the sheet for other people's changes.
  pollSeconds: 45
};
