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
/**
 * 場面を最後まで送る。どこを触っても進むこと自体が要件。
 * 送っても本文が変わらなくなったら、そこで詰まっている（無限に叩き続けない）。
 */
async function playScene() {
  let last = "";
  let stuck = 0;
  for (let i = 0; i < 60; i++) {
    if (!(await page.locator(".scenario-dialog").count())) return;
    const text = await page
      .locator(".scenario-text span")
      .first()
      .innerText()
      .catch(() => "");
    stuck = text === last ? stuck + 1 : 0;
    if (stuck > 3) throw new Error(`場面が進まない: ${text.slice(0, 20)}`);
    last = text;
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
  /* 回想はタイトルからも開ける。器（1200×500）に収まり、閉じるが画面内にあること。
     `c-title` を付けたままだと縦に伸びて覆いが触りを吸う、という壊れ方をした。 */
  await tap(button("回想"));
  const frame = await page.evaluate(() => {
    const r = (sel) => {
      const b = document.querySelector(sel).getBoundingClientRect();
      return { top: Math.round(b.top), bottom: Math.round(b.bottom) };
    };
    const grid = document.querySelector(".c-gallery-grid");
    return {
      app: r(".chapter-app"),
      footer: r(".c-gallery .c-footer"),
      scrollable: grid.scrollHeight > grid.clientHeight,
    };
  });
  assert(frame.footer.bottom <= frame.app.bottom, "閉じるが器の外に出ている");
  assert(frame.scrollable, "目録が内側でスクロールしない");
  assert.equal(await page.locator(".c-recall").count(), 53);
  await tap(button("閉じる"));
  assert(await button("はじめから").count(), "タイトルへ戻れない");

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
  assert.equal(
    await page.locator(".c-request-card .sym-rings").count(),
    3,
    "関係は各依頼人の横に輪で表示",
  );
  assert(
    (await ledger.locator(".c-res").count()) === 2,
    "体力・所持金。返済と期限はHUDへ集約",
  );

  /* 3枚が横一列で揃い、休養は下、状態は立ち絵側。全端末で主要操作が収まる。 */
  for (const [width, height] of [
    [1440, 900],
    [1920, 1080],
    [851, 337],
    [800, 304],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(100);
    const layout = await page.evaluate(() => {
      const box = (e) => {
        const r = e.getBoundingClientRect();
        return {
          left: r.left,
          right: r.right,
          top: r.top,
          bottom: r.bottom,
          width: r.width,
          height: r.height,
        };
      };
      return {
        app: box(document.querySelector(".chapter-app")),
        cards: [...document.querySelectorAll(".c-request-card")].map(box),
        rest: box(document.querySelector(".c-rest")),
        ledger: box(document.querySelector(".c-ledger")),
      };
    });
    const { app, cards, rest, ledger } = layout;
    assert.equal(cards.length, 3);
    assert(
      cards.every(
        (c) => Math.abs(c.top - cards[0].top) < (10 * app.width) / 1200,
      ),
      "依頼状3枚が横一列",
    );
    assert(
      cards.every(
        (c) => c.height / c.width > 0.85 && c.height / c.width < 1.25,
      ),
      "ほぼ正方形の依頼状",
    );
    assert(
      cards[0].right < cards[1].left && cards[1].right < cards[2].left,
      "カードが重ならない",
    );
    assert(
      ledger.right < cards[0].left && rest.top > cards[0].bottom,
      "状態は左、休養はカードの下",
    );
    assert(
      [...cards, rest, ledger].every(
        (r) =>
          r.left >= app.left &&
          r.right <= app.right + 1 &&
          r.top >= app.top &&
          r.bottom <= app.bottom + 1,
      ),
      `${width}×${height}で主要操作が器内`,
    );
  }
  await page.setViewportSize({ width: 1366, height: 768 });

  /* 手紙を戻しても同じ依頼。Escapeは元の手紙へフォーカスを戻す。 */
  const offerIds = await page
    .locator(".c-request-card")
    .evaluateAll((es) => es.map((e) => e.dataset.job));
  const portraitBox = await page.locator(".c-hero").boundingBox();
  await tap(page.locator(".c-slip .c-slip-face").first());
  assert.deepEqual(
    await page.locator(".c-hero").boundingBox(),
    portraitBox,
    "立ち絵が動かない",
  );
  await page.keyboard.press("Escape");
  assert.deepEqual(
    await page
      .locator(".c-request-card")
      .evaluateAll((es) => es.map((e) => e.dataset.job)),
    offerIds,
  );
  assert(
    await page
      .locator(".c-request-card .c-slip-face")
      .first()
      .evaluate((e) => e === document.activeElement),
  );
  await tap(page.locator(".c-request-card .c-slip-face").first());
  await page.screenshot({ path: resolve(out, "sheet-1366.png") });
  assert(await button("この依頼を受ける").count());
  /* 同一イベントループ中の二重クリックでも、保存は1日だけ進む。 */
  await button("この依頼を受ける").evaluate((e) => {
    e.click();
    e.click();
  });
  await page.locator(".scenario-dialog").waitFor();
  assert.equal((await read()).day, 2, "受諾時点で保存、二重入力でも1行動");
  assert.equal(await page.locator(".c-hud button b").innerText(), "1日目", "ノベル中の机は受諾前の日付を保つ");
  assert.equal(await page.locator(".c-res-money b").innerText(), `${start.money.toLocaleString()}G`, "ノベル中に報酬を先に表示しない");
  assert.equal(
    await button("確定する").count(),
    0,
    "受諾前の条件は手紙内に統合",
  );
  await playScene();
  assert.equal(await page.locator(".c-hud button b").innerText(), "2日目", "結果で保存済みの翌日を表示する");
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
  assert(await page.locator(".c-rest-sheet").isVisible());
  assert.equal(
    (await read()).day,
    afterJob.day,
    "休養の手紙を開くだけでは進まない",
  );
  await tap(button("今日は休む"));
  await closeResult();
  const afterRest = await read();
  assert.equal(afterRest.day, 3);
  assert.equal(afterRest.stamina, 100);
  assert.equal(afterRest.money, afterJob.money);

  /* 体力不足でも条件は読める。受諾は止め、詳細を開いただけで日を進めない。 */
  await page.evaluate(() => {
    const key = "ikusei-prototype-save-v14";
    const s = JSON.parse(localStorage.getItem(key));
    s.stamina = 0;
    localStorage.setItem(key, JSON.stringify(s));
  });
  await page.reload();
  await tap(button("続きから"));
  assert.equal(await page.locator(".c-request-card.c-shut").count(), 3);
  await tap(page.locator(".c-request-card .c-slip-face").first());
  assert(
    await button("この依頼を受ける").isDisabled(),
    "体力不足では受諾できない",
  );
  assert.equal((await read()).day, afterRest.day, "条件を読んでも日は進まない");
  await tap(button("机に戻す"));

  /* 回想。目録は全53枚（依頼24・関係21・結末8）で、見たものだけ開ける。 */
  await tap(page.locator(".c-hud button").first());
  await tap(button("開く"));
  assert.equal(await page.locator(".c-recall").count(), 53);
  const got = page.locator(".c-recall.c-got");
  assert((await got.count()) >= 1, "受けた依頼が回想に入る");
  await page.screenshot({ path: resolve(out, "gallery-1366.png") });
  await tap(got.first());
  assert.equal(
    await page.locator(".scenario-dialog").count(),
    1,
    "回想から場面を読み返せる",
  );
  await playScene();
  assert.equal(
    await page.locator(".scenario-dialog").count(),
    0,
    "場面を閉じた指で次の場面が開いている",
  );
  const kept = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("ikusei-prototype-gallery-v1") ?? "[]"),
  );
  assert(kept.length >= 1, "回想はプレイの保存とは別に貯まる");
  await tap(button("閉じる"));

  /* 台帳は机上の本からも開く */
  await tap(button("机に戻る"));
  await tap(button("返済帳・台帳"));
  await page.screenshot({ path: resolve(out, "journal-1366.png") });
  assert(await page.getByText("関係").count());

  /* 旧UI保存の音量は30%。消音は再読込・新規開始後も維持する。 */
  await tap(button("設定"));
  const volume = page.getByRole("slider", { name: "紙の音量" });
  assert.equal(await volume.inputValue(), "30");
  await volume.fill("0");
  await tap(button("閉じる").last());
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("ikusei-prototype-ui-v14")).volume,
    ),
    0,
  );

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
