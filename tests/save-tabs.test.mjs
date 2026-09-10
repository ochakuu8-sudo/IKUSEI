import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const url = process.env.IKUSEI_TEST_URL ?? "http://127.0.0.1:5174/IKUSEI/";
const key = "ikusei-prototype-save-v16";
const browser = await chromium.launch();
const errors = [];
const captureDir = process.env.IKUSEI_SAVE_CAPTURE_DIR ?? "../save-ui-captures";
mkdirSync(captureDir, { recursive: true });
const button = (page, name) => page.getByRole("button", { name, exact: true });
const saved = page => page.evaluate(k => localStorage.getItem(k), key);
async function context(fallback) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: "reduce" });
  await ctx.addInitScript(fallback => {
    if (!/^https?:$/.test(location.protocol)) return;
    if (fallback) Object.defineProperty(Navigator.prototype, "locks", { get: () => undefined });
    localStorage.setItem("ikusei-prototype-ui-v14", JSON.stringify({ tab: "today", speed: 0, motion: true, volume: 0 }));
  }, fallback);
  ctx.on("page", page => page.on("pageerror", error => errors.push(error.message)));
  return ctx;
}
async function seed(page, settle = false) {
  await page.goto(url);
  await page.evaluate(async ({ key, settle }) => {
    const { freshDaily, markSeen } = await import("/IKUSEI/src/daily.ts");
    const { jobs } = await import("/IKUSEI/src/game.ts");
    const s = markSeen(freshDaily("tabs-ui"), jobs.map(j => j.id));
    if (settle) { s.day = 14; s.awaitingSettlement = true; s.money = 1290; }
    localStorage.setItem(key, JSON.stringify(s));
  }, { key, settle });
  await page.reload();
}
async function rest(page) {
  await button(page, "今日は受けない").click();
  await button(page, "今日は休む").click();
}
try {
  for (const fallback of [false, true]) {
    const ctx = await context(fallback);
    try {
      const a = await ctx.newPage(), b = await ctx.newPage();
      await seed(a);
      await b.goto(url);
      await button(a, "続きから").click();
      await button(b, "続きから").click();
      await rest(a);
      await a.locator(".r-day-record").waitFor();
      const latest = await saved(a);
      assert.equal(JSON.parse(latest).day, 2);
      await rest(b);
      await b.getByRole("dialog", { name: "記録が更新されています", exact: true }).waitFor();
      assert.equal(await saved(b), latest, "stale rest must not overwrite the current save");
      if (!fallback) for (const size of [{width:1280,height:720}, {width:844,height:390}]) {
        await b.setViewportSize(size);
        const dialog=b.getByRole('dialog', {name:'記録が更新されています',exact:true});
        const box=await dialog.boundingBox();
        assert(box.x>=0 && box.y>=0 && box.x+box.width<=size.width && box.y+box.height<=size.height);
        assert(await dialog.locator('.dialog-body').evaluate(e=>e.scrollHeight<=e.clientHeight+1));
        const target=await button(b,'最新の記録を読み込む').boundingBox();
        assert(target.height>=44, 'conflict recovery remains tappable at small landscape size');
        await b.screenshot({path:`${captureDir}/conflict-${size.width}.png`});
      }
      await button(b, "最新の記録を読み込む").click();
      await button(b, "続きから").click();
      await button(b, "2日目 第1章").waitFor();
      await rest(b);
      await b.locator(".r-day-record").waitFor();
      assert.equal(JSON.parse(await saved(b)).day, 3, "reloaded tab can save again");
      // A chapter settlement uses the same guard and is not paid twice.
      await seed(a, true);
      await b.reload();
      await button(a, "続きから").click();
      await button(b, "続きから").click();
      await button(a, "この内容で納める").click();
      await a.locator(".r-day-record").waitFor();
      const settled = await saved(a);
      await button(b, "この内容で納める").click();
      await button(b, "最新の記録を読み込む").waitFor();
      assert.equal(await saved(b), settled);
      assert.equal(JSON.parse(settled).money, 240);
      assert.equal(JSON.parse(settled).debt, 10800);
    } finally { await ctx.close(); }
    // Both title screens were opened before any save existed.
    const starts = await context(fallback);
    try {
      const a = await starts.newPage(), b = await starts.newPage();
      await Promise.all([a.goto(url), b.goto(url)]);
      await Promise.all([button(a, "はじめから").click(), button(b, "はじめから").click()]);
      await Promise.all([a.waitForFunction(() => document.querySelector('.a-offer') || document.body.textContent.includes('記録が更新されています')), b.waitForFunction(() => document.querySelector('.a-offer') || document.body.textContent.includes('記録が更新されています'))]);
      const conflicts = await Promise.all([a, b].map(p => button(p, "最新の記録を読み込む").count()));
      assert.equal(conflicts[0] + conflicts[1], 1, "exactly one simultaneous start is rejected");
      assert.equal(JSON.parse(await saved(a)).day, 1);
    } finally { await starts.close(); }
    console.log(`PASS save tabs (${fallback ? "IndexedDB fallback" : "Web Locks"}): stale rest, reload, settlement, simultaneous starts`);
  }
  const retry = await context(false);
  try {
    const p = await retry.newPage();
    await p.goto(url);
    await p.evaluate(() => {
      const request=navigator.locks.request.bind(navigator.locks);
      window.restoreLock=()=>{navigator.locks.request=request;};
      navigator.locks.request=()=>Promise.reject(new DOMException('test denied','SecurityError'));
    });
    await button(p,'はじめから').click();
    await button(p,'保存を再試行').waitFor();
    assert.equal(await saved(p),null);
    await p.evaluate(()=>window.restoreLock());
    await button(p,'保存を再試行').click();
    await p.locator('[data-job="debug-training"]').waitFor();
    assert.equal(JSON.parse(await saved(p)).day,1);
    assert.equal(await button(p,'保存を再試行').count(),0);
    console.log('PASS save lock failure: no write and retry succeeds');
  } finally { await retry.close(); }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
