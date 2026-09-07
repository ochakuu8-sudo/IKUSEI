import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  hasTouch: true,
  reducedMotion: "reduce",
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const base = process.env.IKUSEI_TEST_URL ?? "http://127.0.0.1:5174/IKUSEI/";
const out = resolve("../../outputs/implementation-screens");
mkdirSync(out, { recursive: true });
const button = (name) => page.getByRole("button", { name, exact: true });
async function show(options = {}) {
  await page.evaluate((options) => {
    window.novelHarness.show(options);
    return new Promise(requestAnimationFrame);
  }, options);
  await page.locator('.scenario-stage[data-ready="true"]').waitFor();
  await page.evaluate(() => document.fonts.ready);
}
const next = async () => {
  await page
    .locator(".scenario-tap-target")
    .tap({ position: { x: 40, y: 180 } });
  await page.waitForTimeout(120);
};
async function readBounds() {
  return page.locator(".scenario-text").evaluate((e) => {
    const box = e.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(e.querySelector("span"));
    return [...range.getClientRects()].every(
      (r) =>
        r.left >= box.left - 1 &&
        r.right <= box.right + 1 &&
        r.top >= box.top - 1 &&
        r.bottom <= box.bottom + 1,
    );
  });
}
try {
  await page.goto(base + "tests/fixtures/novel.html");
  await page.locator('.scenario-stage[data-ready="true"]').waitFor();
  for (const [width, height] of [
    [1440, 900],
    [1920, 1080],
    [851, 337],
    [800, 304],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await show({
      lines: [
        {
          speaker: "エレオノール",
          text: "「約束の額は受け取りました。\nそれでは、失礼いたします」",
        },
      ],
    });
    const geometry = await page.evaluate(() => {
      const d = document
          .querySelector(".scenario-dialog")
          .getBoundingClientRect(),
        m = document.querySelector(".scenario-message").getBoundingClientRect();
      const controls = [
        ...document.querySelectorAll(".scenario-controls button"),
      ].map((e) => e.getBoundingClientRect());
      return {
        ratio: d.width / d.height,
        caption: m.height / (d.height / 500),
        font: getComputedStyle(document.querySelector(".scenario-text"))
          .fontSize,
        inside: controls.every(
          (r) =>
            r.left >= m.right &&
            r.right <= d.right &&
            r.top >= d.top &&
            r.bottom <= d.bottom,
        ),
        target: controls[0].height,
      };
    });
    assert(Math.abs(geometry.ratio - 2.4) < 0.001);
    assert(geometry.caption <= 105);
    assert.equal(geometry.font, "24px");
    assert(geometry.inside);
    assert(await readBounds());
    if (width === 800) assert(geometry.target >= 44);
    if (width === 1440 || width === 800)
      await page.locator(".scenario-dialog").screenshot({
        path: resolve(
          out,
          width === 1440 ? "novel-desktop.png" : "novel-mobile.png",
        ),
      });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  const text =
    "「庭で摘んだ薬草を、銀の皿に並べていく。窓から差す光はやわらかく、ここでなら名前を呼ばれずに済む気がした。けれど、扉の向こうには依頼人が待っている。約束した分だけ働き、屋敷へ帰ろう。」";
  await show({ textSize: 28, lines: [{ speaker: "エレオノール", text }] });
  const portions = [];
  for (
    let i = 0;
    i < 20 && (await page.locator(".scenario-dialog").count());
    i++
  ) {
    assert(await readBounds(), "大きな文字と長文でも枠内");
    const part = await page
      .locator(".scenario-text")
      .getAttribute("aria-label");
    assert(part.split("\n").length <= 2);
    portions.push(part);
    await next();
  }
  assert(portions.length > 1);
  assert.equal(portions.join("").replace(/\n/g, ""), text);
  assert.equal(await page.evaluate(() => novelHarness.done), 1);
  /* 文字送りはログ・メニュー・絵だけ表示の間止まる。 */
  await show({
    speed: 50,
    lines: [{ speaker: "エレオノール", text }, { text: "次の発話" }],
  });
  await page.waitForTimeout(130);
  await button("シナリオメニュー").click();
  const partial = await page.locator(".scenario-text span").textContent();
  await page.waitForTimeout(220);
  assert.equal(
    await page.locator(".scenario-text span").textContent(),
    partial,
  );
  await button("会話ログ").click();
  assert(
    !(await page.locator(".scenario-log").innerText()).includes("次の発話"),
  );
  await button("本文に戻る").click();
  await page.waitForTimeout(180);
  await button("セリフを隠す").click();
  const beforeHide = await page.locator(".scenario-text span").textContent();
  await page.waitForTimeout(150);
  assert.equal(
    await page.locator(".scenario-text span").textContent(),
    beforeHide,
  );
  assert(await page.locator(".scenario-shade").isHidden());
  await page.locator(".scenario-tap-target").evaluate((e) => {
    e.click();
    e.click();
  });
  assert.equal(
    await page.locator(".scenario-text").getAttribute("data-line"),
    "0",
  );
  assert.equal(
    await page.locator(".scenario-text").getAttribute("data-page"),
    "0",
  );
  await page.waitForTimeout(180);
  await page.keyboard.press("Escape");
  await button("読書設定").click();
  await page.getByLabel("文字の大きさ", { exact: true }).selectOption("22");
  await page.getByLabel("字幕の地を濃くする", { exact: true }).check();
  await page.getByLabel("文字送り", { exact: true }).selectOption("0");
  await button("本文に戻る").click();
  assert.equal(
    await page
      .locator(".scenario-text")
      .evaluate((e) => getComputedStyle(e).fontSize),
    "22px",
  );
  assert.equal(await page.locator(".scenario-strong").count(), 1);
  await page.waitForTimeout(180);
  await page.locator(".scenario-tap-target").focus();
  await page.keyboard.press("Space");
  assert.equal(
    await page.locator(".scenario-text").getAttribute("data-page"),
    "1",
    "キーボードでページ送り",
  );
  await page.keyboard.press("Escape");
  await button("この場面をとばす").evaluate((e) => {
    e.click();
    e.click();
  });
  assert.equal(
    await page.evaluate(() => novelHarness.done),
    1,
    "スキップは一度だけ",
  );
  /* 長押し・上スワイプでメニューを開き、元のページを保つ。 */
  await show({ lines: [{ text: "最初のページ" }, { text: "次のページ" }] });
  const target = await page.locator(".scenario-tap-target").boundingBox();
  await page.mouse.move(target.x + 50, target.y + 200);
  await page.mouse.down();
  await page.waitForTimeout(500);
  await page.mouse.up();
  assert(await page.locator(".scenario-menu").isVisible());
  await button("本文に戻る").click();
  await page.waitForTimeout(180);
  await page.mouse.move(target.x + 50, target.y + 220);
  await page.mouse.down();
  await page.mouse.move(target.x + 50, target.y + 150, { steps: 5 });
  await page.mouse.up();
  assert(await page.locator(".scenario-menu").isVisible());
  assert.equal(
    await page.locator(".scenario-text").getAttribute("data-line"),
    "0",
  );
  await button("読書設定").click();
  assert(
    await page
      .locator(".scenario-settings")
      .evaluate((e) => e.scrollHeight <= e.clientHeight),
  );
  await page
    .locator(".scenario-dialog")
    .screenshot({ path: resolve(out, "novel-settings.png") });
  /* 一枚絵は人物を重ねず全体を表示。通常と回想、場面境界を同じ解決器に通す。 */
  await page.evaluate(() => {
    novelHarness.sceneArtwork["qa:job"] = {
      image: "backgrounds/valere.webp",
      subtitle: "top",
    };
    novelHarness.sceneArtwork["qa:bond"] = {
      background: "guild",
      anchor: "left",
    };
    novelHarness.sceneArtwork["qa:detail"] = {
      image: "backgrounds/valere.webp",
      fit: "cover",
      focus: "60% 40%",
    };
  });
  await show({
    sceneId: "qa:job",
    lines: [
      { sceneId: "qa:job", text: "一枚絵の場面" },
      { text: "同じ絵が続く" },
      { visual: "qa:detail", text: "絵の細部へ" },
      { sceneId: "qa:bond", text: "関係の場面" },
    ],
  });
  assert.equal(await page.locator(".scenario-portrait").count(), 0);
  const cg = await page.locator(".scenario-cg").getAttribute("src");
  assert.equal(
    await page
      .locator(".scenario-cg")
      .evaluate((e) => getComputedStyle(e).objectFit),
    "contain",
  );
  assert.equal(
    await page.locator(".scenario-stage").getAttribute("data-subtitle"),
    "top",
  );
  await next();
  assert.equal(await page.locator(".scenario-cg").getAttribute("src"), cg);
  await next();
  await page.locator('.scenario-stage[data-ready="true"]').waitFor();
  assert.equal(
    await page.locator(".scenario-cg").evaluate((e) => e.style.objectFit),
    "cover",
  );
  assert.equal(
    await page.locator(".scenario-cg").evaluate((e) => e.style.objectPosition),
    "60% 40%",
  );
  await page
    .locator(".scenario-dialog")
    .screenshot({ path: resolve(out, "novel-cg-fixture.png") });
  await next();
  await page.locator(".scenario-anchor-left").waitFor();
  assert.equal(await page.locator(".scenario-cg").count(), 0);
  assert(
    (await page.locator(".scenario-background").getAttribute("src")).includes(
      "guild.webp",
    ),
  );
  await show({ sceneId: "qa:job" });
  assert.equal(await page.locator(".scenario-cg").getAttribute("src"), cg);
  await page.route("**/missing-scene.webp", (r) =>
    r.fulfill({ status: 404, body: "" }),
  );
  await show({ image: base + "missing-scene.webp" });
  assert.equal(await page.locator(".scenario-cg").count(), 0);
  assert.equal(await page.locator(".scenario-portrait").count(), 1);
  /* 現在の全45場面を実フォントで送る。 */
  const catalog = await page.evaluate(() =>
    novelHarness.catalog.filter((s) => s.lines.length),
  );
  for (const entry of catalog) {
    await show({
      title: entry.title,
      lines: entry.lines,
      sceneId: entry.id,
      place: entry.place,
    });
    for (
      let i = 0;
      i < 30 && (await page.locator(".scenario-dialog").count());
      i++
    ) {
      assert(await readBounds(), entry.id);
      await next();
    }
    assert.equal(
      await page.evaluate(() => novelHarness.done),
      1,
      entry.id + "を最後まで送れる",
    );
  }
  /* 実アプリでも読書設定を保存し、スキップで1日だけ進める。 */
  await page.goto(base);
  await button("はじめから").click();
  await page.locator(".c-request-card .c-slip-face").first().click();
  await button("この依頼を受ける").click();
  await page.locator('.scenario-stage[data-ready="true"]').waitFor();
  const saved = await page.evaluate(() =>
    localStorage.getItem("ikusei-prototype-save-v14"),
  );
  await button("シナリオメニュー").click();
  await button("読書設定").click();
  await page.getByLabel("文字の大きさ", { exact: true }).selectOption("22");
  await page.getByLabel("字幕の地を濃くする", { exact: true }).check();
  await button("本文に戻る").click();
  await page.waitForTimeout(180);
  await page.keyboard.press("Escape");
  await button("この場面をとばす").click();
  assert.equal(
    await page.evaluate(() =>
      localStorage.getItem("ikusei-prototype-save-v14"),
    ),
    saved,
  );
  await button("確認").click();
  await page.waitForFunction(() => {
    const state = JSON.parse(localStorage.getItem("ikusei-prototype-save-v14"));
    const cards = [...document.querySelectorAll(".c-request-card")];
    return cards.length > 0 && cards.every((card) => state.seen.includes(card.dataset.job));
  });
  const afterResult = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("ikusei-prototype-save-v14")),
  );
  assert.deepEqual(
    { ...afterResult, seen: JSON.parse(saved).seen },
    JSON.parse(saved),
    "結果を閉じる操作は新たに見えた依頼の記録だけを更新する",
  );
  await page.reload();
  await button("続きから").click();
  await button("設定").click();
  assert.equal(
    await page.getByLabel("ノベルの文字サイズ", { exact: true }).inputValue(),
    "22",
  );
  assert(
    await page.getByLabel("字幕の地を濃くする", { exact: true }).isChecked(),
  );
  assert.deepEqual(errors, []);
  console.log(
    `PASS novel UI: 24px/薄い字幕、5サイズ、長文、文字送り・ログ・非表示・キー操作、CG/失敗/場面境界、全${catalog.length}場面、設定保存、スキップの一回性`,
  );
} finally {
  await browser.close();
}
