/* sync.js — the offline-first heart of the app.
   Every change is (1) applied to the screen at once, (2) saved on this device, and
   (3) placed in a queue. The queue is sent to the sheet when there is a connection and
   a valid sign-in; until then it simply waits. Also: demo backend and sign-in/roles. */
(function () {
  "use strict";
  const RD = window.RD, U = RD.U, Store = RD.Store, CFG = RD.config;

  const emptyTables = () => { const t = {}; RD.TABLE_NAMES.forEach((n) => (t[n] = [])); return t; };
  RD.state = { tables: emptyTables(), queue: [], uploads: [], lastSync: null, busy: false, error: null, needAuth: false, info: {}, loaded: false };
  RD.forceOffline = false;
  RD.online = () => navigator.onLine !== false && !RD.forceOffline;
  RD.rows = (t) => RD.state.tables[t] || [];
  RD.byId = (t, id) => RD.rows(t).find((r) => r.id === id);

  /* ================================================================ demo backend
     Stands in for Google when config.js is empty: the "sheet" is kept in this browser. */
  const Demo = (RD.Demo = { name: "demo" });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  Demo.init = async () => {
    if (!Store.get("demo_remote")) Demo.reset();
  };
  Demo.reset = () => {
    const seed = window.RD_SEED ? window.RD_SEED() : { tables: emptyTables(), sampleIds: [] };
    RD.TABLE_NAMES.forEach((n) => (seed.tables[n] = seed.tables[n] || []));
    Store.set("demo_remote", seed.tables);
    Store.set("demo_samples", seed.sampleIds || []);
  };
  Demo.ready = () => true;
  Demo.pull = async () => {
    await wait(120);
    return { tables: U.clone(Store.get("demo_remote") || emptyTables()), info: { missingTabs: [], noIdRows: {}, missingCols: {}, title: "Demo data (this browser only)" } };
  };
  Demo.push = async (ops) => {
    await wait(250);
    const remote = U.clone(Store.get("demo_remote") || emptyTables());
    const applied = [], dropped = [];
    ops.forEach((o) => {
      const rows = (remote[o.table] = remote[o.table] || []);
      let row = rows.find((r) => r.id === o.id);
      if (!row) { if (!o.isNew) { dropped.push(o.op); return; } row = { id: o.id }; rows.push(row); }
      Object.assign(row, o.patch);
      if (RD.isDeletedValue(row.deleted)) rows.splice(rows.indexOf(row), 1);
      applied.push(o.op);
    });
    Store.set("demo_remote", remote);
    return { applied, dropped };
  };
  Demo.uploadFile = async (blob, info, onProgress) => {
    for (let i = 1; i <= 4; i++) { await wait(120); if (onProgress) onProgress(i / 4); }
    const key = "demo_file_" + info.id;
    await Store.blobPut(key, blob);
    return { drive_id: key, url: "", size: blob.size, mime: info.mime || blob.type };
  };
  Demo.fileBlob = async (f) => {
    if (f.url && /^data:/.test(f.url)) { try { return await (await fetch(f.url)).blob(); } catch (e) { return null; } }
    return f.drive_id ? Store.blobGet(f.drive_id) : null;
  };
  Demo.fileUrl = () => "";
  Demo.removeSamples = () => {
    const ids = new Set(Store.get("demo_samples") || []);
    const remote = Store.get("demo_remote") || emptyTables();
    ["TimeLogs", "Costings", "Files", "Updates"].forEach((t) => (remote[t] = (remote[t] || []).filter((r) => !ids.has(r.id))));
    Store.set("demo_remote", remote);
    Store.set("demo_samples", []);
  };
  Demo.hasSamples = () => (Store.get("demo_samples") || []).length > 0;

  RD.backend = RD.demo ? Demo : RD.Google;

  /* ================================================================ queue + state */
  const Sync = (RD.Sync = {});
  const persist = () => { Store.set("cache", RD.state.tables); Store.set("queue", RD.state.queue); Store.set("uploads", RD.state.uploads.map((u) => Object.assign({}, u, { progress: 0, status: "waiting" }))); };
  function applyOp(tables, o) {
    const rows = (tables[o.table] = tables[o.table] || []);
    const i = rows.findIndex((r) => r.id === o.id);
    if (RD.isDeletedValue(o.patch.deleted)) { if (i >= 0) rows.splice(i, 1); return; }
    if (i >= 0) rows[i] = Object.assign({}, rows[i], o.patch);
    else if (o.isNew) rows.push(Object.assign({ id: o.id }, o.patch));
  }
  Sync.load = () => {
    const cache = Store.get("cache");
    RD.state.tables = Object.assign(emptyTables(), cache || {});
    RD.state.queue = Store.get("queue", []) || [];
    RD.state.uploads = Store.get("uploads", []) || [];
    RD.state.lastSync = Store.get("lastSync", null);
    RD.state.loaded = !!cache;
  };
  Sync.pending = () => RD.state.queue.length;

  /* Record a change. patch holds only the fields that changed. */
  Sync.mutate = (table, id, patch, isNew) => {
    const who = RD.session ? RD.session.email : "";
    const now = U.nowIso();
    patch = Object.assign({}, patch);
    patch.updated_at = now; patch.updated_by = who;
    if (isNew && RD.TABLES[table].includes("created_at")) { patch.created_at = now; patch.created_by = who; }
    const op = { op: U.uid("op"), table, id, patch, isNew: !!isNew, ts: now };
    applyOp(RD.state.tables, op);
    RD.state.queue.push(op);
    persist();
    RD.emit("change");
    Sync.soon();
    return op;
  };
  Sync.add = (table, prefix, data) => { const id = data.id || U.uid(prefix); const d = Object.assign({}, data); delete d.id; Sync.mutate(table, id, d, true); return id; };
  Sync.remove = (table, id) => Sync.mutate(table, id, { deleted: true });

  /* ---------------------------------------------------------------- file uploads
     The file itself is kept on this device until it reaches Drive; the row that
     describes it is held back (hold: true) so the sheet never lists a file that is not there. */
  Sync.addFile = async (file, meta) => {
    const id = U.uid("f");
    const blobKey = "up_" + id;
    await Store.blobPut(blobKey, file);
    const project = RD.byId("Projects", meta.project_id);
    const row = { project_id: meta.project_id, project_name: project ? project.name : "", name: file.name, kind: meta.kind || RD.guessKind(file.name), mime: file.type || "", size: file.size, drive_id: "", url: "", uploaded_by: RD.session ? RD.session.name : "", note: meta.note || "" };
    const op = Sync.mutate("Files", id, row, true);
    op.hold = true;
    RD.state.uploads.push({ id, blobKey, name: file.name, mime: file.type || "", size: file.size, project_id: meta.project_id, status: "waiting", progress: 0 });
    persist();
    RD.emit("change");
    Sync.soon();
    return id;
  };
  Sync.uploadOf = (fileId) => RD.state.uploads.find((u) => u.id === fileId);
  async function processUploads() {
    for (const up of RD.state.uploads.slice()) {
      const op = RD.state.queue.find((o) => o.table === "Files" && o.id === up.id && o.hold);
      const blob = await Store.blobGet(up.blobKey);
      const drop = () => { RD.state.uploads = RD.state.uploads.filter((u) => u !== up); Store.blobDel(up.blobKey); };
      if (!op || !RD.byId("Files", up.id)) { // the entry was deleted before the upload happened
        RD.state.queue = RD.state.queue.filter((o) => !(o.table === "Files" && o.id === up.id));
        drop(); continue;
      }
      if (!blob) { // the browser discarded the saved file; nothing can be uploaded
        RD.state.queue = RD.state.queue.filter((o) => !(o.table === "Files" && o.id === up.id));
        applyOp(RD.state.tables, { table: "Files", id: up.id, patch: { deleted: true } });
        drop(); RD.toast && RD.toast("“" + up.name + "” was no longer saved on this device and could not be uploaded. Please add it again.", "bad"); continue;
      }
      up.status = "uploading"; up.progress = 0; RD.emit("upload");
      try {
        const res = await RD.backend.uploadFile(blob, { id: up.id, name: up.name, mime: up.mime, project: RD.byId("Projects", up.project_id) }, (p) => { up.progress = p; RD.emit("upload"); });
        Object.assign(op.patch, { drive_id: res.drive_id, url: res.url, size: res.size || up.size, mime: res.mime || up.mime });
        delete op.hold;
        applyOp(RD.state.tables, { table: "Files", id: up.id, patch: { drive_id: res.drive_id, url: res.url } });
        drop(); persist(); RD.emit("change");
      } catch (e) {
        up.status = "waiting"; up.progress = 0; RD.emit("upload");
        throw e;
      }
    }
  }

  /* ---------------------------------------------------------------- send + receive */
  let chain = Promise.resolve(), retryTimer = null, retryDelay = 5000, soonTimer = null;
  const exclusive = (fn) => (chain = chain.catch(() => {}).then(fn));
  const setBusy = (b) => { RD.state.busy = b; RD.emit("status"); };
  function fail(e) {
    const code = e && e.code;
    if (code === "auth") { RD.state.needAuth = true; RD.state.error = null; }
    else if (code === "forbidden") RD.state.error = "Google refused the change: " + (e.message || "this account can view the sheet but not edit it") + ".";
    else if (code === "network" || !code) { RD.state.error = null; clearTimeout(retryTimer); retryTimer = setTimeout(() => Sync.flush(), retryDelay); retryDelay = Math.min(retryDelay * 2, 60000); }
    else RD.state.error = (e && e.message) || "Sync failed.";
    if (!code) console.error(e);
  }
  async function doPull() {
    const res = await RD.backend.pull();
    const tables = Object.assign(emptyTables(), res.tables);
    RD.state.queue.forEach((o) => applyOp(tables, o)); // changes still waiting stay visible
    RD.state.tables = tables;
    RD.state.info = res.info || {};
    RD.state.lastSync = U.nowIso();
    RD.state.loaded = true;
    Store.set("lastSync", RD.state.lastSync);
    persist();
    RD.Auth.refreshRole();
    RD.emit("change");
  }
  Sync.canTalk = () => RD.online() && RD.backend.ready() && !!RD.session;
  Sync.pull = () => exclusive(async () => {
    if (!Sync.canTalk()) { RD.emit("status"); return false; }
    setBusy(true);
    try { await doPull(); RD.state.error = null; RD.state.needAuth = false; retryDelay = 5000; return true; }
    catch (e) { fail(e); return false; }
    finally { setBusy(false); }
  });
  Sync.flush = () => exclusive(async () => {
    if (!RD.session) return false;
    if (!RD.online()) { RD.emit("status"); return false; }
    if (!RD.backend.ready()) { RD.state.needAuth = !RD.demo; RD.emit("status"); return false; }
    if (!RD.state.queue.length && !RD.state.uploads.length) return true;
    if (!RD.canEdit()) { RD.state.queue = []; RD.state.uploads = []; persist(); return true; }
    setBusy(true);
    try {
      await processUploads();
      const ops = RD.state.queue.filter((o) => !o.hold);
      if (ops.length) {
        const res = await RD.backend.push(ops);
        const done = new Set(res.applied.concat(res.dropped));
        RD.state.queue = RD.state.queue.filter((o) => !done.has(o.op));
        persist();
      }
      await doPull();
      RD.state.error = null; RD.state.needAuth = false; retryDelay = 5000;
      return true;
    } catch (e) { fail(e); return false; }
    finally { setBusy(false); }
  });
  Sync.soon = () => { clearTimeout(soonTimer); soonTimer = setTimeout(() => Sync.flush(), 600); };
  Sync.start = () => {
    window.addEventListener("online", () => { RD.emit("status"); Sync.flush().then(() => Sync.pull()); });
    window.addEventListener("offline", () => RD.emit("status"));
    document.addEventListener("visibilitychange", () => { if (!document.hidden && RD.session) (RD.state.queue.length ? Sync.flush() : Sync.pull()); });
    setInterval(() => { if (!document.hidden && RD.session && !RD.state.busy) (RD.state.queue.length || RD.state.uploads.length ? Sync.flush() : Sync.pull()); }, Math.max(15, CFG.pollSeconds) * 1000);
  };
  Sync.setForceOffline = (v) => { RD.forceOffline = !!v; RD.emit("status"); if (!v) Sync.flush().then(() => Sync.pull()); };

  /* ================================================================ sign-in and roles */
  const Auth = (RD.Auth = {});
  const admins = () => RD.rows("Users").filter((u) => u.role === "admin" && String(u.active).toLowerCase() !== "no");
  Auth.lookup = (email) => {
    email = String(email || "").toLowerCase();
    const row = RD.rows("Users").find((u) => String(u.id).toLowerCase() === email);
    if (row && String(row.active).toLowerCase() === "no") return { blocked: true };
    if (CFG.admins.includes(email)) return { role: "admin", row };
    if (row) return { role: ["admin", "engineer", "guest"].includes(row.role) ? row.role : "guest", row };
    return { role: "guest", row: null };
  };
  Auth.restore = () => {
    const s = Store.get("session");
    if (s && s.email) RD.session = s;
    return !!RD.session;
  };
  const save = () => Store.set("session", RD.session);
  /* Re-check the role after every sync so a supervisor's change takes effect on open screens. */
  Auth.refreshRole = () => {
    if (!RD.session) return;
    const hit = Auth.lookup(RD.session.email);
    if (hit.blocked) { RD.toast && RD.toast("Your access to this dashboard has been switched off.", "bad"); Auth.signOut(); return; }
    const name = (hit.row && hit.row.name) || RD.session.name;
    if (hit.role !== RD.session.role || name !== RD.session.name) { RD.session.role = hit.role; RD.session.name = name; save(); RD.emit("session"); }
  };
  Auth.signIn = async (demoUserId) => {
    let ident;
    if (RD.demo) {
      const users = (Store.get("demo_remote") || {}).Users || [];
      const u = users.find((x) => x.id === demoUserId) || users[0];
      if (!u) throw new RD.ApiError("api", "The demo data has no users. Reset the demo data and try again.");
      ident = { email: u.id, name: u.name, fullName: u.full_name || u.name, picture: "" };
    } else {
      ident = await RD.Google.signIn();
    }
    RD.session = Object.assign({ role: "guest" }, ident);
    // First load of the sheet for this person (needed to know their role).
    try { await doPull(); } catch (e) {
      if (!RD.demo) { RD.session = null; if (e.code === "forbidden" || e.code === "notfound") throw new RD.ApiError("forbidden", "Your Google account cannot open the project sheet yet. Ask the supervisor to share it with you."); throw e; }
    }
    const hit = Auth.lookup(ident.email);
    if (hit.blocked) { RD.session = null; RD.backend.signOut && RD.backend.signOut(); throw new RD.ApiError("blocked", "Your access to this dashboard has been switched off. Ask the R&D supervisor."); }
    RD.session.role = hit.role;
    if (hit.row && hit.row.name) RD.session.name = hit.row.name;
    // Brand-new sheet with no supervisor yet: the first person in becomes the supervisor.
    if (!RD.demo && !admins().length && !CFG.admins.length) {
      RD.session.role = "admin";
      Sync.mutate("Users", ident.email, { name: ident.name, full_name: ident.fullName, role: "admin", pillar: "", active: "yes" }, !hit.row);
    }
    save();
    RD.emit("session");
    Sync.soon();
    return RD.session;
  };
  Auth.signOut = () => {
    if (RD.backend.signOut) RD.backend.signOut();
    RD.session = null;
    Store.del("session");
    RD.state.needAuth = false;
    RD.emit("session");
  };
  Auth.reconnect = async () => {
    if (RD.demo) return true;
    await RD.Google.reconnect(true);
    RD.state.needAuth = false;
    RD.emit("status");
    await Sync.flush();
    await Sync.pull();
    return true;
  };
})();
