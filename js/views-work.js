/* views-work.js — Time, Costings, Files, Team, Settings, sync panel */
(function () {
  "use strict";
  const RD = window.RD, U = RD.U, h = RD.h, icon = RD.icon, Sync = RD.Sync, C = RD.Chart, Store = RD.Store, V = RD.Views, vs = RD.vstate;
  const optAll = (label, list) => [{ value: "", label }].concat(list.map((x) => ({ value: x, label: x })));
  const projCell = (r) => { const p = RD.byId("Projects", r.project_id); return h("button", { type: "button", class: "linkish cell-proj", onclick: () => RD.go("project-" + r.project_id), title: p ? p.name : r.project_name }, p && p.job_no ? h("span", { class: "mono" }, p.job_no + " ") : null, p ? p.name : r.project_name || "Deleted project"); };
  const editBtn = (label, fn) => h("button", { type: "button", class: "icon-btn sm", "aria-label": label, title: label, onclick: fn }, icon("edit"));
  const restricted = (root, text) => root.appendChild(h("div", { class: "empty" }, text));

  /* ================================================================ TIME */
  RD.myTimer = () => (RD.session ? RD.rows("TimeLogs").find((l) => RD.isRunning(l) && U.same(l.engineer_email, RD.session.email)) : null);
  RD.stopTimer = (quiet) => {
    const l = RD.myTimer(); if (!l) return;
    const hours = Math.max(0.01, Math.round((Date.now() - new Date(l.started_at).getTime()) / 36000) / 100);
    Sync.mutate("TimeLogs", l.id, { end: U.hhmm(new Date()), hours });
    if (!quiet) RD.toast(hours > 12 ? "Logged " + U.fmtHours(hours) + ". That is a long session: edit the entry if the timer was left running." : "Logged " + U.fmtHours(hours) + " on " + (l.project_name || "the project"), hours > 12 ? "bad" : null);
  };
  function beginTimer(v) {
    const p = RD.byId("Projects", v.project_id);
    if (RD.myTimer()) RD.stopTimer(true);
    const now = new Date();
    Sync.add("TimeLogs", "t", { project_id: v.project_id, project_name: p ? p.name : "", engineer: RD.session.name, engineer_email: RD.session.email, date: U.isoDate(now), start: U.hhmm(now), end: "", hours: "", activity: v.activity || RD.ACTIVITIES[0], note: v.note || "", started_at: now.toISOString() });
    RD.toast("Timer started");
  }
  RD.startTimer = (preset) => {
    const cur = RD.myTimer();
    RD.formModal({
      key: "timer", draft: false, title: "Start timer", submitLabel: "Start", intro: cur ? "Your running timer on “" + cur.project_name + "” will be stopped and logged first." : null,
      values: Object.assign({ activity: Store.get("lastActivity", RD.ACTIVITIES[0]) }, preset || {}),
      fields: [{ key: "project_id", label: "Project", type: "project", required: true, span: 2 }, { key: "activity", label: "Activity", type: "select", options: RD.ACTIVITIES }, { key: "note", label: "Note", placeholder: "Optional" }],
      onSubmit: (v) => { Store.set("lastActivity", v.activity); beginTimer(v); }
    });
  };
  RD.editTime = (log, preset) => {
    const isNew = !log;
    const values = log ? Object.assign({}, log) : Object.assign({ date: U.today(), activity: Store.get("lastActivity", RD.ACTIVITIES[0]), engineer: RD.session.name }, preset || {});
    RD.formModal({
      key: "time-" + (log ? log.id : "new"), title: isNew ? "Add time" : "Edit time entry", values, submitLabel: isNew ? "Add time" : "Save changes",
      fields: [
        { key: "project_id", label: "Project", type: "project", required: true, span: 2 },
        { key: "date", label: "Date", type: "date", required: true },
        RD.isAdmin() ? { key: "engineer", label: "Engineer", type: "select", options: RD.engineerNames() } : null,
        { key: "start", label: "Start time", type: "time" },
        { key: "end", label: "End time", type: "time" },
        { key: "hours", label: "Hours", type: "number", required: true, hint: "Filled in from start and end. Type it yourself if you only know the total." },
        { key: "activity", label: "Activity", type: "select", options: RD.ACTIVITIES },
        { key: "note", label: "Note", type: "textarea", rows: 2 }
      ],
      onChange: (key, f) => { if (key === "start" || key === "end") { const v = f.read(); if (v.start && v.end) f.set("hours", U.durFromTimes(v.start, v.end)); } },
      validate: (v) => (!(v.hours > 0) ? "Hours must be more than 0." : v.hours > 24 ? "One entry cannot be longer than 24 hours." : v.date > U.today() ? "The date is in the future." : null),
      onSubmit: (v) => {
        const p = RD.byId("Projects", v.project_id);
        v.project_name = p ? p.name : "";
        Store.set("lastActivity", v.activity);
        if (isNew) {
          const eng = v.engineer || RD.session.name;
          const user = RD.rows("Users").find((u) => U.same(u.name, eng));
          Sync.add("TimeLogs", "t", Object.assign(v, { engineer: eng, engineer_email: U.same(eng, RD.session.name) ? RD.session.email : user ? user.id : "", started_at: "" }));
          RD.toast("Time added");
        } else {
          const patch = {}; Object.keys(v).forEach((k) => { if (String(v[k]) !== String(log[k] == null ? "" : log[k])) patch[k] = v[k]; });
          if (patch.engineer) { const user = RD.rows("Users").find((u) => U.same(u.name, patch.engineer)); patch.engineer_email = user ? user.id : ""; }
          if (Object.keys(patch).length) { Sync.mutate("TimeLogs", log.id, patch); RD.toast("Changes saved"); }
        }
      },
      onDelete: log && RD.can("entry.edit", log) ? () => { Sync.remove("TimeLogs", log.id); RD.toast("Time entry deleted"); } : null
    });
  };
  RD.timeTable = (logs, opts) => {
    opts = opts || {};
    return RD.table({
      rows: logs, sortKey: "date", sortDir: -1, empty: opts.empty || "No time entries for this selection.",
      columns: [
        { key: "date", label: "Date", sort: (l) => l.date + " " + (l.start || ""), render: (l) => U.fmtDate(l.date) },
        { key: "engineer", label: "Engineer" },
        opts.hideProject ? null : { key: "project_name", label: "Project", cls: "col-main", render: projCell },
        { key: "activity", label: "Activity", cls: "hide-sm" },
        { key: "start", label: "From–to", cls: "hide-sm", sortable: false, render: (l) => (l.start ? h("span", { class: "tnum" }, l.start + (l.end ? "–" + l.end : "")) : null) },
        { key: "hours", label: "Hours", num: true, sort: (l) => U.num(l.hours), render: (l) => (RD.isRunning(l) ? h("span", { class: "running" }, h("span", { class: "live-dot" }), h("span", { "data-since": l.started_at }, "running")) : U.fmtHours(l.hours)) },
        { key: "note", label: "Note", cls: "col-note hide-md", sortable: false, render: (l) => (l.note ? h("span", { class: "clip", title: l.note }, l.note) : null) },
        { key: "_", label: "", sortable: false, cls: "col-act", render: (l) => (RD.can("entry.edit", l) && !RD.isRunning(l) ? editBtn("Edit time entry", () => RD.editTime(l)) : h("span")) }
      ].filter(Boolean)
    });
  };
  V.time = (root) => {
    if (RD.role() === "guest") return restricted(root, "Time logs are kept for the R&D team. Guests can follow project status on the Projects page.");
    const s = vs.time;
    if (s.engineer === "" && RD.role() === "engineer" && !s._touched) s.engineer = RD.session.name;
    const body = h("div", { class: "stack-v" });

    /* timer card */
    const timerCard = h("section", { class: "panel timer-card" });
    const drawTimer = () => {
      timerCard.textContent = "";
      const cur = RD.myTimer();
      if (cur) {
        timerCard.classList.add("on");
        timerCard.appendChild(h("div", { class: "timer-run" },
          h("div", { class: "timer-clock", "data-since": cur.started_at, "data-format": "clock" }, U.clock(Date.now() - new Date(cur.started_at).getTime())),
          h("div", { class: "timer-what" }, h("div", { class: "label" }, "Timer running since " + cur.start), h("div", { class: "timer-proj" }, RD.projectLabel(RD.byId("Projects", cur.project_id)) || cur.project_name), h("div", { class: "muted small" }, [cur.activity, cur.note].filter(Boolean).join(" · "))),
          h("div", { class: "timer-btns" }, RD.btn("Stop and log", { icon: "stop", kind: "primary", id: "btn-stop-timer", onclick: () => RD.stopTimer() }), RD.btn("Discard", { onclick: async () => { if (await RD.confirm("Discard timer", "Discard this timer without logging any time?", "Discard", true)) Sync.remove("TimeLogs", cur.id); } }))));
      } else {
        timerCard.classList.remove("on");
        const picker = RD.projectPicker({ id: "tm-project", value: s.project || "", placeholder: "What are you working on? Search job no. or project" });
        const act = RD.select("tm-activity", RD.ACTIVITIES, Store.get("lastActivity", RD.ACTIVITIES[0]), () => {}, "Activity");
        const note = h("input", { id: "tm-note", class: "inp", type: "text", placeholder: "Note (optional)", "aria-label": "Note" });
        timerCard.appendChild(h("div", { class: "timer-start" }, h("div", { class: "timer-fields" }, picker, act, note),
          RD.btn("Start timer", { icon: "play", kind: "primary", id: "btn-start-timer", onclick: () => { const pid = picker.getValue(); if (!pid) { RD.toast("Choose a project first.", "bad"); picker.querySelector("input").focus(); return; } Store.set("lastActivity", act.value); beginTimer({ project_id: pid, activity: act.value, note: note.value.trim() }); } }),
          RD.btn("Add time by hand", { icon: "plus", id: "btn-add-time", onclick: () => RD.editTime(null, { project_id: picker.getValue() }) })));
      }
    };
    const draw = () => {
      body.textContent = "";
      const [from, to] = RD.periodRange(s.period);
      const logs = RD.rows("TimeLogs").filter((l) => l.date >= from && l.date <= to && (!s.engineer || U.same(l.engineer, s.engineer)) && (!s.project || l.project_id === s.project));
      const total = logs.reduce((a, l) => a + U.num(l.hours), 0);
      const group = (fn) => { const m = {}; logs.forEach((l) => { const k = fn(l) || "—"; m[k] = (m[k] || 0) + U.num(l.hours); }); return Object.keys(m).map((k) => ({ label: k, value: m[k] })).filter((i) => i.value > 0).sort((a, b) => b.value - a.value); };
      const byProject = (() => { const m = {}; logs.forEach((l) => (m[l.project_id] = (m[l.project_id] || 0) + U.num(l.hours))); return Object.keys(m).map((id) => { const p = RD.byId("Projects", id); return { label: p ? (p.job_no ? p.job_no + " · " : "") + p.name : "Deleted project", value: m[id], onClick: p ? () => RD.go("project-" + id) : null }; }).filter((i) => i.value > 0).sort((a, b) => b.value - a.value); })();
      const days = new Set(logs.filter((l) => U.num(l.hours) > 0).map((l) => l.date)).size;
      body.appendChild(h("div", { class: "grid-12" },
        h("div", { class: "span-3 tiles tiles-col" },
          h("div", { class: "tile" }, h("div", { class: "tile-label" }, "Hours"), h("div", { class: "tile-value" }, U.fmtHours(total).replace(" h", "")), h("div", { class: "tile-sub" }, RD.periodLabel(s.period) + (s.engineer ? " · " + s.engineer : " · whole team"))),
          h("div", { class: "tile" }, h("div", { class: "tile-label" }, "Entries"), h("div", { class: "tile-value" }, U.fmtInt(logs.length)), h("div", { class: "tile-sub" }, days ? "on " + days + (days === 1 ? " day" : " days") + " · " + U.fmtHours(total / days) + " per day" : "none yet"))),
        RD.panel("By project", C.bars(byProject.slice(0, 8), { fmt: U.fmtHours, wide: true }), byProject.length > 8 ? h("span", { class: "muted small" }, "Top 8 of " + byProject.length) : null, "span-5"),
        RD.panel(s.engineer ? "By activity" : "By engineer", C.bars(group(s.engineer ? (l) => l.activity : (l) => l.engineer).slice(0, 10), { fmt: U.fmtHours }), null, "span-4")));
      body.appendChild(RD.panel("Time entries", RD.timeTable(logs), RD.preview ? null : RD.btn("Export", { icon: "download", small: true, onclick: () => RD.exportCsv("rd-time-" + U.today() + ".csv", [["date", "engineer", "job_no", "project", "activity", "start", "end", "hours", "note"]].concat(logs.map((l) => { const p = RD.byId("Projects", l.project_id) || {}; return [l.date, l.engineer, p.job_no, p.name || l.project_name, l.activity, l.start, l.end, l.hours, l.note]; }))) })));
    };
    const pf = RD.projectPicker({ id: "tf-project", value: s.project, placeholder: "All projects", onChange: (v) => { s.project = v; draw(); } });
    if (RD.canEdit()) { drawTimer(); root.appendChild(timerCard); }
    root.appendChild(h("div", { class: "filters" },
      RD.select("tf-period", RD.PERIODS, s.period, (v) => { s.period = v; draw(); }, "Period"),
      RD.select("tf-engineer", optAll("All engineers", RD.engineerNames()), s.engineer, (v) => { s.engineer = v; s._touched = true; draw(); }, "Engineer"),
      h("div", { class: "filter-picker" }, pf)));
    root.appendChild(body);
    draw();
  };

  /* ================================================================ COSTINGS */
  RD.editCosting = (c, preset) => {
    const isNew = !c;
    const values = c ? Object.assign({}, c) : Object.assign({ date: U.today(), type: RD.COST_TYPES[0], status: RD.COST_STATUSES[0] }, preset || {});
    RD.formModal({
      key: "cost-" + (c ? c.id : "new"), title: isNew ? "Add costing" : "Edit costing", values, wide: true, submitLabel: isNew ? "Add costing" : "Save changes",
      fields: [
        { key: "project_id", label: "Project", type: "project", required: true, span: 2 },
        { key: "title", label: "What was costed", required: true, span: 2, placeholder: "e.g. Mould quotation, 2-cavity base tool" },
        { key: "type", label: "Type", type: "select", options: RD.COST_TYPES, hint: "The first three types count against the project budget. A product costing records a unit cost." },
        { key: "amount", label: "Amount (" + RD.config.currency + ")", type: "number", required: true },
        { key: "date", label: "Date", type: "date", required: true },
        { key: "status", label: "Status", type: "select", options: RD.COST_STATUSES },
        { key: "supplier", label: "Supplier", list: RD.uniq("Costings", "supplier") },
        { key: "reference", label: "Reference", placeholder: "PO, quotation or costing sheet no." },
        { key: "note", label: "Note", type: "textarea", rows: 2 },
        isNew ? { key: "files", label: "Attach the costing sheet or quotation", type: "file", span: 2 } : null
      ],
      validate: (v) => (v.amount < 0 ? "The amount cannot be negative." : null),
      onSubmit: (v) => {
        const p = RD.byId("Projects", v.project_id);
        v.project_name = p ? p.name : "";
        const files = v.files || []; delete v.files;
        if (isNew) {
          (async () => {
            let file_id = "";
            if (files.length) file_id = await Sync.addFile(files[0], { project_id: v.project_id, kind: "Costing", note: v.title });
            Sync.add("Costings", "c", Object.assign(v, { prepared_by: RD.session.name, file_id }));
            RD.toast("Costing added");
          })();
        } else {
          const patch = {}; Object.keys(v).forEach((k) => { if (String(v[k]) !== String(c[k] == null ? "" : c[k])) patch[k] = v[k]; });
          if (Object.keys(patch).length) { Sync.mutate("Costings", c.id, patch); RD.toast("Changes saved"); }
        }
      },
      onDelete: c && RD.can("entry.edit", c) ? () => { Sync.remove("Costings", c.id); RD.toast("Costing deleted"); } : null
    });
  };
  RD.costTable = (rows, opts) => {
    opts = opts || {};
    return RD.table({
      rows, sortKey: "date", sortDir: -1, empty: opts.empty || "No costings for this selection.",
      columns: [
        { key: "date", label: "Date", render: (c) => U.fmtDate(c.date) },
        opts.hideProject ? null : { key: "project_name", label: "Project", cls: "col-main", render: projCell },
        { key: "title", label: "Costing", cls: opts.hideProject ? "col-main" : "", render: (c) => h("div", null, h("div", { class: "cell-title" }, c.title), h("div", { class: "small muted" }, [c.type, c.supplier, c.reference].filter(Boolean).join(" · "))) },
        { key: "amount", label: "Amount (" + RD.config.currency + ")", num: true, sort: (c) => U.num(c.amount), render: (c) => h("span", { title: U.fmtMoney(c.amount, false) }, U.fmtMoney(c.amount, false)) },
        { key: "status", label: "Status", render: (c) => h("span", { class: "tag tag-" + (c.status === "Approved" ? "ok" : c.status === "Draft" ? "plain" : "info") }, c.status || "Draft") },
        { key: "prepared_by", label: "By", cls: "hide-sm" },
        { key: "file_id", label: "File", sortable: false, cls: "hide-sm", render: (c) => { const f = c.file_id && RD.byId("Files", c.file_id); return f ? h("button", { type: "button", class: "linkish", onclick: () => RD.openFile(f) }, icon("file"), " Open") : null; } },
        { key: "_", label: "", sortable: false, cls: "col-act", render: (c) => (RD.can("entry.edit", c) ? editBtn("Edit costing", () => RD.editCosting(c)) : h("span")) }
      ].filter(Boolean)
    });
  };
  V.costings = (root) => {
    if (!RD.seesMoney()) return restricted(root, "Costings and budgets are visible to the R&D team. Ask the R&D supervisor if you need access.");
    const s = vs.costings;
    const body = h("div", { class: "stack-v" });
    const draw = () => {
      body.textContent = "";
      const words = s.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
      const rows = RD.rows("Costings").filter((c) => (!s.type || c.type === s.type) && (!s.status || c.status === s.status) && (!s.project || c.project_id === s.project) && (!words.length || words.every((w) => [c.title, c.supplier, c.reference, c.project_name, c.prepared_by, c.note].join(" ").toLowerCase().includes(w))));
      const scope = RD.rows("Projects").filter((p) => !s.project || p.id === s.project);
      const by = {}; rows.forEach((c) => (by[c.type] = (by[c.type] || 0) + U.num(c.amount)));
      const sum = (col) => scope.reduce((a, p) => a + U.num(p[col]), 0);
      const pc = rows.filter((c) => c.type === "Product costing");
      body.appendChild(h("div", { class: "grid-12" },
        RD.panel("Spend against budget", h("div", { class: "meters meters-3" }, Object.keys(RD.COST_BUDGET).map((t) => C.meter(t, by[t] || 0, sum(RD.COST_BUDGET[t])))), h("span", { class: "muted small" }, (s.project ? "This project" : "All projects") + " · " + RD.config.currency), "span-9"),
        h("div", { class: "span-3 tiles tiles-col" }, h("div", { class: "tile" }, h("div", { class: "tile-label" }, "Product costings"), h("div", { class: "tile-value" }, U.fmtInt(pc.length)), h("div", { class: "tile-sub" }, pc.filter((c) => c.status === "Approved").length + " approved · " + pc.filter((c) => c.status === "Submitted to Finance").length + " with Finance")))));
      body.appendChild(RD.panel("Costings", RD.costTable(rows), [RD.preview ? null : RD.btn("Export", { icon: "download", small: true, onclick: () => RD.exportCsv("rd-costings-" + U.today() + ".csv", [["date", "job_no", "project", "type", "title", "amount", "supplier", "reference", "status", "prepared_by", "note"]].concat(rows.map((c) => { const p = RD.byId("Projects", c.project_id) || {}; return [c.date, p.job_no, p.name || c.project_name, c.type, c.title, c.amount, c.supplier, c.reference, c.status, c.prepared_by, c.note]; }))) }), RD.can("entry.add") ? RD.btn("Add costing", { icon: "plus", kind: "primary", small: true, id: "btn-add-costing", onclick: () => RD.editCosting(null, { project_id: s.project }) }) : null]));
    };
    const search = h("input", { id: "cs-q", class: "inp inp-sm search", type: "search", placeholder: "Search costings", "aria-label": "Search costings", value: s.q, oninput: U.debounce(() => { s.q = search.value; draw(); }, 150) });
    root.appendChild(h("div", { class: "filters" }, h("span", { class: "search-wrap" }, icon("search"), search),
      RD.select("cs-type", optAll("All types", RD.COST_TYPES), s.type, (v) => { s.type = v; draw(); }, "Type"),
      RD.select("cs-status", optAll("Any status", RD.COST_STATUSES), s.status, (v) => { s.status = v; draw(); }, "Status"),
      h("div", { class: "filter-picker" }, RD.projectPicker({ id: "cs-project", value: s.project, placeholder: "All projects", onChange: (v) => { s.project = v; draw(); } }))));
    root.appendChild(body);
    draw();
  };

  /* ================================================================ FILES */
  const thumbs = new Map();
  async function fileUrlFor(f) {
    if (thumbs.has(f.id)) return thumbs.get(f.id);
    let url = "", blob = null;
    const up = Sync.uploadOf(f.id);
    if (up) blob = await Store.blobGet(up.blobKey);
    else if (f.url && /^data:/.test(f.url)) url = f.url;
    else if (f.drive_id && U.num(f.size) < 20e6 && (RD.demo || Sync.canTalk())) blob = await RD.backend.fileBlob(f).catch(() => null);
    if (blob) url = URL.createObjectURL(blob);
    if (url && !up) thumbs.set(f.id, url);
    return url;
  }
  const io = "IntersectionObserver" in window ? new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); e.target._load && e.target._load(); } }), { rootMargin: "200px" }) : null;
  RD.openFile = async (f) => {
    if (RD.isImage(f)) {
      const holder = h("div", { class: "lightbox" }, h("div", { class: "muted" }, "Loading image…"));
      RD.modal({ title: f.name, wide: true, body: holder, footer: !RD.demo && f.url ? () => [h("span", { class: "grow" }), h("a", { class: "btn", href: f.url, target: "_blank", rel: "noopener" }, icon("open"), h("span", null, "Open in Google Drive"))] : null });
      const url = await fileUrlFor(f);
      holder.textContent = "";
      holder.appendChild(url ? h("img", { src: url, alt: f.name }) : h("div", { class: "empty small" }, RD.online() ? "This image could not be loaded." : "You are offline. The image loads when you reconnect."));
      return;
    }
    if (!RD.demo) { const url = RD.backend.fileUrl(f); if (url) { const a = h("a", { href: url, target: "_blank", rel: "noopener" }); document.body.appendChild(a); a.click(); a.remove(); } else RD.toast("This file is still waiting to upload."); return; }
    const blob = await RD.backend.fileBlob(f);
    if (blob && !RD.preview) { const a = h("a", { href: URL.createObjectURL(blob), download: f.name }); document.body.appendChild(a); a.click(); a.remove(); }
    else RD.toast(blob ? "In the connected app this opens the file in Google Drive." : "This is a sample entry with no file behind it.");
  };
  RD.editFile = (f) => {
    RD.formModal({
      key: "file-" + f.id, draft: false, title: "File details", values: f, intro: f.name,
      fields: [{ key: "project_id", label: "Project", type: "project", required: true, span: 2 }, { key: "kind", label: "Kind", type: "select", options: RD.FILE_KINDS }, { key: "note", label: "Note" }],
      onSubmit: (v) => { const p = RD.byId("Projects", v.project_id); const patch = {}; ["project_id", "kind", "note"].forEach((k) => { if (v[k] !== (f[k] || "")) patch[k] = v[k]; }); if (patch.project_id) patch.project_name = p ? p.name : ""; if (Object.keys(patch).length) { Sync.mutate("Files", f.id, patch); RD.toast("Changes saved"); } },
      onDelete: RD.can("entry.edit", f) ? () => { Sync.remove("Files", f.id); RD.toast("File removed from the dashboard"); } : null,
      deleteLabel: "Remove", deleteConfirm: "Remove “" + f.name + "” from the dashboard?" + (RD.demo ? "" : " The file itself stays in Google Drive.")
    });
  };
  RD.fileGrid = (files, opts) => {
    opts = opts || {};
    if (!files.length) return h("div", { class: "empty small" }, opts.empty || "No files match.");
    const grid = h("div", { class: "file-grid" });
    files.slice().sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""))).slice(0, opts.limit || 120).forEach((f) => {
      const up = Sync.uploadOf(f.id);
      const ext = (U.ext(f.name) || "file").toUpperCase().slice(0, 7);
      const thumb = h("div", { class: "file-thumb kind-" + String(f.kind || "Other").toLowerCase() }, icon(f.kind === "CAD" ? "cube" : RD.isImage(f) ? "image" : "file"), h("span", { class: "ext" }, ext));
      if (RD.isImage(f)) { thumb._load = async () => { const url = await fileUrlFor(f); if (url) { thumb.textContent = ""; thumb.classList.add("has-img"); thumb.appendChild(h("img", { src: url, alt: "", loading: "lazy" })); } }; if (io) io.observe(thumb); else thumb._load(); }
      const p = RD.byId("Projects", f.project_id);
      const state = up ? h("div", { class: "file-state" }, up.status === "uploading" ? [h("span", { class: "progress" }, h("span", { style: "width:" + Math.round(up.progress * 100) + "%" })), "Uploading " + Math.round(up.progress * 100) + "%"] : [icon("cloudoff"), RD.online() ? "Waiting to upload" : "Uploads when you are back online"]) : null;
      grid.appendChild(h("div", { class: "file-card" },
        h("button", { type: "button", class: "file-open", onclick: () => RD.openFile(f), "aria-label": "Open " + f.name }, thumb),
        h("div", { class: "file-info" },
          h("div", { class: "file-name", title: f.name }, f.name),
          h("div", { class: "small muted" }, [f.kind, U.fmtSize(f.size)].filter(Boolean).join(" · ")),
          opts.hideProject ? null : h("button", { type: "button", class: "linkish small clip", onclick: () => RD.go("project-" + f.project_id) }, p ? (p.job_no ? p.job_no + " · " : "") + p.name : f.project_name || ""),
          h("div", { class: "small muted" }, [f.uploaded_by, f.created_at ? U.ago(f.created_at) : ""].filter(Boolean).join(" · ")),
          state),
        RD.can("entry.edit", f) ? h("button", { type: "button", class: "icon-btn sm file-edit", "aria-label": "File details", title: "File details", onclick: () => RD.editFile(f) }, icon("edit")) : null));
    });
    return grid;
  };
  RD.uploadDialog = (preset, dropped) => {
    preset = preset || {};
    let files = dropped ? Array.from(dropped) : [];
    const listEl = h("div", { class: "upload-list" });
    const drawList = () => { listEl.textContent = ""; files.forEach((f, i) => listEl.appendChild(h("div", { class: "upload-item" }, icon(RD.guessKind(f.name) === "CAD" ? "cube" : RD.isImage({ name: f.name, mime: f.type }) ? "image" : "file"), h("span", { class: "clip" }, f.name), h("span", { class: "muted small" }, RD.guessKind(f.name) + " · " + U.fmtSize(f.size)), h("button", { type: "button", class: "icon-btn sm", "aria-label": "Remove " + f.name, onclick: () => { files.splice(i, 1); drawList(); } }, icon("x"))))); };
    const input = h("input", { type: "file", id: "up-files", multiple: true, class: "visually-hidden", onchange: () => { files = files.concat(Array.from(input.files)); input.value = ""; drawList(); } });
    const zone = h("label", { class: "dropzone", for: "up-files" }, icon("upload"), h("b", null, "Choose files"), h("span", { class: "muted" }, "or drop them here. SolidWorks parts, assemblies and drawings, STEP files, renders, PDFs, costing sheets."), input);
    ["dragover", "dragenter"].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add("over"); }));
    ["dragleave", "drop"].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove("over"); }));
    zone.addEventListener("drop", (e) => { files = files.concat(Array.from(e.dataTransfer.files || [])); drawList(); });
    drawList();
    const f = RD.form({
      key: "upload", draft: false, values: { project_id: preset.project_id || "", kind: "auto", note: "" },
      fields: [{ key: "project_id", label: "Project", type: "project", required: true, span: 2 }, { key: "kind", label: "Kind", type: "select", options: [{ value: "auto", label: "Decide by file type" }].concat(RD.FILE_KINDS) }, { key: "note", label: "Note", placeholder: "e.g. Rev C after design review" }],
      onSubmit: async (v) => {
        if (!files.length) return f.error("Choose at least one file.");
        m.close();
        for (const file of files) await Sync.addFile(file, { project_id: v.project_id, kind: v.kind === "auto" ? RD.guessKind(file.name) : v.kind, note: v.note });
        const n = files.length + (files.length === 1 ? " file" : " files");
        RD.toast(RD.online() ? "Uploading " + n : n + " saved on this device. They upload when you are back online.");
      }
    });
    const m = RD.modal({ title: "Upload files", wide: true, body: [f.el, zone, listEl, files.some((x) => x.size > 300e6) ? h("p", { class: "hint" }, "Large files: keep this tab open until the upload finishes.") : null], footer: (mm) => [h("span", { class: "grow" }), RD.btn("Cancel", { onclick: () => mm.close() }), RD.btn("Upload", { kind: "primary", icon: "upload", onclick: () => f.submit() })] });
  };
  /* Pick a file that already lives in the engineer's own Google Drive. */
  RD.driveDialog = (preset) => {
    if (!RD.online()) return RD.toast("Linking from Drive needs a connection. You are offline.", "bad");
    preset = preset || {};
    let chosen = null;
    const results = h("div", { class: "drive-list" }, h("div", { class: "muted pad" }, "Loading your recent files…"));
    const load = async (term) => {
      try {
        const list = await RD.Google.listMyDrive(term);
        results.textContent = "";
        if (!list.length) results.appendChild(h("div", { class: "muted pad" }, term ? "No file in your Drive has “" + term + "” in its name." : "No recent files."));
        list.forEach((d) => { const row = h("button", { type: "button", class: "drive-item", onclick: () => { chosen = d; Array.from(results.children).forEach((c) => c.classList.remove("on")); row.classList.add("on"); } }, icon(RD.guessKind(d.name) === "CAD" ? "cube" : /^image\//.test(d.mimeType) ? "image" : "file"), h("span", { class: "clip" }, d.name), h("span", { class: "muted small" }, [d.owners && d.owners[0] && d.owners[0].displayName, d.modifiedTime ? U.ago(d.modifiedTime) : "", U.fmtSize(d.size)].filter(Boolean).join(" · "))); results.appendChild(row); });
      } catch (e) { results.textContent = ""; results.appendChild(h("div", { class: "form-error" }, e.code === "auth" ? "Your Google session expired. Use Reconnect in the top bar, then try again." : "Could not read your Drive: " + e.message)); }
    };
    const search = h("input", { id: "dr-q", class: "inp", type: "search", placeholder: "Search your Drive by file name", "aria-label": "Search your Drive", oninput: U.debounce(() => load(search.value.trim()), 350) });
    const f = RD.form({
      key: "drive", draft: false, values: { project_id: preset.project_id || "", mode: "copy", kind: "auto" },
      fields: [{ key: "project_id", label: "Project", type: "project", required: true, span: 2 },
        { key: "mode", label: "How to add it", type: "select", options: [{ value: "copy", label: "Copy into the project folder (recommended)" }, { value: "link", label: "Link to my file and let colleagues view it" }], hint: "A copy stays with the project even if you later move or delete your own file." },
        { key: "kind", label: "Kind", type: "select", options: [{ value: "auto", label: "Decide by file type" }].concat(RD.FILE_KINDS) }],
      onSubmit: async (v) => {
        if (!chosen) return f.error("Choose a file from the list first.");
        const p = RD.byId("Projects", v.project_id);
        addBtn.disabled = true;
        try {
          let res;
          if (v.mode === "copy") res = await RD.Google.copyIntoProject(chosen, p);
          else { res = { drive_id: chosen.id, url: chosen.webViewLink, size: Number(chosen.size) || 0, mime: chosen.mimeType, name: chosen.name }; try { await RD.Google.shareWithDomain(chosen.id); } catch (e) { RD.toast("The file was linked, but its sharing could not be changed. Colleagues may have to request access.", "bad"); } }
          Sync.add("Files", "f", { project_id: v.project_id, project_name: p ? p.name : "", name: res.name || chosen.name, kind: v.kind === "auto" ? RD.guessKind(chosen.name) : v.kind, mime: res.mime || "", size: res.size || 0, drive_id: res.drive_id, url: res.url || "", uploaded_by: RD.session.name, note: v.mode === "link" ? "Linked from " + RD.session.name + "'s Drive" : "" });
          RD.toast("File added to the project"); m.close();
        } catch (e) { addBtn.disabled = false; f.error("Google Drive refused: " + e.message); }
      }
    });
    const addBtn = RD.btn("Add to project", { kind: "primary", onclick: () => f.submit() });
    const m = RD.modal({ title: "Link from my Google Drive", wide: true, body: [f.el, search, results], footer: (mm) => [h("span", { class: "grow" }), RD.btn("Cancel", { onclick: () => mm.close() }), addBtn] });
    load("");
  };
  V.files = (root) => {
    const s = vs.files;
    const out = h("div");
    const draw = () => {
      out.textContent = "";
      const words = s.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
      const rows = RD.rows("Files").filter((f) => (RD.seesMoney() || f.kind !== "Costing") && (!s.kind || f.kind === s.kind) && (!s.project || f.project_id === s.project) && (!words.length || words.every((w) => [f.name, f.project_name, f.note, f.uploaded_by].join(" ").toLowerCase().includes(w))));
      out.appendChild(h("div", { class: "count" }, rows.length + (rows.length === 1 ? " file" : " files") + (rows.length > 120 ? " · showing the newest 120" : "")));
      out.appendChild(RD.fileGrid(rows, { empty: RD.rows("Files").length ? "No file matches these filters." : "No files yet. Upload SolidWorks models, renders and documents, or link them from Google Drive." }));
    };
    const search = h("input", { id: "fl-q", class: "inp inp-sm search", type: "search", placeholder: "Search files", "aria-label": "Search files", value: s.q, oninput: U.debounce(() => { s.q = search.value; draw(); }, 150) });
    const kinds = RD.FILE_KINDS.filter((k) => RD.seesMoney() || k !== "Costing");
    const chips = h("div", { class: "chips", role: "group", "aria-label": "File kind" });
    const drawChips = () => { chips.textContent = ""; [""].concat(kinds).forEach((k) => chips.appendChild(h("button", { type: "button", class: "chip" + (s.kind === k ? " on" : ""), "aria-pressed": String(s.kind === k), onclick: () => { s.kind = k; drawChips(); draw(); } }, k || "All"))); };
    drawChips();
    root.appendChild(h("div", { class: "filters" }, h("span", { class: "search-wrap" }, icon("search"), search), chips,
      h("div", { class: "filter-picker" }, RD.projectPicker({ id: "fl-project", value: s.project, placeholder: "All projects", onChange: (v) => { s.project = v; draw(); } })),
      h("span", { class: "grow" }),
      RD.can("entry.add") && !RD.demo ? RD.btn("Link from my Drive", { icon: "link", small: true, onclick: () => RD.driveDialog({ project_id: s.project }) }) : null,
      RD.can("entry.add") ? RD.btn("Upload files", { icon: "upload", kind: "primary", small: true, id: "btn-upload", onclick: () => RD.uploadDialog({ project_id: s.project }) }) : null));
    root.appendChild(out);
    if (RD.can("entry.add")) {
      root.addEventListener("dragover", (e) => { if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes("Files")) e.preventDefault(); });
      root.addEventListener("drop", (e) => { if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length && !RD.modals) { e.preventDefault(); RD.uploadDialog({ project_id: s.project }, e.dataTransfer.files); } });
    }
    draw();
  };

  /* ================================================================ TEAM */
  RD.editUser = (u, preset) => {
    const isNew = !u;
    RD.formModal({
      key: "user-" + (u ? u.id : "new"), draft: false, title: isNew ? "Add person" : "Edit person", submitLabel: isNew ? "Add person" : "Save changes",
      values: u ? Object.assign({ email: u.id }, u) : Object.assign({ role: "engineer", active: "yes" }, preset || {}),
      fields: [
        { key: "email", label: "Google account (email)", required: true, span: 2, placeholder: "name@" + (RD.config.domain || "yourcompany.com"), hint: isNew ? "This is the account they sign in with." : "To change the email, switch this person off and add them again." },
        { key: "name", label: "Short name", required: true, hint: "Exactly as written in the Engineer column, e.g. Amal" },
        { key: "full_name", label: "Full name" },
        { key: "role", label: "Role", type: "select", options: [{ value: "admin", label: "Supervisor (admin)" }, { value: "engineer", label: "Engineer" }, { value: "guest", label: "Guest (view only)" }] },
        { key: "pillar", label: "Pillar / team", list: RD.uniq("Projects", "pillar") },
        { key: "active", label: "Access", type: "select", options: [{ value: "yes", label: "On" }, { value: "no", label: "Switched off" }] }
      ],
      validate: (v) => {
        const email = v.email.toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return "Enter a full email address.";
        if (isNew && RD.rows("Users").some((x) => String(x.id).toLowerCase() === email)) return "This email is already in the list.";
        if (!isNew && email !== String(u.id).toLowerCase()) return "The email cannot be changed here. Switch this person off and add them again with the new email.";
        if (u && U.same(u.id, RD.session.email) && (v.role !== "admin" || v.active === "no") && RD.rows("Users").filter((x) => x.role === "admin" && String(x.active).toLowerCase() !== "no").length <= 1 && !RD.config.admins.length) return "You are the only supervisor. Make someone else a supervisor first.";
        return null;
      },
      onSubmit: (v) => {
        const data = { name: v.name, full_name: v.full_name, role: v.role, pillar: v.pillar, active: v.active };
        if (isNew) { Sync.mutate("Users", v.email.toLowerCase(), data, true); RD.toast(v.name + " added"); }
        else { const patch = {}; Object.keys(data).forEach((k) => { if (data[k] !== (u[k] || "")) patch[k] = data[k]; }); if (Object.keys(patch).length) { Sync.mutate("Users", u.id, patch); RD.toast("Changes saved"); } }
      }
    });
  };
  V.team = (root) => {
    if (RD.role() === "guest") return restricted(root, "The team list is visible to R&D staff.");
    const users = RD.rows("Users");
    const open = {}; RD.rows("Projects").filter(RD.isOpen).forEach((p) => U.splitNames(p.engineer).forEach((n) => (open[n.toLowerCase()] = (open[n.toLowerCase()] || 0) + 1)));
    const [from, to] = RD.periodRange("4w");
    const hrs = {}; RD.rows("TimeLogs").forEach((l) => { if (l.date >= from && l.date <= to) { const k = String(l.engineer).toLowerCase(); hrs[k] = (hrs[k] || 0) + U.num(l.hours); } });
    root.appendChild(RD.panel("People", RD.table({
      rows: users, sortKey: "name", empty: "Nobody has been added yet.",
      columns: [
        { key: "name", label: "Name", cls: "col-main", render: (u) => h("div", { class: "person" }, h("span", { class: "avatar" }, RD.initials(u.full_name || u.name)), h("div", null, h("div", { class: "cell-title" }, u.name + (U.same(u.id, RD.session.email) ? " (you)" : "")), h("div", { class: "small muted" }, u.full_name && u.full_name !== u.name ? u.full_name + " · " + u.id : u.id))) },
        { key: "role", label: "Role", render: (u) => h("span", { class: "tag tag-" + (u.role === "admin" ? "info" : u.role === "engineer" ? "ok" : "plain") }, RD.ROLES[u.role] || "Guest") },
        { key: "pillar", label: "Pillar", cls: "hide-sm" },
        { key: "open", label: "Open projects", num: true, sort: (u) => open[String(u.name).toLowerCase()] || 0, render: (u) => open[String(u.name).toLowerCase()] || null },
        { key: "hours", label: "Hours, 4 weeks", num: true, cls: "hide-sm", sort: (u) => hrs[String(u.name).toLowerCase()] || 0, render: (u) => (hrs[String(u.name).toLowerCase()] ? U.fmtHours(hrs[String(u.name).toLowerCase()]) : null) },
        { key: "active", label: "Access", render: (u) => (String(u.active).toLowerCase() === "no" ? h("span", { class: "tag tag-bad" }, "Off") : h("span", { class: "muted" }, "On")) },
        { key: "_", label: "", sortable: false, cls: "col-act", render: (u) => (RD.isAdmin() ? editBtn("Edit " + u.name, () => RD.editUser(u)) : h("span")) }
      ]
    }), RD.isAdmin() ? RD.btn("Add person", { icon: "plus", kind: "primary", small: true, id: "btn-add-user", onclick: () => RD.editUser(null) }) : null));
    if (RD.isAdmin()) {
      const known = new Set(users.map((u) => String(u.name).toLowerCase()));
      const loose = RD.engineerNames().filter((n) => !known.has(n.toLowerCase()));
      if (loose.length) root.appendChild(RD.panel("Engineers in the project list without an account", [h("p", { class: "muted" }, "These names appear in the Engineer column but nobody with that short name can sign in yet. Add each person with their company email so their projects and hours link up."), h("div", { class: "chips" }, loose.map((n) => h("button", { type: "button", class: "chip", onclick: () => RD.editUser(null, { name: n, role: "engineer", active: "yes" }) }, icon("plus"), n + " (" + (open[n.toLowerCase()] || 0) + " open)")))]));
    }
    root.appendChild(RD.panel("What each role can do", h("div", { class: "roles" },
      h("div", null, h("h4", null, "Supervisor"), h("p", null, "Sees and edits everything. Adds and removes people, sets roles, deletes projects, edits anyone's time, costings and files.")),
      h("div", null, h("h4", null, "Engineer"), h("p", null, "Adds projects and edits the ones they own. Logs their own time, posts updates, adds costings and files on any project, and edits or deletes their own entries.")),
      h("div", null, h("h4", null, "Guest"), h("p", null, "Colleagues from other departments. View only: project list, status, updates and files. Budgets, BIP values and costings stay hidden unless a supervisor allows them in Settings.")))));
  };

  /* ================================================================ SETTINGS */
  V.settings = (root) => {
    const st = RD.state, info = st.info || {};
    const row = (label, value) => h("div", { class: "fact" }, h("dt", null, label), h("dd", null, value));
    root.appendChild(RD.panel("Your account", h("dl", { class: "facts" }, row("Name", RD.session.fullName || RD.session.name), row("Signed in as", RD.session.email), row("Role", RD.ROLES[RD.role()]), row("Short name on projects", RD.session.name)), RD.btn("Sign out", { icon: "logout", small: true, onclick: () => RD.signOutFlow() })));

    const conn = [];
    if (RD.demo) {
      conn.push(h("p", null, RD.preview ? "This is a preview running inside Claude. Everything you add here is kept in this browser only." : "Demo mode: no Google Sheet is connected, so everything you add is kept in this browser only."));
      conn.push(h("p", { class: "muted" }, "To go live, host the project files (GitHub Pages works), create a Google sign-in client, and put the client ID, the sheet ID and the Drive folder ID in config.js. The steps are in docs/SETUP.md in the project files."));
      conn.push(h("div", { class: "btn-row" }, RD.btn("Reset demo data", { icon: "refresh", small: true, onclick: async () => { if (await RD.confirm("Reset demo data", "Throw away everything added in this demo and start again from the sample data?", "Reset", true)) { st.queue = []; st.uploads = []; Store.set("queue", []); Store.set("uploads", []); RD.Demo.reset(); await Sync.pull(); RD.toast("Demo data reset"); } } }), RD.Demo.hasSamples() ? RD.btn("Remove sample entries", { small: true, onclick: () => RD.removeSamples() }) : null));
    } else {
      conn.push(h("dl", { class: "facts" }, row("Google Sheet", h("a", { href: RD.Google.sheetUrl(), target: "_blank", rel: "noopener" }, info.title || "Open sheet")), RD.Google.folderUrl() ? row("Drive folder", h("a", { href: RD.Google.folderUrl(), target: "_blank", rel: "noopener" }, "Open folder")) : row("Drive folder", "Not set in config.js: file uploads are off"), row("Last synced", st.lastSync ? U.ago(st.lastSync) : "Not yet"), row("Company domain", RD.config.domain || "Any Google account")));
      const problems = [];
      if ((info.missingTabs || []).length) problems.push("Missing tabs: " + info.missingTabs.join(", "));
      Object.keys(info.missingCols || {}).forEach((t) => problems.push(t + " is missing columns: " + info.missingCols[t].join(", ")));
      const noId = Object.keys(info.noIdRows || {});
      noId.forEach((t) => problems.push(info.noIdRows[t] + " row(s) in " + t + " have no id and are hidden from the dashboard"));
      if (problems.length) {
        conn.push(h("div", { class: "note note-warn" }, icon("alert"), h("div", null, h("b", null, "The sheet needs attention"), h("ul", null, problems.map((p) => h("li", null, p))))));
        if (RD.isAdmin()) conn.push(h("div", { class: "btn-row" },
          (info.missingTabs || []).length || Object.keys(info.missingCols || {}).length ? RD.btn("Add missing tabs and columns", { kind: "primary", small: true, id: "btn-setup-sheet", onclick: async (e) => { e.currentTarget.disabled = true; try { await RD.Google.setupSheet(); await Sync.pull(); RD.toast("Sheet is set up"); } catch (err) { RD.toast("Could not change the sheet: " + err.message, "bad"); } RD.renderView(); } }) : null,
          noId.length ? RD.btn("Give ids to rows without one", { small: true, onclick: async () => { try { const n = await RD.Google.assignIds(); await Sync.pull(); RD.toast(n + " row(s) now have an id"); } catch (err) { RD.toast("Could not change the sheet: " + err.message, "bad"); } RD.renderView(); } }) : null));
      } else conn.push(h("div", { class: "note note-ok" }, icon("check"), "The sheet has every tab and column the dashboard needs."));
    }
    root.appendChild(RD.panel("Connection", conn));

    if (RD.isAdmin()) {
      const on = String(RD.setting("guest_sees_finance", "no")).toLowerCase() === "yes";
      root.appendChild(RD.panel("Guests", [h("label", { class: "check" }, h("input", { type: "checkbox", id: "set-guest-finance", checked: on, onchange: (e) => { const exists = RD.byId("Settings", "guest_sees_finance"); Sync.mutate("Settings", "guest_sees_finance", { value: e.target.checked ? "yes" : "no" }, !exists); RD.toast(e.target.checked ? "Guests can now see finance figures" : "Finance figures are hidden from guests"); } }), "Let guests see BIP values, budgets and costings"), RD.demo ? null : h("p", { class: "hint" }, "This hides the figures inside the dashboard. Anyone who can open the Google Sheet itself can still read them there, so share the sheet only with people who may see them.")]));
    }

    const dev = [h("dl", { class: "facts" }, row("Changes waiting to sync", String(Sync.pending())), row("Files waiting to upload", String(st.uploads.length)), row("Saved on this device", Store.ok ? "Yes: the dashboard opens and takes changes without a connection" : "No: this browser blocks local storage, so offline changes are lost if the tab closes"))];
    dev.push(h("div", { class: "btn-row" }, RD.btn("Sync details", { icon: "cloud", small: true, onclick: () => RD.syncPanel() }), RD.demo ? h("label", { class: "check" }, h("input", { type: "checkbox", id: "set-offline", checked: RD.forceOffline, onchange: (e) => { Sync.setForceOffline(e.target.checked); RD.toast(e.target.checked ? "Working offline: changes wait on this device" : "Back online: sending changes"); } }), "Work offline (try it: make changes, then switch back)") : null));
    root.appendChild(RD.panel("This device", dev));

    root.appendChild(RD.panel("Working with Claude", [h("p", null, RD.demo ? "Once the dashboard is connected to your Google Sheet, Claude can read and update that same sheet through its Google Sheets connector. Ask it to log hours, post status updates or summarise the week, and the dashboard shows the result at the next sync." : "Claude can read and update this same Google Sheet through its Google Sheets connector. Ask it to log hours, post status updates or summarise the week, and the dashboard shows the result at the next sync."), h("p", { class: "muted" }, "The instructions Claude needs (tab layout, id and date rules) are in docs/CLAUDE_INSTRUCTIONS.md in the project files.")]));
  };
  RD.removeSamples = async () => {
    if (!(await RD.confirm("Remove sample entries", "Remove the sample time logs, costings and files? Projects and anything you added yourself stay.", "Remove", true))) return;
    RD.Demo.removeSamples(); await Sync.pull(); RD.toast("Sample entries removed");
  };

  /* ================================================================ SYNC PANEL */
  const opLabel = (o) => {
    const row = RD.byId(o.table, o.id) || o.patch;
    const what = { Projects: "Project", TimeLogs: "Time entry", Costings: "Costing", Files: "File", Updates: "Update", Users: "Person", Settings: "Setting" }[o.table] || o.table;
    const name = row.name || row.title || row.project_name || row.text || o.id;
    return what + (RD.isDeletedValue(o.patch.deleted) ? " deleted" : o.isNew ? " added" : " changed") + ": " + String(name).slice(0, 70);
  };
  RD.syncPanel = () => {
    const body = h("div", { class: "sync-panel" });
    const draw = () => {
      const st = RD.state;
      body.textContent = "";
      const online = RD.online();
      body.appendChild(h("div", { class: "note " + (!online || st.needAuth ? "note-warn" : st.error ? "note-bad" : "note-ok") }, icon(!online ? "cloudoff" : st.error || st.needAuth ? "alert" : "check"), h("div", null,
        !online ? [h("b", null, "You are offline"), h("div", null, "Keep working. Every change is saved on this device and sent as soon as the connection is back.")]
          : st.needAuth ? [h("b", null, "Google sign-in has expired"), h("div", null, "Your changes are safe on this device. Reconnect to send them.")]
          : st.error ? [h("b", null, "The last sync failed"), h("div", null, st.error)]
          : [h("b", null, st.queue.length ? "Sending changes" : "Everything is saved"), h("div", null, st.lastSync ? "Last synced " + U.ago(st.lastSync) + "." : "")])));
      if (st.queue.length) {
        body.appendChild(h("div", { class: "label" }, st.queue.length + " waiting on this device"));
        const list = h("ul", { class: "queue" });
        st.queue.slice(-30).reverse().forEach((o) => list.appendChild(h("li", null, h("span", null, opLabel(o)), h("span", { class: "muted small" }, (o.hold ? "waiting for its file · " : "") + U.ago(o.ts)))));
        body.appendChild(list);
      }
      if (st.uploads.length) {
        body.appendChild(h("div", { class: "label" }, st.uploads.length + " file(s) to upload"));
        const list = h("ul", { class: "queue" });
        st.uploads.forEach((u) => list.appendChild(h("li", null, h("span", { class: "clip" }, u.name), h("span", { class: "muted small" }, u.status === "uploading" ? Math.round(u.progress * 100) + "%" : U.fmtSize(u.size)))));
        body.appendChild(list);
      }
    };
    const redraw = () => draw();
    ["status", "change", "upload"].forEach((ev) => RD.on(ev, redraw));
    RD.modal({
      title: "Sync", body, onClose: () => ["status", "change", "upload"].forEach((ev) => RD.off(ev, redraw)),
      footer: () => [RD.demo ? h("label", { class: "check" }, h("input", { type: "checkbox", id: "sync-offline", checked: RD.forceOffline, onchange: (e) => Sync.setForceOffline(e.target.checked) }), "Work offline") : null, h("span", { class: "grow" }),
        RD.state.needAuth ? (() => { const b = RD.btn("Reconnect to Google", { kind: "primary", onclick: () => RD.Auth.reconnect().catch((e) => RD.toast(e.message, "bad")) }); b.setAttribute("data-reconnect", ""); return b; })() : RD.btn("Sync now", { icon: "refresh", kind: "primary", onclick: () => Sync.flush().then(() => Sync.pull()) })]
    });
    draw();
  };
})();
