/* demo-data.js — sample data for DEMO MODE only (used when config.js has no Google details).
   All names, projects and figures in this file are invented. Nothing here is read once the
   dashboard is connected to a Google Sheet. */
(function () {
  "use strict";
  const DEMO_USERS = [
    { id: "supervisor@example.com", name: "Supervisor", full_name: "R&D Supervisor (demo)", role: "admin", pillar: "", active: "yes" },
    { id: "amal@example.com", name: "Amal", full_name: "Amal (demo engineer)", role: "engineer", pillar: "Design Eng", active: "yes" },
    { id: "dilini@example.com", name: "Dilini", full_name: "Dilini (demo engineer)", role: "engineer", pillar: "Materials Eng", active: "yes" },
    { id: "kasun@example.com", name: "Kasun", full_name: "Kasun (demo engineer)", role: "engineer", pillar: "Sourcing", active: "yes" },
    { id: "nimali@example.com", name: "Nimali", full_name: "Nimali (demo engineer)", role: "engineer", pillar: "IoT/Electronics", active: "yes" },
    { id: "guest@example.com", name: "Guest", full_name: "Guest from Sales (demo)", role: "guest", pillar: "", active: "yes" }
  ];
  const P = (job_no, name, portfolio, category, pillar, engineer, status, endInDays, skus, bip, dev, tool, cert, current_status, extra) =>
    Object.assign({ job_no, name, portfolio, category, project_type: portfolio, pillar, engineer, status, _end: endInDays, skus, bip_value: bip, budget_dev: dev, budget_tool: tool, budget_cert: cert, current_status, responsible_dept: "RND", npd: "", remarks: "", requested_date: "", saving_pct: "", saving_per_item: "", monthly_demand: "" }, extra || {});
  const DEMO_PROJECTS = [
    P("RG-SW-26-101", "Slim switch range, 1 to 4 gang", "Revenue Generation", "Switches & Sockets", "Design Eng", "Amal", "At Risk", 35, 24, 180000000, 1000000, 28000000, 900000, "T1 samples received. Rocker fit is tight on the 3 gang plate, tool correction requested.", { responsible_dept: "Tool Room", npd: "Yes" }),
    P("RG-SW-26-102", "USB A+C fast-charge socket, single", "Revenue Generation", "Switches & Sockets", "Sourcing", "Kasun", "On Track", 60, 6, 42000000, 300000, 1200000, 450000, "Pilot order of 500 pcs placed. Incoming inspection plan agreed with QA.", { responsible_dept: "Procurement" }),
    P("RG-LIT-26-103", "LED panel light 24 W, surface mount", "Revenue Generation", "Lighting", "Sourcing", "Kasun", "On Track", 90, 4, 96000000, 50000, "", 380000, "Second supplier sample passed photometric test. Waiting for price confirmation.", { responsible_dept: "Procurement" }),
    P("RG-LIT-26-104", "Sensor flood light 30 W", "Revenue Generation", "Lighting", "IoT/Electronics", "Nimali", "At Risk", -6, 2, 35000000, 250000, "", 300000, "First article failed the surge test. Driver redesign in progress.", { responsible_dept: "QAD" }),
    P("RG-PVC-26-105", "Conduit fittings, 20 mm family", "Revenue Generation", "PVC", "Design Eng", "Amal", "On Hold", 120, 18, 64000000, 500000, 15500000, 250000, "On hold until the sales forecast for the fittings range is confirmed.", { responsible_dept: "Sales" }),
    P("RG-BAT-26-106", "5 kWh wall-mount battery pack", "Revenue Generation", "Battery", "IoT/Electronics", "Nimali", "On Track", 150, 1, "", 800000, "", "", "Cell supplier confirmed. BMS firmware bench test planned for next week.", { responsible_dept: "Procurement/RND" }),
    P("RG-AA-26-107", "Ceiling rose, 2-terminal", "Revenue Generation", "Allied Accessories", "Design Eng", "Amal", "Completed", -40, 1, 6500000, 150000, 2400000, "", "Commercial production started. Handover to manufacturing done.", { responsible_dept: "Manufacturing" }),
    P("RG-AA-26-108", "Surface mounting box, 3 way", "Revenue Generation", "Allied Accessories", "Design Eng", "Amal", "On Track", 45, 1, 5200000, 100000, 3100000, "", "Waiting for tool quotations to finish the costing."),
    P("CR-SW-26-201", "Socket base material change to recycled PC blend", "Cost Reduction", "Switches & Sockets", "Materials Eng", "Dilini", "Completed", -20, 9, 4100000, "", "", "", "Quality approval received and BOM updated.", { saving_pct: "3.5%", saving_per_item: 8.5, monthly_demand: 40000 }),
    P("CR-SW-26-202", "Stamped terminal redesign, 13 A socket", "Cost Reduction", "Switches & Sockets", "Materials Eng", "Dilini", "On Track", 30, 9, 28700000, 200000, 4300000, "", "Endurance test running, 60% complete with no failures.", { saving_pct: "18%", saving_per_item: 59.9, monthly_demand: 40000, responsible_dept: "QAD" }),
    P("CR-LT-26-203", "Panel light heat sink removal, 12 W", "Cost Reduction", "Lighting", "Sourcing", "Kasun", "Incomplete", -12, 8, 31500000, "", "", "", "Thermal test report received. Pilot order request is pending.", { saving_pct: "15-17%", responsible_dept: "Procurement" }),
    P("CR-PK-26-204", "Inner box redesign for mechanisms", "Cost Reduction", "Packaging", "Materials Eng", "Dilini", "On Track", 25, 49, 2000000, "", "", "", "Samples from the new cutter approved by QA.", { saving_per_item: 24.7, monthly_demand: 7000 }),
    P("FE-PK-26-301", "Packing line automation, label applicator", "Factory Expansion", "Automation - Packaging", "Design Eng", "Amal", "At Risk", 20, 1, "", 600000, 2400000, "", "Trial shipment delayed at the supplier. New date requested.", { responsible_dept: "Procurement" }),
    P("BS-IOT-26-401", "Energy monitoring module, DIN rail", "Blue Sky", "IoT/Electronics", "IoT/Electronics", "Nimali", "TBC", 180, 2, "", 400000, "", "", "Concept PCB designed. Enclosure options under review."),
    P("", "Retail packaging refresh, power strips", "Customer Satisfaction", "Packaging", "Sourcing", "Dilini", "Completed", -70, 8, 23000000, "", "", "", "New packs in the market since last quarter."),
    P("", "QR code warranty registration", "Customer Satisfaction", "", "IoT/Electronics", "Nimali", "On Hold", "", "", "", "", "", "", "Waiting for the decision on the customer portal."),
    P("", "Two new plate colours for the premium range", "Improvements", "Switches & Sockets", "Materials Eng", "Dilini", "", "", "", "", "", "", "", "")
  ];

  /* small deterministic random generator so the sample data looks the same on every device */
  function rng(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
  const pad = (n) => String(n).padStart(2, "0");
  const iso = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  function renderSvg(title, hue) {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 320"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(' + hue + ',22%,92%)"/><stop offset="1" stop-color="hsl(' + hue + ',18%,78%)"/></linearGradient></defs><rect width="480" height="320" fill="url(#g)"/><ellipse cx="240" cy="262" rx="150" ry="14" fill="rgba(0,0,0,.14)"/><rect x="130" y="62" width="220" height="190" rx="18" fill="#fbfbfa" stroke="#c9ced3" stroke-width="2"/><rect x="158" y="92" width="74" height="130" rx="8" fill="#eef0f2" stroke="#c2c8ce" stroke-width="2"/><rect x="248" y="92" width="74" height="130" rx="8" fill="#eef0f2" stroke="#c2c8ce" stroke-width="2"/><rect x="186" y="108" width="18" height="6" rx="3" fill="hsl(' + hue + ',55%,48%)"/><rect x="276" y="108" width="18" height="6" rx="3" fill="hsl(' + hue + ',55%,48%)"/><text x="240" y="300" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" fill="#4a545e">' + title + "</text></svg>";
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  /* Build the demo "sheet". projects/users can be supplied by the preview build (window.RD_SEED_PROJECTS). */
  window.RD_SEED = function () {
    const now = new Date(), nowIso = now.toISOString(), today = iso(now);
    const r = rng(20261009);
    const pick = (arr) => arr[Math.floor(r() * arr.length)];
    const users = (window.RD_SEED_USERS || DEMO_USERS).map((u) => Object.assign({ created_at: nowIso, created_by: "", updated_at: nowIso, updated_by: "" }, u));
    const real = !!window.RD_SEED_PROJECTS;
    const projects = (window.RD_SEED_PROJECTS || DEMO_PROJECTS).map((p, i) => {
      const o = Object.assign({ id: "p_demo" + pad(i + 1), drive_folder_id: "", created_at: nowIso, created_by: "", updated_at: nowIso, updated_by: "" }, p);
      if ("_end" in o) { o.end_date = o._end === "" ? "" : iso(addDays(now, o._end)); delete o._end; }
      delete o._src;
      return o;
    });
    const tables = { Projects: projects, Users: users, TimeLogs: [], Costings: [], Files: [], Updates: [], Settings: [{ id: "guest_sees_finance", value: "no", updated_at: nowIso, updated_by: "" }] };
    const sampleIds = [];
    const emailOf = {}; users.forEach((u) => (emailOf[u.name.toLowerCase()] = u.id));
    const names = (s) => String(s || "").split(/\s*[\/,&]\s*/).filter(Boolean);
    const ACT = ["Design / CAD", "Design / CAD", "Prototyping & samples", "Testing", "Testing", "Costing", "Sourcing & suppliers", "Documentation", "Tooling follow-up", "Meetings"];
    const tag = real ? "Sample entry" : "";
    let n = 0;
    const id = (p) => { const x = p + "_s" + (++n).toString(36); sampleIds.push(x); return x; };

    /* time logs: last 6 weeks of weekdays for every engineer who owns an open project */
    const mine = {};
    projects.forEach((p) => { if (p.status !== "Completed" && p.status !== "On Hold") names(p.engineer).forEach((e) => (mine[e] = mine[e] || []).push(p)); });
    Object.keys(mine).forEach((eng) => {
      for (let back = 41; back >= 0; back--) {
        const d = addDays(now, -back), wd = d.getDay();
        if (wd === 0 || wd === 6 || r() < 0.22) continue;
        let startMin = 8 * 60 + 30 + Math.floor(r() * 4) * 15;
        const count = r() < 0.55 ? 2 : 1;
        for (let k = 0; k < count; k++) {
          const p = pick(mine[eng]);
          const dur = (Math.floor(r() * 10) + 4) * 15; // 1.0 h to 3.25 h
          if (back === 0 && startMin + dur > now.getHours() * 60 + now.getMinutes()) break;
          const endMin = startMin + dur;
          const stamp = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(endMin / 60), endMin % 60).toISOString();
          tables.TimeLogs.push({ id: id("t"), project_id: p.id, project_name: p.name, engineer: eng, engineer_email: emailOf[eng.toLowerCase()] || "", date: iso(d), start: pad(Math.floor(startMin / 60)) + ":" + pad(startMin % 60), end: pad(Math.floor(endMin / 60)) + ":" + pad(endMin % 60), hours: Math.round((dur / 60) * 100) / 100, activity: pick(ACT), note: tag, started_at: "", created_at: stamp, created_by: emailOf[eng.toLowerCase()] || "", updated_at: stamp, updated_by: emailOf[eng.toLowerCase()] || "" });
          startMin = endMin + 30 + Math.floor(r() * 3) * 15;
        }
      }
    });

    /* costings against the budget lines that exist */
    const LINES = [["Development cost", "budget_dev", ["Prototype parts and samples", "3D printed housings", "Test jig and fixtures"]], ["Tool investment", "budget_tool", ["Mould quotation, base tool", "Press tool, first payment", "Tool modification after T1"]], ["Certification", "budget_cert", ["SLS type test fee", "Third-party lab report"]]];
    const STAT = ["Draft", "Submitted to Finance", "Approved", "Approved"];
    projects.filter((p) => +p.budget_dev > 0 || +p.budget_tool > 0 || +p.budget_cert > 0).slice(0, real ? 26 : 99).forEach((p) => {
      const eng = names(p.engineer)[0] || "Supervisor";
      LINES.forEach((L) => {
        const budget = +p[L[1]] || 0; if (!budget || r() < 0.3) return;
        const d = addDays(now, -Math.floor(r() * 60)), stamp = d.toISOString();
        const share = p.status === "At Risk" && r() < 0.35 ? 1.04 + r() * 0.12 : 0.2 + r() * 0.6;
        tables.Costings.push({ id: id("c"), project_id: p.id, project_name: p.name, date: iso(d), type: L[0], title: (real ? "Sample: " : "") + pick(L[2]), amount: Math.round((budget * share) / 1000) * 1000, supplier: "", reference: "Q-" + (2600 + Math.floor(r() * 300)), status: pick(STAT), prepared_by: eng, file_id: "", note: tag, created_at: stamp, created_by: emailOf[eng.toLowerCase()] || "", updated_at: stamp, updated_by: "" });
      });
      if (r() < 0.45) { const d = addDays(now, -Math.floor(r() * 30)), stamp = d.toISOString(); tables.Costings.push({ id: id("c"), project_id: p.id, project_name: p.name, date: iso(d), type: "Product costing", title: (real ? "Sample: " : "") + "Unit cost sheet, rev " + pick(["A", "B", "C"]), amount: Math.round((120 + r() * 900) * 100) / 100, supplier: "", reference: "", status: pick(STAT), prepared_by: eng, file_id: "", note: tag, created_at: stamp, created_by: emailOf[eng.toLowerCase()] || "", updated_at: stamp, updated_by: "" }); }
    });

    /* files: a few renders (real images) and CAD / document entries */
    const CAD = ["housing_assembly.SLDASM", "base_plate_revC.SLDPRT", "rocker_v4.SLDPRT", "terminal_block.STEP", "general_arrangement.SLDDRW"];
    const DOC = [["test_report_endurance.pdf", "Document", "application/pdf"], ["design_review_minutes.docx", "Document", ""], ["bom_costing_revB.xlsx", "Costing", ""]];
    projects.filter((p) => p.status !== "Completed" && p.engineer).slice(0, real ? 14 : 99).forEach((p, i) => {
      const eng = names(p.engineer)[0];
      const stamp = (k) => addDays(now, -Math.floor(r() * 30) - k).toISOString();
      const row = (name, kind, mime, size, url) => { const s = stamp(0); tables.Files.push({ id: id("f"), project_id: p.id, project_name: p.name, name: (real ? "sample_" : "") + name, kind, mime, size, drive_id: "", url: url || "", uploaded_by: eng, note: tag, created_at: s, created_by: emailOf[eng.toLowerCase()] || "", updated_at: s, updated_by: "" }); };
      if (i % 2 === 0) row("render_front_" + (i + 1) + ".svg", "Render", "image/svg+xml", 2400, renderSvg("Sample render " + (i + 1), (i * 47) % 360));
      row(pick(CAD), "CAD", "", Math.round((0.4 + r() * 6) * 1e6));
      if (r() < 0.6) { const d = pick(DOC); row(d[0], d[1], d[2], Math.round((0.1 + r() * 2) * 1e6)); }
    });

    /* updates: only for the invented demo projects (real project histories are never made up) */
    if (!real) {
      const TEXT = ["Supplier sample received, incoming inspection started.", "Design review held. Two open points on wall thickness.", "Costing sent to Finance for approval.", "Tool trial T0 done. Short shot on cavity 2, toolmaker informed.", "Test lab booked for next week."];
      projects.forEach((p) => {
        if (!p.current_status) return;
        const eng = names(p.engineer)[0] || "Supervisor";
        const k = 1 + Math.floor(r() * 2);
        for (let j = k; j >= 1; j--) { const d = addDays(now, -j * 9 - Math.floor(r() * 5)); tables.Updates.push({ id: id("u"), project_id: p.id, project_name: p.name, date: iso(d), by: eng, status: j === 1 ? p.status : "On Track", text: pick(TEXT), created_at: d.toISOString(), created_by: emailOf[eng.toLowerCase()] || "", updated_at: d.toISOString(), updated_by: "" }); }
        const d0 = addDays(now, -Math.floor(r() * 5)); tables.Updates.push({ id: id("u"), project_id: p.id, project_name: p.name, date: iso(d0), by: eng, status: p.status, text: p.current_status, created_at: d0.toISOString(), created_by: emailOf[eng.toLowerCase()] || "", updated_at: d0.toISOString(), updated_by: "" });
      });
    }
    void today;
    return { tables, sampleIds: real ? sampleIds : [] };
  };
})();
