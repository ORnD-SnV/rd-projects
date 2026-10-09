// Quick look: sign in as each demo role and screenshot every page.
const { chromium } = require(process.env.PW || "playwright");
const OUT = process.env.OUT || "shots";
const BASE = process.env.BASE || "http://localhost:8765/";
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  for (const [w, hgt, scheme, tag] of [[1440, 900, "light", "desk"], [390, 844, "dark", "phone"]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: hgt }, colorScheme: scheme, serviceWorkers: "block" });
    const page = await ctx.newPage();
    page.on("console", (m) => { if (m.type() === "error") errors.push(tag + ": " + m.text()); });
    page.on("pageerror", (e) => errors.push(tag + " pageerror: " + e.message));
    await page.goto(BASE);
    await page.waitForSelector(".login-card");
    await page.screenshot({ path: `${OUT}/${tag}-login.png` });
    await page.click("#login-admin");
    await page.waitForSelector(".tiles");
    await page.waitForTimeout(700);
    for (const r of ["overview", "projects", "time", "costings", "files", "team", "settings"]) {
      await page.evaluate((x) => RD.go(x), r);
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/${tag}-${r}.png`, fullPage: true });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 1) errors.push(`${tag} ${r}: page scrolls sideways by ${overflow}px`);
    }
    const pid = await page.evaluate(() => RD.rows("Projects")[0].id);
    await page.evaluate((x) => RD.go("project-" + x), pid);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/${tag}-project.png`, fullPage: true });
    await ctx.close();
  }
  await browser.close();
  console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "no console errors, no sideways scroll");
})().catch((e) => { console.error(e); process.exit(1); });
