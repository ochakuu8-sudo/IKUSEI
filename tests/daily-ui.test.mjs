/**
 * 起動中のローカルViteに対して、1日ぶんの操作を通しで確かめる。
 * `npm run dev` を上げてから `npm run test:ui`。初回のみ `npx playwright install chromium`。
 */
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const browser = await chromium.launch(),
  out = resolve("../../outputs/implementation-screens");
mkdirSync(out, { recursive: true });
const page = await browser.newPage({
    viewport: { width: 1366, height: 768 },
    hasTouch: true,
    reducedMotion: "reduce",
  }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const button = (name) => page.getByRole("button", { name }),
  read = () =>
    page.evaluate(() =>
      JSON.parse(localStorage.getItem("ikusei-prototype-save-v14")),
    );
async function tap(locator) {
  await locator.tap();
  await page.waitForTimeout(220);
}
/** 場面を最後まで送る。どこを触っても進むこと自体が要件。 */
async function playScene() {
  for (let i = 0; i < 40; i++) {
    if (!(await page.locator(".scenario-dialog").count())) return;
    await page.locator(".scenario-tap-target").tap({ force: true });
    await page.waitForTimeout(90);
  }
  throw new Error("場面が終わらない");
}
async function closeResult() {
  /* 場面が閉じてから結果が出るまで1フレーム空くので、待ってから閉じる。 */
  await page.waitForTimeout(260);
  if (await button("確認").count()) await tap(button("確認"));
  assert.equal(
    await page.locator("dialog[open]").count(),
    0,
    "結果を閉じきれていない",
  );
}

try {
  /* 文字送りは即時にして、送りのタップ数でテストが揺れないようにする。 */
  await page.addInitScript(() => {
    localStorage.setItem(
      "ikusei-prototype-ui-v14",
      JSON.stringify({ tab: "today", sheet: null, speed: 0, motion: true }),
    );
  });
  await page.goto(
    process.env.IKUSEI_TEST_URL ?? "http://127.0.0.1:5174/IKUSEI/",
  );
  await page.evaluate(() =>
    localStorage.removeItem("ikusei-prototype-save-v14"),
  );
  await page.reload();
  await tap(button("はじめから"));
  const start = await read();
  assert.equal(start.saveVersion, 14);
  assert.equal(start.day, 1);
  assert.equal(start.stamina, 100);
  await page.screenshot({ path: resolve(out, "today-1366.png") });

  /* 今日の提示は3件＋「今日は受けない」。開かずに比べられること。 */
  assert.equal(await page.locator(".c-slip").count(), 4);
  assert(await page.locator(".c-slip .c-costs").count());
  assert(await page.locator(".c-slip .c-slip-seal").count(), "地の紋が入る");
  /* 手元の一覧に、いま管理しているものが揃っていること。 */
  const ledger = page.locator(".c-ledger");
  assert.equal(await ledger.count(), 1);
  assert.equal(await ledger.locator(".c-ax").count(), 3, "三軸");
  assert((await ledger.locator(".c-bond").count()) >= 6, "相手ごとの関係");
  assert(
    (await ledger.locator(".c-res").count()) >= 3,
    "体力・所持金・章の返済",
  );

  /* 1件選ぶ → 依頼状 → 確認 → 場面 → 結果 → 翌日 */
  await tap(page.locator(".c-slip .c-slip-face").first());
  await page.screenshot({ path: resolve(out, "sheet-1366.png") });
  assert(await button("この依頼を受ける").count());
  await tap(button("この依頼を受ける"));
  await tap(
    page
      .locator("dialog[open]")
      .last()
      .getByRole("button", { name: "確定する" }),
  );
  await playScene();
  await page.screenshot({ path: resolve(out, "result-1366.png") });
  await closeResult();
  const afterJob = await read();
  assert.equal(afterJob.day, 2, "1日 = 1行動");
  assert(afterJob.stamina < 100, "体力は使ったまま持ち越す");
  assert(afterJob.money > start.money);

  /* 読み込み直しても、その日の顔ぶれは変わらない */
  const before = await page.locator(".c-slip .c-slip-main b").allInnerTexts();
  await page.reload();
  await tap(button("続きから"));
  assert.deepEqual(
    await page.locator(".c-slip .c-slip-main b").allInnerTexts(),
    before,
  );

  /* 休むと体力だけが戻り、1日を失う */
  await tap(page.locator(".c-slip.c-rest .c-slip-face"));
  await tap(
    page
      .locator("dialog[open]")
      .last()
      .getByRole("button", { name: "確定する" }),
  );
  await closeResult();
  const afterRest = await read();
  assert.equal(afterRest.day, 3);
  assert.equal(afterRest.stamina, 100);
  assert.equal(afterRest.money, afterJob.money);

  /* 台帳はHUDの日付から開く */
  await tap(page.locator(".c-hud button").first());
  await page.screenshot({ path: resolve(out, "journal-1366.png") });
  assert(await page.getByText("関係").count());

  /* どの端末でも 1200×500 の比を保つ */
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(200);
  const ratio = await page.locator(".chapter-app").evaluate((e) => {
    const r = e.getBoundingClientRect();
    return r.width / r.height;
  });
  assert(Math.abs(ratio - 2.4) < 0.001, `2.4:1 ではない (${ratio})`);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  assert(
    Math.abs(
      (await page
        .locator(".chapter-app")
        .evaluate((e) => e.getBoundingClientRect().height)) - 162.5,
    ) < 1,
  );
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.waitForTimeout(200);
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth),
    await page.evaluate(() => window.innerWidth),
    "ページを横スクロールさせない",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS v14 UI: 3件＋受けない → 依頼状 → 場面 → 結果 → 翌日 ／ 再読込で同じ顔ぶれ ／ 休む ／ 台帳 ／ 2.4:1固定",
  );
} finally {
  await browser.close();
}
