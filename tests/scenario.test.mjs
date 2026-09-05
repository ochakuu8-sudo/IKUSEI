import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const browser = await chromium.launch();
const output = resolve("../scenario-validation");
mkdirSync(output, { recursive: true });
const saveKey = "ikusei-prototype-save-v9";
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    reducedMotion: "reduce",
    hasTouch: true,
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const button = (name) => page.getByRole("button", { name, exact: true });
  await page.goto(
    process.env.IKUSEI_TEST_URL ?? "http://127.0.0.1:5173/IKUSEI/",
  );
  await button("はじめから").click();
  await button("出かける").click();
  assert.equal(
    await page
      .locator(".destination")
      .filter({ hasText: "ラティエ邸" })
      .count(),
    0,
  );
  await button("地図表示").click();
  assert.equal(
    await page.locator(".map-pin").filter({ hasText: "屋敷" }).count(),
    0,
  );
  await page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key));
    state.eventQueue = [
      {
        id: "garden-introduction",
        title: "薬草園への紹介",
        place: "garden",
        lines: [
          "約束した日に薬を届けた。",
          "礼として、薬草園へ入るための紹介状を受け取った。".repeat(8),
          "これからは地図から薬草園を訪れ、新しい素材を採集できる。",
        ],
      },
    ];
    localStorage.setItem(key, JSON.stringify(state));
    const ui = JSON.parse(localStorage.getItem("ikusei-ui-v1"));
    ui.speed = 80;
    localStorage.setItem("ikusei-ui-v1", JSON.stringify(ui));
  }, saveKey);
  await page.reload();
  await button("続きから").click();
  await page.locator(".scenario-dialog").waitFor();
  const before = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)),
    saveKey,
  );
  for (const [width, height] of [
    [1280, 720],
    [390, 844],
    [667, 375],
    [800, 360],
    [844, 390],
    [932, 430],
  ]) {
    await page.setViewportSize({ width, height });
    const issues = await page.evaluate(() => {
      const failures = [];
      for (const selector of [".scenario-dialog", ".scenario-art"]) {
        const r = document.querySelector(selector).getBoundingClientRect();
        if (
          Math.abs(r.x) > 1 ||
          Math.abs(r.y) > 1 ||
          Math.abs(r.width - innerWidth) > 1 ||
          Math.abs(r.height - innerHeight) > 1
        )
          failures.push(selector + " is not fullscreen");
      }
      for (const selector of [
        ".scenario-message",
        ".scenario-text",
        ".scenario-controls button",
      ]) {
        for (const el of document.querySelectorAll(selector)) {
          const r = el.getBoundingClientRect();
          if (
            r.x < 0 ||
            r.y < 0 ||
            r.right > innerWidth + 1 ||
            r.bottom > innerHeight + 1
          )
            failures.push(selector + " outside viewport");
          if (
            el.tagName === "BUTTON" &&
            (r.height < 44 ||
              !el.contains(
                document.elementFromPoint(
                  r.x + r.width / 2,
                  r.y + r.height / 2,
                ),
              ))
          )
            failures.push(selector + " not tappable");
        }
      }
      return failures;
    });
    assert.deepEqual(issues, [], `${width}x${height}`);
    await page.screenshot({ path: resolve(output, `scenario-${width}.png`) });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await button("セリフを隠す").tap();
  assert.equal(await page.locator(".scenario-message").count(), 0);
  await page.keyboard.press("Escape");
  assert(await page.locator(".scenario-message").isVisible());
  await button("会話ログ").tap();
  assert(await page.locator(".scenario-log").isVisible());
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".scenario-log").count(), 0);
  assert.deepEqual(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)),
      saveKey,
    ),
    before,
  );
  await page.locator(".scenario-text").tap();
  if (await button("次へ").count()) await button("次へ").tap();
  await page.locator(".scenario-text").tap();
  await page.screenshot({ path: resolve(output, "scenario-long-text.png") });
  const forward = page.locator(".scenario-forward");
  assert(await forward.isVisible());
  await page.reload();
  await button("続きから").click();
  await page.locator(".scenario-dialog").waitFor();
  assert.deepEqual(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)),
      saveKey,
    ),
    before,
  );
  for (let i = 0; i < 8 && (await forward.count()); i++) await forward.tap();
  assert.equal(await page.locator(".scenario-dialog").count(), 0);
  const done = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)),
    saveKey,
  );
  assert.equal(done.eventQueue.length, 0);
  assert.deepEqual(done.playedEvents, ["garden-introduction"]);
  assert.equal(done.day, before.day);
  assert.equal(done.money, before.money);
  await page.reload();
  await button("続きから").click();
  assert.equal(await page.locator(".scenario-dialog").count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: no home destination or map pin; fullscreen CG/dialogue at six sizes; touch, log, hide, Escape, long text, unread reload and completion persistence",
  );
} finally {
  await browser.close();
}
