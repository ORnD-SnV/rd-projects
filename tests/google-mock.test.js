// Browser tests for CONNECTED mode against a stand-in for Google (sign-in, Sheets API, Drive API).
// The stand-in follows the documented behaviour of the real endpoints the app calls, including
// trimmed trailing cells, grid limits on writes, and serial-number dates. It is not Google itself:
// run through docs/SETUP.md "First run checklist" once against your real sheet.
// Run:  python3 -m http.server 8765   then   node tests/google-mock.test.js
const { chromium } = require(process.env.PW || "playwright");
let failed = 0, passed = 0;
const ok = (cond, name, extra) => { if (cond) { passed++; console.log("  ok   " + name); } else { failed++; console.log("  FAIL " + name + (extra !== undefined ? "  -> " + JSON.stringify(extra).slice(0, 400) : "")); } };
const { makeGoogle, open, hooks, FOLDER } = require("./google-standin");
hooks.fail = (m) => { failed++; console.log("  FAIL " + m); };

const until = async (fn, ms) => { const end = Date.now() + (ms || 9000); while (Date.now() < end) { if (fn()) return true; await new Promise((r) => setTimeout(r, 60)); } return false; };
const idle = async (page) => { await page.waitForFunction(() => !RD.state.busy && RD.state.queue.length === 0 && RD.state.uploads.length === 0, null, { timeout: 9000 }).catch(() => {}); await page.waitForTimeout(200); };

(async () => {
  const browser = await chromium.launch();
  const g = makeGoogle();
  g.addTab("Sheet1", []);

  console.log("First sign-in on an empty spreadsheet");
  {
    const { ctx, page } = await open(browser, g, "nimal");
    await page.click("#login-google");
    await page.waitForSelector(".shell");
    await idle(page);
    ok(await page.evaluate(() => RD.session.role) === "admin", "first person in becomes supervisor");
    ok(["Projects", "TimeLogs", "Costings", "Files", "Updates", "Users", "Settings"].every((t) => g.tabs[t]), "all seven tabs were created", g.order);
    ok(g.tabs.Projects.values[0].includes("bip_value") && g.tabs.Projects.cols >= g.tabs.Projects.values[0].length, "headings written inside the grid");
    const users = g.rowsOf("Users");
    ok(users.length === 1 && users[0].id === "nimal@acme.test" && users[0].role === "admin", "supervisor row written to Users", users);
    ok((await page.evaluate(() => window.__gisCfg.hd)) === "acme.test" && /auth\/drive/.test(await page.evaluate(() => window.__gisCfg.scope)), "sign-in is limited to the company domain and asks for Drive access");
    // add people
    await page.evaluate(() => RD.go("team"));
    for (const [email, name, role] of [["kamal@acme.test", "Kamal", "engineer"], ["sales1@acme.test", "Sales", "guest"]]) {
      await page.click("#btn-add-user");
      await page.fill("#f-user-new-email", email); await page.fill("#f-user-new-name", name); await page.selectOption("#f-user-new-role", role);
      await page.click(".modal-foot .btn-primary");
    }
    await idle(page);
    ok(g.rowsOf("Users").length === 3, "two more people appended");
    await ctx.close();
  }

  console.log("Reading a sheet people have edited by hand");
  {
    // Columns in a different order, an extra column, a typed date (serial number), a dd/mm/yyyy text date, a row with no id.
    const hd = ["name", "id", "my_notes", "job_no", "status", "engineer", "end_date", "portfolio", "bip_value", "current_status", "deleted", "updated_at", "updated_by"];
    g.tabs.Projects.values = [hd,
      ["Slim range", "p_one", "keep me", "RG-SW-26-001", "On Track", "Kamal", 46357, "Revenue Generation", "1,250,000", "", "", "", ""],
      ["Trailer socket", "p_two", "=SUM(1,2)", "RG-SW-26-002", "At Risk", "Nimal", "15/08/2026", "Revenue Generation", 60000000, "Pilot pending", "", "", ""],
      ["Typed by hand, no id", "", "", "RG-SW-26-003", "", "", "", "", "", "", "", "", ""],
      ["Removed one", "p_gone", "", "", "", "", "", "", "", "", true, "", ""]];
    g.tabs.Projects.cols = hd.length; // an imported sheet is exactly as wide as its data
    const { ctx, page } = await open(browser, g, "kamal");
    await page.click("#login-google");
    await page.waitForSelector(".shell");
    await idle(page);
    ok(await page.evaluate(() => RD.session.role) === "engineer" && await page.evaluate(() => RD.session.name) === "Kamal", "role and short name come from the Users tab");
    const st = await page.evaluate(() => ({ n: RD.rows("Projects").length, one: RD.byId("Projects", "p_one"), two: RD.byId("Projects", "p_two"), info: RD.state.info }));
    ok(st.n === 2, "deleted row and row without id are left out", st.n);
    ok(st.one.end_date === "2026-12-01", "a date typed into the sheet (serial 46357) reads as 1 Dec 2026", st.one.end_date);
    ok(st.two.end_date === "2026-08-15", "a dd/mm/yyyy text date is understood", st.two.end_date);
    ok(st.one.bip_value === 1250000, "a number typed with commas is read as a number", st.one.bip_value);
    ok(st.info.noIdRows.Projects === 1 && st.info.missingCols.Projects.includes("budget_dev"), "missing ids and columns are reported", st.info);

    console.log("Editing merges into the sheet as it is now");
    await ctx.setOffline(true);
    await page.waitForFunction(() => !RD.online());
    await page.evaluate(() => RD.go("project-p_one"));
    await page.click(".page-actions .btn:has-text('Edit')");
    await page.selectOption("#f-project-p-one-status", "At Risk");
    await page.fill("#f-project-p-one-budget_tool", "4500000");
    await page.click(".modal-foot .btn-primary");
    await page.waitForTimeout(800);
    ok(g.rowsOf("Projects").find((r) => r.id === "p_one").status === "On Track", "nothing is written while offline");
    // Meanwhile, in the sheet: someone sorts the rows, inserts a new one on top and edits another cell of the same project.
    const v = g.tabs.Projects.values; const body = v.slice(1).reverse();
    body.unshift(["Inserted above", "p_new", "", "RG-SW-26-009", "TBC", "", "", "Revenue Generation", "", "", "", "", ""]);
    g.tabs.Projects.values = [v[0]].concat(body);
    g.tabs.Projects.values.find((r) => r[1] === "p_one")[g.col("Projects", "engineer")] = "Kamal / Nimal";
    g.log = [];
    await ctx.setOffline(false);
    await idle(page);
    const one = g.rowsOf("Projects").find((r) => r.id === "p_one"), two = g.rowsOf("Projects").find((r) => r.id === "p_two");
    ok(one.status === "At Risk" && one.budget_tool === 4500000, "the edit landed on the right row after the rows moved", one);
    ok(one.engineer === "Kamal / Nimal" && one.my_notes === "keep me", "the other person's edit and the extra column survive", one);
    ok(two.status === "At Risk" && two.my_notes === "=SUM(1,2)" && two.current_status === "Pilot pending", "neighbouring rows are untouched", two);
    ok(g.tabs.Projects.values[0].includes("budget_tool") && g.tabs.Projects.cols > 13, "a missing column was added and the grid widened first");
    const touchedCols = new Set(g.log.filter((x) => x.indexOf("Projects!") === 0 && !/,0$/.test(x)).map((x) => g.tabs.Projects.values[0][+x.split("!")[1].split(",")[0]]));
    ok([...touchedCols].sort().join() === "budget_tool,status,updated_at,updated_by", "only the edited cells were written", [...touchedCols]);
    ok(one.updated_by === "kamal@acme.test", "the change is stamped with who made it");
    ok(await page.evaluate(() => RD.byId("Projects", "p_new") && RD.byId("Projects", "p_one").engineer) === "Kamal / Nimal", "the screen picks up the other person's changes");

    console.log("Time, updates and files");
    await page.evaluate(() => RD.go("time"));
    await page.click("#btn-add-time");
    await page.fill("#f-time-new-project_id", "RG-SW-26-001"); await page.keyboard.press("Enter");
    await page.fill("#f-time-new-start", "08:30"); await page.fill("#f-time-new-end", "12:00"); await page.dispatchEvent("#f-time-new-end", "change");
    await page.click(".modal-foot .btn-primary");
    await idle(page);
    const logs = g.rowsOf("TimeLogs");
    ok(logs.length === 1 && logs[0].hours === 3.5 && logs[0].project_id === "p_one" && logs[0].engineer === "Kamal" && logs[0].date === new Date().toLocaleDateString("en-CA") && logs[0].start === "08:30", "time entry appended with plain date, times and hours", logs[0]);
    ok(g.tabs.TimeLogs.values[0].join() === (await page.evaluate(() => RD.TABLES.TimeLogs.join())), "TimeLogs columns are in the documented order");
    // file upload goes to a per-project folder, row is written only after the upload
    await page.evaluate(() => RD.go("files"));
    await page.click("#btn-upload");
    await page.fill("#f-upload-project_id", "RG-SW-26-001"); await page.keyboard.press("Enter");
    await page.setInputFiles("#up-files", { name: "plate's rev B.SLDPRT", mimeType: "", buffer: Buffer.from("SW-BYTES-123") });
    await page.click(".modal-foot .btn-primary");
    await until(() => g.rowsOf("Files").length > 0);
    await idle(page);
    const folder = Object.values(g.drive).find((f) => f.mimeType === "application/vnd.google-apps.folder");
    const file = Object.values(g.drive).find((f) => f.name === "plate's rev B.SLDPRT");
    const frow = g.rowsOf("Files")[0];
    ok(!!folder && folder.name === "RG-SW-26-001 Slim range" && folder.parents[0] === FOLDER, "a project folder was created under the shared folder", folder && folder.name);
    ok(!!file && file.parents[0] === folder.id && file.bytes.toString() === "SW-BYTES-123", "the SolidWorks file reached that folder intact");
    ok(!!frow && frow.drive_id === file.id && /drive.google.com/.test(frow.url) && frow.kind === "CAD" && frow.project_id === "p_one", "Files row points at the uploaded file", frow);
    ok(g.rowsOf("Projects").find((r) => r.id === "p_one").drive_folder_id === folder.id, "the folder id is remembered on the project");
    // link from the engineer's own Drive (copy)
    g.drive.mine1 = { id: "mine1", name: "enclosure_render.png", mimeType: "image/png", size: "2048", owner: "kamal", parents: ["root"], webViewLink: "https://drive.google.com/file/d/mine1/view", bytes: Buffer.from("png") };
    g.drive.other1 = { id: "other1", name: "enclosure_private.png", mimeType: "image/png", size: "1", owner: "nimal", parents: ["root"] };
    await page.click(".filters .btn:has-text('Link from my Drive')");
    await page.fill("#dr-q", "enclosure");
    await page.waitForSelector(".drive-item");
    await page.waitForTimeout(500);
    ok(await page.locator(".drive-item").count() === 1, "Drive search lists the engineer's own matching file only");
    await page.click(".drive-item");
    await page.fill("#f-drive-project_id", "RG-SW-26-002"); await page.keyboard.press("Enter");
    await page.click(".modal-foot .btn-primary");
    await page.waitForFunction(() => !document.querySelector(".modal-back"), null, { timeout: 6000 });
    await idle(page);
    const linked = g.rowsOf("Files").find((r) => r.name === "enclosure_render.png");
    ok(!!linked && linked.drive_id !== "mine1" && linked.kind === "Render" && linked.project_id === "p_two", "a copy of the Drive file is attached to the project", linked);

    console.log("Google session renewal");
    const prompts = await page.evaluate(() => (window.__gisPrompts || []).length);
    await page.evaluate(() => { RD.Google.tokenExp = Date.now() + 60000; });
    await page.click('[data-nav="overview"]');
    await page.waitForFunction(() => RD.Google.tokenExp - Date.now() > 30 * 60000, null, { timeout: 4000 }).catch(() => {});
    ok(await page.evaluate(() => RD.Google.tokenExp - Date.now() > 30 * 60000) && (await page.evaluate(() => window.__gisPrompts.slice(-1)[0])) === "" && (await page.evaluate(() => window.__gisPrompts.length)) === prompts + 1, "a click shortly before expiry renews the session without asking");
    await page.click('[data-nav="projects"]');
    await page.waitForTimeout(200);
    ok((await page.evaluate(() => window.__gisPrompts.length)) === prompts + 1, "and does not ask again while the session is fresh");

    console.log("Expired Google session");
    g.expireTokens = true;
    await page.evaluate(() => RD.go("project-p_two"));
    await page.click(".page-actions .btn:has-text('Post update')");
    await page.fill(".modal textarea", "FA report received.");
    await page.click(".modal-foot .btn-primary");
    await page.waitForSelector("#btn-reconnect", { timeout: 6000 });
    ok(await page.evaluate(() => RD.state.queue.length) === 2 && g.rowsOf("Updates").length === 0, "changes are kept on the device when Google rejects the session");
    g.expireTokens = false;
    await page.click("#btn-reconnect");
    await idle(page);
    ok(g.rowsOf("Updates").length === 1 && g.rowsOf("Projects").find((r) => r.id === "p_two").current_status === "FA report received.", "after Reconnect the waiting changes are sent");
    ok(await page.locator("#btn-reconnect").count() === 0, "reconnect banner is gone");
    await ctx.close();
  }

  console.log("Guest and supervisor tools");
  {
    const { ctx, page } = await open(browser, g, "sales1");
    await page.click("#login-google");
    await page.waitForSelector(".shell");
    await idle(page);
    const writesBefore = g.calls.filter((c) => /^(POST|PUT)/.test(c)).length;
    ok(await page.evaluate(() => RD.session.role) === "guest", "a listed guest signs in as guest");
    await page.evaluate(() => RD.go("projects"));
    ok(await page.locator("#btn-add-project").count() === 0, "guest has no editing controls");
    await page.waitForTimeout(400);
    ok(g.calls.filter((c) => /^(POST|PUT)/.test(c)).length === writesBefore, "guest session sends no writes to Google");
    await ctx.close();
    const b = await open(browser, g, "stranger");
    await b.page.click("#login-google");
    await b.page.waitForSelector(".shell");
    ok(await b.page.evaluate(() => RD.session.role) === "guest", "a company account that is not in Users is a guest");
    await b.ctx.close();
    const a = await open(browser, g, "nimal");
    await a.page.click("#login-google");
    await a.page.waitForSelector(".shell");
    await idle(a.page);
    await a.page.evaluate(() => RD.go("settings"));
    ok((await a.page.textContent("#view")).includes("have no id"), "Settings reports the row without an id");
    await a.page.click(".btn:has-text('Give ids to rows without one')");
    await a.page.waitForFunction(() => !RD.state.info.noIdRows.Projects, null, { timeout: 6000 }).catch(() => {});
    const adopted = g.rowsOf("Projects").find((r) => r.name === "Typed by hand, no id");
    ok(/^p_/.test(adopted.id) && await a.page.evaluate(() => RD.rows("Projects").some((p) => p.name === "Typed by hand, no id")), "the hand-typed row gets an id and appears", adopted.id);
    // switch a user off -> they are refused
    await a.page.evaluate(() => RD.go("team"));
    await a.page.click('button[aria-label="Edit Kamal"]');
    await a.page.selectOption("#f-user-kamal-acme-test-active", "no");
    await a.page.click(".modal-foot .btn-primary");
    await idle(a.page);
    await a.ctx.close();
    const k = await open(browser, g, "kamal");
    await k.page.click("#login-google");
    await k.page.waitForSelector(".form-error:not([hidden])");
    ok((await k.page.textContent(".form-error")).includes("switched off") && await k.page.locator(".shell").count() === 0, "a switched-off person cannot sign in");
    await k.ctx.close();
  }

  await browser.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
