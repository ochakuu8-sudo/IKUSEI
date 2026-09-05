import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: "reduce",
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    process.env.IKUSEI_TOUCH_URL ?? "http://127.0.0.1:5173/IKUSEI/",
  );
  const tap = (name) => page.getByRole("button", { name, exact: true }).tap();
  const closeResults = async () => {
    while (await page.locator("dialog[open]").count())
      await page
        .locator("dialog[open]")
        .last()
        .getByRole("button", { name: "閉じる", exact: true })
        .tap();
  };
  await tap("はじめから");
  await tap("薬の依頼を見る");
  await tap("この薬を準備する");
  await page.getByRole("button", { name: /商会で仕入れ/ }).tap();
  await tap("購入内容を確認");
  await tap("購入する・1日");
  await closeResults();
  await tap("調合の準備に戻る");
  await tap("薬湯を2個調合する");
  await tap("納品を確認する");
  await tap("納品へ");
  await tap("納品内容を確認");
  await tap("納品する・1日");
  await closeResults();
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("ikusei-prototype-save-v9")),
  );
  assert.equal(state.day, 3);
  assert.equal(state.money, 374);
  assert.equal(state.stamina, 38);
  assert.equal(state.stock.tisane, 0);
  await page
    .getByRole("button", { name: "自室へ", exact: true })
    .filter({ visible: true })
    .first()
    .tap();
  await page.setViewportSize({ width: 844, height: 390 });
  assert.equal(
    await page
      .getByRole("navigation", { name: "今日の行動", exact: true })
      .getByRole("button")
      .count(),
    4,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS touch: four home commands → purchase → brew → deliver, day 3 / 374G / stamina 38; portrait and landscape",
  );
} finally {
  await browser.close();
}
