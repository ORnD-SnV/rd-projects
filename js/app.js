/* app.js — start-up, sign-in screen, app frame, navigation */
(function () {
  "use strict";
  const RD = window.RD, U = RD.U, h = RD.h, icon = RD.icon, Sync = RD.Sync, Store = RD.Store, Auth = RD.Auth, CFG = RD.config;
  const app = document.getElementById("app");
  const NAV = [
    { id: "overview", label: "Overview", icon: "grid", show: () => true },
    { id: "projects", label: "Projects", icon: "list", show: () => true },
    { id: "time", label: "Time", icon: "clock", show: () => RD.role() !== "guest" },
    { id: "costings", label: "Costings", icon: "coins", show: () => RD.seesMoney() },
    { id: "files", label: "Files", icon: "file", show: () => true },
    { id: "team", label: "Team", icon: "users", show: () => RD.role() !== "guest" },
    { id: "settings", label: "Settings", icon: "gear", show: () => true }
  ];
  const TITLES = { overview: "Overview", projects: "Projects", project: "Projects", time: "Time", costings: "Costings", files: "Files", team: "Team", settings: "Settings" };
  const parseRoute = (r) => { r = String(r || "").replace(/^#/, ""); if (r.indexOf("project-") === 0) return ["project", r.slice(8)]; return [RD.Views[r] ? r : "overview", null]; };
  RD.route = (location.hash || "").replace(/^#/, "") || "overview";

  /* ---------------------------------------------------------------- theme (hosted app only; the Claude preview follows its own viewer) */
  function applyTheme() { let t = null; try { t = localStorage.getItem("rd_theme"); } catch (e) {} if (RD.preview) return; if (t === "dark" || t === "light") document.documentElement.setAttribute("data-theme", t); else document.documentElement.removeAttribute("data-theme"); }
  function cycleTheme() { let t = null; try { t = localStorage.getItem("rd_theme"); } catch (e) {} const next = t === "dark" ? "light" : t === "light" ? "" : "dark"; try { next ? localStorage.setItem("rd_theme", next) : localStorage.removeItem("rd_theme"); } catch (e) {} applyTheme(); RD.toast(next ? "Theme: " + next : "Theme: follows your device"); }

  /* ---------------------------------------------------------------- sign-in screen */
  function mark() { return h("div", { class: "mark", "aria-hidden": "true" }, h("span", null, "R"), h("span", { class: "amp" }, "&"), h("span", null, "D")); }
  function renderLogin() {
    document.title = CFG.appName;
    const err = h("div", { class: "form-error", role: "alert", hidden: true });
    const card = h("div", { class: "login-card" }, h("div", { class: "login-brand" }, mark(), h("div", null, h("h1", null, CFG.appName), h("p", { class: "muted" }, CFG.orgName || "Projects, hours, costings and design files in one place"))));
    if (RD.demo) {
      const users = (Store.get("demo_remote") || {}).Users || [];
      const admin = users.find((u) => u.role === "admin"), guest = users.find((u) => u.role === "guest"), engs = users.filter((u) => u.role === "engineer");
      const go = (id) => Auth.signIn(id).catch((e) => { err.textContent = e.message; err.hidden = false; });
      const sel = h("select", { id: "login-engineer", class: "inp", "aria-label": "Which engineer" }, engs.map((u) => h("option", { value: u.id }, u.name)));
      const pref = Store.get("demoEngineer"); if (pref && engs.some((u) => u.id === pref)) sel.value = pref;
      card.appendChild(h("div", { class: "login-note" }, RD.preview ? "Preview: choose a role to see what each kind of user gets. Nothing leaves this browser." : "Demo mode: no Google account needed. Choose a role to try the dashboard. Data stays in this browser."));
      card.appendChild(h("div", { class: "role-cards" },
        admin ? h("button", { type: "button", class: "role-card", id: "login-admin", onclick: () => go(admin.id) }, h("b", null, "Supervisor"), h("span", null, "Sees and edits everything, manages people and roles"), h("span", { class: "role-go" }, "Sign in as " + admin.name)) : null,
        engs.length ? h("div", { class: "role-card" }, h("b", null, "Engineer"), h("span", null, "Own projects, time tracking, costings, file uploads"), sel, RD.btn("Sign in as engineer", { kind: "primary", small: true, id: "login-engineer-go", onclick: () => { Store.set("demoEngineer", sel.value); go(sel.value); } })) : null,
        guest ? h("button", { type: "button", class: "role-card", id: "login-guest", onclick: () => go(guest.id) }, h("b", null, "Guest"), h("span", null, "Other departments: view-only, no finance figures"), h("span", { class: "role-go" }, "Sign in as " + guest.name)) : null));
    } else {
      const b = RD.btn("Sign in with Google", { kind: "primary", id: "login-google", onclick: async () => { b.disabled = true; err.hidden = true; try { await Auth.signIn(); } catch (e) { err.textContent = e.message || "Sign-in failed."; err.hidden = false; } b.disabled = false; } });
      card.appendChild(h("div", { class: "login-google" }, b, h("p", { class: "muted small" }, CFG.domain ? "Use your @" + CFG.domain + " account. Your role is set by the R&D supervisor." : "Use your company Google account.")));
      if (!RD.online()) card.appendChild(h("div", { class: "note note-warn" }, icon("cloudoff"), "You are offline. Signing in needs a connection; after that the dashboard also works offline."));
    }
    card.appendChild(err);
    app.textContent = "";
    app.appendChild(h("div", { class: "login" }, card));
  }

  /* ---------------------------------------------------------------- app frame */
  let viewRoot, dirty = false, topRight, banners, navEls = [], titleEl, pointerDown = false;
  document.addEventListener("pointerdown", () => (pointerDown = true), true);
  ["pointerup", "pointercancel"].forEach((ev) => document.addEventListener(ev, () => setTimeout(() => (pointerDown = false), 0), true));
  function syncPill() {
    const st = RD.state, n = st.queue.length + st.uploads.length, online = RD.online();
    let label, tone = "ok", ic = "check";
    if (!online) { label = n ? "Offline · " + n + " waiting" : "Offline"; tone = "warn"; ic = "cloudoff"; }
    else if (st.needAuth) { label = n ? "Reconnect · " + n + " waiting" : "Reconnect"; tone = "warn"; ic = "alert"; }
    else if (st.busy) { label = n ? "Sending " + n + "…" : "Syncing…"; tone = "busy"; ic = "refresh"; }
    else if (st.error) { label = "Sync problem"; tone = "bad"; ic = "alert"; }
    else if (n) { label = n + " to send"; tone = "busy"; ic = "cloud"; }
    else { label = st.lastSync ? "Saved · " + U.hhmm(new Date(st.lastSync)) : "Saved"; }
    return h("button", { type: "button", id: "sync-pill", class: "sync-pill tone-" + tone, onclick: () => RD.syncPanel(), title: "Sync details" }, icon(ic), h("span", null, label));
  }
  function drawTop() {
    if (!topRight) return;
    topRight.textContent = "";
    const t = RD.myTimer();
    if (t) topRight.appendChild(h("div", { class: "timer-chip" }, h("span", { class: "live-dot" }), h("span", { class: "tnum", "data-since": t.started_at, "data-format": "clock" }, U.clock(Date.now() - new Date(t.started_at).getTime())), h("span", { class: "chip-proj clip" }, t.project_name), h("button", { type: "button", class: "icon-btn sm", "aria-label": "Stop timer and log the time", title: "Stop and log", onclick: () => RD.stopTimer() }, icon("stop"))));
    topRight.appendChild(syncPill());
    banners.textContent = "";
    const st = RD.state, n = st.queue.length + st.uploads.length;
    const note = (tone, ic, text, action) => banners.appendChild(h("div", { class: "banner banner-" + tone }, icon(ic), h("span", null, text), action || null));
    if (!RD.online()) note("warn", "cloudoff", "You are offline. Keep working: changes are saved on this device and sent when you reconnect." + (n ? " " + n + " waiting." : ""));
    else if (st.needAuth) note("warn", "alert", "Your Google sign-in has expired. Changes are safe on this device.", (() => { const b = RD.btn("Reconnect", { small: true, id: "btn-reconnect", onclick: () => Auth.reconnect().catch((e) => RD.toast(e.message, "bad")) }); b.setAttribute("data-reconnect", ""); return b; })());
    else if (st.error) note("bad", "alert", st.error, RD.btn("Try again", { small: true, onclick: () => Sync.flush().then(() => Sync.pull()) }));
    if (!RD.demo && RD.isAdmin() && ((st.info.missingTabs || []).length)) note("warn", "alert", "The Google Sheet is missing some tabs the dashboard needs.", RD.btn("Open Settings", { small: true, onclick: () => RD.go("settings") }));
    if (RD.demo && !Store.get("hideDemoBanner")) note("info", "note",
      RD.preview ? (RD.Demo.hasSamples() ? "Preview. The project list comes from your own sheet. Time logs, costings and files are sample entries so the screens are not empty." : "Preview. The project list comes from your own sheet. Everything you add stays in this browser.")
        : "Demo mode with sample data, kept in this browser only. Connect your Google Sheet in config.js to go live.",
      h("span", { class: "banner-actions" }, RD.preview && RD.Demo.hasSamples() && RD.isAdmin() ? RD.btn("Remove sample entries", { small: true, onclick: () => RD.removeSamples() }) : null, h("button", { type: "button", class: "icon-btn sm", "aria-label": "Hide this note", onclick: () => { Store.set("hideDemoBanner", true); drawTop(); } }, icon("x"))));
  }
  function renderShell() {
    const items = NAV.filter((n) => n.show());
    navEls = [];
    const navBtn = (n) => { const b = h("button", { type: "button", class: "nav-item", "data-nav": n.id, onclick: () => RD.go(n.id) }, icon(n.icon), h("span", null, n.label)); navEls.push(b); return b; };
    const rail = h("aside", { class: "rail" },
      h("div", { class: "rail-brand" }, mark(), h("div", { class: "rail-name" }, h("b", null, CFG.appName), CFG.orgName ? h("span", null, CFG.orgName) : null)),
      h("nav", { class: "rail-nav", "aria-label": "Main" }, items.map(navBtn)),
      h("div", { class: "rail-foot" },
        h("div", { class: "me" }, h("span", { class: "avatar" }, RD.initials(RD.session.fullName || RD.session.name)), h("div", { class: "me-text" }, h("b", { class: "clip" }, RD.session.name), h("span", { class: "role-tag role-" + RD.role() }, RD.ROLES[RD.role()]))),
        h("div", { class: "rail-btns" }, RD.preview ? null : h("button", { type: "button", class: "icon-btn", "aria-label": "Switch light or dark theme", title: "Light / dark", onclick: cycleTheme }, icon("sun")), h("button", { type: "button", class: "icon-btn", id: "btn-signout", "aria-label": "Sign out", title: "Sign out", onclick: () => RD.signOutFlow() }, icon("logout")))));
    titleEl = h("h1", { class: "top-title" });
    topRight = h("div", { class: "top-right" });
    banners = h("div", { class: "banners" });
    viewRoot = h("main", { id: "view", class: "view" });
    // Wait until any click in progress has finished, so a refresh never swallows the click.
    viewRoot.addEventListener("focusout", () => { const later = () => { if (pointerDown) return setTimeout(later, 120); if (dirty) softRender(); }; setTimeout(later, 180); });
    app.textContent = "";
    app.appendChild(h("div", { class: "shell" }, rail, h("div", { class: "main" }, h("header", { class: "top" }, titleEl, topRight), banners, viewRoot)));
    drawTop();
    RD.renderView();
  }
  RD.renderView = () => {
    if (!RD.session || !viewRoot) return;
    dirty = false;
    RD.hideTip && RD.hideTip();
    const y = window.scrollY;
    const [name, param] = parseRoute(RD.route);
    const nav = NAV.find((n) => n.id === name);
    const allowed = !nav || nav.show();
    viewRoot.textContent = "";
    viewRoot.className = "view view-" + name;
    const p = name === "project" ? RD.byId("Projects", param) : null;
    titleEl.textContent = TITLES[name] || "";
    document.title = (p ? p.name : TITLES[name]) + " · " + CFG.appName;
    navEls.forEach((b) => { const on = b.getAttribute("data-nav") === (name === "project" ? "projects" : name); b.classList.toggle("on", on); if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
    if (!RD.state.loaded && !RD.rows("Projects").length) viewRoot.appendChild(h("div", { class: "empty" }, RD.online() ? "Loading the project sheet…" : "You are offline and this device has no saved copy yet. Connect once to load the projects."));
    else if (!allowed) viewRoot.appendChild(h("div", { class: "empty" }, "This page is not available for your role."));
    else RD.Views[name](viewRoot, param);
    if (y) window.scrollTo(0, y);
  };
  /* Re-draw after data changed, but never while someone is typing or a dialog is open. */
  function softRender() {
    if (!RD.session || !viewRoot) return;
    const a = document.activeElement;
    if (RD.modals > 0 || (a && viewRoot.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== "checkbox")) { dirty = true; return; }
    RD.renderView();
  }
  RD.signOutFlow = async () => {
    const n = RD.state.queue.length + RD.state.uploads.length;
    if (n && !(await RD.confirm("Sign out", n + " change(s) have not been sent yet. They stay saved on this device and are sent the next time someone signs in here. Sign out anyway?", "Sign out"))) return;
    Auth.signOut();
  };
  function renderApp() { applyTheme(); if (RD.session) renderShell(); else { viewRoot = null; topRight = null; renderLogin(); } }

  /* ---------------------------------------------------------------- wiring */
  let lastRole = null;
  RD.on("session", () => { const r = RD.session ? RD.session.email + RD.session.role + RD.session.name : null; if (r !== lastRole) { lastRole = r; renderApp(); } });
  RD.on("change", () => { drawTop(); softRender(); });
  RD.on("status", drawTop);
  RD.on("modalsClosed", () => { if (dirty) softRender(); });
  RD.on("upload", U.debounce(() => { drawTop(); const [name] = parseRoute(RD.route); if (name === "files" || name === "project") softRender(); }, 250));
  window.addEventListener("hashchange", () => { const r = (location.hash || "").replace(/^#/, "") || "overview"; if (r !== RD.route) { RD.route = r; RD.renderView(); } });
  setInterval(() => {
    document.querySelectorAll("[data-since]").forEach((el) => { const ms = Date.now() - new Date(el.getAttribute("data-since")).getTime(); el.textContent = el.getAttribute("data-format") === "clock" ? U.clock(ms) : "running " + U.clock(ms).slice(0, 5); });
  }, 500);

  /* Google sign-in lasts about an hour. While someone is using the dashboard, renew it quietly on a click
     shortly before it runs out (a click is needed: browsers only let Google's window open during one). */
  let renewing = false;
  document.addEventListener("click", (e) => {
    if (RD.demo || !RD.session || renewing || !RD.online() || (e.target.closest && e.target.closest("[data-reconnect]"))) return;
    if (RD.Google.tokenExp - Date.now() > 10 * 60 * 1000) return;
    renewing = true;
    RD.Google.reconnect(false).then(() => { RD.state.needAuth = false; RD.emit("status"); return Sync.flush().then(() => Sync.pull()); }).catch(() => {}).then(() => setTimeout(() => (renewing = false), 30000));
  }, true);

  async function boot() {
    await Store.init();
    await RD.backend.init();
    Sync.load();
    Auth.restore();
    lastRole = RD.session ? RD.session.email + RD.session.role + RD.session.name : null;
    renderApp();
    Sync.start();
    if (RD.session) {
      if (!RD.demo && !RD.Google.ready()) {
        RD.state.needAuth = true; drawTop();
        if (RD.online()) RD.Google.reconnect(false).then(() => { RD.state.needAuth = false; return Sync.flush().then(() => Sync.pull()); }).catch(() => drawTop());
      } else Sync.flush().then(() => Sync.pull());
    }
    if (!RD.preview && "serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  }
  boot();
})();
