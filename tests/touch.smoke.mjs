import { resolve } from "node:path";
import { mkdirSync } from "node:fs";
mkdirSync(resolve("../redesign-validation"), { recursive: true });
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(resolve("package.json"));
const { chromium } = require("playwright");
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 2,
  reducedMotion: "reduce",
});
await page.goto(
  process.env.IKUSEI_TOUCH_URL ?? "http://127.0.0.1:5173/IKUSEI/",
);
await page.getByRole("button", { name: "はじめから", exact: true }).tap();
await page.getByRole("button", { name: "帳面を開く", exact: true }).tap();
const nav = (label) =>
  page
    .getByRole("navigation")
    .getByRole("button", { name: label, exact: true })
    .tap();
const commit = () =>
  page
    .getByRole("dialog")
    .getByRole("button", { name: "この内容で実行", exact: true })
    .tap();
async function close() {
  for (let i = 0; i < 8 && (await page.locator("dialog[open]").count()); i++)
    await page
      .locator("dialog[open]")
      .last()
      .getByRole("button", { name: "閉じる", exact: true })
      .tap();
}
await nav("薬の依頼書");
await page.getByRole("button", { name: "納品に選ぶ", exact: true }).tap();
await page.getByRole("button", { name: "不足分を準備する" }).tap();
await page.getByRole("button", { name: "商会で仕入れ" }).first().tap();
await page.getByRole("button", { name: "準備メモの不足分を追加" }).tap();
await page.getByRole("button", { name: "購入内容を確認" }).tap();
await commit();
await close();
await page.getByRole("button", { name: "調合の準備に戻る" }).tap();
await page.getByRole("button", { name: "調合を確認", exact: true }).tap();
await commit();
await close();
await page.getByRole("button", { name: "依頼書に戻る" }).tap();
await page.getByRole("button", { name: "出発内容を確認" }).tap();
await commit();
await close();
const s = await page.evaluate(() =>
  JSON.parse(localStorage.getItem("ikusei-prototype-save-v9")),
);
assert.equal(s.day, 3);
assert.equal(s.money, 374);
assert.equal(s.stock.tisane, 0);
assert.equal(s.stamina, 38);
await nav("自室");
await page.screenshot({
  path: resolve("../redesign-validation/touch-portrait.png"),
});
await page.setViewportSize({ width: 844, height: 390 });
await nav("地図");
await page.screenshot({
  path: resolve("../redesign-validation/touch-landscape.png"),
});
console.log(
  "PASS touch emulation: new game → source → purchase → bulk brew → delivery; day 3 / 374G / stamina 38; portrait/landscape",
);
await browser.close();
