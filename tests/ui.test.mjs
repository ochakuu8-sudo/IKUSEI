import { createRequire } from "node:module";
import { resolve } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import * as G from "@game/game";
import { performAction } from "@game/engine";
const { chromium } = createRequire(resolve("package.json"))("playwright");
const out = resolve("../stamina-validation");
mkdirSync(out, { recursive: true });
const url = process.env.IKUSEI_TEST_URL ?? "http://127.0.0.1:5174/IKUSEI/",
  key = "ikusei-prototype-save-v10";
const b = (p, name) => p.getByRole("button", { name, exact: true });
const read = (p) => p.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);
const row = (p, name) => p.locator(".work-choice").filter({ hasText: name });
const commit = (p, name) =>
  p
    .locator("dialog[open]")
    .last()
    .getByRole("button", { name, exact: true })
    .click();
async function finish(p) {
  for (let i = 0; i < 40 && (await p.locator("dialog[open]").count()); i++) {
    if (await p.locator(".scenario-dialog").count())
      await p
        .locator(".scenario-tap-target")
        .tap({ position: { x: 30, y: 100 } });
    else await commit(p, "確認");
  }
}
async function seed(p, s) {
  await p.evaluate(
    ({ s, key }) => {
      localStorage.setItem(key, JSON.stringify(s));
      localStorage.removeItem("ikusei-ui-v1");
    },
    { s, key },
  );
  await p.reload();
  await b(p, "続きから").click();
}
async function inspect(p, name, selector) {
  const issues = await p.locator(selector).evaluateAll((es) =>
    es
      .filter(
        (e) =>
          e.getClientRects().length &&
          getComputedStyle(e).visibility !== "hidden",
      )
      .flatMap((e) => {
        const r = e.getBoundingClientRect(),
          hit = document.elementFromPoint(
            r.x + r.width / 2,
            r.y + r.height / 2,
          );
        return r.x < 0 ||
          r.y < 0 ||
          r.right > innerWidth + 1 ||
          r.bottom > innerHeight + 1 ||
          r.height < 43 ||
          !e.contains(hit)
          ? [e.textContent]
          : [];
      }),
  );
  assert.deepEqual(issues, [], name);
  await p.screenshot({ path: resolve(out, name + ".png") });
}
const browser = await chromium.launch();
const errors = [],
  checks = [];
try {
  for (const [w, h] of [
    [1280, 720],
    [390, 844],
  ]) {
    const p = await browser.newPage({
      viewport: { width: w, height: h },
      hasTouch: true,
      reducedMotion: "reduce",
    });
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(url);
    await b(p, "はじめから").click();
    assert.deepEqual(
      await p
        .locator(".commands:not(.compact-commands) button")
        .evaluateAll((es) => es.map((e) => e.ariaLabel)),
      ["依頼", "収集", "調合"],
    );
    for (const [width, height] of [
      [w, h],
      [667, 375],
      [800, 360],
      [844, 390],
      [932, 430],
    ]) {
      await p.setViewportSize({ width, height });
      await inspect(
        p,
        `home-${w}-${width}`,
        ".commands:not(.compact-commands) button,.home-decisions .home-utilities button",
      );
    }
    await p.setViewportSize({ width: w, height: h });
    await b(p, "依頼").click();
    assert.equal(await row(p, "学院文書の筆耕").count(), 0);
    await row(p, "学院へ薬湯を届ける").click();
    assert.equal(await p.locator(".inline-preparation").count(), 0);
    await p.screenshot({ path: resolve(out, "order-" + w + ".png") });
    await b(p, "素材を集める").click();
    await p
      .locator(".gather-card")
      .filter({ hasText: "修道院の丘" })
      .getByRole("button", { name: "採集する", exact: true })
      .click();
    await commit(p, "採集する");
    assert.equal((await read(p)).day, 1);
    assert.equal((await read(p)).stamina, 78);
    assert(await p.locator(".collection-screen").isVisible());
    await p.screenshot({ path: resolve(out, "collection-" + w + ".png") });
    await b(p, "調合へ").click();
    await p.screenshot({ path: resolve(out, "brew-" + w + ".png") });
    await p.locator(".brew-sheet .action-dock .primary").click();
    await commit(p, "調合する");
    assert.equal((await read(p)).stock.tisane, 2);
    await b(p, "依頼へ戻る").click();
    assert(await p.locator(".work-detail").isVisible());
    await p.locator(".work-detail .action-dock .primary").click();
    await commit(p, "納品する");
    await finish(p);
    const s = await read(p);
    assert.equal(s.day, 1);
    assert.equal(s.stamina, 34);
    assert.equal(s.money, 450);
    assert.equal(s.relations.claire, 1);
    checks.push("same-day-loop-" + w);
    await b(p, "詳細から戻る").click();
    await b(p, "自室へ").filter({ visible: true }).first().click();
    await b(p, "一日を終える").click();
    await commit(p, "一日を終える");
    await finish(p);
    assert.equal((await read(p)).day, 2);
    assert.equal((await read(p)).stamina, 100);
    checks.push("day-end-" + w);
    let a = performAction(
      { ...structuredClone(G.initialState), day: 2 },
      { type: "accept", offer: "special-a" },
    ).state;
    a.day = 8;
    a.stock.tisane = 4;
    await seed(p, a);
    await b(p, "一日を終える").click();
    assert(await p.locator("dialog footer .deadline-strip").isVisible());
    await p
      .locator("dialog")
      .getByRole("button", { name: "戻る", exact: true })
      .click();
    await b(p, "依頼").click();
    await row(p, "学院へ薬湯を届ける").click();
    await b(p, "納品に追加").click();
    await b(p, "詳細から戻る").click();
    await p.getByRole("button", { name: /特別依頼 1/, exact: true }).click();
    await row(p, "特別依頼A：紹介の薬湯").click();
    await p.locator(".work-detail .action-dock .primary").click();
    await commit(p, "納品する");
    await finish(p);
    assert.equal((await read(p)).day, 8);
    assert.equal((await read(p)).money, 810);
    assert.deepEqual((await read(p)).unlockedPeople, ["herbalist"]);
    checks.push("special-batch-" + w);
    let z = structuredClone(G.initialState);
    z.stamina = 0;
    await seed(p, z);
    await b(p, "収集").click();
    assert(await p.locator(".gather-card button").first().isDisabled());
    await b(p, "仕入れ").click();
    await p.getByRole("spinbutton", { name: "野薔薇の購入数" }).fill("1");
    await p.locator(".shop-screen .action-dock .primary").click();
    await commit(p, "購入する");
    assert.equal((await read(p)).stamina, 0);
    assert.equal((await read(p)).day, 1);
    checks.push("zero-stamina-shopping-" + w);
    let last = structuredClone(G.initialState);
    last.day = 14;
    last.money = 2000;
    await seed(p, last);
    await b(p, "一日を終える").click();
    await commit(p, "一日を終える");
    await finish(p);
    assert(await p.locator(".screen-settlement").isVisible());
    checks.push("chapter-end-" + w);
    await p.close();
  }
} catch (e) {
  for (const c of browser.contexts())
    for (const p of c.pages()) {
      await p.screenshot({ path: resolve(out, "failure.png") });
      console.log(await p.locator("body").innerText());
    }
  throw e;
} finally {
  await browser.close();
}
assert.deepEqual(errors, []);
writeFileSync(
  resolve(out, "report.json"),
  JSON.stringify({ checks, errors }, null, 2),
);
console.log("PASS stamina UI flows and six viewport layouts", checks.length);
