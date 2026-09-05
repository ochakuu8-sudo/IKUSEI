import { createRequire } from "node:module";
import { resolve } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import * as G from "@game/game";
import { performAction } from "@game/engine";
import { legacyOffers } from "@game/content/support";
const { chromium } = createRequire(resolve("package.json"))("playwright");
const url = process.env.IKUSEI_TEST_URL ?? "http://127.0.0.1:5173/IKUSEI/";
const out = resolve("../workday-validation");
mkdirSync(out, { recursive: true });
const key = "ikusei-prototype-save-v9",
  errors = [],
  checks = [];
const b = (p, name) => p.getByRole("button", { name, exact: true });
const read = (p) => p.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);
const row = (p, title) => p.locator(".work-choice").filter({ hasText: title });
async function finish(p) {
  for (let i = 0; i < 80 && (await p.locator("dialog[open]").count()); i++) {
    if (await p.locator(".scenario-dialog").count())
      await p
        .locator(".scenario-tap-target")
        .tap({ position: { x: 30, y: 110 } });
    else {
      const dialog = p.locator("dialog[open]").last();
      const ok = dialog.getByRole("button", { name: "確認", exact: true });
      if (await ok.count()) await ok.click();
      else
        throw new Error(
          "unexpected dialog " + (await dialog.getAttribute("aria-label")),
        );
    }
  }
  assert.equal(await p.locator("dialog[open]").count(), 0);
}
async function seed(p, s, keepUI = false) {
  await p.evaluate(
    ({ s, key, keepUI }) => {
      localStorage.setItem(key, JSON.stringify(s));
      if (!keepUI) localStorage.removeItem("ikusei-ui-v1");
    },
    { s, key, keepUI },
  );
  await p.reload();
  await b(p, "続きから").click();
}
async function home(p) {
  if (await p.locator(".commands:not(.compact-commands)").count()) return;
  await b(p, "自室へ").filter({ visible: true }).first().click();
}
async function inspect(p, name, selector) {
  const issues = await p.locator(selector).evaluateAll((es) =>
    es
      .filter(
        (e) =>
          e.getClientRects().length &&
          getComputedStyle(e).visibility !== "hidden",
      )
      .flatMap((e) => {
        const r = e.getBoundingClientRect(),
          hit = document.elementFromPoint(
            r.x + r.width / 2,
            r.y + r.height / 2,
          );
        return r.x < 0 ||
          r.y < 0 ||
          r.right > innerWidth + 1 ||
          r.bottom > innerHeight + 1 ||
          r.height < 43 ||
          !e.contains(hit)
          ? [
              e.textContent +
                ": " +
                JSON.stringify({
                  x: r.x,
                  y: r.y,
                  width: r.width,
                  height: r.height,
                }),
            ]
          : [];
      }),
  );
  assert.deepEqual(issues, [], name);
  await p.screenshot({ path: resolve(out, name + ".png") });
  checks.push(name);
}
const browser = await chromium.launch();
try {
  for (const [w, h] of [
    [1280, 720],
    [390, 844],
  ]) {
    const p = await browser.newPage({
      viewport: { width: w, height: h },
      hasTouch: true,
      reducedMotion: "reduce",
    });
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(url);
    await b(p, "はじめから").click();
    assert.deepEqual(
      await p
        .locator(".commands:not(.compact-commands) button")
        .evaluateAll((es) => es.map((e) => e.ariaLabel)),
      ["仕事をする", "出かける", "休む"],
    );
    assert.equal(await b(p, "約束帳").count(), 0);
    assert(await b(p, "調合").filter({ visible: true }).first().isVisible());
    for (const [vw, vh] of [
      [w, h],
      [667, 375],
      [800, 360],
      [844, 390],
      [932, 430],
    ]) {
      await p.setViewportSize({ width: vw, height: vh });
      await inspect(
        p,
        `home-${w}-${vw}`,
        ".commands:not(.compact-commands) button, .home-decisions .home-utilities button",
      );
    }
    await p.setViewportSize({ width: w, height: h });
    await b(p, "仕事をする").click();
    assert((await p.locator(".work-choice").count()) > 3);
    assert(await row(p, "学院文書の筆耕").isVisible());
    await row(p, "学院へ薬湯を届ける").click();
    assert.equal(await p.locator(".brew-workspace").count(), 0);
    await inspect(p, `detail-${w}`, ".work-detail .action-dock button");
    await p
      .locator(".prep-source button")
      .filter({ hasText: "商会で不足分を買う" })
      .click();
    assert((await p.locator("dialog[open]").innerText()).includes("-76"));
    await b(p, "戻る").filter({ visible: true }).last().click();
    assert.equal((await read(p)).day, 1);
    await p
      .locator(".prep-source button")
      .filter({ hasText: "商会で不足分を買う" })
      .click();
    await b(p, "購入する・1日").click();
    await finish(p);
    assert(await p.locator(".work-detail").isVisible());
    assert.equal((await read(p)).day, 2);
    assert.equal((await read(p)).money, 44);
    await p
      .locator(".inline-preparation > button")
      .filter({ hasText: "薬湯を2個調合する・0日" })
      .click();
    await b(p, "調合する・0日").click();
    assert.equal((await read(p)).day, 2);
    assert.equal((await read(p)).stock.tisane, 2);
    await p.locator(".work-detail .action-dock .primary").click();
    await b(p, "納品する・1日").click();
    await finish(p);
    assert(await p.locator(".commands:not(.compact-commands)").isVisible());
    let done = await read(p);
    assert.equal(done.day, 3);
    assert.equal(done.money, 374);
    assert.equal(done.stamina, 38);
    assert.equal(done.stock.tisane, 0);
    checks.push(`inline-prepare-buy-brew-deliver-${w}`);
    await b(p, "出かける").click();
    assert.equal(await p.getByText("行き先一覧", { exact: true }).count(), 0);
    assert.equal(
      await p.locator(".outing-target").filter({ hasText: "屋敷" }).count(),
      0,
    );
    await p.screenshot({ path: resolve(out, `outing-${w}.png`) });
    await p.locator(".outing-target").filter({ hasText: "ヴェルネ" }).click();
    await b(p, "この人の依頼を見る・0日").click();
    assert(
      (await p.locator(".work-choice").allTextContents()).every((t) =>
        t.includes("ヴェルネ"),
      ),
    );
    await b(p, "ひとつ戻る").click();
    assert(await p.locator(".person-detail").isVisible());
    await b(p, "詳細から戻る").click();
    await p.locator(".outing-target").filter({ hasText: "丘" }).click();
    assert.equal(await p.locator(".shop-screen").count(), 0);
    await b(p, "採集する・1日").click();
    await finish(p);
    assert(await p.locator(".commands:not(.compact-commands)").isVisible());
    assert.equal((await read(p)).day, 4);
    checks.push(`direct-person-and-gather-${w}`);
    await b(p, "休む").click();
    await b(p, "休む・1日").click();
    await finish(p);
    await b(p, "仕事をする").click();
    await row(p, "学院文書の筆耕").click();
    await p.locator(".work-detail .action-dock .primary").click();
    await p
      .locator("dialog[open]")
      .getByRole("button", { name: "仕事をする・1日", exact: true })
      .click();
    await finish(p);
    assert(await p.locator(".commands:not(.compact-commands)").isVisible());
    assert.equal((await read(p)).day, 6);
    checks.push(`personal-job-scene-return-${w}`);
    // Same collection lists a previously seen job as closed, without revealing locked people.
    await b(p, "仕事をする").click();
    const lower = await read(p);
    lower.axes.品位 = 0;
    await seed(p, lower, true);
    await b(p, "仕事をする").click();
    assert((await p.locator(".work-row.unavailable").count()) > 0);
    assert.equal(
      await p.locator(".work-row").filter({ hasText: "薬草師" }).count(),
      0,
    );
    checks.push(`closed-known-jobs-${w}`);
    await seed(p, structuredClone(G.initialState));
    let special = structuredClone(G.initialState);
    special.day = 2;
    await seed(p, special);
    await b(p, "仕事をする").click();
    await row(p, "特別依頼A：紹介の薬湯").click();
    await p.locator(".work-detail .action-dock .primary").click();
    await p
      .locator("dialog[open]")
      .getByRole("button", { name: "引き受ける・0日", exact: true })
      .click();
    await finish(p);
    let accepted = await read(p);
    assert.equal(accepted.day, 2);
    assert.equal(accepted.money, 280);
    assert.equal(accepted.obligations.length, 1);
    assert(await p.locator(".work-detail .action-dock .primary").isDisabled());
    accepted.day = 8;
    accepted.stock.tisane = 4;
    await seed(p, accepted);
    await p.setViewportSize({ width: 800, height: 360 });
    await inspect(
      p,
      "due-home-" + w,
      ".commands:not(.compact-commands) button, .home-decisions .home-utilities button, .home-notice",
    );
    await p.setViewportSize({ width: w, height: h });
    await b(p, "休む").click();
    await inspect(p, `deadline-${w}`, "dialog[open] footer button");
    assert(await p.locator("dialog[open] footer .deadline-strip").isVisible());
    await b(p, "閉じる").click();
    await b(p, "仕事をする").click();
    await p
      .getByRole("checkbox", {
        name: "学院へ薬湯を届けるを納品に選ぶ",
        exact: true,
      })
      .check();
    await p
      .getByRole("checkbox", {
        name: "特別依頼A：紹介の薬湯を納品に選ぶ",
        exact: true,
      })
      .check();
    const expected = performAction(accepted, {
      type: "deliver",
      ordinary: [G.jobs.find((j) => j.title === "学院へ薬湯を届ける").id],
      promises: [{ id: accepted.obligations[0].id, option: "standard" }],
    }).state;
    await p.locator(".work-screen > .action-dock .primary").click();
    assert.equal(
      await p.locator("dialog[open] footer .deadline-strip").count(),
      0,
    );
    await b(p, "納品する・1日").click();
    await finish(p);
    assert.deepEqual(await read(p), expected);
    assert(await p.locator(".commands:not(.compact-commands)").isVisible());
    checks.push(`special-and-ordinary-batch-${w}`);
    const last = structuredClone(G.initialState);
    last.day = 14;
    last.money = 3000;
    await seed(p, last);
    await b(p, "仕事をする").click();
    await row(p, "学院へ薬湯を届ける").click();
    await p
      .locator(".prep-source button")
      .filter({ hasText: "商会で不足分を買う" })
      .click();
    await b(p, "購入する・1日").click();
    await finish(p);
    assert((await read(p)).awaitingSettlement);
    assert(await p.locator(".screen-settlement").isVisible());
    checks.push(`preparation-chapter-boundary-${w}`);
    await p.close();
  }
  // Legacy two-day fulfillment still goes through its own confirmed action.
  const p = await browser.newPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  await p.goto(url);
  let old = structuredClone(G.initialState);
  old.capabilities = ["flexible-orders"];
  old = performAction(
    old,
    { type: "accept", offer: "flexible-reservation" },
    legacyOffers,
  ).state;
  old.stock.sleeper = 1;
  await seed(p, old);
  await b(p, "日付から予定表を開く").click();
  await b(p, "約束一覧").click();
  await b(p, "代替品を説明して納める・2日で納品").click();
  assert(await b(p, "納品する・2日").isVisible());
  await b(p, "納品する・2日").click();
  await finish(p);
  assert.equal((await read(p)).day, 3);
  checks.push("legacy-two-day");
  await p.close();
} catch (e) {
  for (const c of browser.contexts())
    for (const p of c.pages()) {
      await p.screenshot({ path: resolve(out, "failure.png") });
      console.log(await p.locator("body").innerText());
    }
  throw e;
} finally {
  await browser.close();
}
assert.deepEqual(errors, []);
writeFileSync(
  resolve(out, "report.json"),
  JSON.stringify({ checks, errors }, null, 2),
);
console.log(`PASS ${checks.length} workday flows and layouts`);
