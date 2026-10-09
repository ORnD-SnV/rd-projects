/* views-main.js — Overview, Projects list, Project page */
(function () {
  "use strict";
  const RD = window.RD, U = RD.U, h = RD.h, icon = RD.icon, Sync = RD.Sync, C = RD.Chart;
  const V = (RD.Views = {});
  const vs = (RD.vstate = {
    overview: { portfolio: "", engineer: "", period: "4w" },
    projects: { q: "", portfolio: "", status: "", engineer: "", category: "", mine: false },
    time: { period: "week", engineer: "", project: "" },
    costings: { q: "", type: "", status: "", project: "" },
    files: { q: "", kind: "", project: "" },
    ptab: "updates"
  });

  /* ---------------------------------------------------------------- shared helpers */
  RD.PERIODS = [{ value: "week", label: "This week" }, { value: "lastweek", label: "Last week" }, { value: "4w", label: "Last 4 weeks" }, { value: "month", label: "This month" }, { value: "year", label: "This year" }, { value: "all", label: "All time" }];
  RD.periodRange = (key) => {
    const t = U.today();
    if (key === "week") return [U.weekStart(t), t];
    if (key === "lastweek") { const s = U.addDays(U.weekStart(t), -7); return [s, U.addDays(s, 6)]; }
    if (key === "4w") return [U.addDays(U.weekStart(t), -21), t];
    if (key === "month") return [t.slice(0, 8) + "01", t];
    if (key === "year") return [t.slice(0, 4) + "-01-01", t];
    return ["", "9999-12-31"];
  };
  RD.periodLabel = (key) => (RD.PERIODS.find((p) => p.value === key) || {}).label || "";
  RD.engineerNames = () => {
    const set = new Map();
    RD.rows("Projects").forEach((p) => U.splitNames(p.engineer).forEach((n) => set.set(n.toLowerCase(), n)));
    RD.rows("Users").forEach((u) => { if (u.role !== "guest" && u.name) set.set(String(u.name).toLowerCase(), u.name); });
    RD.rows("TimeLogs").forEach((l) => { if (l.engineer) set.set(String(l.engineer).toLowerCase(), l.engineer); });
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b));
  };
  RD.uniq = (table, col) => Array.from(new Set(RD.rows(table).map((r) => String(r[col] || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  RD.hoursByProject = () => { const m = {}; RD.rows("TimeLogs").forEach((l) => (m[l.project_id] = (m[l.project_id] || 0) + U.num(l.hours))); return m; };
  RD.isRunning = (l) => !!l.started_at && !l.end && !U.hasNum(l.hours);
  RD.go = (route) => { RD.route = route; try { if (location.hash !== "#" + route) location.hash = route; } catch (e) {} RD.renderView(); try { window.scrollTo(0, 0); } catch (e) {} };
  const optAll = (label, list) => [{ value: "", label }].concat(list.map((x) => ({ value: x, label: x })));
  const filterBar = (...kids) => h("div", { class: "filters" }, kids);
  const lateBy = (p) => { const d = U.parseDate(p.end_date); return d ? Math.round((U.parseDate(U.today()) - d) / 86400000) : 0; };
  const dateCell = (p) => {
    if (!p.end_date) return null;
    return h("span", { class: RD.isOverdue(p) ? "late" : null, title: RD.isOverdue(p) ? lateBy(p) + " days past the end date" : null }, U.fmtDate(p.end_date), RD.isOverdue(p) ? h("span", { class: "late-tag" }, lateBy(p) + " d late") : null);
  };

  /* ================================================================ OVERVIEW */
  V.overview = (root) => {
    const s = vs.overview;
    const money = RD.seesMoney();
    const body = h("div", { class: "stack-v" });
    const draw = () => {
      body.textContent = "";
      const all = RD.rows("Projects");
      const projects = all.filter((p) => (!s.portfolio || p.portfolio === s.portfolio) && (!s.engineer || U.splitNames(p.engineer).some((n) => U.same(n, s.engineer))));
      const inPortfolio = new Set(all.filter((p) => !s.portfolio || p.portfolio === s.portfolio).map((p) => p.id));
      const byId = {}; all.forEach((p) => (byId[p.id] = p));
      const logs = RD.rows("TimeLogs").filter((l) => (!s.engineer || U.same(l.engineer, s.engineer)) && (!s.portfolio || inPortfolio.has(l.project_id)));
      const [from, to] = RD.periodRange(s.period);
      const inPeriod = logs.filter((l) => l.date >= from && l.date <= to);
      const open = projects.filter(RD.isOpen);
      const atRisk = projects.filter((p) => p.status === "At Risk");
      const overdue = projects.filter(RD.isOverdue);
      const done = projects.filter((p) => p.status === "Completed");
      const hours = inPeriod.reduce((a, l) => a + U.num(l.hours), 0);
      const people = new Set(inPeriod.filter((l) => U.num(l.hours) > 0).map((l) => String(l.engineer).toLowerCase())).size;

      /* headline numbers */
      const tile = (label, value, sub, tone, onClick) => h(onClick ? "button" : "div", { class: "tile" + (tone ? " tile-" + tone : "") + (onClick ? " clickable" : ""), type: onClick ? "button" : null, onclick: onClick }, h("div", { class: "tile-label" }, label), h("div", { class: "tile-value" }, value), h("div", { class: "tile-sub" }, sub));
      const toProjects = (patch) => () => { Object.assign(vs.projects, { q: "", status: "", category: "", mine: false, portfolio: s.portfolio, engineer: s.engineer }, patch); RD.go("projects"); };
      body.appendChild(h("div", { class: "tiles" },
        tile("Open projects", U.fmtInt(open.length), projects.length + " in total · " + done.length + " completed", null, toProjects({})),
        tile("At risk", U.fmtInt(atRisk.length), overdue.length ? overdue.length + " past their end date" : "None past their end date", atRisk.length ? "risk" : null, toProjects({ status: "At Risk" })),
        tile("Hours logged", U.fmtHours(hours).replace(" h", ""), RD.periodLabel(s.period).toLowerCase() + (people ? " · " + people + (people === 1 ? " engineer" : " engineers") : ""), null, RD.role() === "guest" ? null : () => { Object.assign(vs.time, { period: s.period, engineer: s.engineer, project: "" }); RD.go("time"); }),
        money
          ? tile("BIP value, open projects", U.fmtMoney(open.reduce((a, p) => a + U.num(p.bip_value), 0)), RD.config.currency + " per year, anticipated", null, null)
          : tile("Completed", U.fmtInt(done.length), "of " + projects.length + " projects", null, toProjects({ status: "Completed" }))));

      /* status mix per portfolio */
      const keys = RD.STATUS_ORDER.map((st) => ({ key: st, label: RD.statusLabel(st), cls: RD.STATUS_KEY[st] }));
      const known = new Set(RD.STATUS_ORDER);
      const portfolios = RD.PORTFOLIOS.concat(RD.uniq("Projects", "portfolio").filter((p) => !RD.PORTFOLIOS.includes(p)));
      const stackRows = portfolios.map((pf) => {
        const rows = projects.filter((p) => p.portfolio === pf);
        const values = {}; rows.forEach((p) => { const k = known.has(p.status) ? p.status : "TBC"; values[k] = (values[k] || 0) + 1; });
        return { label: pf, values, n: rows.length, onClick: () => { Object.assign(vs.projects, { q: "", status: "", category: "", mine: false, portfolio: pf, engineer: s.engineer }); RD.go("projects"); } };
      }).filter((r) => r.n);
      const statusPanel = RD.panel("Projects by status", stackRows.length ? C.stack(stackRows, keys) : h("div", { class: "empty small" }, "No projects match these filters."), null, "span-7");

      /* needs attention */
      const attention = projects.filter((p) => RD.isOpen(p) && (p.status === "At Risk" || p.status === "Incomplete" || RD.isOverdue(p)))
        .sort((a, b) => (a.end_date || "9999").localeCompare(b.end_date || "9999"));
      const attList = h("div", { class: "rows" });
      attention.slice(0, 7).forEach((p) => attList.appendChild(h("button", { type: "button", class: "row-link", onclick: () => RD.go("project-" + p.id) },
        h("span", { class: "row-main" }, h("span", { class: "mono small" }, p.job_no || "No job no."), h("span", { class: "row-title" }, p.name)),
        h("span", { class: "row-side" }, RD.pill(p.status), h("span", { class: "small " + (RD.isOverdue(p) ? "late" : "muted") }, p.end_date ? (RD.isOverdue(p) ? lateBy(p) + " d late" : "due " + U.fmtDate(p.end_date, false)) : "no end date")))));
      const attPanel = RD.panel("Needs attention", attention.length ? [attList, attention.length > 7 ? h("div", { class: "panel-foot" }, RD.btn("See all " + attention.length, { small: true, onclick: toProjects({ status: "At Risk" }) })) : null] : h("div", { class: "empty small" }, "Nothing at risk or overdue in this selection."), null, "span-5");

      /* hours by engineer, hours per week, workload */
      const byEng = {};
      inPeriod.forEach((l) => { const k = l.engineer || "Unknown"; byEng[k] = (byEng[k] || 0) + U.num(l.hours); });
      const engItems = Object.keys(byEng).map((k) => ({ label: k, value: byEng[k], onClick: RD.role() === "guest" ? null : () => { Object.assign(vs.time, { period: s.period, engineer: k, project: "" }); RD.go("time"); } })).filter((i) => i.value > 0).sort((a, b) => b.value - a.value).slice(0, 12);
      const hoursPanel = RD.panel("Hours by engineer", C.bars(engItems, { fmt: U.fmtHours, empty: "No time logged " + RD.periodLabel(s.period).toLowerCase() + "." }), h("span", { class: "muted small" }, RD.periodLabel(s.period)), "span-4");
      const ws = U.weekStart(U.today());
      const weeks = [];
      for (let i = 7; i >= 0; i--) { const start = U.addDays(ws, -7 * i), end = U.addDays(start, 6); weeks.push({ label: String(U.parseDate(start).getDate()), sub: i === 7 || U.parseDate(start).getDate() <= 7 ? U.fmtDate(start, false).split(" ")[1] : "", tip: "Week of " + U.fmtDate(start), value: logs.filter((l) => l.date >= start && l.date <= end).reduce((a, l) => a + U.num(l.hours), 0) }); }
      const weekPanel = RD.panel("Hours per week", C.columns(weeks, { fmt: U.fmtHours, empty: "No time logged in the last 8 weeks." }), h("span", { class: "muted small" }, "Last 8 weeks"), "span-4");
      const load = {};
      open.forEach((p) => U.splitNames(p.engineer).forEach((n) => (load[n] = (load[n] || 0) + 1)));
      const loadItems = Object.keys(load).map((k) => ({ label: k, value: load[k], onClick: () => { Object.assign(vs.projects, { q: "", status: "", category: "", mine: false, portfolio: s.portfolio, engineer: k }); RD.go("projects"); } })).sort((a, b) => b.value - a.value).slice(0, 12);
      const loadPanel = RD.panel("Open projects by engineer", C.bars(loadItems, { empty: "No open projects." }), null, "span-4");

      /* money */
      let moneyPanel = null;
      if (money) {
        const pid = new Set(projects.map((p) => p.id));
        const cost = {}; RD.rows("Costings").forEach((c) => { if (pid.has(c.project_id)) cost[c.type] = (cost[c.type] || 0) + U.num(c.amount); });
        const sum = (col) => projects.reduce((a, p) => a + U.num(p[col]), 0);
        moneyPanel = RD.panel("Costings against budget", h("div", { class: "meters" }, Object.keys(RD.COST_BUDGET).map((t) => C.meter(t, cost[t] || 0, sum(RD.COST_BUDGET[t])))), h("span", { class: "muted small" }, RD.config.currency), "span-5");
      }

      /* activity */
      const feed = [];
      RD.rows("Updates").forEach((u) => feed.push({ at: u.created_at || u.date, who: u.by, text: "posted an update", detail: u.text, pid: u.project_id }));
      RD.rows("TimeLogs").forEach((l) => { if (U.num(l.hours) > 0) feed.push({ at: l.updated_at || l.date, who: l.engineer, text: "logged " + U.fmtHours(l.hours), detail: l.activity, pid: l.project_id }); });
      if (money) RD.rows("Costings").forEach((c) => feed.push({ at: c.created_at || c.date, who: c.prepared_by, text: "added a costing", detail: c.title + " · " + U.fmtMoney(c.amount) + " " + RD.config.currency, pid: c.project_id }));
      RD.rows("Files").forEach((f) => feed.push({ at: f.created_at, who: f.uploaded_by, text: "added a file", detail: f.name, pid: f.project_id }));
      const scoped = new Set(projects.map((p) => p.id));
      const recent = feed.filter((f) => f.at && scoped.has(f.pid) && (!s.engineer || U.same(f.who, s.engineer))).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 8);
      const running = RD.rows("TimeLogs").filter((l) => RD.isRunning(l) && scoped.has(l.project_id));
      const act = h("div", { class: "rows" });
      running.forEach((l) => act.appendChild(h("button", { type: "button", class: "row-link", onclick: () => RD.go("project-" + l.project_id) }, h("span", { class: "row-main" }, h("span", { class: "row-title" }, h("span", { class: "live-dot" }), l.engineer + " is working on " + ((byId[l.project_id] || {}).name || l.project_name || "a project")), h("span", { class: "small muted" }, l.activity || "")), h("span", { class: "row-side small muted" }, "since " + l.start))));
      recent.forEach((f) => { const p = byId[f.pid]; act.appendChild(h("button", { type: "button", class: "row-link", onclick: () => RD.go("project-" + f.pid) }, h("span", { class: "row-main" }, h("span", { class: "row-title" }, h("b", null, f.who || "Someone"), " " + f.text + (p ? " · " + p.name : "")), f.detail ? h("span", { class: "small muted clip" }, f.detail) : null), h("span", { class: "row-side small muted" }, /T/.test(f.at) ? U.ago(f.at) : U.fmtDate(f.at, false)))); });
      const actPanel = RD.panel("Recent activity", running.length || recent.length ? act : h("div", { class: "empty small" }, "No activity yet. Time logs, updates, costings and files appear here as the team adds them."), null, money ? "span-7" : "span-12");

      body.appendChild(h("div", { class: "grid-12" }, statusPanel, attPanel, hoursPanel, weekPanel, loadPanel, moneyPanel, actPanel));
    };
    root.appendChild(filterBar(
      RD.select("ov-portfolio", optAll("All portfolios", RD.PORTFOLIOS), s.portfolio, (v) => { s.portfolio = v; draw(); }, "Portfolio"),
      RD.select("ov-engineer", optAll("All engineers", RD.engineerNames()), s.engineer, (v) => { s.engineer = v; draw(); }, "Engineer"),
      RD.select("ov-period", RD.PERIODS, s.period, (v) => { s.period = v; draw(); }, "Period for hours")));
    root.appendChild(body);
    draw();
  };

  /* ================================================================ PROJECTS */
  function suggestJobNo(portfolio, category) {
    const m = {};
    RD.rows("Projects").forEach((p) => { if (p.portfolio !== portfolio || (category && p.category !== category)) return; const x = /^(.*-)(\d{3})$/.exec(String(p.job_no || "").trim()); if (!x) return; const e = (m[x[1]] = m[x[1]] || { n: 0, max: 0 }); e.n++; e.max = Math.max(e.max, +x[2]); });
    const best = Object.keys(m).sort((a, b) => m[b].n - m[a].n)[0];
    return best ? best + String(m[best].max + 1).padStart(3, "0") : "";
  }
  RD.projectFields = (isNew) => [
    { key: "name", label: "Project name", required: true, span: 2 },
    { key: "portfolio", label: "Portfolio", type: "select", options: RD.PORTFOLIOS.concat(RD.uniq("Projects", "portfolio").filter((p) => !RD.PORTFOLIOS.includes(p))), required: true },
    { key: "category", label: "Category", list: RD.uniq("Projects", "category") },
    { key: "job_no", label: "Job no.", placeholder: "e.g. RG-SW-26-007", hint: isNew ? "The next free number is suggested once portfolio and category are chosen." : null },
    { key: "engineer", label: "Engineer", list: RD.engineerNames(), hint: "For two engineers write both names with a slash: Amal / Dilini" },
    { key: "project_type", label: "Project type", list: RD.uniq("Projects", "project_type") },
    { key: "pillar", label: "Project pillar", list: RD.uniq("Projects", "pillar") },
    { key: "status", label: "Project status", type: "select", options: [{ value: "", label: "Not set" }].concat(RD.STATUSES) },
    { key: "end_date", label: "End date", type: "date" },
    { key: "responsible_dept", label: "Responsible department", list: RD.uniq("Projects", "responsible_dept") },
    { key: "npd", label: "NPD", type: "select", options: [{ value: "", label: "—" }, "Yes", "No"] },
    { key: "skus", label: "No. of products / SKUs", type: "number" },
    { key: "requested_date", label: "Requested date", type: "date" },
    RD.seesMoney() ? { type: "group", label: "Value and budget (" + RD.config.currency + ")" } : null,
    RD.seesMoney() ? { key: "bip_value", label: "BIP value per year", type: "number", hint: "Anticipated revenue or saving per year" } : null,
    RD.seesMoney() ? { key: "budget_dev", label: "Development cost budget", type: "number" } : null,
    RD.seesMoney() ? { key: "budget_tool", label: "Tool investment budget", type: "number" } : null,
    RD.seesMoney() ? { key: "budget_cert", label: "Certification budget", type: "number" } : null,
    { type: "group", label: "Cost reduction projects" },
    { key: "saving_pct", label: "Cost saving %", placeholder: "e.g. 12%" },
    { key: "saving_per_item", label: "Cost saving per item", type: "number" },
    { key: "monthly_demand", label: "Forecasted monthly demand", type: "number" },
    { key: "remarks", label: "Remarks", type: "textarea" }
  ];
  RD.editProject = (p) => {
    const isNew = !p;
    let lastSuggestion = "";
    const values = p ? Object.assign({}, p) : { portfolio: vs.projects.portfolio || RD.PORTFOLIOS[0], engineer: RD.role() === "engineer" ? RD.session.name : "", status: "On Track" };
    RD.formModal({
      key: "project-" + (p ? p.id : "new"), title: isNew ? "Add project" : "Edit project", wide: true, values, fields: RD.projectFields(isNew), submitLabel: isNew ? "Add project" : "Save changes",
      onChange: (key, f) => {
        if (!isNew || (key !== "portfolio" && key !== "category")) return;
        const v = f.read(), sug = suggestJobNo(v.portfolio, v.category) || suggestJobNo(v.portfolio, "");
        if (sug && (v.job_no === "" || v.job_no === lastSuggestion)) { f.set("job_no", sug); lastSuggestion = sug; }
      },
      validate: (v) => { const clash = v.job_no && RD.rows("Projects").find((x) => x.job_no === v.job_no && (!p || x.id !== p.id)); return clash && isNew ? "Job no. " + v.job_no + " is already used by “" + clash.name + "”. Choose another number." : null; },
      onSubmit: (v) => {
        if (isNew) { const id = Sync.add("Projects", "p", v); RD.toast("Project added"); RD.go("project-" + id); }
        else { const patch = {}; Object.keys(v).forEach((k) => { if (String(v[k]) !== String(p[k] == null ? "" : p[k])) patch[k] = v[k]; }); if (Object.keys(patch).length) { Sync.mutate("Projects", p.id, patch); RD.toast("Changes saved"); } }
      },
      onDelete: p && RD.can("project.delete") ? () => { Sync.remove("Projects", p.id); RD.toast("Project deleted"); RD.go("projects"); } : null,
      deleteLabel: "Delete project", deleteConfirm: p ? "Delete “" + p.name + "”? The project disappears from the dashboard for everyone. Its time logs, costings and files stay in the sheet." : ""
    });
  };

  V.projects = (root) => {
    const s = vs.projects;
    const money = RD.seesMoney();
    const out = h("div");
    const count = h("div", { class: "count" });
    const filtered = () => {
      const words = s.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
      return RD.rows("Projects").filter((p) => {
        if (s.portfolio && p.portfolio !== s.portfolio) return false;
        if (s.status === "__none" ? !!p.status : s.status === "__overdue" ? !RD.isOverdue(p) : s.status === "__open" ? !RD.isOpen(p) : s.status && p.status !== s.status) return false;
        if (s.category && p.category !== s.category) return false;
        if (s.engineer && !U.splitNames(p.engineer).some((n) => U.same(n, s.engineer))) return false;
        if (s.mine && !RD.mine(p.engineer)) return false;
        if (words.length) { const hay = [p.job_no, p.name, p.engineer, p.category, p.current_status, p.remarks, p.responsible_dept, p.pillar].join(" ").toLowerCase(); if (!words.every((w) => hay.includes(w))) return false; }
        return true;
      });
    };
    const draw = () => {
      const hours = RD.hoursByProject();
      const rows = filtered();
      count.textContent = rows.length + " of " + RD.rows("Projects").length + " projects";
      out.textContent = "";
      out.appendChild(RD.table({
        rows, sortKey: "job_no", onRow: (p) => RD.go("project-" + p.id),
        empty: RD.rows("Projects").length ? "No project matches these filters." : "No projects yet. Add the first one with “Add project”.",
        columns: [
          { key: "job_no", label: "Job no.", cls: "hide-sm", render: (p) => (p.job_no ? h("span", { class: "mono" }, p.job_no) : null) },
          { key: "name", label: "Project", cls: "col-main", render: (p) => h("div", null, p.job_no ? h("div", { class: "mono small show-sm" }, p.job_no) : null, h("div", { class: "cell-title" }, p.name), h("div", { class: "small muted" }, [p.portfolio, p.category].filter(Boolean).join(" · "))) },
          { key: "engineer", label: "Engineer" },
          { key: "status", label: "Status", sort: (p) => RD.STATUS_ORDER.indexOf(p.status), render: (p) => RD.pill(p.status) },
          { key: "end_date", label: "End date", render: dateCell },
          money ? { key: "bip_value", label: "BIP value / yr", num: true, cls: "hide-sm", sort: (p) => (U.hasNum(p.bip_value) ? U.num(p.bip_value) : ""), render: (p) => (U.hasNum(p.bip_value) ? U.fmtMoney(p.bip_value) : null) } : null,
          { key: "hours", label: "Hours", num: true, cls: "hide-sm", sort: (p) => hours[p.id] || "", render: (p) => (hours[p.id] ? U.fmtHours(hours[p.id]) : null) },
          { key: "current_status", label: "Current status", cls: "col-note hide-md", sortable: false, render: (p) => (p.current_status ? h("span", { class: "clip", title: p.current_status }, p.current_status) : null) }
        ].filter(Boolean)
      }));
    };
    const search = h("input", { id: "pj-q", class: "inp inp-sm search", type: "search", placeholder: "Search projects", "aria-label": "Search projects", value: s.q, oninput: U.debounce(() => { s.q = search.value; draw(); }, 150) });
    const statusOpts = [{ value: "", label: "Any status" }, { value: "__open", label: "All open" }].concat(RD.STATUSES.map((x) => ({ value: x, label: x })), [{ value: "__none", label: "Not set" }, { value: "__overdue", label: "Past end date" }]);
    root.appendChild(filterBar(
      h("span", { class: "search-wrap" }, icon("search"), search),
      RD.select("pj-portfolio", optAll("All portfolios", RD.PORTFOLIOS), s.portfolio, (v) => { s.portfolio = v; draw(); }, "Portfolio"),
      RD.select("pj-status", statusOpts, s.status, (v) => { s.status = v; draw(); }, "Status"),
      RD.select("pj-engineer", optAll("All engineers", RD.engineerNames()), s.engineer, (v) => { s.engineer = v; draw(); }, "Engineer"),
      RD.select("pj-category", optAll("All categories", RD.uniq("Projects", "category")), s.category, (v) => { s.category = v; draw(); }, "Category"),
      RD.role() === "engineer" ? h("label", { class: "check" }, h("input", { type: "checkbox", id: "pj-mine", checked: s.mine, onchange: (e) => { s.mine = e.target.checked; draw(); } }), "My projects") : null,
      h("span", { class: "grow" }),
      RD.preview ? null : RD.btn("Export", { icon: "download", small: true, title: "Download this list as CSV", onclick: () => { const cols = RD.TABLES.Projects.filter((c) => !["deleted", "drive_folder_id"].includes(c) && (money || !/^(bip_value|budget_)/.test(c))); RD.exportCsv("rd-projects-" + U.today() + ".csv", [cols].concat(filtered().map((p) => cols.map((c) => p[c])))); } }),
      RD.can("project.add") ? RD.btn("Add project", { icon: "plus", kind: "primary", small: true, id: "btn-add-project", onclick: () => RD.editProject(null) }) : null));
    root.appendChild(count);
    root.appendChild(out);
    draw();
  };

  /* ================================================================ PROJECT PAGE */
  RD.postUpdate = (p) => {
    RD.formModal({
      key: "update-" + p.id, title: "Post update", intro: RD.projectLabel(p), values: { status: p.status, text: "" }, submitLabel: "Post update",
      fields: [{ key: "status", label: "Project status", type: "select", options: [{ value: "", label: "Not set" }].concat(RD.STATUSES) }, { key: "text", label: "Current status", type: "textarea", rows: 4, required: true, placeholder: "What happened, what is pending, who is it waiting on" }],
      onSubmit: (v) => {
        Sync.add("Updates", "u", { project_id: p.id, project_name: p.name, date: U.today(), by: RD.session.name, status: v.status, text: v.text });
        Sync.mutate("Projects", p.id, { current_status: v.text, status: v.status });
        RD.toast("Update posted");
      }
    });
  };
  V.project = (root, id) => {
    const p = RD.byId("Projects", id);
    if (!p) { root.appendChild(h("div", { class: "empty" }, "This project is no longer in the list. ", RD.btn("Back to projects", { small: true, onclick: () => RD.go("projects") }))); return; }
    const money = RD.seesMoney();
    const canEdit = RD.can("project.edit", p), canAdd = RD.can("entry.add");
    const logs = RD.rows("TimeLogs").filter((l) => l.project_id === id);
    const costs = RD.rows("Costings").filter((c) => c.project_id === id);
    const files = RD.rows("Files").filter((f) => f.project_id === id);
    const updates = RD.rows("Updates").filter((u) => u.project_id === id).sort((a, b) => String(b.created_at || b.date).localeCompare(String(a.created_at || a.date)));
    const hours = logs.reduce((a, l) => a + U.num(l.hours), 0);

    root.appendChild(h("div", { class: "page-head" },
      h("button", { type: "button", class: "back", onclick: () => RD.go("projects") }, icon("back"), "Projects"),
      h("div", { class: "page-title" },
        h("div", { class: "page-kicker" }, h("span", { class: "mono" }, p.job_no || "No job no."), h("span", null, [p.portfolio, p.category].filter(Boolean).join(" · "))),
        h("h2", null, p.name),
        h("div", { class: "page-meta" }, RD.pill(p.status), p.engineer ? h("span", null, icon("users"), p.engineer) : null, p.end_date ? h("span", { class: RD.isOverdue(p) ? "late" : null }, icon("clock"), "Ends " + U.fmtDate(p.end_date) + (RD.isOverdue(p) ? " · " + lateBy(p) + " d late" : "")) : null)),
      h("div", { class: "page-actions" },
        canAdd ? RD.btn("Post update", { icon: "note", onclick: () => RD.postUpdate(p) }) : null,
        canAdd ? RD.btn("Start timer", { icon: "play", onclick: () => RD.startTimer({ project_id: p.id }) }) : null,
        canEdit ? RD.btn("Edit", { icon: "edit", onclick: () => RD.editProject(p) }) : null)));

    const fact = (label, value, cls) => (value === "" || value == null ? null : h("div", { class: "fact" }, h("dt", null, label), h("dd", { class: cls || null }, value)));
    const facts = h("dl", { class: "facts" },
      fact("Project type", p.project_type), fact("Project pillar", p.pillar), fact("Responsible department", p.responsible_dept), fact("No. of products / SKUs", U.hasNum(p.skus) ? U.fmtInt(p.skus) : ""), fact("NPD", p.npd), fact("Requested date", p.requested_date ? U.fmtDate(p.requested_date) : ""),
      money ? fact("BIP value per year", U.hasNum(p.bip_value) ? U.fmtMoney(p.bip_value, false) + " " + RD.config.currency : "") : null,
      fact("Cost saving", p.saving_pct), fact("Saving per item", U.hasNum(p.saving_per_item) ? U.fmtMoney(p.saving_per_item, false) : ""), fact("Monthly demand", U.hasNum(p.monthly_demand) ? U.fmtInt(p.monthly_demand) : ""),
      fact("Hours logged", hours ? U.fmtHours(hours) : ""), fact("Last changed", p.updated_at ? U.ago(p.updated_at) + (p.updated_by ? " by " + p.updated_by : "") : ""));
    const statusBox = h("div", { class: "status-box" }, h("div", { class: "label" }, "Current status"), h("p", null, p.current_status || h("span", { class: "muted" }, "No status written yet.")), p.remarks ? [h("div", { class: "label" }, "Remarks"), h("p", { class: "muted" }, p.remarks)] : null);
    let budget = null;
    if (money) {
      const by = {}; costs.forEach((c) => (by[c.type] = (by[c.type] || 0) + U.num(c.amount)));
      const any = Object.keys(RD.COST_BUDGET).some((t) => U.num(p[RD.COST_BUDGET[t]]) > 0 || by[t]);
      if (any) budget = RD.panel("Budget", h("div", { class: "meters" }, Object.keys(RD.COST_BUDGET).map((t) => C.meter(t, by[t] || 0, U.num(p[RD.COST_BUDGET[t]])))), h("span", { class: "muted small" }, RD.config.currency));
    }
    root.appendChild(h("div", { class: "grid-12" }, h("div", { class: "span-7 stack-v" }, RD.panel(null, [statusBox]), budget), h("div", { class: "span-5 stack-v" }, RD.panel("Details", facts))));

    /* tabs */
    const tabs = [["updates", "Updates", updates.length], ["time", "Time", hours ? U.fmtHours(hours) : 0], money ? ["costings", "Costings", costs.length] : null, ["files", "Files", files.length]].filter(Boolean);
    if (!tabs.some((t) => t[0] === vs.ptab)) vs.ptab = "updates";
    const tabBody = h("div", { class: "tab-body" });
    const tabBar = h("div", { class: "tabs", role: "tablist" });
    const drawTab = () => {
      tabBar.textContent = ""; tabBody.textContent = "";
      tabs.forEach((t) => tabBar.appendChild(h("button", { type: "button", role: "tab", "aria-selected": String(vs.ptab === t[0]), class: "tab" + (vs.ptab === t[0] ? " on" : ""), onclick: () => { vs.ptab = t[0]; drawTab(); } }, t[1], t[2] ? h("span", { class: "tab-n" }, String(t[2])) : null)));
      if (vs.ptab === "updates") {
        if (canAdd) tabBody.appendChild(h("div", { class: "tab-actions" }, RD.btn("Post update", { icon: "plus", small: true, onclick: () => RD.postUpdate(p) })));
        if (!updates.length) tabBody.appendChild(h("div", { class: "empty small" }, "No updates posted yet. Each update is kept here with its date, so the history of the project builds up."));
        const tl = h("div", { class: "timeline" });
        updates.forEach((u) => tl.appendChild(h("div", { class: "tl-item" }, h("div", { class: "tl-head" }, h("b", null, u.by || "Someone"), h("span", { class: "muted" }, U.fmtDate(u.date)), u.status ? RD.pill(u.status) : null, RD.can("entry.edit", u) ? h("button", { type: "button", class: "icon-btn sm", "aria-label": "Delete update", title: "Delete update", onclick: async () => { if (await RD.confirm("Delete update", "Delete this update from the project history?", "Delete", true)) Sync.remove("Updates", u.id); } }, icon("trash")) : null), h("p", null, u.text))));
        tabBody.appendChild(tl);
      } else if (vs.ptab === "time") {
        if (canAdd) tabBody.appendChild(h("div", { class: "tab-actions" }, RD.btn("Start timer", { icon: "play", small: true, onclick: () => RD.startTimer({ project_id: p.id }) }), RD.btn("Add time", { icon: "plus", small: true, onclick: () => RD.editTime(null, { project_id: p.id }) })));
        tabBody.appendChild(RD.timeTable(logs, { hideProject: true, empty: "No time logged on this project yet." }));
      } else if (vs.ptab === "costings") {
        if (canAdd) tabBody.appendChild(h("div", { class: "tab-actions" }, RD.btn("Add costing", { icon: "plus", small: true, onclick: () => RD.editCosting(null, { project_id: p.id }) })));
        tabBody.appendChild(RD.costTable(costs, { hideProject: true, empty: "No costings recorded for this project yet." }));
      } else {
        if (canAdd) tabBody.appendChild(h("div", { class: "tab-actions" }, RD.btn("Upload files", { icon: "upload", small: true, onclick: () => RD.uploadDialog({ project_id: p.id }) }), !RD.demo ? RD.btn("Link from my Drive", { icon: "link", small: true, onclick: () => RD.driveDialog({ project_id: p.id }) }) : null, p.drive_folder_id ? h("a", { class: "btn btn-sm", href: "https://drive.google.com/drive/folders/" + p.drive_folder_id, target: "_blank", rel: "noopener" }, icon("open"), h("span", null, "Open Drive folder")) : null));
        tabBody.appendChild(RD.fileGrid(files, { hideProject: true, empty: "No files yet. Upload SolidWorks parts and assemblies, renders, test reports and costing sheets here." }));
      }
    };
    root.appendChild(h("section", { class: "panel" }, tabBar, tabBody));
    drawTab();
  };
})();
