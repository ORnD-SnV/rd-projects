/* core.js — config, small utilities, local storage (IndexedDB), schema and permissions */
(function () {
  "use strict";
  const RD = (window.RD = window.RD || {});

  /* ------------------------------------------------------------------ config */
  const CFG = (RD.config = Object.assign(
    { clientId: "", spreadsheetId: "", driveFolderId: "", domain: "", admins: [], appName: "R&D Projects", orgName: "", currency: "LKR", pollSeconds: 45 },
    window.RD_CONFIG || {}
  ));
  CFG.admins = (CFG.admins || []).map((e) => String(e).trim().toLowerCase());
  RD.preview = !!window.RD_PREVIEW; // true inside the Claude preview page
  RD.demo = !CFG.clientId || !CFG.spreadsheetId;

  /* ------------------------------------------------------------------ events */
  const listeners = {};
  RD.on = (ev, fn) => ((listeners[ev] = listeners[ev] || []).push(fn), fn);
  RD.off = (ev, fn) => { listeners[ev] = (listeners[ev] || []).filter((f) => f !== fn); };
  RD.emit = (ev, data) => (listeners[ev] || []).forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } });

  /* ------------------------------------------------------------------ utils */
  const U = (RD.U = {});
  U.uid = (prefix) => {
    const a = new Uint8Array(6);
    (window.crypto || window.msCrypto).getRandomValues(a);
    let s = "";
    for (const b of a) s += (b % 36).toString(36);
    return prefix + "_" + s + Date.now().toString(36).slice(-2);
  };
  U.pad = (n) => String(n).padStart(2, "0");
  U.isoDate = (d) => d.getFullYear() + "-" + U.pad(d.getMonth() + 1) + "-" + U.pad(d.getDate());
  U.today = () => U.isoDate(new Date());
  U.nowIso = () => new Date().toISOString();
  U.hhmm = (d) => U.pad(d.getHours()) + ":" + U.pad(d.getMinutes());
  U.parseDate = (s) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ""));
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  };
  U.addDays = (iso, n) => { const d = U.parseDate(iso) || new Date(); d.setDate(d.getDate() + n); return U.isoDate(d); };
  U.weekStart = (iso) => { const d = U.parseDate(iso) || new Date(); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return U.isoDate(d); };
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  U.fmtDate = (iso, withYear) => {
    const d = U.parseDate(iso);
    if (!d) return iso ? String(iso) : "—";
    const y = d.getFullYear();
    return d.getDate() + " " + MONTHS[d.getMonth()] + (withYear === false ? "" : " " + y);
  };
  U.fmtDateTime = (isoTs) => {
    const d = new Date(isoTs);
    if (isNaN(d)) return "";
    return d.getDate() + " " + MONTHS[d.getMonth()] + ", " + U.hhmm(d);
  };
  U.ago = (isoTs) => {
    const t = new Date(isoTs).getTime();
    if (isNaN(t)) return "";
    const s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s / 60) + " min ago";
    if (s < 86400) return Math.floor(s / 3600) + " h ago";
    if (s < 86400 * 7) return Math.floor(s / 86400) + " d ago";
    return U.fmtDate(U.isoDate(new Date(t)));
  };
  U.num = (v) => { const n = typeof v === "number" ? v : parseFloat(String(v == null ? "" : v).replace(/,/g, "")); return isFinite(n) ? n : 0; };
  U.hasNum = (v) => v !== "" && v != null && isFinite(typeof v === "number" ? v : parseFloat(String(v).replace(/,/g, "")));
  U.fmtInt = (n) => Math.round(U.num(n)).toLocaleString("en-US");
  U.fmtHours = (h) => { const n = U.num(h); return (Math.round(n * 10) / 10).toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 1 : 0, maximumFractionDigits: 1 }) + " h"; };
  // Money the way Sri Lankan finance sheets write it: Mn / Bn
  U.fmtMoney = (v, compact) => {
    if (!U.hasNum(v)) return "—";
    const n = U.num(v), a = Math.abs(n);
    if (compact !== false) {
      if (a >= 1e9) return (n / 1e9).toFixed(a >= 1e10 ? 1 : 2) + " Bn";
      if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e8 ? 0 : 1) + " Mn";
      if (a >= 1e5) return Math.round(n / 1e3).toLocaleString("en-US") + " K";
    }
    return n.toLocaleString("en-US", { maximumFractionDigits: n % 1 ? 2 : 0 });
  };
  U.fmtSize = (b) => { const n = U.num(b); if (!n) return ""; if (n > 1e9) return (n / 1e9).toFixed(1) + " GB"; if (n > 1e6) return (n / 1e6).toFixed(1) + " MB"; if (n > 1e3) return Math.round(n / 1e3) + " KB"; return n + " B"; };
  U.durFromTimes = (start, end) => {
    const a = /^(\d{1,2}):(\d{2})/.exec(start || ""), b = /^(\d{1,2}):(\d{2})/.exec(end || "");
    if (!a || !b) return 0;
    let m = +b[1] * 60 + +b[2] - (+a[1] * 60 + +a[2]);
    if (m < 0) m += 24 * 60;
    return Math.round((m / 60) * 100) / 100;
  };
  U.clock = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return U.pad(Math.floor(s / 3600)) + ":" + U.pad(Math.floor((s % 3600) / 60)) + ":" + U.pad(s % 60); };
  U.splitNames = (s) => String(s || "").split(/\s*[\/,&]\s*/).map((x) => x.trim()).filter(Boolean);
  U.same = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
  U.ext = (name) => { const m = /\.([a-z0-9_]+)$/i.exec(name || ""); return m ? m[1].toLowerCase() : ""; };
  U.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  U.clone = (o) => JSON.parse(JSON.stringify(o));
  U.csv = (rows) => rows.map((r) => r.map((c) => { const s = c == null ? "" : String(c); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(",")).join("\r\n");

  /* ------------------------------------------------------------------ local store
     Small key/value store in IndexedDB with an in-memory mirror, so reads are
     synchronous and the app still runs (without persistence) where IndexedDB
     is blocked. Blobs (files waiting to upload) live in their own object store. */
  const Store = (RD.Store = { mem: new Map(), db: null, ok: false });
  const DB_NAME = "rd-projects-" + (RD.demo ? (RD.preview ? "preview" : "demo") : String(CFG.spreadsheetId).slice(0, 16));
  Store.init = () =>
    new Promise((resolve) => {
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      try {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => { req.result.createObjectStore("kv"); req.result.createObjectStore("blobs"); };
        req.onerror = finish;
        req.onblocked = finish;
        req.onsuccess = () => {
          Store.db = req.result;
          try {
            const tx = Store.db.transaction("kv", "readonly");
            const cur = tx.objectStore("kv").openCursor();
            cur.onsuccess = () => { const c = cur.result; if (c) { Store.mem.set(c.key, c.value); c.continue(); } };
            tx.oncomplete = () => { Store.ok = true; finish(); };
            tx.onerror = finish;
          } catch (e) { finish(); }
        };
        setTimeout(finish, 2500);
      } catch (e) { finish(); }
    });
  Store.get = (k, fallback) => (Store.mem.has(k) ? Store.mem.get(k) : fallback);
  Store.set = (k, v) => {
    Store.mem.set(k, v);
    if (!Store.db) return;
    try { Store.db.transaction("kv", "readwrite").objectStore("kv").put(v, k); } catch (e) { /* storage full or blocked: keep running from memory */ }
  };
  Store.del = (k) => { Store.mem.delete(k); if (Store.db) try { Store.db.transaction("kv", "readwrite").objectStore("kv").delete(k); } catch (e) {} };
  const memBlobs = new Map();
  Store.blobPut = (k, blob) => new Promise((res) => {
    memBlobs.set(k, blob);
    if (!Store.db) return res();
    try { const tx = Store.db.transaction("blobs", "readwrite"); tx.objectStore("blobs").put(blob, k); tx.oncomplete = () => { memBlobs.delete(k); res(); }; tx.onerror = () => res(); } catch (e) { res(); }
  });
  Store.blobGet = (k) => new Promise((res) => {
    if (memBlobs.has(k)) return res(memBlobs.get(k));
    if (!Store.db) return res(null);
    try { const rq = Store.db.transaction("blobs", "readonly").objectStore("blobs").get(k); rq.onsuccess = () => res(rq.result || null); rq.onerror = () => res(null); } catch (e) { res(null); }
  });
  Store.blobDel = (k) => { memBlobs.delete(k); if (Store.db) try { Store.db.transaction("blobs", "readwrite").objectStore("blobs").delete(k); } catch (e) {} };

  /* ------------------------------------------------------------------ schema
     One tab per table in the Google Sheet. Row 1 holds these column names.
     Extra columns added by people are preserved; column order does not matter. */
  const AUDIT = ["created_at", "created_by", "updated_at", "updated_by", "deleted"];
  RD.TABLES = {
    Projects: ["id", "job_no", "name", "portfolio", "category", "project_type", "pillar", "engineer", "status", "current_status", "end_date", "requested_date", "skus", "bip_value", "budget_dev", "budget_tool", "budget_cert", "saving_pct", "saving_per_item", "monthly_demand", "responsible_dept", "npd", "remarks", "drive_folder_id"].concat(AUDIT),
    TimeLogs: ["id", "project_id", "project_name", "engineer", "engineer_email", "date", "start", "end", "hours", "activity", "note", "started_at"].concat(AUDIT),
    Costings: ["id", "project_id", "project_name", "date", "type", "title", "amount", "supplier", "reference", "status", "prepared_by", "file_id", "note"].concat(AUDIT),
    Files: ["id", "project_id", "project_name", "name", "kind", "mime", "size", "drive_id", "url", "uploaded_by", "note"].concat(AUDIT),
    Updates: ["id", "project_id", "project_name", "date", "by", "status", "text"].concat(AUDIT),
    Users: ["id", "name", "full_name", "role", "pillar", "active"].concat(AUDIT),
    Settings: ["id", "value", "updated_at", "updated_by"]
  };
  RD.TABLE_NAMES = Object.keys(RD.TABLES);
  RD.COLTYPE = {
    end_date: "date", requested_date: "date", date: "date", start: "time", end: "time",
    skus: "num", bip_value: "num", budget_dev: "num", budget_tool: "num", budget_cert: "num", saving_per_item: "num", monthly_demand: "num", hours: "num", amount: "num", size: "num"
  };

  RD.PORTFOLIOS = ["Revenue Generation", "Cost Reduction", "Factory Expansion", "Blue Sky", "Customer Satisfaction", "Improvements", "NPD"];
  RD.STATUSES = ["On Track", "At Risk", "On Hold", "Incomplete", "Completed", "TBC"];
  RD.STATUS_KEY = { "Completed": "done", "On Track": "ok", "At Risk": "risk", "Incomplete": "bad", "On Hold": "hold", "TBC": "tbc", "": "none" };
  RD.STATUS_ORDER = ["Completed", "On Track", "At Risk", "Incomplete", "On Hold", "TBC", ""];
  RD.statusLabel = (s) => s || "Not set";
  RD.isOpen = (p) => p.status !== "Completed";
  RD.isOverdue = (p) => RD.isOpen(p) && p.status !== "On Hold" && !!U.parseDate(p.end_date) && p.end_date < U.today();
  RD.ACTIVITIES = ["Design / CAD", "Prototyping & samples", "Testing", "Costing", "Sourcing & suppliers", "Documentation", "Tooling follow-up", "Meetings", "Other"];
  RD.COST_TYPES = ["Development cost", "Tool investment", "Certification", "Product costing", "Other"];
  RD.COST_BUDGET = { "Development cost": "budget_dev", "Tool investment": "budget_tool", "Certification": "budget_cert" };
  RD.COST_STATUSES = ["Draft", "Submitted to Finance", "Approved"];
  RD.FILE_KINDS = ["CAD", "Render", "Document", "Costing", "Other"];
  RD.ROLES = { admin: "Supervisor", engineer: "Engineer", guest: "Guest" };
  const CAD_EXT = ["sldprt", "sldasm", "slddrw", "step", "stp", "iges", "igs", "x_t", "x_b", "dxf", "dwg", "stl", "3mf", "easm", "eprt", "edrw", "ipt", "iam", "f3d", "obj"];
  const IMG_EXT = ["png", "jpg", "jpeg", "webp", "gif", "bmp", "tif", "tiff", "svg"];
  RD.guessKind = (name) => { const e = U.ext(name); if (CAD_EXT.includes(e)) return "CAD"; if (IMG_EXT.includes(e)) return "Render"; if (["xls", "xlsx", "csv"].includes(e)) return "Costing"; if (["pdf", "doc", "docx", "ppt", "pptx", "txt", "md"].includes(e)) return "Document"; return "Other"; };
  RD.isImage = (f) => /^image\//.test(f.mime || "") || IMG_EXT.includes(U.ext(f.name));

  /* ------------------------------------------------------------------ permissions */
  RD.session = null; // { email, name, fullName, picture, role }
  RD.role = () => (RD.session ? RD.session.role : "guest");
  RD.isAdmin = () => RD.role() === "admin";
  RD.canEdit = () => RD.role() === "admin" || RD.role() === "engineer";
  RD.mine = (name) => !!RD.session && U.splitNames(name).some((n) => U.same(n, RD.session.name));
  RD.setting = (key, fallback) => { const r = (RD.state.tables.Settings || []).find((x) => x.id === key); return r ? r.value : fallback; };
  RD.seesMoney = () => RD.role() !== "guest" || String(RD.setting("guest_sees_finance", "no")).toLowerCase() === "yes";
  /* can(action, row) — action: project.add | project.edit | project.delete | entry.add | entry.edit (time, costing, file, update rows) | users | settings */
  RD.can = (action, row) => {
    const role = RD.role();
    if (role === "admin") return true;
    if (role !== "engineer") return false;
    switch (action) {
      case "project.add": return true;
      case "project.edit": return !!row && (RD.mine(row.engineer) || U.same(row.created_by, RD.session.email));
      case "entry.add": return true;
      case "entry.edit": return !!row && (U.same(row.created_by, RD.session.email) || U.same(row.engineer_email, RD.session.email));
      default: return false;
    }
  };
})();
