import { createRequire } from "node:module";
import { resolve } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import * as G from "@game/game";
import { performAction } from "@game/engine";
const pw = createRequire(resolve("package.json"))("playwright");
const url = process.env.IKUSEI_TEST_URL ?? "http://127.0.0.1:5173/IKUSEI/";
const out = resolve("../command-validation");
mkdirSync(out, { recursive: true });
const errors = [],
  checks = [];
const saveKey = "ikusei-prototype-save-v9";
const engines = process.env.IKUSEI_BROWSERS?.split(",") ?? ["chromium"];
const actionNames = ["薬の依頼を見る", "調合する", "出かける", "休む"];
const read = (page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)), saveKey);
const button = (page, name) => page.getByRole("button", { name, exact: true });
const main = (page) => page.locator("#main-content");
async function home(page) {
  if (
    await page
      .getByRole("navigation", { name: "今日の行動", exact: true })
      .count()
  )
    return;
  await button(page, "自室へ").filter({ visible: true }).first().click();
}
async function action(page, name) {
  await home(page);
  await page
    .getByRole("navigation", { name: "今日の行動", exact: true })
    .getByRole("button", { name, exact: true })
    .click();
}
async function seed(page, s) {
  await page.evaluate(
    ({ s, key }) => {
      localStorage.clear();
      localStorage.setItem(key, JSON.stringify(s));
    },
    { s, key: saveKey },
  );
  await page.reload();
  await button(page, "続きから").click();
}
async function close(page) {
  while (await page.locator("dialog[open]").count())
    await page
      .locator("dialog[open]")
      .last()
      .getByRole("button", { name: "閉じる", exact: true })
      .click();
}
async function inspect(page, label, homeButtons = false) {
  await page.evaluate(() => document.fonts.ready);
  const issues = await page.evaluate(
    ({ homeButtons }) => {
      const problems = [];
      if (document.documentElement.scrollWidth > innerWidth + 1)
        problems.push("horizontal overflow");
      const selectors = homeButtons
        ? ".commands:not(.compact-commands) button"
        : ".route-bar button";
      for (const el of document.querySelectorAll(selectors)) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        if (
          r.top < 0 ||
          r.bottom > innerHeight + 1 ||
          r.left < 0 ||
          r.right > innerWidth + 1
        )
          problems.push("outside initial viewport: " + el.textContent);
        const hit = document.elementFromPoint(
          r.x + r.width / 2,
          r.y + r.height / 2,
        );
        if (!el.contains(hit))
          problems.push("covered control: " + el.textContent);
        if (r.height < 43 || r.width < 43)
          problems.push("small control: " + el.textContent);
      }
      return problems;
    },
    { homeButtons },
  );
  assert.deepEqual(issues, [], label);
  await page.screenshot({ path: resolve(out, label + ".png") });
  checks.push(label);
}
for (const engine of engines) {
  const browser = await pw[engine].launch();
  try {
    for (const [w, h] of [
      [1280, 720],
      [390, 844],
    ]) {
      const tag = engine + "-" + w;
      const page = await browser.newPage({
        viewport: { width: w, height: h },
        hasTouch: w < 500,
        reducedMotion: "reduce",
      });
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(url);
      await button(page, "はじめから").click();
      assert.equal(
        await page.locator("dialog[open]").count(),
        0,
        "home is immediately available",
      );
      assert.deepEqual(
        await page
          .getByRole("navigation", { name: "今日の行動" })
          .getByRole("button")
          .evaluateAll((es) => es.map((e) => e.getAttribute("aria-label"))),
        actionNames,
      );
      await inspect(page, tag + "-home", true);
      const initial = await read(page);
      await action(page, "調合する");
      assert.equal(
        await main(page).locator(".brew-sheet").count(),
        0,
        "choose a medicine first",
      );
      await main(page)
        .getByRole("button", { name: /薬湯 所持/ })
        .click();
      await inspect(page, tag + "-recipe");
      await button(page, "ひとつ戻る").click();
      assert.equal(
        await main(page).locator(".brew-sheet").count(),
        0,
        "back returns to recipe list",
      );
      await home(page);
      await action(page, "出かける");
      await main(page)
        .getByRole("button", { name: /アルノー商会/ })
        .click();
      await inspect(page, tag + "-place");
      await button(page, "人物に会う").click();
      await main(page)
        .getByRole("button", { name: /ヴェルネ/ })
        .click();
      assert(await button(page, "親交を深める").isVisible());
      await button(page, "ひとつ戻る").click();
      assert(await main(page).locator(".person-list").isVisible());
      await button(page, "ひとつ戻る").click();
      await button(page, "素材を買う").click();
      assert.equal(
        await main(page).locator(".person-heading").count(),
        0,
        "shop contains no unrelated people UI",
      );
      await home(page);
      await action(page, "休む");
      await button(page, "閉じる").click();
      assert.deepEqual(
        await read(page),
        initial,
        "browsing and cancelling consume no resources",
      );
      await action(page, "薬の依頼を見る");
      await inspect(page, tag + "-orders");
      await button(page, "この薬を準備する").click();
      await main(page)
        .getByRole("button", { name: /商会で仕入れ/ })
        .click();
      assert.equal(
        await page
          .getByRole("spinbutton", { name: "野薔薇の購入数", exact: true })
          .inputValue(),
        "4",
      );
      assert.equal(
        await page
          .getByRole("spinbutton", { name: "苦艾の購入数", exact: true })
          .inputValue(),
        "2",
      );
      await inspect(page, tag + "-buy");
      await button(page, "購入内容を確認").click();
      await button(page, "購入する・1日").click();
      await close(page);
      await button(page, "調合の準備に戻る").click();
      await button(page, "薬湯を2個調合する").click();
      assert.equal((await read(page)).stock.tisane, 2);
      await button(page, "納品を確認する").click();
      await button(page, "納品へ").click();
      await button(page, "納品内容を確認").click();
      await button(page, "納品する・1日").click();
      await close(page);
      const delivered = await read(page);
      assert.equal(delivered.day, 3);
      assert.equal(delivered.money, 374);
      assert.equal(delivered.stamina, 38);
      assert.equal(delivered.stock.tisane, 0);
      const ui = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("ikusei-ui-v1")),
      );
      assert.equal(ui.selection.ordinary.length, 0);
      await home(page);
      await page.reload();
      await button(page, "続きから").click();
      assert.deepEqual(await read(page), delivered);
      checks.push(tag + "-purchase-brew-delivery-reload");
      // All four commands remain accessible on the existing short landscape sizes.
      for (const [lw, lh] of [
        [667, 375],
        [800, 360],
        [844, 390],
        [932, 430],
      ]) {
        await page.setViewportSize({ width: lw, height: lh });
        await inspect(page, tag + "-landscape-" + lw, true);
      }
      await page.setViewportSize({ width: w, height: h });
      const rich = structuredClone(G.initialState);
      rich.money = 3000;
      rich.materials = Object.fromEntries(G.materialIds.map((id) => [id, 20]));
      await seed(page, rich);
      await action(page, "調合する");
      await main(page)
        .getByRole("button", { name: /薬湯 所持/ })
        .click();
      await button(page, "薬湯を1個調合する").dblclick();
      assert.equal(
        (await read(page)).stock.tisane,
        1,
        "double click crafts only once",
      );
      let due = structuredClone(G.initialState);
      due.day = 2;
      due = performAction(due, { type: "accept", offer: "special-a" }).state;
      due.day = 8;
      due.stock.tisane = 2;
      await seed(page, due);
      await page.setViewportSize({ width: 800, height: 360 });
      await inspect(page, tag + "-due-home", true);
      await page.setViewportSize({ width: w, height: h });
      await action(page, "休む");
      assert(
        await page
          .getByRole("alert")
          .getByText(/本日の用事を残したまま/)
          .isVisible(),
      );
      await button(page, "閉じる").click();
      assert.equal((await read(page)).day, 8);
      await action(page, "薬の依頼を見る");
      await button(page, "指定日の依頼").click();
      await button(page, "まとめ納品へ").click();
      await button(page, "納品に選ぶ").click();
      await button(page, "納品内容を確認").click();
      await button(page, "納品する・1日").click();
      await close(page);
      assert.equal((await read(page)).obligations[0].status, "fulfilled");
      checks.push(tag + "-double-click-and-fixed-day");
      await page.close();
    }
  } finally {
    await browser.close();
  }
}
assert.deepEqual(errors, []);
writeFileSync(
  resolve(out, "report.json"),
  JSON.stringify({ checks, errors }, null, 2),
);
console.log(
  "PASS " +
    checks.length +
    " focused screens/flows: four home commands, back, people, purchasing, crafting, delivery, reload, landscape, double click, fixed-day warning/delivery",
);
