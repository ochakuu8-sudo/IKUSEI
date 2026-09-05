import { createRequire } from "node:module";
import { resolve } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import * as G from "@game/game";
import { performAction } from "@game/engine";
import { legacyOffers } from "@game/content/support";
const require = createRequire(resolve("package.json"));
const pw = require("playwright");
const url = process.env.IKUSEI_TEST_URL ?? "http://127.0.0.1:5173/IKUSEI/";
const out = resolve("../redesign-validation");
mkdirSync(out, { recursive: true });
const failures = [],
  errors = [],
  checks = [];
const sizes = [
  [667, 375],
  [800, 360],
  [844, 390],
  [932, 430],
  [390, 844],
  [1440, 900],
];
const engines = process.env.IKUSEI_BROWSERS?.split(",") ?? [
  "chromium",
  "firefox",
  "webkit",
];
const rich = () => {
  const s = structuredClone(G.initialState);
  s.money = 4000;
  s.known = G.recipes.map((r) => r.id);
  s.stock = Object.fromEntries(G.recipes.map((r) => [r.id, 12]));
  s.materials = Object.fromEntries(G.materialIds.map((id) => [id, 40]));
  s.stamina = 100;
  return s;
};
async function seed(page, s, ui = {}) {
  await page.evaluate(
    ({ s, ui }) => {
      localStorage.clear();
      if (s)
        localStorage.setItem("ikusei-prototype-save-v9", JSON.stringify(s));
      localStorage.setItem(
        "ikusei-ui-v1",
        JSON.stringify({ helpSeen: true, speed: 0, ...ui }),
      );
    },
    { s, ui },
  );
  await page.reload();
  if (s)
    await page.getByRole("button", { name: "続きから", exact: true }).click();
}
async function nav(page, label) {
  await page
    .getByRole("navigation")
    .getByRole("button", { name: label, exact: true })
    .click();
}
async function acceptDialog(page) {
  await page
    .getByRole("dialog")
    .last()
    .getByRole("button", { name: "この内容で実行", exact: true })
    .click();
}
async function closeDialogs(page) {
  for (let i = 0; i < 8 && (await page.locator("dialog[open]").count()); i++) {
    const d = page.locator("dialog[open]").last();
    const close = d.getByRole("button", { name: "閉じる", exact: true });
    await close.click();
  }
}
async function check(page, name, tag) {
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
  const issues = await page.evaluate(() => {
    const issues = [];
    if (
      document.documentElement.scrollWidth > innerWidth + 1 ||
      document.documentElement.scrollHeight > innerHeight + 1
    )
      issues.push("document overflow");
    const root =
      [...document.querySelectorAll("dialog[open]")].at(-1) ?? document;
    for (const e of root.querySelectorAll("button,input,select")) {
      const target = e.matches('input[type="checkbox"]')
        ? (e.closest("label") ?? e)
        : e;
      const r = target.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.width < 43 || r.height < 43)
        issues.push("small target " + e.textContent?.trim());
      if (e.scrollWidth > e.clientWidth + 3)
        issues.push("text overflow " + e.textContent?.trim());
    }
    for (const e of root.querySelectorAll("p,small,button")) {
      const target = e.matches('input[type="checkbox"]')
        ? (e.closest("label") ?? e)
        : e;
      const r = target.getBoundingClientRect();
      if (r.width && r.height && parseFloat(getComputedStyle(e).fontSize) < 12)
        issues.push("small font " + e.textContent?.slice(0, 40));
    }
    return issues;
  });
  const root = (await page.locator("dialog[open]").count())
    ? page.locator("dialog[open]").last()
    : page.locator("body");
  const buttons = root.locator("button:visible:enabled");
  for (let i = 0; i < (await buttons.count()); i++) {
    const b = buttons.nth(i);
    try {
      await b.scrollIntoViewIfNeeded({ timeout: 2500 });
      await b.click({ trial: true, timeout: 2500 });
    } catch (e) {
      issues.push("unreachable " + (await b.innerText()).trim());
    }
  }
  await page
    .locator(".content")
    .evaluateAll((es) => es.forEach((e) => (e.scrollTop = 0)));
  await page
    .locator(".dialog-body")
    .evaluateAll((es) => es.forEach((e) => (e.scrollTop = 0)));
  await page.screenshot({ path: resolve(out, `${tag}-${name}.png`) });
  checks.push(`${tag}/${name}`);
  if (issues.length)
    failures.push({ screen: `${tag}/${name}`, issues: [...new Set(issues)] });
}
for (const engine of engines) {
  const browser = await pw[engine].launch();
  for (const [width, height] of sizes.filter(
    ([w]) =>
      !process.env.IKUSEI_WIDTHS ||
      process.env.IKUSEI_WIDTHS.split(",").includes(String(w)),
  )) {
    const tag = `${engine}-${width}x${height}`;
    const page = await browser.newPage({
      viewport: { width, height },
      reducedMotion: "reduce",
    });
    page.on("pageerror", (e) => errors.push(`${tag}: ${e.message}`));
    await page.goto(url);
    let state;
    if (!process.env.IKUSEI_EXTRA_ONLY) {
      await seed(page, null);
      await check(page, "title", tag);
      await page.getByRole("button", { name: "設定", exact: true }).click();
      await check(page, "settings", tag);
      await closeDialogs(page);
      await page
        .getByRole("button", { name: "はじめから", exact: true })
        .click();
      await check(page, "help", tag);
      await page
        .getByRole("button", { name: "帳面を開く", exact: true })
        .click();
      await check(page, "home", tag);
      await nav(page, "薬の依頼書");
      await check(page, "normal-shortage", tag);
      await page
        .getByRole("button", { name: "納品に選ぶ", exact: true })
        .click();
      await page.getByRole("button", { name: "不足分を準備する" }).click();
      await check(page, "brew-shortage", tag);
      assert.equal(
        await page.evaluate(
          () =>
            JSON.parse(localStorage.getItem("ikusei-ui-v1")).selection.ordinary
              .length,
        ),
        1,
      );
      await page.getByRole("button", { name: "商会で仕入れ" }).first().click();
      await page
        .getByRole("button", { name: "準備メモの不足分を追加" })
        .click();
      assert.deepEqual(
        await page.evaluate(() =>
          Object.fromEntries(
            Object.entries(
              JSON.parse(localStorage.getItem("ikusei-ui-v1")).basket,
            ).filter(([, n]) => n > 0),
          ),
        ),
        { rose: 4, wormwood: 2 },
      );
      await check(page, "supply-shortage", tag);
      await page.getByRole("button", { name: "調合の準備に戻る" }).click();
      await page.getByRole("button", { name: "依頼書に戻る" }).click();
      assert.equal(
        await page.getByRole("button", { name: "選択中", exact: true }).count(),
        1,
      );
      await page.reload();
      await page.getByRole("button", { name: "続きから", exact: true }).click();
      await nav(page, "薬の依頼書");
      assert.equal(
        await page.getByRole("button", { name: "選択中", exact: true }).count(),
        1,
      );
      await seed(page, rich());
      await nav(page, "調合");
      await page.getByRole("button", { name: /薬湯.*所持/ }).click();
      await page
        .getByRole("spinbutton", { name: "数量", exact: true })
        .fill("2");
      await page
        .getByRole("button", { name: "調合を確認", exact: true })
        .click();
      await check(page, "bulk-confirm", tag);
      await acceptDialog(page);
      state = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("ikusei-prototype-save-v9")),
      );
      assert.equal(state.stock.tisane, 14);
      assert.equal(state.stamina, 68);
      assert.equal(state.day, 1);
      await closeDialogs(page);
      await page.getByRole("button", { name: "所持薬", exact: true }).click();
      await check(page, "inventory", tag);
      await page.getByRole("button", { name: "素材", exact: true }).click();
      await check(page, "materials", tag);
      await seed(page, { ...rich(), day: 2 });
      await nav(page, "薬の依頼書");
      await page.getByRole("button", { name: "特別依頼", exact: true }).click();
      await check(page, "special-offer", tag);
      await page.getByRole("button", { name: "条件を確認して受諾" }).click();
      await check(page, "special-confirm", tag);
      await acceptDialog(page);
      await check(page, "conversation", tag);
      await closeDialogs(page);
      state = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("ikusei-prototype-save-v9")),
      );
      assert.equal(state.money, 4160);
      assert.equal(state.obligations.length, 1);
      state.day = 8;
      state.stock.tisane = 12;
      await seed(page, state);
      await nav(page, "薬の依頼書");
      await page
        .locator(".order-card")
        .filter({
          has: page.getByRole("heading", { name: "薬湯", exact: true }),
        })
        .getByRole("button", { name: "納品に選ぶ", exact: true })
        .click();
      await page.getByRole("button", { name: /まとめ納品 \(/ }).click();
      await page
        .getByRole("button", { name: "納品に選ぶ", exact: true })
        .click();
      await check(page, "mixed-batch", tag);
      await page.getByRole("button", { name: "出発内容を確認" }).click();
      await check(page, "batch-confirm", tag);
      await acceptDialog(page);
      await check(page, "batch-result", tag);
      await closeDialogs(page);
      state = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("ikusei-prototype-save-v9")),
      );
      assert.equal(state.day, 9);
      assert.equal(state.stock.tisane, 8);
      assert.equal(state.obligations[0].status, "fulfilled");
      assert.ok(state.unlockedPeople.includes("herbalist"));
      assert.deepEqual(
        JSON.parse(
          await page.evaluate(() => localStorage.getItem("ikusei-ui-v1")),
        ).selection,
        { ordinary: [], promises: [] },
      );
      await nav(page, "地図");
      await check(page, "world-list", tag);
      await page.getByRole("button", { name: "地図表示", exact: true }).click();
      await check(page, "world-map", tag);
      await page.getByRole("button", { name: "学院", exact: true }).click();
      await check(page, "people", tag);
      await page.getByRole("button", { name: "クレール", exact: true }).click();
      await check(page, "personal-jobs", tag);
      await nav(page, "約束帳");
      await page.getByRole("button", { name: "すべて", exact: true }).click();
      await check(page, "journal", tag);
      await page.getByRole("button", { name: "14日予定表" }).click();
      await check(page, "calendar", tag);
      let b = performAction(
        { ...rich(), day: 9 },
        { type: "accept", offer: "special-b" },
      ).state;
      b.chapter = 2;
      b.day = 1;
      b = performAction(b, {
        type: "deliver",
        ordinary: [],
        promises: [
          {
            id: b.obligations[0].id,
            option: b.obligations[0].terms.options[0].id,
          },
        ],
      }).state;
      await seed(page, b);
      await check(page, "special-event", tag);
      await page.reload();
      await page.getByRole("button", { name: "続きから", exact: true }).click();
      assert.equal(await page.getByRole("dialog").count(), 1);
      await closeDialogs(page);
      state = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("ikusei-prototype-save-v9")),
      );
      assert.equal(state.playedEvents.length, 1);
      await nav(page, "地図");
      await page
        .getByRole("button", { name: "行き先一覧", exact: true })
        .click();
      await page.getByRole("button", { name: /紹介された薬草園/ }).click();
      await check(page, "gather", tag);
      await page.getByRole("button", { name: "採集内容を確認" }).click();
      await check(page, "gather-confirm", tag);
      await closeDialogs(page);
      let c = performAction(
        rich(),
        { type: "accept", offer: "supply-credit" },
        legacyOffers,
      ).state;
      c.day = 14;
      c.awaitingSettlement = true;
      c.money = 1300;
      await seed(page, c);
      await check(page, "settlement", tag);
      await page.getByRole("button", { name: "約束への支払いを確認" }).click();
      await page
        .getByRole("button", { name: "返還・支払待ち", exact: true })
        .click();
      await check(page, "payment-journal", tag);
      await page
        .getByRole("button", { name: "未精算額を支払う", exact: true })
        .click();
      await check(page, "payment-confirm", tag);
      await acceptDialog(page);
      await closeDialogs(page);
      await page.getByRole("button", { name: "章末の精算に戻る" }).click();
      await page
        .getByRole("button", { name: "返済内容を確認して確定" })
        .click();
      await acceptDialog(page);
      await closeDialogs(page);
      state = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("ikusei-prototype-save-v9")),
      );
      assert.equal(state.chapter, 2);
      await seed(page, { ...rich(), chapter: 6, day: 14, ended: true });
      await check(page, "ending", tag);
      await seed(page, {
        ...rich(),
        money: 0,
        stamina: 0,
        day: 14,
        awaitingSettlement: true,
      });
      await check(page, "settlement-short", tag);
    }

    if (width === 390 || width === 1440) {
      await seed(page, structuredClone(G.initialState));
      await nav(page, "薬の依頼書");
      await page.locator(".filters select").first().selectOption("ready");
      await check(page, "empty-orders", tag);
      await seed(page, { ...rich(), stamina: 0 });
      await nav(page, "薬の依頼書");
      await check(page, "stamina-shortage", tag);
      assert.ok(
        (await page.getByText("体力不足", { exact: true }).count()) > 0,
      );
      await seed(page, rich());
      await nav(page, "薬の依頼書");
      await page
        .locator(".order-card")
        .filter({
          has: page.getByRole("heading", { name: "薬湯", exact: true }),
        })
        .getByRole("button", { name: "納品に選ぶ", exact: true })
        .click();
      await page.getByRole("button", { name: "出発内容を確認" }).click();
      for (let i = 0; i < 12; i++) {
        await page.keyboard.press("Tab");
        assert.ok(
          await page.evaluate(
            () => !!document.activeElement.closest("dialog[open]"),
          ),
        );
      }
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("dialog[open]").count(), 0);
      assert.equal(
        await page.evaluate(() => document.activeElement.textContent),
        "出発内容を確認",
      );
      await page.getByRole("button", { name: "出発内容を確認" }).click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "この内容で実行" })
        .evaluate((b) => {
          b.click();
          b.click();
        });
      await closeDialogs(page);
      state = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("ikusei-prototype-save-v9")),
      );
      assert.equal(state.day, 2);
      assert.equal(state.stock.tisane, 10);
      let multi = performAction(
        rich(),
        { type: "accept", offer: "reservation" },
        legacyOffers,
      ).state;
      multi.day = 2;
      multi = performAction(multi, {
        type: "accept",
        offer: "special-a",
      }).state;
      multi.day = 8;
      await seed(page, multi);
      await nav(page, "約束帳");
      await page.getByRole("button", { name: "本日", exact: true }).click();
      await check(page, "multiple-promises", tag);
      await seed(page, rich());
      await nav(page, "地図");
      await page
        .getByRole("button", { name: "行き先一覧", exact: true })
        .click();
      await page.getByRole("button", { name: /王立学院/ }).click();
      await page.getByRole("button", { name: "クレール", exact: true }).click();
      await page
        .locator(".nested")
        .filter({
          has: page.getByRole("heading", {
            name: "学院文書の筆耕",
            exact: true,
          }),
        })
        .getByRole("button", { name: "条件を確認して実行" })
        .click();
      await check(page, "personal-confirm", tag);
      await acceptDialog(page);
      await closeDialogs(page);
      state = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("ikusei-prototype-save-v9")),
      );
      assert.ok(
        Object.keys(state.personalRuns).some((k) => k.includes("copyist")),
      );
      await page
        .locator(".hud")
        .getByRole("button", { name: "設定", exact: true })
        .click();
      await page.getByText("セーブデータの管理", { exact: true }).click();
      await page
        .getByRole("button", { name: "セーブを初期化", exact: true })
        .click();
      await check(page, "reset-confirm", tag);
      await page
        .getByRole("dialog")
        .last()
        .getByRole("button", { name: "戻る", exact: true })
        .click();
      assert.ok(
        await page.evaluate(
          () => !!localStorage.getItem("ikusei-prototype-save-v9"),
        ),
      );
      await closeDialogs(page);
      const long = rich();
      long.log = Array.from(
        { length: 8 },
        (_, i) =>
          "記録" + i + "：" + "長い記録も内側で折り返して読めます。".repeat(12),
      );
      await seed(page, long);
      await page.getByText(/最近の記録・残債/).click();
      await check(page, "long-history", tag);
      await page.setViewportSize({ width: 844, height: 390 });
      await check(page, "rotated-landscape", tag);
      await page.setViewportSize({ width, height });
      await page.evaluate(() => {
        window.originalSave = Storage.prototype.setItem;
        Storage.prototype.setItem = function () {
          throw new DOMException("quota", "QuotaExceededError");
        };
      });
      await page.getByRole("button", { name: "休養", exact: true }).click();
      await acceptDialog(page);
      await closeDialogs(page);
      await check(page, "save-error", tag);
      assert.ok((await page.getByRole("alert").count()) > 0);
      await page.evaluate(() => {
        Storage.prototype.setItem = window.originalSave;
      });
      await page.getByRole("button", { name: "保存を再試行" }).click();
      assert.equal(await page.getByRole("alert").count(), 0);
    }
    await page.close();
    console.log("PASS browser flow", tag);
  }
  await browser.close();
}
writeFileSync(
  resolve(out, "report.json"),
  JSON.stringify({ screens: checks.length, checks, failures, errors }, null, 2),
);
console.log(
  JSON.stringify({ screens: checks.length, failures, errors }, null, 2),
);
assert.deepEqual(errors, []);
assert.deepEqual(failures, []);
