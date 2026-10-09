/* backend-google.js — Sign in with Google, Google Sheets as the database, Google Drive for files.
   Everything runs in the browser with the signed-in person's own Google permissions; there is no server. */
(function () {
  "use strict";
  const RD = window.RD, U = RD.U, CFG = RD.config;
  const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets/";
  const DRIVE = "https://www.googleapis.com/drive/v3/";
  const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
  const SCOPES = "openid email profile https://www.googleapis.com/auth/drive";
  const FOLDER_MIME = "application/vnd.google-apps.folder";

  class ApiError extends Error {
    constructor(code, message, status) { super(message); this.code = code; this.status = status; }
  }
  RD.ApiError = ApiError;

  const G = (RD.Google = { name: "google", token: null, tokenExp: 0, tokenClient: null, meta: null, identity: null });

  /* ---------------------------------------------------------------- sign-in */
  let gisLoading = null;
  function loadGis() {
    if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    if (gisLoading) return gisLoading;
    gisLoading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { gisLoading = null; reject(new ApiError("network", "Could not reach Google sign-in. Check your internet connection.")); };
      document.head.appendChild(s);
    });
    return gisLoading;
  }

  function saveToken() {
    try { sessionStorage.setItem("rd_token", JSON.stringify({ t: G.token, e: G.tokenExp })); } catch (e) {}
  }
  G.init = async () => {
    try {
      const saved = JSON.parse(sessionStorage.getItem("rd_token") || "null");
      if (saved && saved.e > Date.now() + 60000) { G.token = saved.t; G.tokenExp = saved.e; }
    } catch (e) {}
  };
  G.ready = () => !!G.token && G.tokenExp > Date.now() + 30000;

  /* Ask Google for an access token. interactive=false tries silently (works while the
     person is still signed in to Google in this browser and has approved the app before). */
  function requestToken(interactive, hint) {
    return loadGis().then(() => new Promise((resolve, reject) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: CFG.clientId,
        scope: SCOPES,
        hd: CFG.domain || undefined,
        login_hint: hint || undefined,
        callback: (resp) => {
          if (!resp || resp.error || !resp.access_token) return reject(new ApiError("auth", (resp && (resp.error_description || resp.error)) || "Sign-in was cancelled."));
          G.token = resp.access_token;
          G.tokenExp = Date.now() + (Number(resp.expires_in) || 3600) * 1000;
          saveToken();
          resolve(G.token);
        },
        error_callback: (err) => reject(new ApiError("auth", err && err.type === "popup_failed_to_open" ? "The Google sign-in window was blocked. Allow pop-ups for this site and try again." : "Sign-in was cancelled."))
      });
      client.requestAccessToken({ prompt: interactive ? "select_account" : "" });
    }));
  }

  G.signIn = async () => {
    await requestToken(true);
    const info = await api("https://www.googleapis.com/oauth2/v3/userinfo");
    const email = String(info.email || "").toLowerCase();
    if (CFG.domain && !email.endsWith("@" + CFG.domain.toLowerCase())) {
      G.signOut();
      throw new ApiError("domain", "Sign in with your @" + CFG.domain + " account. " + email + " is not part of the company workspace.");
    }
    G.identity = { email, fullName: info.name || email, name: info.given_name || (info.name || email).split(/[ @]/)[0], picture: info.picture || "" };
    return G.identity;
  };
  /* Called when the saved token has expired but the person is still "logged in" to the app. */
  G.reconnect = async (interactive) => {
    const hint = RD.session ? RD.session.email : undefined;
    try { await requestToken(false, hint); }
    catch (e) { if (!interactive) throw e; await requestToken(true, hint); }
    return true;
  };
  G.signOut = () => {
    const t = G.token;
    G.token = null; G.tokenExp = 0; G.identity = null; G.meta = null;
    try { sessionStorage.removeItem("rd_token"); } catch (e) {}
    try { if (t && window.google && google.accounts) google.accounts.oauth2.revoke(t, () => {}); } catch (e) {}
  };

  /* ---------------------------------------------------------------- fetch wrapper */
  async function api(url, opts) {
    opts = opts || {};
    if (!G.token) throw new ApiError("auth", "Not signed in to Google.");
    let res;
    try {
      res = await fetch(url, {
        method: opts.method || "GET",
        headers: Object.assign({ Authorization: "Bearer " + G.token }, opts.body && !opts.raw ? { "Content-Type": "application/json" } : {}, opts.headers || {}),
        body: opts.body ? (opts.raw ? opts.body : JSON.stringify(opts.body)) : undefined
      });
    } catch (e) {
      throw new ApiError("network", "No connection to Google.");
    }
    if (res.status === 401) { G.token = null; G.tokenExp = 0; throw new ApiError("auth", "Your Google session has expired.", 401); }
    if (!res.ok) {
      let msg = res.statusText;
      try { const j = await res.json(); msg = (j.error && (j.error.message || j.error.status)) || msg; } catch (e) {}
      if (res.status === 403) throw new ApiError("forbidden", msg, 403);
      if (res.status === 404) throw new ApiError("notfound", msg, 404);
      if (res.status === 429 || res.status >= 500) throw new ApiError("network", msg, res.status);
      throw new ApiError("api", msg, res.status);
    }
    if (opts.blob) return res.blob();
    if (opts.response) return res;
    const text = await res.text();
    return text ? JSON.parse(text) : {};
  }
  G.api = api;

  /* ---------------------------------------------------------------- sheet <-> rows */
  const q = (name) => "'" + name.replace(/'/g, "''") + "'";
  const colLetter = (n) => { let s = ""; n++; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; };
  const isDeleted = (v) => v === true || /^(true|yes|1)$/i.test(String(v == null ? "" : v).trim());
  RD.isDeletedValue = isDeleted;
  // Sheets stores typed-in dates as serial numbers; convert them back to text.
  function serialToDate(n) { const d = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000); return d.getUTCFullYear() + "-" + U.pad(d.getUTCMonth() + 1) + "-" + U.pad(d.getUTCDate()); }
  function serialToTime(n) { const m = Math.round((n % 1) * 1440); return U.pad(Math.floor(m / 60) % 24) + ":" + U.pad(m % 60); }
  function readCell(col, v) {
    if (v == null) return "";
    const type = RD.COLTYPE[col];
    if (type === "date") {
      if (typeof v === "number") return serialToDate(v);
      const s = String(v).trim();
      let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
      if (m) return m[1] + "-" + U.pad(m[2]) + "-" + U.pad(m[3]);
      m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(s); // dd/mm/yyyy typed as text
      if (m) return m[3] + "-" + U.pad(m[2]) + "-" + U.pad(m[1]);
      return s;
    }
    if (type === "time") {
      if (typeof v === "number") return serialToTime(v);
      const m = /^(\d{1,2}):(\d{2})/.exec(String(v).trim());
      return m ? U.pad(m[1]) + ":" + m[2] : String(v).trim();
    }
    if (type === "num") {
      if (typeof v === "number") return v;
      const s = String(v).replace(/,/g, "").trim();
      return s !== "" && isFinite(+s) ? +s : (s === "" ? "" : String(v));
    }
    return typeof v === "string" ? v : (typeof v === "boolean" ? v : String(v));
  }
  function writeCell(v) { return v === undefined || v === null ? "" : v; }
  G.parseTable = (name, values) => {
    const out = { rows: [], header: [], noId: 0 };
    if (!values || !values.length) return out;
    const header = (out.header = values[0].map((h) => String(h == null ? "" : h).trim()));
    const idCol = header.indexOf("id");
    for (let r = 1; r < values.length; r++) {
      const arr = values[r] || [];
      if (!arr.some((c) => c !== "" && c != null)) continue;
      const id = idCol >= 0 ? String(arr[idCol] == null ? "" : arr[idCol]).trim() : "";
      if (!id) { out.noId++; continue; }
      const row = {};
      header.forEach((h, i) => { if (h) row[h] = readCell(h, arr[i]); });
      row.id = id;
      if (isDeleted(row.deleted)) continue;
      delete row.deleted;
      out.rows.push(row);
    }
    return out;
  };

  async function getMeta(force) {
    if (G.meta && !force) return G.meta;
    const j = await api(SHEETS + CFG.spreadsheetId + "?fields=properties.title,sheets.properties(sheetId,title,gridProperties.columnCount)");
    G.meta = { title: (j.properties && j.properties.title) || "", tabs: {} };
    (j.sheets || []).forEach((s) => (G.meta.tabs[s.properties.title] = { id: s.properties.sheetId, cols: (s.properties.gridProperties && s.properties.gridProperties.columnCount) || 26 }));
    return G.meta;
  }
  /* A tab only has as many columns as its grid; widen it before writing a heading further right. */
  async function ensureColumns(need) {
    const meta = await getMeta();
    const requests = [];
    Object.keys(need).forEach((t) => { const tab = meta.tabs[t]; if (tab && need[t] > tab.cols) { requests.push({ appendDimension: { sheetId: tab.id, dimension: "COLUMNS", length: need[t] - tab.cols + 4 } }); tab.cols = need[t] + 4; } });
    if (requests.length) await api(SHEETS + CFG.spreadsheetId + ":batchUpdate", { method: "POST", body: { requests } });
  }
  async function batchGet(tabs) {
    if (!tabs.length) return {};
    const qs = tabs.map((t) => "ranges=" + encodeURIComponent(q(t))).join("&");
    const j = await api(SHEETS + CFG.spreadsheetId + "/values:batchGet?" + qs + "&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER&majorDimension=ROWS");
    const out = {};
    (j.valueRanges || []).forEach((vr, i) => (out[tabs[i]] = vr.values || []));
    return out;
  }

  G.pull = async () => {
    let meta;
    try { meta = await getMeta(true); } catch (e) { if (e.code === "notfound") throw new ApiError("forbidden", "This Google account has no access to the project sheet. Ask the supervisor to share it with you."); throw e; }
    const present = RD.TABLE_NAMES.filter((t) => t in meta.tabs);
    const raw = await batchGet(present);
    const tables = {}, info = { missingTabs: RD.TABLE_NAMES.filter((t) => !(t in meta.tabs)), noIdRows: {}, missingCols: {}, title: meta.title };
    RD.TABLE_NAMES.forEach((t) => {
      const p = G.parseTable(t, raw[t]);
      tables[t] = p.rows;
      if (p.noId) info.noIdRows[t] = p.noId;
      if (t in meta.tabs) { const miss = RD.TABLES[t].filter((c) => !p.header.includes(c)); if (miss.length) info.missingCols[t] = miss; }
    });
    return { tables, info };
  };

  /* Create any missing tab and add any missing column heading. Safe to run again. */
  G.setupSheet = async () => {
    const meta = await getMeta(true);
    const missing = RD.TABLE_NAMES.filter((t) => !(t in meta.tabs));
    if (missing.length) {
      await api(SHEETS + CFG.spreadsheetId + ":batchUpdate", { method: "POST", body: { requests: missing.map((t) => ({ addSheet: { properties: { title: t, gridProperties: { frozenRowCount: 1, columnCount: Math.max(26, RD.TABLES[t].length + 6) } } } })) } });
      await getMeta(true);
    }
    const raw = await batchGet(RD.TABLE_NAMES);
    const data = [], need = {};
    RD.TABLE_NAMES.forEach((t) => {
      const header = ((raw[t] && raw[t][0]) || []).map((h) => String(h == null ? "" : h).trim());
      const add = RD.TABLES[t].filter((c) => !header.includes(c));
      if (add.length) { data.push({ range: q(t) + "!A1", values: [header.concat(add)] }); need[t] = header.length + add.length; }
    });
    await ensureColumns(need);
    if (data.length) await api(SHEETS + CFG.spreadsheetId + "/values:batchUpdate", { method: "POST", body: { valueInputOption: "RAW", data } });
    return { createdTabs: missing, fixedTabs: data.length };
  };
  /* Give an id to rows that people typed into the sheet by hand without one. */
  G.assignIds = async () => {
    const raw = await batchGet(RD.TABLE_NAMES.filter((t) => t in (G.meta ? G.meta.tabs : {})));
    const data = [], prefix = { Projects: "p", TimeLogs: "t", Costings: "c", Files: "f", Updates: "u", Users: "user", Settings: "s" };
    let n = 0;
    Object.keys(raw).forEach((t) => {
      const values = raw[t]; if (!values.length) return;
      const idCol = values[0].map((h) => String(h).trim()).indexOf("id"); if (idCol < 0) return;
      for (let r = 1; r < values.length; r++) {
        const arr = values[r] || [];
        if (!arr.some((c) => c !== "" && c != null)) continue;
        if (String(arr[idCol] == null ? "" : arr[idCol]).trim()) continue;
        data.push({ range: q(t) + "!" + colLetter(idCol) + (r + 1), values: [[U.uid(prefix[t] || "r")]] }); n++;
      }
    });
    if (data.length) await api(SHEETS + CFG.spreadsheetId + "/values:batchUpdate", { method: "POST", body: { valueInputOption: "RAW", data } });
    return n;
  };

  /* Send queued changes. Each change is {op, table, id, patch, isNew}.
     The tab is re-read first, so a change is merged into the row as it is NOW:
     only the edited cells are overwritten, other people's edits to other cells survive,
     and it does not matter if rows were sorted or moved in the meantime. */
  G.push = async (ops) => {
    const meta = await getMeta();
    const tabs = Array.from(new Set(ops.map((o) => o.table)));
    const missing = tabs.filter((t) => !(t in meta.tabs));
    if (missing.length) { await G.setupSheet(); }
    const raw = await batchGet(tabs);
    const updates = [], appends = {}, applied = [], dropped = [], need = {};
    tabs.forEach((t) => {
      const values = raw[t] || [];
      let header = (values[0] || []).map((h) => String(h == null ? "" : h).trim());
      let headerChanged = false;
      if (!header.length) { header = RD.TABLES[t].slice(); headerChanged = true; }
      const colOf = (c) => { let i = header.indexOf(c); if (i < 0) { header.push(c); i = header.length - 1; headerChanged = true; } return i; };
      const idCol = colOf("id");
      const rowOf = new Map();
      for (let r = 1; r < values.length; r++) { const id = String((values[r] || [])[idCol] == null ? "" : values[r][idCol]).trim(); if (id && !rowOf.has(id)) rowOf.set(id, r); }
      const touched = new Map(); // sheet row index -> { column index: new value }
      const fresh = new Map(); // id -> array (rows to append)
      ops.filter((o) => o.table === t).forEach((o) => {
        if (rowOf.has(o.id)) {
          const r = rowOf.get(o.id);
          const cells = touched.get(r) || {};
          touched.set(r, cells);
          Object.keys(o.patch).forEach((k) => { if (k !== "id") cells[colOf(k)] = writeCell(o.patch[k]); });
        } else if (fresh.has(o.id) || o.isNew) {
          let arr = fresh.get(o.id);
          if (!arr) { arr = []; arr[idCol] = o.id; fresh.set(o.id, arr); }
          Object.keys(o.patch).forEach((k) => { if (k !== "id") arr[colOf(k)] = writeCell(o.patch[k]); });
        } else { dropped.push(o.op); return; } // the row was removed from the sheet by someone else
        applied.push(o.op);
      });
      const fill = (arr) => { const out = []; for (let i = 0; i < header.length; i++) out[i] = arr[i] === undefined || arr[i] === null ? "" : arr[i]; return out; };
      if (headerChanged) { updates.push({ range: q(t) + "!A1", values: [header] }); need[t] = header.length; }
      // Only the edited cells are written, so formulas and other people's edits in the same row are left alone.
      touched.forEach((cells, r) => Object.keys(cells).forEach((c) => updates.push({ range: q(t) + "!" + colLetter(+c) + (r + 1), values: [[cells[c]]] })));
      if (fresh.size) appends[t] = Array.from(fresh.values()).map(fill);
    });
    await ensureColumns(need);
    if (updates.length) await api(SHEETS + CFG.spreadsheetId + "/values:batchUpdate", { method: "POST", body: { valueInputOption: "RAW", data: updates } });
    for (const t of Object.keys(appends)) {
      await api(SHEETS + CFG.spreadsheetId + "/values/" + encodeURIComponent(q(t) + "!A1") + ":append?valueInputOption=RAW&insertDataOption=INSERT_ROWS", { method: "POST", body: { values: appends[t] } });
    }
    return { applied, dropped };
  };

  /* ---------------------------------------------------------------- Drive */
  const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const ALL = "supportsAllDrives=true&includeItemsFromAllDrives=true";
  const folderCache = {};
  async function projectFolder(project) {
    if (!CFG.driveFolderId) throw new ApiError("config", "No Drive folder is set in config.js (driveFolderId).");
    if (!project) return CFG.driveFolderId;
    if (project.drive_folder_id) return project.drive_folder_id;
    if (folderCache[project.id]) return folderCache[project.id];
    const name = ((project.job_no ? project.job_no + " " : "") + project.name).replace(/[\\/]/g, "-").slice(0, 120);
    const found = await api(DRIVE + "files?q=" + encodeURIComponent("'" + esc(CFG.driveFolderId) + "' in parents and name = '" + esc(name) + "' and mimeType = '" + FOLDER_MIME + "' and trashed = false") + "&fields=files(id)&" + ALL);
    let id = found.files && found.files[0] && found.files[0].id;
    if (!id) id = (await api(DRIVE + "files?supportsAllDrives=true&fields=id", { method: "POST", body: { name, mimeType: FOLDER_MIME, parents: [CFG.driveFolderId] } })).id;
    folderCache[project.id] = id;
    RD.Sync.mutate("Projects", project.id, { drive_folder_id: id });
    return id;
  }
  G.projectFolder = projectFolder;

  /* Resumable upload, so large SolidWorks assemblies go through and progress can be shown. */
  G.uploadFile = async (blob, info, onProgress) => {
    const parent = await projectFolder(info.project);
    const mime = info.mime || blob.type || "application/octet-stream";
    const start = await api(UPLOAD + "?uploadType=resumable&supportsAllDrives=true&fields=id,name,size,mimeType,webViewLink", {
      method: "POST", response: true,
      headers: { "X-Upload-Content-Type": mime, "X-Upload-Content-Length": String(blob.size) },
      body: { name: info.name, parents: [parent], description: info.note || "" }
    });
    const session = start.headers.get("Location");
    if (!session) throw new ApiError("api", "Google Drive did not start the upload.");
    const file = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", session);
      xhr.setRequestHeader("Authorization", "Bearer " + G.token);
      xhr.setRequestHeader("Content-Type", mime);
      xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
      xhr.onload = () => { if (xhr.status >= 200 && xhr.status < 300) { try { resolve(JSON.parse(xhr.responseText)); } catch (e) { reject(new ApiError("api", "Upload finished but Drive sent an unreadable reply.")); } } else if (xhr.status === 401) { G.token = null; reject(new ApiError("auth", "Your Google session has expired.")); } else reject(new ApiError(xhr.status === 403 ? "forbidden" : "network", "Upload failed (" + xhr.status + ").")); };
      xhr.onerror = () => reject(new ApiError("network", "Upload interrupted."));
      xhr.send(blob);
    });
    return { drive_id: file.id, url: file.webViewLink || "https://drive.google.com/file/d/" + file.id + "/view", size: Number(file.size) || blob.size, mime: file.mimeType || mime };
  };
  G.fileBlob = async (f) => (f.drive_id ? api(DRIVE + "files/" + encodeURIComponent(f.drive_id) + "?alt=media&supportsAllDrives=true", { blob: true }) : null);
  G.fileUrl = (f) => f.url || (f.drive_id ? "https://drive.google.com/file/d/" + f.drive_id + "/view" : "");
  /* The signed-in engineer's own Drive: recent files, or search by name. */
  G.listMyDrive = async (search) => {
    let query = "trashed = false and mimeType != '" + FOLDER_MIME + "'";
    if (search) query += " and name contains '" + esc(search) + "'";
    const j = await api(DRIVE + "files?q=" + encodeURIComponent(query) + "&orderBy=" + encodeURIComponent(search ? "name" : "modifiedTime desc") + "&pageSize=40&fields=" + encodeURIComponent("files(id,name,mimeType,size,modifiedTime,webViewLink,owners(displayName))") + "&" + ALL);
    return j.files || [];
  };
  G.copyIntoProject = async (driveFile, project) => {
    const parent = await projectFolder(project);
    const f = await api(DRIVE + "files/" + encodeURIComponent(driveFile.id) + "/copy?supportsAllDrives=true&fields=id,name,size,mimeType,webViewLink", { method: "POST", body: { name: driveFile.name, parents: [parent] } });
    return { drive_id: f.id, url: f.webViewLink, size: Number(f.size) || 0, mime: f.mimeType, name: f.name };
  };
  G.shareWithDomain = async (driveId) => {
    if (!CFG.domain) return;
    await api(DRIVE + "files/" + encodeURIComponent(driveId) + "/permissions?supportsAllDrives=true&sendNotificationEmail=false", { method: "POST", body: { type: "domain", role: "reader", domain: CFG.domain } });
  };
  G.sheetUrl = () => "https://docs.google.com/spreadsheets/d/" + CFG.spreadsheetId + "/edit";
  G.folderUrl = () => (CFG.driveFolderId ? "https://drive.google.com/drive/folders/" + CFG.driveFolderId : "");
})();
