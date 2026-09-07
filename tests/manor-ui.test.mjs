/** 実データ全24件で机と手紙を検査する。ローカルViteを起動して実行。 */
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
const browser = await chromium.launch();
const out = resolve("../../outputs/implementation-screens");
mkdirSync(out, { recursive: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  reducedMotion: "reduce",
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const read = () =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem("ikusei-prototype-save-v14")),
  );
const button = (name) => page.getByRole("button", { name, exact: true });
try {
  await page.goto(
    process.env.IKUSEI_TEST_URL ?? "http://127.0.0.1:5174/IKUSEI/",
  );
  const samples = await page.evaluate(async () => {
    const {
      freshDaily,
      offersOf,
      closingPreview,
      payOf,
      staminaOf,
      takeReason,
    } = await import("/IKUSEI/src/daily.ts");
    const { jobs, capDropOf } = await import("/IKUSEI/src/game.ts");
    const states = [],
      seen = new Set();
    let hasClosing = false;
    for (const level of [100, 70, 40])
      for (let i = 0; i < 500; i++) {
        const s = freshDaily("manor-qa-" + i);
        s.unlocked.push("herbalist");
        s.money = 999999;
        s.relations = Object.fromEntries(
          Object.keys(s.relations).map((k) => [k, 3]),
        );
        s.axes = { 貞操: level, 品位: level, 威厳: level === 40 ? 24 : level };
        s.dignityCap = level === 40 ? 57 : 100;
        s.stamina = level === 40 ? 15 : 100;
        if (i % 2 === 0) s.recent = ["vernet", "vernet", "vernet"];
        const offers = offersOf(s);
        const closes = offers.some((j) => closingPreview(j, s).length > 0);
        if (offers.some((j) => !seen.has(j.id)) || (!hasClosing && closes)) {
          states.push({
            state: s,
            offers: offers.map((j) => ({
              id: j.id,
              title: j.title,
              pay: payOf(j, s),
              stamina: staminaOf(j),
              costs: j.costs,
              cap: capDropOf(j),
              closing: closingPreview(j, s),
              blocked: !!takeReason(j, s),
            })),
          });
          offers.forEach((j) => seen.add(j.id));
          hasClosing ||= closes;
        }
      }
    if (seen.size !== jobs.length)
      throw Error(
        "未検査の依頼あり: " +
          jobs.filter((j) => !seen.has(j.id)).map((j) => j.id),
      );
    if (!hasClosing) throw Error("紹介停止のケースがない");
    return states;
  });
  const checked = new Set();
  for (const [i, { state, offers }] of samples.entries()) {
    await page.evaluate(
      (s) =>
        localStorage.setItem("ikusei-prototype-save-v14", JSON.stringify(s)),
      state,
    );
    await page.reload();
    await button("続きから").click();
    await page.evaluate(() => document.fonts.ready);
    const overflow = await page.evaluate(() => {
      const bad = [];
      for (const card of document.querySelectorAll(".c-request-card")) {
        const b = card.getBoundingClientRect();
        const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          if (!walker.currentNode.textContent.trim()) continue;
          const range = document.createRange();
          range.selectNodeContents(walker.currentNode);
          for (const r of range.getClientRects())
            if (
              r.left < b.left - 1 ||
              r.right > b.right + 1 ||
              r.top < b.top - 1 ||
              r.bottom > b.bottom + 1
            )
              bad.push(walker.currentNode.textContent);
        }
        if (
          card.querySelector(".c-slip-main b").getBoundingClientRect().bottom >
          card.querySelector(".c-slip-terms").getBoundingClientRect().top
        )
          bad.push("題名と条件が重なる");
      }
      return bad;
    });
    assert.deepEqual(overflow, [], `提示${i}の文字がはみ出す`);
    if (i === 0 || i === samples.length - 1)
      await page.screenshot({
        path: resolve(
          out,
          i === 0 ? "manor-desktop.png" : "manor-low-stamina.png",
        ),
      });
    for (const offer of offers) {
      if (checked.has(offer.id) && !offer.closing.length) continue;
      await page.locator(`[data-job="${offer.id}"] .c-slip-face`).click();
      const letter = page.locator(".c-reading-sheet");
      const text = await letter.innerText();
      assert(text.includes(offer.title));
      assert(text.includes(`${offer.pay.toLocaleString()}G`));
      assert(text.includes(`−${offer.stamina}`));
      for (const cost of offer.costs)
        assert(
          text.includes(
            `${state.axes[cost.axis]}→${Math.max(0, state.axes[cost.axis] - cost.amount)}`,
          ),
        );
      if (!offer.costs.length) assert(text.includes("代償なし"));
      if (offer.cap)
        assert(
          text.includes(
            `品位上限 ${state.dignityCap} → ${Math.max(0, state.dignityCap - offer.cap)}（戻らない）`,
          ),
        );
      for (const closed of offer.closing)
        assert(text.includes(closed), "閉じる依頼を受諾前にすべて表示");
      assert.equal(
        await button("この依頼を受ける").isDisabled(),
        offer.blocked,
      );
      const fit = await letter.evaluate((e) => {
        const r = e.getBoundingClientRect(),
          terms = e
            .querySelector(".c-letter-conditions")
            .getBoundingClientRect(),
          foot = e.querySelector(".c-letter-footer").getBoundingClientRect(),
          story = e.querySelector(".c-letter-story").getBoundingClientRect();
        return (
          story.height >= 70 &&
          story.bottom <= terms.top + 1 &&
          terms.bottom <= foot.top + 1 &&
          foot.bottom <= r.bottom + 1
        );
      });
      assert(fit, `${offer.id}の本文・条件・操作の領域が重なる`);
      if (offer.closing.length && offer.cap)
        await page.screenshot({ path: resolve(out, "manor-consequences.png") });
      assert.equal((await read()).day, state.day, "閲覧で日は進まない");
      await button("机に戻す").click();
      checked.add(offer.id);
    }
  }
  assert.equal(checked.size, 24);
  for (const [width, height] of [
    [1440, 900],
    [1920, 1080],
    [851, 337],
    [800, 304],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.locator(".c-request-card .c-slip-face").first().click();
    const inside = await page.evaluate(() => {
      const app = document
        .querySelector(".chapter-app")
        .getBoundingClientRect();
      return [".c-letter-footer", ".c-letter-conditions"].every((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return (
          r.left >= app.left &&
          r.right <= app.right + 1 &&
          r.top >= app.top &&
          r.bottom <= app.bottom + 1
        );
      });
    });
    assert(inside, `${width}×${height}で条件と操作が枠内`);
    await page.keyboard.press("Escape");
    if (width === 800)
      await page.screenshot({ path: resolve(out, "manor-mobile.png") });
  }
  /* 動きを有効にして受諾直後に再読込。演出中にも確定した1日が残る。 */
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.evaluate((s) => {
    localStorage.setItem("ikusei-prototype-save-v14", JSON.stringify(s));
    localStorage.setItem(
      "ikusei-prototype-ui-v14",
      JSON.stringify({ tab: "today", speed: 0, motion: false, volume: 0 }),
    );
  }, samples[0].state);
  await page.reload();
  await button("続きから").click();
  await page.locator(".c-request-card .c-slip-face").first().click();
  await page.keyboard.press("Escape");
  await page.locator(".c-reading-sheet").waitFor({ state: "hidden" });
  assert(
    await page.locator(".c-request-card .c-slip-face").first().evaluate((e) => e === document.activeElement),
    "通常モーションの復帰完了後も選んだ依頼にフォーカスする",
  );
  await page.locator(".c-request-card .c-slip-face").first().click();
  const accepted = await button("この依頼を受ける").evaluate(async (e) => {
    e.click();
    e.click();
    await new Promise(requestAnimationFrame);
    return {
      inert: document.querySelector(".chapter-app").inert,
      ritual: !!document.querySelector(".c-ritual-sign"),
      day: JSON.parse(localStorage.getItem("ikusei-prototype-save-v14")).day,
      displayedDay: document.querySelector(".c-hud button b").textContent,
      displayedMoney: document.querySelector(".c-res-money b").textContent,
      signingInsideLetter: !!document.querySelector(".c-reading-sheet .c-letter-response .c-response-stamp"),
    };
  });
  assert.deepEqual(accepted, {
    inert: true, ritual: true, day: 2, displayedDay: "1日目",
    displayedMoney: `${samples[0].state.money.toLocaleString()}G`, signingInsideLetter: true,
  });
  await page.reload();
  await button("続きから").click();
  assert.equal((await read()).day, 2);
  assert.equal(await page.locator(".c-request-card").count(), 3);
  await button("設定").click();
  assert.equal(
    await page.getByRole("slider", { name: "紙の音量" }).inputValue(),
    "0",
    "消音を保持",
  );
  await button("閉じる").last().click();
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("ikusei-prototype-save-v14"));
    s.awaitingSettlement = true;
    s.day = 14;
    localStorage.setItem("ikusei-prototype-save-v14", JSON.stringify(s));
  });
  await page.reload();
  await button("続きから").click();
  assert(await button("返済を確定する").isVisible());
  await page.reload();
  await button("はじめから").click();
  await button("確定する").click();
  assert.equal((await read()).day, 1);
  assert.deepEqual(
    await page.evaluate(() => {
      const ui = JSON.parse(localStorage.getItem("ikusei-prototype-ui-v14"));
      return { volume: ui.volume, speed: ui.speed, motion: ui.motion };
    }),
    { volume: 0, speed: 0, motion: false },
    "新規開始でも消音・文字速度・動きの設定を保持",
  );
  assert.deepEqual(errors, []);
  console.log(
    `PASS manor: 全24依頼/${samples.length}組、報酬・複数代償・上限・紹介停止、5サイズ、演出中保存と二重入力、消音、章末`,
  );
} finally {
  await browser.close();
}
