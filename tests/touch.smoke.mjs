import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch(
  process.env.IKUSEI_CHROMIUM ? { executablePath: process.env.IKUSEI_CHROMIUM } : {},
);
try {
  const p = await browser.newPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: "reduce",
  });
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(process.env.IKUSEI_TOUCH_URL ?? "http://127.0.0.1:5174/IKUSEI/");
  const tap = (name) => p.getByRole("button", { name, exact: true }).tap(),
    confirm = (name) =>
      p
        .locator("dialog[open]")
        .last()
        .getByRole("button", { name, exact: true })
        .tap();
  await tap("はじめから");
  await tap("依頼");
  await p
    .locator(".work-choice")
    .filter({ hasText: "学院へ薬湯を届ける" })
    .tap();
  await tap("素材を集める");
  await p
    .locator(".gather-card")
    .filter({ hasText: "修道院の丘" })
    .getByRole("button", { name: "採集する", exact: true })
    .tap();
  await confirm("採集する");
  await tap("調合へ");
  await p.locator(".brew-sheet .action-dock .primary").tap();
  await confirm("調合する");
  await tap("依頼へ戻る");
  await p.locator(".work-detail .action-dock .primary").tap();
  await confirm("納品する");
  for (let i = 0; i < 30 && (await p.locator("dialog[open]").count()); i++) {
    if (await p.locator(".scenario-dialog").count())
      await p
        .locator(".scenario-tap-target")
        .tap({ position: { x: 30, y: 100 } });
    else await confirm("確認");
  }
  let s = await p.evaluate(() =>
    JSON.parse(localStorage.getItem("ikusei-prototype-save-v11")),
  );
  assert.equal(s.day, 1);
  assert.equal(s.money, 450);
  assert.equal(s.stamina, 34);
  await tap("詳細から戻る");
  await p
    .getByRole("button", { name: "自室へ", exact: true })
    .filter({ visible: true })
    .first()
    .tap();
  await tap("一日を終える");
  await confirm("一日を終える");
  await confirm("確認");
  s = await p.evaluate(() =>
    JSON.parse(localStorage.getItem("ikusei-prototype-save-v11")),
  );
  assert.equal(s.day, 2);
  assert.equal(s.stamina, 100);
  await p.setViewportSize({ width: 844, height: 390 });
  assert.equal(
    await p.locator(".commands:not(.compact-commands) button").count(),
    3,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS touch: request → gather → brew → deliver on day 1; end day → day 2 / stamina 100",
  );
} finally {
  await browser.close();
}
