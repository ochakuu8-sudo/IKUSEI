import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
const browser = await chromium.launch(),
  out = resolve("../../outputs/implementation-screens");
mkdirSync(out, { recursive: true });
const page = await browser.newPage({
    viewport: { width: 1366, height: 768 },
    hasTouch: true,
    reducedMotion: "reduce",
  }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const button = (name) => page.getByRole("button", { name, exact: true }),
  read = () =>
    page.evaluate(() =>
      JSON.parse(localStorage.getItem("ikusei-prototype-save-v13")),
    );
async function click(name) {
  await button(name).tap();
  await page.waitForTimeout(230);
}
/** 主操作のボタンは体力や不足素材を併記するので、前方一致でつかむ。 */
async function clickLike(re) {
  await page.getByRole("button", { name: re }).first().tap();
  await page.waitForTimeout(230);
}
async function confirm() {
  await page
    .locator("dialog[open]")
    .last()
    .getByRole("button", { name: "確定する", exact: true })
    .tap();
  await page.waitForTimeout(230);
}
async function closeResult() {
  if (await button("確認").count()) await click("確認");
}
try {
  await page.goto(
    process.env.IKUSEI_TEST_URL ?? "http://127.0.0.1:5174/IKUSEI/",
  );
  await click("はじめから");
  assert.equal((await read()).saveVersion, 13);
  await page.screenshot({ path: resolve(out, "home-1366.png") });
  await page
    .locator(".c-home-content")
    .getByRole("button", { name: /^依頼/ })
    .tap();
  await page.waitForTimeout(250);
  await page
    .locator(".c-card-link")
    .filter({ hasText: "商会の帳場へ薬湯を" })
    .tap();
  await page.screenshot({ path: resolve(out, "orders-1366.png") });
  await clickLike(/^素材をそろえる/);
  await page.screenshot({ path: resolve(out, "map-1366.png") });
  await clickLike(/^採集する/);
  await confirm();
  await closeResult();
  const gathered = await read();
  assert(gathered.materials.rose >= 2 && gathered.materials.rose <= 4);
  assert.equal(gathered.day, 1);
  await clickLike(/^調合へ/);
  await page.screenshot({ path: resolve(out, "brew-1366.png") });
  await clickLike(/個つくる/);
  await confirm();
  await closeResult();
  assert.equal((await read()).recipeXP.tisane, 1);
  await click("依頼へ戻る");
  await clickLike(/^納品する/);
  await confirm();
  await page.locator(".scenario-dialog").waitFor();
  const before = await read();
  assert.equal(before.questCompletionCounts["c1-01"], 1);
  assert.equal(before.money, 288);
  await page.reload();
  await click("続きから");
  await page.locator(".scenario-dialog").waitFor();
  assert.equal((await read()).money, 288);
  await click("シナリオメニュー");
  await click("この場面をとばす");
  await closeResult();
  assert((await read()).playedEvents.includes("evt-c1-01"));
  await page
    .locator(".c-home-content")
    .getByRole("button", { name: /^依頼/ })
    .tap();
  await page.waitForTimeout(250);
  await page.locator(".c-card-link").first().tap();
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: resolve(out, "orders-844.png") });
  const fit = await page.locator(".chapter-app").evaluate((e) => {
    const r = e.getBoundingClientRect();
    return r.width / r.height;
  });
  assert(Math.abs(fit - 2.4) < 0.001);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  assert(
    Math.abs(
      (await page
        .locator(".chapter-app")
        .evaluate((e) => e.getBoundingClientRect().height)) - 162.5,
    ) < 1,
  );
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.waitForTimeout(200);
  await page
    .locator(".c-nav")
    .getByRole("button", { name: "自室", exact: true })
    .tap();
  await click("一日を終える");
  await confirm();
  await closeResult();
  assert.equal((await read()).day, 2);
  assert.equal((await read()).stamina, 100);
  assert.deepEqual(errors, []);
  console.log(
    "PASS v13 UI: request → map/gather → brew → quality delivery → unread reload/skip → next day; fixed 2.4:1 landscape/portrait",
  );
} finally {
  await browser.close();
}
