/** Shared by the CLI runner and the CUA browser QA session. No hidden app-state mutation. */
export async function checkReform(page, setViewport, base) {
  const must = (value, message) => {
    if (!value) throw new Error(message);
  };
  const button = (name) => page.getByRole("button", { name, exact: true });
  const stats = { offers: 0, jobs: new Set(), blocked: 0, viewports: [] };
  await setViewport({ width: 1280, height: 720 });
  let offerCaseCount = 1;
  for (let i = 0; i < offerCaseCount; i++) {
    await page.goto(`${base}tests/fixtures/reform.html?case=${i}`);
    await button("続きから").click();
    const q = JSON.parse(await page.locator("#qa-expected").textContent());
    offerCaseCount = q.offerCaseCount;
    must(q.covered === q.jobCount, "Fixture must cover the whole job catalog");
    for (let j = 0; j < q.offers.length; j++) {
      const offer = q.offers[j],
        card = page.locator(".a-offer .a-envelope").nth(j);
      const label = await card.getAttribute("aria-label");
      must(
        label.includes(`${offer.pay.toLocaleString()}G`),
        `${offer.title}: card pay`,
      );
      await card.click();
      const detail = await page.locator(".a-open-letter").innerText();
      must(
        detail.replace(/\s/g, "").includes(`${offer.pay.toLocaleString()}G`),
        `${offer.title}: detail pay`,
      );
      must(detail.includes(`−${offer.stamina}`), `${offer.title}: stamina`);
      must(
        (await button(/^この依頼を受ける/).isEnabled()) !== offer.blocked,
        `${offer.title}: availability`,
      );
      must(!detail.includes("品位上限"), "Removed cap must not be displayed");
      if (offer.growthHint) {
        must(detail.includes(offer.growthHint), `${offer.title}: growth hint before acceptance`);
        must(await page.locator('.a-letter-growth').evaluate(e => {
          const r=e.getBoundingClientRect(), p=e.parentElement.getBoundingClientRect();
          return r.top>=p.top && r.bottom<=p.bottom && e.scrollWidth<=e.clientWidth;
        }), `${offer.title}: growth hint is not clipped`);
      }
      if (offer.closing.length)
        must(label.includes("紹介停止"), `${offer.title}: closing warning`);
      stats.offers++;
      stats.jobs.add(offer.id);
      if (offer.blocked) stats.blocked++;
      await button("手紙一覧へ").click();
    }
  }
  for (const [index, short, money, debt] of [
    [offerCaseCount, "205G", "0G", "11,057G"],
    [offerCaseCount + 1, "0G", "240G", "10,800G"],
  ]) {
    await page.goto(`${base}tests/fixtures/reform.html?case=${index}`);
    await button("続きから").click();
    const preview = await page.locator(".r-settlement").innerText();
    must(
      preview.includes(short) && preview.includes(debt),
      "Settlement preview",
    );
    await button("この内容で納める").click();
    const result = await page.locator(".r-day-record").innerText();
    must(
      result.includes(money) && result.includes(debt),
      "Settlement committed values",
    );
    await button("次章へ").click();
    await page.goto(base);
    await button("続きから").click();
    must(await button("1日目 第2章").isVisible(), "Resume after settlement");
  }
  for (const size of [
    { width: 1280, height: 720 },
    { width: 800, height: 304 },
    { width: 390, height: 844 },
  ]) {
    await setViewport(size);
    await page.goto(`${base}tests/fixtures/novel.html?sample=long`);
    await page
      .locator('.scenario-stage[data-ready="true"]')
      .waitFor({ state: "visible" });
    const portions = [];
    for (
      let n = 0;
      n < 20 &&
      (await page.locator(".scenario-text").getAttribute("data-line")) === "0";
      n++
    ) {
      const part = await page
        .locator(".scenario-text")
        .getAttribute("aria-label");
      must(part.split("\n").length <= 2, "At most two subtitle lines");
      portions.push(part);
      // Intentional page turns are distinct gestures; the reader ignores rapid repeats for 100ms.
      await page.waitForTimeout(120);
      await button("画面をタップして次へ").click();
    }
    must(
      portions.join("").replace(/\n/g, "") ===
        "「庭で摘んだ薬草を、銀の皿に並べていく。窓から差す光はやわらかく、ここでなら名前を呼ばれずに済む気がした。けれど、扉の向こうには依頼人が待っている。約束した分だけ働き、屋敷へ帰ろう。」",
      "No lost or duplicated text",
    );
    await button("シナリオメニュー").click();
    must(
      !(await button("既読部分を送る").isEnabled()),
      "Unread bond must not be skipped as read",
    );
    stats.viewports.push(size);
  }
  return { ...stats, jobs: stats.jobs.size };
}
