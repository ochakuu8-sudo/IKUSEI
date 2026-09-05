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
  const result = () =>
    page
      .locator("dialog[open]")
      .getByRole("button", { name: "確認", exact: true })
      .tap();
  await tap("はじめから");
  await tap("仕事をする");
  await page
    .locator(".work-choice")
    .filter({ hasText: "学院へ薬湯を届ける" })
    .tap();
  await page
    .locator(".prep-source button")
    .filter({ hasText: "商会で不足分を買う" })
    .tap();
  await tap("購入する・1日");
  await result();
  assert(await page.locator(".work-detail").isVisible());
  await page
    .locator(".inline-preparation > button")
    .filter({ hasText: "薬湯を2個調合する・0日" })
    .tap();
  await tap("調合する・0日");
  await page.locator(".work-detail .action-dock .primary").tap();
  await tap("納品する・1日");
  await result();
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("ikusei-prototype-save-v9")),
  );
  assert.equal(state.day, 3);
  assert.equal(state.money, 374);
  assert.equal(state.stamina, 38);
  assert.equal(state.stock.tisane, 0);
  for (const [width, height] of [
    [390, 844],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    assert.equal(
      await page.locator(".commands:not(.compact-commands) button").count(),
      3,
    );
    assert(await page.locator(".home-decisions").isVisible());
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS touch: three home commands → inline purchase → brew → deliver → home; day 3 / 374G / stamina 38; portrait and landscape",
  );
} finally {
  await browser.close();
}
