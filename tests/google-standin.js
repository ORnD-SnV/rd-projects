// A stand-in for the Google endpoints the dashboard calls (sign-in, Sheets API, Drive API), for browser tests.
// It follows the documented behaviour of the real endpoints: trimmed trailing cells, grid limits on writes,
// header lookups, resumable uploads. It is not Google itself.
const BASE = process.env.BASE || "http://localhost:8765/";
const SHEET = "sheet-test-id", FOLDER = "folder-root";
const CONFIG = `window.RD_CONFIG = { clientId: "test-client.apps.googleusercontent.com", spreadsheetId: "${SHEET}", driveFolderId: "${FOLDER}", domain: "acme.test", admins: [], appName: "R&D Projects", currency: "LKR", pollSeconds: 3600 };`;

/* ---------------------------------------------------------------- stand-in Google */
function makeGoogle() {
  const g = { tabs: {}, order: [], nextId: 1, drive: {}, driveSeq: 1, calls: [], expireTokens: false, log: [] };
  g.addTab = (title, values, cols) => { g.tabs[title] = { id: g.nextId++, cols: cols || 26, values: values || [] }; g.order.push(title); };
  g.col = (tab, name) => g.tabs[tab].values[0].indexOf(name);
  g.rowsOf = (tab) => { const v = g.tabs[tab].values, hd = v[0]; return v.slice(1).map((r) => { const o = {}; hd.forEach((h, i) => (o[h] = r[i] === undefined ? "" : r[i])); return o; }); };
  const parseRange = (r) => { const m = /^'((?:[^']|'')+)'(?:!([A-Z]+)(\d+))?$/.exec(r) || /^([^!]+)(?:!([A-Z]+)(\d+))?$/.exec(r); if (!m) throw new Error("bad range " + r); let c = 0; (m[2] || "A").split("").forEach((ch) => (c = c * 26 + ch.charCodeAt(0) - 64)); return { tab: m[1].replace(/''/g, "'"), col: c - 1, row: +(m[3] || 1) - 1 }; };
  const trim = (rows) => { const out = rows.map((r) => { const a = (r || []).slice(); while (a.length && (a[a.length - 1] === "" || a[a.length - 1] == null)) a.pop(); return a; }); while (out.length && !out[out.length - 1].length) out.pop(); return out; };
  g.handle = (method, url, body, headers) => {
    const u = new URL(url), p = u.pathname;
    g.calls.push(method + " " + p);
    const auth = headers.authorization || "";
    const json = (status, obj, extra) => ({ status, body: JSON.stringify(obj), headers: Object.assign({ "content-type": "application/json" }, extra || {}) });
    if (g.expireTokens || !/^Bearer tok-/.test(auth)) return json(401, { error: { code: 401, message: "Invalid Credentials", status: "UNAUTHENTICATED" } });
    const who = auth.replace("Bearer tok-", "");
    if (p === "/oauth2/v3/userinfo") return json(200, { email: who + "@acme.test", name: who[0].toUpperCase() + who.slice(1) + " Perera", given_name: who[0].toUpperCase() + who.slice(1), hd: "acme.test" });
    const base = "/v4/spreadsheets/" + SHEET;
    if (p === base && method === "GET") return json(200, { properties: { title: "R&D Projects DB" }, sheets: g.order.map((t) => ({ properties: { sheetId: g.tabs[t].id, title: t, gridProperties: { columnCount: g.tabs[t].cols } } })) });
    if (p === base + ":batchUpdate") {
      for (const r of body.requests) {
        if (r.addSheet) { const pr = r.addSheet.properties; if (g.tabs[pr.title]) return json(400, { error: { message: "A sheet with the name already exists" } }); g.addTab(pr.title, [], (pr.gridProperties && pr.gridProperties.columnCount) || 26); }
        else if (r.appendDimension) { const t = g.order.find((x) => g.tabs[x].id === r.appendDimension.sheetId); g.tabs[t].cols += r.appendDimension.length; }
        else return json(400, { error: { message: "unsupported request in stand-in" } });
      }
      return json(200, { replies: [] });
    }
    if (p === base + "/values:batchGet") {
      const ranges = u.searchParams.getAll("ranges");
      if (u.searchParams.get("valueRenderOption") !== "UNFORMATTED_VALUE") return json(400, { error: { message: "test expects UNFORMATTED_VALUE" } });
      const out = [];
      for (const r of ranges) { const pr = parseRange(r); if (!g.tabs[pr.tab]) return json(400, { error: { message: "Unable to parse range: " + r } }); const values = trim(g.tabs[pr.tab].values); out.push(values.length ? { range: r, majorDimension: "ROWS", values } : { range: r, majorDimension: "ROWS" }); }
      return json(200, { spreadsheetId: SHEET, valueRanges: out });
    }
    if (p === base + "/values:batchUpdate") {
      if (body.valueInputOption !== "RAW") return json(400, { error: { message: "test expects RAW" } });
      for (const d of body.data) {
        const pr = parseRange(d.range), tab = g.tabs[pr.tab];
        if (!tab) return json(400, { error: { message: "Unable to parse range: " + d.range } });
        for (let i = 0; i < d.values.length; i++) for (let j = 0; j < d.values[i].length; j++) {
          if (pr.col + j >= tab.cols) return json(400, { error: { message: `Range (${d.range}) exceeds grid limits. Max columns: ${tab.cols}` } });
          while (tab.values.length <= pr.row + i) tab.values.push([]);
          tab.values[pr.row + i][pr.col + j] = d.values[i][j];
          g.log.push(pr.tab + "!" + (pr.col + j) + "," + (pr.row + i));
        }
      }
      return json(200, { totalUpdatedCells: 1 });
    }
    const ap = new RegExp("^" + base.replace(/\//g, "\\/") + "\\/values\\/(.+):append$").exec(decodeURIComponent(p));
    if (ap && method === "POST") {
      const pr = parseRange(ap[1]), tab = g.tabs[pr.tab];
      if (!tab) return json(400, { error: { message: "Unable to parse range" } });
      const cur = trim(tab.values);
      body.values.forEach((row) => { if (row.length > tab.cols) throw new Error("append wider than grid"); cur.push(row.slice()); });
      tab.values = cur;
      return json(200, { updates: { updatedRows: body.values.length } });
    }
    /* ---- Drive ---- */
    if (p === "/drive/v3/files" && method === "GET") {
      const q = u.searchParams.get("q") || "";
      let files = Object.values(g.drive);
      const par = /'([^']+)' in parents/.exec(q); if (par) files = files.filter((f) => (f.parents || []).includes(par[1]));
      const nm = /name = '((?:[^'\\]|\\.)*)'/.exec(q); if (nm) files = files.filter((f) => f.name === nm[1].replace(/\\(.)/g, "$1"));
      const has = /name contains '((?:[^'\\]|\\.)*)'/.exec(q); if (has) files = files.filter((f) => f.name.toLowerCase().includes(has[1].toLowerCase()));
      if (/mimeType = 'application\/vnd.google-apps.folder'/.test(q)) files = files.filter((f) => f.mimeType === "application/vnd.google-apps.folder");
      if (/mimeType != 'application\/vnd.google-apps.folder'/.test(q)) files = files.filter((f) => f.mimeType !== "application/vnd.google-apps.folder" && f.owner === who);
      return json(200, { files });
    }
    if (p === "/drive/v3/files" && method === "POST") { const id = "drv" + g.driveSeq++; g.drive[id] = Object.assign({ id, owner: who }, body); return json(200, { id }); }
    if (p === "/upload/drive/v3/files" && method === "POST") {
      if (!g.drive[body.parents[0]] && body.parents[0] !== FOLDER) return json(404, { error: { message: "File not found: " + body.parents[0] } });
      const id = "drv" + g.driveSeq++; g.drive[id] = Object.assign({ id, owner: who, pending: true, mimeType: headers["x-upload-content-type"] }, body);
      return { status: 200, body: "", headers: { location: "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=" + id } };
    }
    if (p === "/upload/drive/v3/files" && method === "PUT") { const f = g.drive[u.searchParams.get("upload_id")]; f.pending = false; f.bytes = body; f.size = String(body.length); return json(200, { id: f.id, name: f.name, size: f.size, mimeType: f.mimeType, webViewLink: "https://drive.google.com/file/d/" + f.id + "/view" }); }
    const cp = /^\/drive\/v3\/files\/([^/]+)\/copy$/.exec(p);
    if (cp) { const src = g.drive[cp[1]]; const id = "drv" + g.driveSeq++; g.drive[id] = Object.assign({}, src, { id, parents: body.parents, name: body.name, owner: who }); return json(200, { id, name: body.name, size: src.size, mimeType: src.mimeType, webViewLink: "https://drive.google.com/file/d/" + id + "/view" }); }
    const pm = /^\/drive\/v3\/files\/([^/]+)\/permissions$/.exec(p);
    if (pm) { g.drive[pm[1]].shared = body; return json(200, { id: "perm1" }); }
    const media = /^\/drive\/v3\/files\/([^/]+)$/.exec(p);
    if (media && u.searchParams.get("alt") === "media") { const f = g.drive[media[1]]; return f ? { status: 200, body: f.bytes, headers: { "content-type": f.mimeType || "application/octet-stream" } } : json(404, { error: { message: "not found" } }); }
    return json(404, { error: { message: "stand-in has no route for " + method + " " + p } });
  };
  return g;
}
const GIS = `window.google = { accounts: { oauth2: {
  initTokenClient: function (cfg) { window.__gisCfg = cfg; return { requestAccessToken: function (o) { window.__gisPrompts = (window.__gisPrompts || []).concat([o && o.prompt]); setTimeout(function () { if (window.__gisFail) cfg.error_callback({ type: "popup_closed" }); else cfg.callback({ access_token: "tok-" + (localStorage.getItem("who") || "nimal"), expires_in: 3600 }); }, 15); } }; },
  revoke: function (t, cb) { cb && cb(); } } } };`;
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,PUT,OPTIONS", "access-control-expose-headers": "Location" };

async function open(browser, g, who) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
  await ctx.addInitScript((w) => { try { if (!localStorage.getItem("who")) localStorage.setItem("who", w); } catch (e) {} }, who);
  await ctx.route("**/config.js", (r) => r.fulfill({ contentType: "application/javascript", body: CONFIG }));
  await ctx.route("https://accounts.google.com/gsi/client", (r) => r.fulfill({ contentType: "application/javascript", body: GIS }));
  const api = async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    let body = req.postDataBuffer();
    const ct = (req.headers()["content-type"] || "");
    if (body && /json/.test(ct)) body = JSON.parse(body.toString("utf8"));
    let res;
    try { res = g.handle(req.method(), req.url(), body, req.headers()); } catch (e) { res = { status: 500, body: JSON.stringify({ error: { message: "stand-in crashed: " + e.message } }), headers: { "content-type": "application/json" } }; hooks.fail("stand-in crashed: " + e.message); }
    await route.fulfill({ status: res.status, body: res.body, headers: Object.assign({}, CORS, res.headers) });
  };
  await ctx.route("https://sheets.googleapis.com/**", api);
  await ctx.route("https://www.googleapis.com/**", api);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => hooks.fail("page error: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) hooks.fail("console error: " + m.text().slice(0, 300)); });
  await page.goto(BASE);
  await page.waitForSelector("#login-google");
  return { ctx, page };
}
const hooks = { fail: (m) => console.log("  FAIL " + m) };
module.exports = { makeGoogle, open, hooks, SHEET, FOLDER, BASE };
