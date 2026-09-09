import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
const url = process.env.IKUSEI_TEST_URL ?? "http://127.0.0.1:5174/IKUSEI/";
const key = "ikusei-prototype-save-v16";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 800 }, reducedMotion: "reduce" });
const errors = [];
page.on("pageerror", e => errors.push(e.message));
const captureDir = process.env.IKUSEI_CAPTURE_DIR ?? "../adv-ui-captures";
mkdirSync(captureDir, { recursive: true });
await page.addInitScript(() => {
  localStorage.setItem("ikusei-prototype-ui-v14", JSON.stringify({ tab: "today", sheet: null, speed: Number(localStorage.getItem("adv-test-speed") ?? 0), motion: true, volume: 0, textSize: 24, strongText: false }));
});
async function saved() { return page.evaluate(k => JSON.parse(localStorage.getItem(k)), key); }
async function screenshot(name) { await page.screenshot({ path: captureDir + "/" + name + ".png" }); }
async function resume() {
  await page.reload();
  await page.getByRole("button", { name: "続きから", exact: true }).click();
}
async function skipText() {
  await page.waitForSelector(".scenario-stage[data-ready=true]");
  await page.getByRole("button", { name: "シナリオメニュー", exact: true }).click();
  await page.getByRole("button", { name: "この場面をとばす", exact: true }).click();
}
async function accept(id) {
  await page.locator('[data-job="' + id + '"] button').click();
  await page.getByRole("button", { name: "この依頼を受ける" }).click();
  await page.waitForSelector(".scenario-stage[data-ready=true]");
}
try {
  await page.goto(url);
  await page.getByRole("button", { name: "はじめから", exact: true }).click();
  await page.waitForSelector('[data-job="debug-training"]');
  for (const axis of ["貞操", "品位", "威厳"]) {
    const row = page.locator(`[data-axis="${axis}"]`);
    assert((await row.innerText()).includes("ランク5"));
    const label = await row.locator(".a-axis-title b").boundingBox();
    const meter = await row.locator(".a-meter").boundingBox();
    assert(meter.y >= label.y + label.height, "rank label sits above the meter");
  }
  await screenshot("desk");
  assert.equal((await saved()).day, 1);
  await accept("debug-challenge");
  const accepted = await saved();
  assert.equal(accepted.day, 1);
  assert.equal(accepted.money, 120);
  await skipText();
  await page.waitForSelector('[data-choice="negotiation"]');
  assert.equal(await page.locator('[data-choice="negotiation"]').getAttribute("aria-disabled"), "true");
  await page.locator('[data-choice="negotiation"]').click({ force: true });
  assert.equal((await saved()).activeSession.nodeId, "role");
  assert.equal((await saved()).activeSession.choices.length, 0);
  await screenshot("locked");
  await resume();
  await page.waitForSelector('[data-choice="normal"]');
  await page.getByRole("button", { name: "会話ログ", exact: true }).click();
  await page.getByRole("button", { name: "選択に戻る", exact: true }).click();
  await page.locator(".adv-stage").getByRole("button", { name: "設定", exact: true }).click();
  await page.getByRole("button", { name: "選択に戻る", exact: true }).click();
  assert.equal((await saved()).activeSession.choices.length, 0);
  await page.locator('[data-choice="normal"]').click();
  await skipText();
  await page.getByRole("button", { name: "翌日へ", exact: true }).waitFor();
  const completed = await saved();
  await resume();
  assert.equal((await saved()).money, completed.money);
  await page.getByRole("button", { name: "翌日へ", exact: true }).click();
  await accept("debug-training");
  await page.waitForFunction(k => JSON.parse(localStorage.getItem(k)).activeSession.cursor.chars > 0, key, { timeout: 4000 });
  assert((await saved()).activeSession.cursor.chars > 0);
  // A partial typewriter checkpoint survives font measurement and browser reload.
  await page.evaluate(k => {
    const s = JSON.parse(localStorage.getItem(k));
    s.activeSession.cursor.chars = 12;
    localStorage.setItem(k, JSON.stringify(s));
    localStorage.setItem("adv-test-speed", "50");
  }, key);
  await resume();
  await page.waitForSelector(".scenario-stage[data-ready=true]");
  const resumedText = await page.locator(".scenario-text span").innerText();
  assert(resumedText.length >= 12 && resumedText.length < 50, "partial cursor is preserved across layout measurement");
  await page.getByRole("button", { name: "シナリオメニュー", exact: true }).click();
  await page.getByRole("button", { name: "保存してタイトルへ", exact: true }).click();
  assert((await saved()).activeSession.cursor.chars >= 12);
  await page.evaluate(() => localStorage.setItem("adv-test-speed", "0"));
  await resume();
  await skipText();
  await page.locator('[data-choice="negotiation"]').dblclick();
  await skipText();
  await page.getByRole("button", { name: "翌日へ", exact: true }).waitFor();
  assert.equal((await saved()).growthXP.negotiation, 2);
  await screenshot("growth-result");
  await page.getByRole("button", { name: "翌日へ", exact: true }).click();
  await page.getByRole("button", { name: "交渉の成長について", exact: true }).click();
  assert.equal(await page.locator('.growth-card').first().locator('.growth-rank b').innerText(), '1');
  await page.getByRole("dialog", { name: "主人公の成長" }).getByRole("button", { name: "閉じる", exact: true }).click();
  await accept("debug-challenge");
  await skipText();
  assert.equal(await page.locator('[data-choice="negotiation"]').getAttribute("aria-disabled"), "false");
  await page.locator('[data-choice="negotiation"]').click();
  await skipText();
  await page.getByRole("button", { name: "翌日へ", exact: true }).click();
  await page.waitForSelector('[data-job="debug-followup-negotiation"]');
  assert.equal(await page.locator('[data-job="debug-followup-charm"]').count(), 0);
  await screenshot("followup");
  await page.getByRole("button", { name: "回想", exact: true }).click();
  await page.getByRole("button", { name: "選択の回想", exact: true }).click();
  const beforeReplay = await saved();
  await page.locator(".adv-archive-list button").last().click();
  for (let i = 0; i < 8 && await page.locator(".scenario-stage").count(); i++) await skipText();
  assert.deepEqual(await saved(), beforeReplay);
  // Seed a debug state to exercise full-width complex conditions, without rewriting content.
  await page.evaluate(async k => {
    const { freshDaily } = await import("/IKUSEI/src/daily.ts");
    const s = freshDaily("ui-composite"); s.debugMode = true;
    localStorage.setItem(k, JSON.stringify(s));
  }, key);
  await resume();
  await accept("debug-axes"); await skipText();
  await page.locator('[data-choice="prestige"]').click();
  await page.waitForSelector('[data-choice="band"]');
  assert.equal(await page.locator('[data-choice="band"]').getAttribute("aria-disabled"), "false");
  assert.equal(await page.locator('[data-choice="high"]').getAttribute("aria-disabled"), "true");
  for (const size of [{ width: 1440, height: 800 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(150);
    const dims = await page.locator(".adv-stage").evaluate(e => ({ width: e.clientWidth, height: e.clientHeight, scroll: e.scrollWidth }));
    assert.equal(dims.width, 1200); assert.equal(dims.height, 500); assert.equal(dims.scroll, 1200);
    const box = await page.locator(".adv-stage").boundingBox();
    assert(box.x >= -1 && box.y >= -1 && box.x + box.width <= size.width + 1 && box.y + box.height <= size.height + 1);
    await screenshot("conditions-" + size.width);
  }
  await page.setViewportSize({ width: 1440, height: 800 });
  const preFailure = await saved();
  await page.evaluate(k => {
    const original = Storage.prototype.setItem;
    window.__restoreStorage = () => { Storage.prototype.setItem = original; };
    Storage.prototype.setItem = function(key, value) { if (key === k) throw new DOMException("test quota", "QuotaExceededError"); return original.call(this, key, value); };
  }, key);
  await page.locator('[data-choice="band"]').click();
  await page.getByRole("button", { name: "保存を再試行", exact: true }).waitFor();
  assert.deepEqual(await saved(), preFailure);
  await screenshot("save-failure");
  await page.evaluate(() => window.__restoreStorage());
  await page.getByRole("button", { name: "保存を再試行", exact: true }).click();
  await skipText();
  assert.equal((await saved()).axes.威厳, 60);
  assert.equal((await saved()).activeSession.choices.length, 2);
  await page.evaluate(async k => {
    const { freshDaily } = await import("/IKUSEI/src/daily.ts");
    const s = freshDaily("ui-rank-recovery"); s.debugMode = true;
    s.axes = { 貞操: 0, 品位: 45, 威厳: 61 };
    localStorage.setItem(k, JSON.stringify(s));
  }, key);
  await resume();
  assert((await page.locator('[data-axis="貞操"]').innerText()).includes("ランク0"));
  await accept("debug-axes"); await skipText();
  await page.locator('[data-choice="recover"]').click();
  await page.waitForSelector('[data-choice="band"]');
  assert.deepEqual((await saved()).activeSession.working.axes, { 貞操: 0, 品位: 60, 威厳: 80 });
  assert.equal(await page.locator('[data-choice="high"]').getAttribute("aria-disabled"), "true");
  await page.locator('[data-choice="normal"]').click();
  await page.getByRole("button", { name: "翌日へ", exact: true }).waitFor();
  const recovered = await saved();
  assert.deepEqual(recovered.axes, { 貞操: 0, 品位: 60, 威厳: 80 });
  assert(!JSON.stringify(recovered).includes("dignityCap"));
  assert(!(await page.locator("body").innerText()).includes("品位上限"));
  await resume();
  assert.deepEqual((await saved()).axes, recovered.axes);
  await screenshot("rank-recovery");
  assert.deepEqual(errors, []);
  console.log("PASS ADV UI: growth, locks, branches, resume, cursor, exactly-once, archive, complex conditions, 1200x500, storage retry, irreversible ranks and recovery");
} catch (error) {
  await screenshot("failure");
  console.error("PAGE", (await page.locator("body").innerText()).slice(-5000), errors);
  throw error;
} finally { await browser.close(); }
