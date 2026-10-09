// Browser tests for demo mode: roles, time tracking, offline queue, drafts, uploads, offline start-up.
// Run:  python3 -m http.server 8765   (in the project folder), then  node tests/demo.test.js
const { chromium } = require(process.env.PW || "playwright");
const BASE = process.env.BASE || "http://localhost:8765/";
let failed = 0, passed = 0;
const ok = (cond, name, extra) => { if (cond) { passed++; console.log("  ok   " + name); } else { failed++; console.log("  FAIL " + name + (extra !== undefined ? "  -> " + JSON.stringify(extra) : "")); } };
const remote = (page, table) => page.evaluate((t) => (RD.Store.get("demo_remote") || {})[t] || [], table);
const settle = async (page) => { await page.waitForFunction(() => !RD.state.busy && (RD.state.queue.length === 0 || !RD.online()), null, { timeout: 8000 }).catch(() => {}); await page.waitForTimeout(150); };

async function fresh(browser, opts) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" }, opts || {}));
  const page = await ctx.newPage();
  page.on("pageerror", (e) => { failed++; console.log("  FAIL page error: " + e.message); });
  await page.goto(BASE);
  await page.waitForSelector(".login-card");
  return { ctx, page };
}

(async () => {
  const browser = await chromium.launch();

  console.log("Supervisor");
  {
    const { ctx, page } = await fresh(browser);
    await page.click("#login-admin");
    await page.waitForSelector(".tiles");
    ok(await page.locator('[data-nav="team"]').count() === 1, "sees Team");
    await page.evaluate(() => RD.go("projects"));
    await page.click("#btn-add-project");
    await page.fill("#f-project-new-name", "Test bench enclosure");
    await page.selectOption("#f-project-new-portfolio", "Cost Reduction");
    await page.fill("#f-project-new-category", "Switches & Sockets");
    await page.dispatchEvent("#f-project-new-category", "change");
    const sug = await page.inputValue("#f-project-new-job_no");
    ok(sug === "CR-SW-26-203", "suggests the next free job number", sug);
    await page.click(".modal-foot .btn-primary");
    await page.waitForSelector(".page-title h2");
    ok((await page.textContent(".page-title h2")) === "Test bench enclosure", "new project opens");
    await settle(page);
    const rows = await remote(page, "Projects");
    const row = rows.find((r) => r.name === "Test bench enclosure");
    ok(!!row && row.job_no === "CR-SW-26-203" && row.created_by === "supervisor@example.com", "project reached the (demo) sheet with author", row && row.created_by);
    // post an update -> project status changes and history row exists
    await page.click(".page-actions .btn:has-text('Post update')");
    await page.selectOption(".modal select", "At Risk");
    await page.fill(".modal textarea", "Waiting for sheet metal quote.");
    await page.click(".modal-foot .btn-primary");
    await settle(page);
    const upd = (await remote(page, "Updates")).filter((u) => u.project_id === row.id);
    const proj = (await remote(page, "Projects")).find((r) => r.id === row.id);
    ok(upd.length === 1 && proj.status === "At Risk" && proj.current_status === "Waiting for sheet metal quote.", "update is logged and status changed");
    // role change takes effect
    await page.evaluate(() => RD.go("team"));
    ok(await page.locator("#btn-add-user").count() === 1, "can add people");
    // delete project (soft delete)
    await page.evaluate((id) => RD.go("project-" + id), row.id);
    await page.click(".page-actions .btn:has-text('Edit')");
    await page.click(".modal-foot .btn-danger-ghost");
    await page.click(".modal-back:last-of-type .btn-danger");
    await settle(page);
    ok(!(await remote(page, "Projects")).some((r) => r.id === row.id), "deleted project is gone");
    await ctx.close();
  }

  console.log("Engineer");
  {
    const { ctx, page } = await fresh(browser);
    await page.selectOption("#login-engineer", "amal@example.com");
    await page.click("#login-engineer-go");
    await page.waitForSelector(".tiles");
    await page.evaluate(() => RD.go("team"));
    ok(await page.locator("#btn-add-user").count() === 0, "cannot add people");
    const ids = await page.evaluate(() => ({ mine: RD.rows("Projects").find((p) => p.engineer === "Amal").id, other: RD.rows("Projects").find((p) => p.engineer === "Kasun").id }));
    await page.evaluate((id) => RD.go("project-" + id), ids.other);
    ok(await page.locator(".page-actions .btn:has-text('Edit')").count() === 0, "cannot edit another engineer's project");
    ok(await page.locator(".page-actions .btn:has-text('Start timer')").count() === 1, "can log time on another engineer's project");
    await page.evaluate((id) => RD.go("project-" + id), ids.mine);
    ok(await page.locator(".page-actions .btn:has-text('Edit')").count() === 1, "can edit own project");
    // timer
    await page.evaluate(() => RD.go("time"));
    await page.fill("#tm-project", "RG-SW-26-101");
    await page.keyboard.press("Enter");
    await page.fill("#tm-note", "bracket redesign");
    await page.click("#btn-start-timer");
    await page.waitForSelector("#btn-stop-timer");
    await page.waitForTimeout(2200);
    const clock = await page.textContent(".timer-clock");
    ok(/^00:00:0[1-4]$/.test(clock), "timer is counting", clock);
    await settle(page);
    const running = (await remote(page, "TimeLogs")).find((l) => l.note === "bracket redesign");
    ok(!!running && running.end === "" && running.engineer === "Amal" && !!running.started_at, "running timer is visible to others in the sheet");
    await page.click("#btn-stop-timer");
    await settle(page);
    const done = (await remote(page, "TimeLogs")).find((l) => l.note === "bracket redesign");
    ok(done.hours > 0 && /^\d\d:\d\d$/.test(done.end) && /^\d\d:\d\d$/.test(done.start), "stopping logs start, end and hours", done);
    // manual entry computes hours from start/end
    await page.click("#btn-add-time");
    await page.fill("#f-time-new-project_id", "CR-SW-26-202"); await page.keyboard.press("Enter");
    await page.fill("#f-time-new-start", "09:00"); await page.fill("#f-time-new-end", "11:30");
    await page.dispatchEvent("#f-time-new-end", "change");
    ok((await page.inputValue("#f-time-new-hours")) === "2.5", "hours are worked out from start and end");
    await page.click(".modal-foot .btn-primary");
    await settle(page);
    ok((await remote(page, "TimeLogs")).some((l) => l.hours === 2.5 && l.start === "09:00" && l.engineer_email === "amal@example.com"), "manual entry saved");
    // cannot edit someone else's entry
    const foreign = await page.evaluate(() => { const l = RD.rows("TimeLogs").find((x) => x.engineer === "Kasun"); return RD.can("entry.edit", l); });
    ok(foreign === false, "cannot edit another engineer's time entry");
    await ctx.close();
  }

  console.log("Guest");
  {
    const { ctx, page } = await fresh(browser);
    await page.click("#login-guest");
    await page.waitForSelector(".tiles");
    const nav = await page.$$eval("[data-nav]", (els) => els.map((e) => e.getAttribute("data-nav")));
    ok(!nav.includes("time") && !nav.includes("costings") && !nav.includes("team"), "no Time, Costings or Team in the menu", nav);
    await page.evaluate(() => RD.go("projects"));
    ok(await page.locator("#btn-add-project").count() === 0, "no Add project button");
    ok(!(await page.textContent(".tbl thead")).includes("BIP"), "BIP value column hidden");
    const pid = await page.evaluate(() => RD.rows("Projects")[0].id);
    await page.evaluate((id) => RD.go("project-" + id), pid);
    ok(await page.locator(".page-actions .btn").count() === 0 && !(await page.textContent("#view")).includes("Budget"), "project page is read-only without budget");
    await page.evaluate(() => RD.go("costings"));
    ok((await page.textContent("#view")).includes("not available for your role"), "costings page is closed to guests");
    ok(await page.evaluate(() => { try { RD.Sync.mutate; return RD.canEdit(); } catch (e) { return "err"; } }) === false, "role has no edit rights");
    await ctx.close();
  }

  console.log("Offline queue");
  {
    const { ctx, page } = await fresh(browser);
    await page.selectOption("#login-engineer", "dilini@example.com");
    await page.click("#login-engineer-go");
    await page.waitForSelector(".tiles");
    await settle(page);
    const before = (await remote(page, "TimeLogs")).length;
    await ctx.setOffline(true);
    await page.waitForFunction(() => !RD.online());
    await page.waitForSelector(".banner-warn");
    ok((await page.textContent(".banner-warn")).includes("offline"), "offline banner shows");
    await page.evaluate(() => RD.go("time"));
    for (const h of ["1.5", "2"]) {
      await page.click("#btn-add-time");
      await page.fill("#f-time-new-project_id", "CR-SW-26-202"); await page.keyboard.press("Enter");
      await page.fill("#f-time-new-hours", h);
      await page.fill("#f-time-new-note", "offline entry " + h);
      await page.click(".modal-foot .btn-primary");
      await page.waitForTimeout(150);
    }
    await page.waitForTimeout(900);
    ok((await page.textContent("#sync-pill")).includes("Offline · 2 waiting"), "pill counts waiting changes", await page.textContent("#sync-pill"));
    ok((await page.textContent("#view")).includes("offline entry 1.5"), "offline change is visible on this device straight away");
    ok((await remote(page, "TimeLogs")).length === before, "nothing reached the sheet while offline");
    const stored = await page.evaluate(() => new Promise((res) => { const rq = indexedDB.open("rd-projects-demo"); rq.onsuccess = () => { const g = rq.result.transaction("kv").objectStore("kv").get("queue"); g.onsuccess = () => res((g.result || []).length); }; }));
    ok(stored === 2, "queue is written to the device's storage", stored);
    await ctx.setOffline(false);
    await page.waitForFunction(() => RD.state.queue.length === 0 && !RD.state.busy, null, { timeout: 8000 });
    ok((await remote(page, "TimeLogs")).length === before + 2, "both changes are sent after reconnecting");
    ok(/Saved/.test(await page.textContent("#sync-pill")), "pill returns to Saved", await page.textContent("#sync-pill"));
    await ctx.close();
  }

  console.log("Drafts and uploads");
  {
    const { ctx, page } = await fresh(browser);
    await page.selectOption("#login-engineer", "kasun@example.com");
    await page.click("#login-engineer-go");
    await page.waitForSelector(".tiles");
    await page.evaluate(() => RD.go("costings"));
    await page.click("#btn-add-costing");
    await page.fill("#f-cost-new-title", "Half-typed quotation");
    await page.waitForTimeout(450);
    await page.keyboard.press("Escape");
    await page.click("#btn-add-costing");
    ok((await page.inputValue("#f-cost-new-title")) === "Half-typed quotation" && await page.locator(".draft-note").count() === 1, "an unfinished form comes back as a draft");
    await page.fill("#f-cost-new-project_id", "RG-LIT-26-103"); await page.keyboard.press("Enter");
    await page.fill("#f-cost-new-amount", "125,000");
    await page.setInputFiles("#f-cost-new-files", { name: "quote.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 test") });
    await page.click(".modal-foot .btn-primary");
    await settle(page); await page.waitForTimeout(900); await settle(page);
    const c = (await remote(page, "Costings")).find((x) => x.title === "Half-typed quotation");
    const f = c && (await remote(page, "Files")).find((x) => x.id === c.file_id);
    ok(!!c && c.amount === 125000 && c.prepared_by === "Kasun", "costing saved with the amount as a number", c && c.amount);
    ok(!!f && f.kind === "Costing" && !!f.drive_id, "attached costing sheet uploaded and linked", f);
    await page.click("#btn-add-costing");
    ok((await page.inputValue("#f-cost-new-title")) === "", "draft is cleared after saving");
    await page.keyboard.press("Escape");
    // image upload while offline -> held until online
    await page.evaluate(() => RD.go("files"));
    await ctx.setOffline(true);
    await page.waitForFunction(() => !RD.online());
    await page.click("#btn-upload");
    await page.fill("#f-upload-project_id", "RG-LIT-26-103"); await page.keyboard.press("Enter");
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
    await page.setInputFiles("#up-files", [{ name: "render_iso.png", mimeType: "image/png", buffer: png }, { name: "housing.SLDPRT", mimeType: "", buffer: Buffer.from("solidworks-bytes") }]);
    await page.click(".modal-foot .btn-primary");
    await page.waitForTimeout(900);
    ok((await page.textContent("#view")).includes("Uploads when you are back online"), "files wait on the device while offline");
    ok(!(await remote(page, "Files")).some((x) => x.name === "housing.SLDPRT"), "sheet does not list a file that is not uploaded yet");
    await ctx.setOffline(false);
    await page.waitForFunction(() => RD.state.queue.length === 0 && RD.state.uploads.length === 0 && !RD.state.busy, null, { timeout: 10000 });
    const up = (await remote(page, "Files")).filter((x) => ["housing.SLDPRT", "render_iso.png"].includes(x.name));
    ok(up.length === 2 && up.every((x) => x.drive_id) && up.find((x) => x.name === "housing.SLDPRT").kind === "CAD" && up.find((x) => x.name === "render_iso.png").kind === "Render", "both files upload after reconnecting, with kind detected", up.map((x) => x.kind));
    await ctx.close();
  }

  console.log("Opens with no connection (service worker)");
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(BASE);
    await page.waitForSelector(".login-card");
    await page.click("#login-admin");
    await page.waitForSelector(".tiles");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForTimeout(800);
    await page.reload(); // let the worker take control and cache this visit
    await page.waitForSelector(".tiles");
    await ctx.setOffline(true);
    await page.reload();
    const loaded = await page.waitForSelector(".tiles", { timeout: 6000 }).then(() => true).catch(() => false);
    ok(loaded, "dashboard opens with the network off");
    ok(loaded && (await page.textContent(".tile-value")) !== "0", "saved projects are shown offline");
    if (loaded) {
      await page.evaluate(() => RD.go("projects"));
      await page.click("#btn-add-project");
      await page.fill("#f-project-new-name", "Made while offline");
      await page.click(".modal-foot .btn-primary");
      await page.waitForTimeout(900);
      await page.reload();
      await page.waitForSelector(".shell");
      const st = await page.evaluate(() => ({ q: RD.state.queue.length, has: RD.rows("Projects").some((p) => p.name === "Made while offline") }));
      ok(st.q === 1 && st.has, "an offline change survives closing and reopening the page", st);
      await ctx.setOffline(false);
      await page.waitForFunction(() => RD.state.queue.length === 0 && !RD.state.busy, null, { timeout: 8000 });
      ok((await remote(page, "Projects")).some((p) => p.name === "Made while offline"), "and is sent once the connection is back");
    }
    await ctx.close();
  }

  await browser.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
