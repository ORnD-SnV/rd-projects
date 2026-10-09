/* ui.js — DOM helper, icons, dialogs, forms, tables, charts. No framework. */
(function () {
  "use strict";
  const RD = window.RD, U = RD.U, Store = RD.Store;

  /* ---------------------------------------------------------------- h() */
  function h(tag, attrs) {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k.slice(0, 2) === "on" && typeof v === "function") el.addEventListener(k.slice(2), v);
      else if (k === "value") el.value = v;
      else if (v === true) el.setAttribute(k, "");
      else el.setAttribute(k, v);
    }
    for (let i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, kid) {
    if (kid == null || kid === false) return;
    if (Array.isArray(kid)) return kid.forEach((k) => append(el, k));
    el.appendChild(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  RD.h = h;

  /* ---------------------------------------------------------------- icons (static, trusted markup) */
  const P = {
    grid: '<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="11" y="3" width="6" height="6" rx="1"/><rect x="3" y="11" width="6" height="6" rx="1"/><rect x="11" y="11" width="6" height="6" rx="1"/>',
    list: '<path d="M7 5h10M7 10h10M7 15h10"/><circle cx="3.5" cy="5" r=".8"/><circle cx="3.5" cy="10" r=".8"/><circle cx="3.5" cy="15" r=".8"/>',
    clock: '<circle cx="10" cy="10" r="7"/><path d="M10 6v4l2.5 2"/>',
    coins: '<ellipse cx="10" cy="5.5" rx="6" ry="2.5"/><path d="M4 5.5v4.5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V5.5M4 10v4.5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V10"/>',
    file: '<path d="M5 2.5h6l4 4v11H5z"/><path d="M11 2.5v4h4"/>',
    users: '<circle cx="7.5" cy="7" r="3"/><path d="M2 17c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/><path d="M13.5 4.5a3 3 0 0 1 0 5M15 12.4c1.8.7 3 2.4 3 4.6"/>',
    gear: '<circle cx="10" cy="10" r="2.6"/><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4"/>',
    plus: '<path d="M10 4v12M4 10h12"/>',
    play: '<path d="M6 4l10 6-10 6z" fill="currentColor"/>',
    stop: '<rect x="5" y="5" width="10" height="10" rx="1.5" fill="currentColor"/>',
    search: '<circle cx="9" cy="9" r="5.5"/><path d="M13.5 13.5L17 17"/>',
    cloud: '<path d="M6 15.5a4 4 0 0 1-.6-7.95 5 5 0 0 1 9.7 1.05A3.5 3.5 0 0 1 14.5 15.5z"/>',
    cloudoff: '<path d="M6 15.5a4 4 0 0 1-.6-7.95M8 5.2a5 5 0 0 1 7.1 3.4 3.5 3.5 0 0 1 1.6 5.6M3 3l14 14"/>',
    check: '<path d="M4 10.5l4 4 8-9"/>',
    alert: '<path d="M10 3l8 14H2z"/><path d="M10 8v4M10 14.5v.5"/>',
    x: '<path d="M5 5l10 10M15 5L5 15"/>',
    upload: '<path d="M10 13V3M6 7l4-4 4 4M3 13v3.5h14V13"/>',
    link: '<path d="M8.5 11.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1"/><path d="M11.5 8.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1"/>',
    edit: '<path d="M3 17l1-4L14 3l3 3L7 16z"/><path d="M12 5l3 3"/>',
    trash: '<path d="M4 6h12M8 6V3.5h4V6M5.5 6l.7 11h7.6l.7-11"/>',
    logout: '<path d="M12 3H4v14h8M9 10h9M15 7l3 3-3 3"/>',
    back: '<path d="M12 4l-6 6 6 6"/>',
    refresh: '<path d="M16.5 10a6.5 6.5 0 1 1-2-4.7M16.5 3v3.5H13"/>',
    download: '<path d="M10 3v10M6 9l4 4 4-4M3 13v3.5h14V13"/>',
    note: '<path d="M4 3h12v10l-4 4H4z"/><path d="M12 17v-4h4M7 7h6M7 10h4"/>',
    cube: '<path d="M10 2.5l6.5 3.7v7.6L10 17.5l-6.5-3.7V6.2z"/><path d="M3.5 6.2L10 10l6.5-3.8M10 10v7.5"/>',
    image: '<rect x="3" y="4" width="14" height="12" rx="1.5"/><circle cx="7.5" cy="8.5" r="1.3"/><path d="M3.5 14.5l4-4 3 3 2.5-2.5 3.5 3.5"/>',
    open: '<path d="M11 4h5v5M16 4l-7 7M14 11v5H4V6h5"/>',
    sun: '<circle cx="10" cy="10" r="3.2"/><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4"/>',
    /* status glyphs: shape differs per status so colour is never the only cue */
    s_done: '<path d="M5 10.5l3.5 3.5L15 6.5" stroke-width="2.4"/>',
    s_ok: '<circle cx="10" cy="10" r="4.2" fill="currentColor" stroke="none"/>',
    s_risk: '<path d="M10 4l6.5 11.5h-13z" fill="currentColor" stroke="none"/>',
    s_bad: '<path d="M5.5 5.5l9 9M14.5 5.5l-9 9" stroke-width="2.4"/>',
    s_hold: '<path d="M7 5v10M13 5v10" stroke-width="2.6"/>',
    s_tbc: '<circle cx="10" cy="10" r="4.6"/>',
    s_none: '<path d="M6 10h8"/>'
  };
  RD.icon = (name, cls) => {
    const span = document.createElement("span");
    span.className = "ic" + (cls ? " " + cls : "");
    span.setAttribute("aria-hidden", "true");
    span.innerHTML = '<svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + (P[name] || "") + "</svg>";
    return span;
  };
  const icon = RD.icon;

  RD.pill = (status) => {
    const key = RD.STATUS_KEY[status] || (status ? "tbc" : "none");
    return h("span", { class: "pill st-" + key }, icon("s_" + key), RD.statusLabel(status));
  };
  RD.btn = (label, opts) => {
    opts = opts || {};
    return h("button", { type: opts.type || "button", class: "btn" + (opts.kind ? " btn-" + opts.kind : "") + (opts.small ? " btn-sm" : ""), onclick: opts.onclick, title: opts.title, disabled: opts.disabled, id: opts.id, "aria-label": opts.aria }, opts.icon ? icon(opts.icon) : null, label ? h("span", null, label) : null);
  };
  RD.initials = (name) => String(name || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  /* ---------------------------------------------------------------- toast */
  let toastWrap;
  RD.toast = (msg, tone) => {
    if (!toastWrap) { toastWrap = h("div", { class: "toasts", role: "status", "aria-live": "polite" }); document.body.appendChild(toastWrap); }
    const t = h("div", { class: "toast" + (tone ? " toast-" + tone : "") }, msg);
    toastWrap.appendChild(t);
    setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 300); }, tone === "bad" ? 7000 : 3600);
  };

  /* ---------------------------------------------------------------- modal */
  RD.modals = 0;
  RD.modal = (opts) => {
    const back = h("div", { class: "modal-back" });
    const box = h("div", { class: "modal" + (opts.wide ? " modal-wide" : ""), role: "dialog", "aria-modal": "true", "aria-label": opts.title });
    const prevFocus = document.activeElement;
    const api = { el: box, closed: false };
    api.close = (reason) => {
      if (api.closed) return;
      api.closed = true; RD.modals--;
      document.removeEventListener("keydown", onKey);
      back.remove();
      if (prevFocus && prevFocus.focus) try { prevFocus.focus(); } catch (e) {}
      if (opts.onClose) opts.onClose(reason);
      if (RD.modals === 0) RD.emit("modalsClosed");
    };
    const onKey = (e) => { const all = document.querySelectorAll(".modal-back"); if (e.key === "Escape" && all[all.length - 1] === back) api.close("esc"); };
    box.appendChild(h("div", { class: "modal-head" }, h("h2", null, opts.title), h("button", { class: "icon-btn", type: "button", "aria-label": "Close", onclick: () => api.close("x") }, icon("x"))));
    const body = h("div", { class: "modal-body" });
    append(body, typeof opts.body === "function" ? opts.body(api) : opts.body);
    box.appendChild(body);
    if (opts.footer) { const f = h("div", { class: "modal-foot" }); append(f, typeof opts.footer === "function" ? opts.footer(api) : opts.footer); box.appendChild(f); }
    back.appendChild(box);
    back.addEventListener("mousedown", (e) => { if (e.target === back) api.close("backdrop"); });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(back);
    RD.modals++;
    const first = box.querySelector(".modal-body input:not([type=hidden]):not([type=file]):not([type=checkbox]), .modal-body textarea") || box.querySelector(".modal-foot .btn-primary") || box.querySelector(".icon-btn");
    if (first) try { first.focus(); } catch (e) {}
    return api;
  };
  RD.confirm = (title, message, okLabel, danger) =>
    new Promise((resolve) => {
      let answered = false;
      RD.modal({
        title, body: h("p", { class: "confirm-text" }, message),
        footer: (m) => [RD.btn("Cancel", { onclick: () => m.close() }), RD.btn(okLabel || "OK", { kind: danger ? "danger" : "primary", onclick: () => { answered = true; m.close(); resolve(true); } })],
        onClose: () => { if (!answered) resolve(false); }
      });
    });

  /* ---------------------------------------------------------------- project picker (searchable) */
  RD.projectLabel = (p) => (p ? (p.job_no ? p.job_no + " · " : "") + p.name : "");
  RD.projectPicker = (opts) => {
    let value = opts.value || "", items = [], active = -1;
    const input = h("input", { type: "text", id: opts.id, class: "inp", placeholder: opts.placeholder || "Search job no. or project name", autocomplete: "off", role: "combobox", "aria-expanded": "false", "aria-autocomplete": "list" });
    const list = h("div", { class: "picker-list", hidden: true, role: "listbox" });
    const wrap = h("div", { class: "picker" }, input, list);
    const cur = () => RD.byId("Projects", value);
    input.value = RD.projectLabel(cur());
    const close = () => { list.hidden = true; input.setAttribute("aria-expanded", "false"); };
    const choose = (p) => { value = p ? p.id : ""; input.value = RD.projectLabel(p); close(); if (opts.onChange) opts.onChange(value); };
    const render = () => {
      const qy = input.value.trim().toLowerCase();
      const sel = cur();
      const typed = sel && input.value === RD.projectLabel(sel) ? "" : qy;
      let rows = RD.rows("Projects");
      if (typed) { const parts = typed.split(/\s+/); rows = rows.filter((p) => { const hay = (p.job_no + " " + p.name + " " + p.engineer + " " + p.category).toLowerCase(); return parts.every((w) => hay.includes(w)); }); }
      rows = rows.slice().sort((a, b) => (RD.mine(b.engineer) - RD.mine(a.engineer)) || (RD.isOpen(b) - RD.isOpen(a)) || String(a.name).localeCompare(String(b.name)));
      items = rows.slice(0, 40); active = items.length ? 0 : -1;
      list.textContent = "";
      if (!items.length) list.appendChild(h("div", { class: "picker-empty" }, "No project matches “" + input.value + "”."));
      items.forEach((p, i) => list.appendChild(h("div", { class: "picker-item" + (i === active ? " active" : ""), role: "option", onmousedown: (e) => { e.preventDefault(); choose(p); } }, h("span", { class: "mono" }, p.job_no || "—"), h("span", { class: "picker-name" }, p.name), h("span", { class: "muted" }, p.engineer || ""))));
      if (rows.length > items.length) list.appendChild(h("div", { class: "picker-empty" }, "Showing 40 of " + rows.length + ". Type to narrow down."));
      list.hidden = false; input.setAttribute("aria-expanded", "true");
    };
    const mark = () => Array.from(list.querySelectorAll(".picker-item")).forEach((el, i) => { el.classList.toggle("active", i === active); if (i === active) el.scrollIntoView({ block: "nearest" }); });
    // The list opens on a click or on typing, not on focus alone, so tabbing through a form stays quiet.
    input.addEventListener("focus", () => input.select());
    input.addEventListener("click", () => { if (list.hidden) render(); });
    input.addEventListener("input", render);
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); if (list.hidden) render(); else { active = Math.min(items.length - 1, active + 1); mark(); } }
      else if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(0, active - 1); mark(); }
      else if (e.key === "Enter") { if (!list.hidden && items[active]) { e.preventDefault(); choose(items[active]); } }
      else if (e.key === "Escape") { if (!list.hidden) { e.stopPropagation(); close(); input.value = RD.projectLabel(cur()); } }
    });
    input.addEventListener("blur", () => setTimeout(() => { close(); if (!input.value.trim() && value && opts.clearable !== false) choose(null); else input.value = RD.projectLabel(cur()); }, 120));
    wrap.getValue = () => value;
    wrap.setValue = (v) => { value = v || ""; input.value = RD.projectLabel(cur()); };
    return wrap;
  };

  /* ---------------------------------------------------------------- forms
     fields: [{ key, label, type, options, required, hint, span, list, placeholder, min, step }]
     Unsaved input is kept on this device (draft) until the form is saved or cancelled. */
  RD.form = (opts) => {
    const formKey = opts.key, ctrls = {}, values = Object.assign({}, opts.values || {});
    const draftKey = opts.draft === false ? null : "draft:" + formKey;
    let restored = false, dead = false, touched = false;
    if (draftKey) { const d = Store.get(draftKey); if (d && typeof d === "object") { Object.assign(values, d); restored = true; } }
    const grid = h("div", { class: "form-grid" });
    const err = h("div", { class: "form-error", role: "alert", hidden: true });
    opts.fields.forEach((f) => {
      if (!f) return;
      if (f.type === "group") { grid.appendChild(h("div", { class: "form-group-title span-2" }, f.label)); return; }
      const id = "f-" + formKey.replace(/[^a-z0-9]+/gi, "-") + "-" + f.key;
      let c; const v = values[f.key] == null ? "" : values[f.key];
      if (f.type === "textarea") c = h("textarea", { id, class: "inp", rows: f.rows || 3, placeholder: f.placeholder }), (c.value = v);
      else if (f.type === "select") {
        c = h("select", { id, class: "inp" });
        (f.options || []).forEach((o) => { const ov = typeof o === "object" ? o.value : o, ol = typeof o === "object" ? o.label : o; c.appendChild(h("option", { value: ov }, ol)); });
        if (v !== "" && !Array.from(c.options).some((o) => o.value === String(v))) c.appendChild(h("option", { value: v }, String(v)));
        c.value = v;
      } else if (f.type === "project") c = RD.projectPicker({ id, value: v, onChange: () => changed() });
      else if (f.type === "file") c = h("input", { id, class: "inp", type: "file", multiple: f.multiple });
      else {
        c = h("input", { id, class: "inp" + (f.type === "number" ? " num" : ""), type: f.type === "number" ? "text" : f.type || "text", inputmode: f.type === "number" ? "decimal" : null, placeholder: f.placeholder, min: f.min, max: f.max, step: f.step, autocomplete: "off" });
        c.value = v;
        if (f.list && f.list.length) { const dl = h("datalist", { id: id + "-dl" }); f.list.forEach((o) => dl.appendChild(h("option", { value: o }))); c.setAttribute("list", id + "-dl"); grid.appendChild(dl); }
      }
      ctrls[f.key] = c;
      grid.appendChild(h("div", { class: "field" + (f.span === 2 || f.type === "textarea" ? " span-2" : "") }, h("label", { for: id }, f.label, f.required ? h("span", { class: "req", title: "Required" }, " *") : null), c, f.hint ? h("div", { class: "hint" }, f.hint) : null));
      if (f.type !== "project" && f.type !== "file") { c.addEventListener("input", () => changed(f.key)); c.addEventListener("change", () => changed(f.key)); }
    });
    const read = () => {
      const out = {};
      opts.fields.forEach((f) => {
        if (!f || f.type === "group") return;
        const c = ctrls[f.key];
        if (f.type === "project") out[f.key] = c.getValue();
        else if (f.type === "file") out[f.key] = Array.from(c.files || []);
        else if (f.type === "number") { const s = c.value.replace(/,/g, "").trim(); out[f.key] = s === "" ? "" : isFinite(+s) ? +s : NaN; }
        else out[f.key] = c.value.trim ? c.value.trim() : c.value;
      });
      return out;
    };
    const writeDraft = () => { if (!draftKey || dead || !touched) return; const v = read(); opts.fields.forEach((f) => { if (f && f.type === "file") delete v[f.key]; }); Store.set(draftKey, v); };
    const saveDraft = U.debounce(writeDraft, 300);
    function changed(key) { touched = true; err.hidden = true; if (opts.onChange) opts.onChange(key, api); saveDraft(); }
    const api = {
      el: h("form", { class: "form", novalidate: true, onsubmit: (e) => { e.preventDefault(); api.submit(); } }, restored ? h("div", { class: "draft-note" }, icon("note"), "Restored what you had typed before. ", h("button", { type: "button", class: "linkish", onclick: () => { Store.del(draftKey); opts.fields.forEach((f) => { if (f && f.key && ctrls[f.key] && f.type !== "file") { const o = (opts.values || {})[f.key]; if (f.type === "project") ctrls[f.key].setValue(o); else ctrls[f.key].value = o == null ? "" : o; } }); api.el.querySelector(".draft-note").remove(); } }, "Clear")) : null, grid, err, h("button", { type: "submit", hidden: true })),
      ctrls, read,
      set: (k, v) => { const c = ctrls[k]; if (!c) return; if (c.setValue) c.setValue(v); else c.value = v == null ? "" : v; },
      error: (m) => { err.textContent = m; err.hidden = false; },
      clearDraft: () => { dead = true; if (draftKey) Store.del(draftKey); },
      /* The dialog was closed without Save or Cancel: keep what was typed, then stop writing. */
      park: () => { writeDraft(); dead = true; },
      submit: () => {
        const v = read();
        for (const f of opts.fields) {
          if (!f || f.type === "group") continue;
          if (f.required && (v[f.key] === "" || v[f.key] == null || (Array.isArray(v[f.key]) && !v[f.key].length))) { api.error("Fill in “" + f.label + "”."); const c = ctrls[f.key]; (c.querySelector ? c.querySelector("input") || c : c).focus(); return; }
          if (f.type === "number" && typeof v[f.key] === "number" && isNaN(v[f.key])) { api.error("“" + f.label + "” must be a number."); ctrls[f.key].focus(); return; }
        }
        const problem = opts.validate ? opts.validate(v) : null;
        if (problem) return api.error(problem);
        opts.onSubmit(v, api);
      }
    };
    return api;
  };
  /* A form inside a modal with Save / Cancel. */
  RD.formModal = (opts) => {
    const f = RD.form(Object.assign({}, opts, { onSubmit: (v) => { const r = opts.onSubmit(v, f); if (r !== false) { f.clearDraft(); m.close("saved"); } } }));
    const m = RD.modal({
      title: opts.title, wide: opts.wide, body: [opts.intro ? h("p", { class: "muted form-intro" }, opts.intro) : null, f.el], onClose: () => f.park(),
      footer: (mm) => [opts.onDelete ? RD.btn(opts.deleteLabel || "Delete", { kind: "danger-ghost", icon: "trash", onclick: async () => { if (await RD.confirm(opts.deleteLabel || "Delete", opts.deleteConfirm || "Delete this entry? It is removed for everyone.", "Delete", true)) { opts.onDelete(); f.clearDraft(); mm.close("deleted"); } } }) : null, h("span", { class: "grow" }), RD.btn("Cancel", { onclick: () => { f.clearDraft(); mm.close("cancel"); } }), RD.btn(opts.submitLabel || "Save", { kind: "primary", onclick: () => f.submit() })]
    });
    return { form: f, modal: m };
  };

  /* ---------------------------------------------------------------- table */
  RD.table = (opts) => {
    let sortKey = opts.sortKey || null, sortDir = opts.sortDir || 1, limit = opts.limit || 150;
    const wrap = h("div", { class: "table-wrap" });
    const draw = () => {
      wrap.textContent = "";
      let rows = opts.rows.slice();
      const col = opts.columns.find((c) => c.key === sortKey);
      if (col) rows.sort((a, b) => { const x = (col.sort || col.value || ((r) => r[col.key]))(a), y = (col.sort || col.value || ((r) => r[col.key]))(b); const ex = x === "" || x == null, ey = y === "" || y == null; if (ex !== ey) return ex ? 1 : -1; return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * sortDir; });
      if (!rows.length) { wrap.appendChild(h("div", { class: "empty" }, opts.empty || "Nothing to show.")); return; }
      const thead = h("tr");
      opts.columns.forEach((c) => {
        const th = h("th", { class: (c.cls || "") + (c.num ? " num" : ""), scope: "col", "aria-sort": c.key === sortKey ? (sortDir > 0 ? "ascending" : "descending") : null });
        if (c.sortable === false) th.textContent = c.label;
        else th.appendChild(h("button", { type: "button", class: "th-btn", onclick: () => { if (sortKey === c.key) sortDir = -sortDir; else { sortKey = c.key; sortDir = c.num ? -1 : 1; } draw(); } }, c.label, c.key === sortKey ? h("span", { class: "sort-arrow" }, sortDir > 0 ? "▲" : "▼") : null));
        thead.appendChild(th);
      });
      const tbody = h("tbody");
      rows.slice(0, limit).forEach((r) => {
        const tr = h("tr", { class: opts.onRow ? "clickable" : null, tabindex: opts.onRow ? "0" : null });
        if (opts.onRow) { tr.addEventListener("click", (e) => { if (!e.target.closest("button,a,input")) opts.onRow(r); }); tr.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target === tr) opts.onRow(r); }); }
        opts.columns.forEach((c) => { const td = h("td", { class: (c.cls || "") + (c.num ? " num" : "") }); const v = c.render ? c.render(r) : (c.value ? c.value(r) : r[c.key]); append(td, v == null || v === "" ? h("span", { class: "muted" }, "—") : v); tr.appendChild(td); });
        tbody.appendChild(tr);
      });
      wrap.appendChild(h("table", { class: "tbl" }, h("thead", null, thead), tbody));
      if (rows.length > limit) wrap.appendChild(h("div", { class: "more" }, RD.btn("Show " + Math.min(200, rows.length - limit) + " more (" + (rows.length - limit) + " hidden)", { small: true, onclick: () => { limit += 200; draw(); } })));
    };
    draw();
    return wrap;
  };

  /* ---------------------------------------------------------------- charts */
  const C = (RD.Chart = {});
  let tip;
  function showTip(e, lines) {
    if (!tip) { tip = h("div", { class: "tip", role: "tooltip" }); document.body.appendChild(tip); }
    tip.textContent = "";
    lines.forEach((l, i) => tip.appendChild(h("div", { class: i === 0 ? "tip-v" : "tip-l" }, l)));
    tip.hidden = false;
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX != null && e.type !== "focus" ? e.clientX : r.left + r.width / 2;
    const y = e.clientY != null && e.type !== "focus" ? e.clientY : r.top;
    const w = tip.offsetWidth, hgt = tip.offsetHeight;
    tip.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, x - w / 2)) + "px";
    tip.style.top = Math.max(8, y - hgt - 12) + window.scrollY + "px";
  }
  const hideTip = () => { if (tip) tip.hidden = true; };
  function hover(el, lines) {
    el.addEventListener("pointermove", (e) => showTip(e, lines()));
    el.addEventListener("pointerleave", hideTip);
    el.addEventListener("focus", (e) => showTip(e, lines()));
    el.addEventListener("blur", hideTip);
  }
  RD.hideTip = hideTip;

  /* Horizontal bars for comparing magnitude: one hue, value written at the bar end. */
  C.bars = (items, opts) => {
    opts = opts || {};
    const max = Math.max.apply(null, items.map((i) => i.value).concat([opts.max || 0, 0.0001]));
    const fmt = opts.fmt || U.fmtInt;
    const box = h("div", { class: "bars" + (opts.wide ? " bars-wide" : "") });
    if (!items.length) return h("div", { class: "empty small" }, opts.empty || "No data for this selection.");
    items.forEach((it) => {
      const row = h(it.onClick ? "button" : "div", { class: "bar-row" + (it.onClick ? " clickable" : ""), tabindex: "0", type: it.onClick ? "button" : null, "aria-label": it.label + ": " + fmt(it.value), onclick: it.onClick },
        h("span", { class: "bar-label", title: it.label }, it.label),
        h("span", { class: "bar-track" }, h("span", { class: "bar-fill" + (it.dim ? " dim" : ""), style: "width:" + Math.max(it.value > 0 ? 0.8 : 0, (it.value / max) * 100).toFixed(2) + "%" })),
        h("span", { class: "bar-value" }, fmt(it.value)));
      hover(row, () => [fmt(it.value), it.label].concat(it.extra || []));
      box.appendChild(row);
    });
    return box;
  };
  /* Stacked rows: project status mix per portfolio. Legend is always shown; segments carry tooltips. */
  C.stack = (rows, keys, opts) => {
    opts = opts || {};
    const wrap = h("div", { class: "stack" });
    const totals = {}; keys.forEach((k) => (totals[k.key] = 0));
    rows.forEach((r) => keys.forEach((k) => (totals[k.key] += r.values[k.key] || 0)));
    const legend = h("div", { class: "legend" });
    keys.forEach((k) => { if (totals[k.key]) legend.appendChild(h("span", { class: "legend-item" }, h("i", { class: "sw sw-" + k.cls }), k.label, h("b", null, " " + totals[k.key]))); });
    wrap.appendChild(legend);
    const max = Math.max.apply(null, rows.map((r) => keys.reduce((s, k) => s + (r.values[k.key] || 0), 0)).concat([1]));
    rows.forEach((r) => {
      const total = keys.reduce((s, k) => s + (r.values[k.key] || 0), 0);
      const bar = h("span", { class: "stack-bar", style: "width:" + ((total / max) * 100).toFixed(2) + "%" });
      keys.forEach((k) => { const v = r.values[k.key] || 0; if (!v) return; const seg = h("span", { class: "seg sw-" + k.cls, style: "flex:" + v + " 0 0", tabindex: "0", "aria-label": r.label + ", " + k.label + ": " + v }); hover(seg, () => [String(v) + (v === 1 ? " project" : " projects"), k.label + " · " + r.label]); bar.appendChild(seg); });
      wrap.appendChild(h(r.onClick ? "button" : "div", { class: "stack-row" + (r.onClick ? " clickable" : ""), type: r.onClick ? "button" : null, onclick: r.onClick }, h("span", { class: "bar-label", title: r.label }, r.label), h("span", { class: "stack-track" }, bar), h("span", { class: "bar-value" }, String(total))));
    });
    return wrap;
  };
  /* Columns over time (hours per week). Y ticks are clean numbers; latest column is emphasised. */
  C.columns = (points, opts) => {
    opts = opts || {};
    const fmt = opts.fmt || U.fmtInt;
    const rawMax = Math.max.apply(null, points.map((p) => p.value).concat([0]));
    if (!rawMax) return h("div", { class: "empty small" }, opts.empty || "No data for this selection.");
    const pow = Math.pow(10, Math.floor(Math.log10(rawMax)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => rawMax / s <= 4) || pow * 10;
    const top = Math.ceil(rawMax / step) * step;
    const plot = h("div", { class: "cols-plot" });
    for (let v = 0; v <= top + 1e-9; v += step) plot.appendChild(h("div", { class: "cols-grid" + (v === 0 ? " base" : ""), style: "bottom:" + ((v / top) * 100).toFixed(2) + "%" }, h("span", null, U.fmtInt(v))));
    const cols = h("div", { class: "cols" });
    points.forEach((p, i) => {
      const col = h("div", { class: "col", tabindex: "0", "aria-label": p.label + ": " + fmt(p.value) }, h("span", { class: "col-bar" + (i === points.length - 1 ? " now" : ""), style: "height:" + ((p.value / top) * 100).toFixed(2) + "%" }));
      hover(col, () => [fmt(p.value), p.tip || p.label]);
      cols.appendChild(col);
    });
    plot.appendChild(cols);
    const axis = h("div", { class: "cols-axis" });
    points.forEach((p) => axis.appendChild(h("span", null, p.label, h("small", null, p.sub || "\u00a0"))));
    return h("div", { class: "cols-chart" }, plot, axis);
  };
  /* Meter: spend against a budget. The track is a lighter step of the fill. */
  C.meter = (label, value, max, opts) => {
    opts = opts || {};
    const pct = max > 0 ? value / max : 0;
    const tone = pct > 1 ? "over" : pct > 0.85 ? "near" : "fine";
    const m = h("div", { class: "meter", tabindex: "0" },
      h("div", { class: "meter-head" }, h("span", { class: "meter-label" }, label), h("span", { class: "meter-val" }, h("b", null, U.fmtMoney(value)), max > 0 ? " of " + U.fmtMoney(max) : " · no budget set")),
      h("div", { class: "meter-track tone-" + tone }, h("span", { class: "meter-fill", style: "width:" + Math.min(100, pct * 100).toFixed(1) + "%" })),
      max > 0 ? h("div", { class: "meter-foot" }, pct > 1 ? [icon("alert"), "Over budget by " + U.fmtMoney(value - max)] : Math.round(pct * 100) + "% used") : null);
    hover(m, () => [U.fmtMoney(value, false) + " " + RD.config.currency, label + (max > 0 ? " · budget " + U.fmtMoney(max, false) : "")]);
    return m;
  };

  /* ---------------------------------------------------------------- misc */
  RD.panel = (title, body, actions, cls) => h("section", { class: "panel" + (cls ? " " + cls : "") }, title ? h("div", { class: "panel-head" }, h("h3", null, title), actions ? h("div", { class: "panel-actions" }, actions) : null) : null, h("div", { class: "panel-body" }, body));
  RD.select = (id, options, value, onChange, label) => {
    const s = h("select", { id, class: "inp inp-sm", "aria-label": label, onchange: () => onChange(s.value) });
    options.forEach((o) => s.appendChild(h("option", { value: typeof o === "object" ? o.value : o }, typeof o === "object" ? o.label : o)));
    s.value = value;
    return s;
  };
  RD.exportCsv = (filename, rows) => {
    const blob = new Blob(["﻿" + U.csv(rows)], { type: "text/csv;charset=utf-8" });
    const a = h("a", { href: URL.createObjectURL(blob), download: filename });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
})();
