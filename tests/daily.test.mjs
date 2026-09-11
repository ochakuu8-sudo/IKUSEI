import assert from "node:assert/strict";
import {
  closingPreview,
  dailyAction,
  freshDaily,
  isOpen,
  offersOf,
  payOf,
  quotaOf,
  staminaOf,
  takeReason,
  tracesOf,
  markSeen,
  materialCostOf,
  OFFERS_PER_DAY,
} from "@game/daily";
import { jobs } from "@game/game";
import { campaignChapters } from "@game/campaign";
// Explicit archived-content fixture. Shipping scope is tested in chapter-one.test.mjs.
for (let chapter = 1; chapter <= 6; chapter++) campaignChapters[chapter] = { title: "旧版の検証", jobIds: jobs.filter(j => !j.id.startsWith("ch1-")).map(j => j.id), people: ["vernet", "claire"], events: [] };
import { parseDaily, migrateFromV13 } from "@game/saveV14";

let passed = 0;
const check = (name, fn) => {
  fn();
  passed++;
  console.log("PASS " + name);
};

check("1日1行動。仕事を受けると日が進み、体力は戻らない", () => {
  const s = freshDaily("t1");
  const job = offersOf(s)[0];
  const out = dailyAction(s, { type: "take", job: job.id });
  assert.equal(out.error, undefined);
  assert.equal(out.state.day, 2);
  assert.equal(out.state.stamina, 100 - staminaOf(job));
  assert.equal(out.state.money, s.money + payOf(job, s));
  assert(out.outcome.scene.length > 0, "納品には必ず場面が入る");
});

check("休むと体力だけが戻り、1日を失う", () => {
  let s = freshDaily("t2");
  const job = offersOf(s)[0];
  s = dailyAction(s, { type: "take", job: job.id }).state;
  const tired = s.stamina;
  const out = dailyAction(s, { type: "rest" });
  assert.equal(out.state.stamina, 100);
  assert.equal(out.state.day, 3);
  assert.equal(out.state.money, s.money);
  assert(tired < 100);
});

check("提示は毎日3件まで。読み込み直しても同じ顔ぶれ", () => {
  const s = freshDaily("t3");
  const a = offersOf(s).map((j) => j.id);
  const b = offersOf(structuredClone(s)).map((j) => j.id);
  assert.deepEqual(a, b);
  assert(a.length <= OFFERS_PER_DAY);
  assert.equal(new Set(a).size, a.length);
});

check("代償は受ける前に確定し、受けたぶんだけ軸が減る", () => {
  const s = freshDaily("t4");
  const job = jobs.find((j) => j.id === "escort"); // 夜会への同伴
  const before = { ...s.axes };
  const out = dailyAction(s, { type: "take", job: job.id });
  for (const c of job.costs)
    assert.equal(out.state.axes[c.axis], before[c.axis] - c.amount);
  assert.deepEqual(
    out.outcome.drops.map((d) => [d.axis, d.amount]),
    job.costs.map((c) => [c.axis, c.amount]),
  );
});

check("品位は同ランク内だけ回復し、低下したランクには戻らない", () => {
  let s = freshDaily("t5");
  s.axes.品位 = 90;
  const out = dailyAction(s, { type: "take", job: "banquet" });
  assert.equal(out.state.axes.品位, 80, "90から14低下して76、その日の回復で80まで");
  assert.equal("dignityCap" in out.state, false);
  assert.equal("capDrop" in out.outcome, false);
  s = out.state;
  for (let i = 0; i < 10; i++) s = dailyAction(s, { type: "rest" }).state;
  assert.equal(s.axes.品位, 80, "何日休んでもランク4の範囲を越えない");
});

check("軸が下がると上の依頼が閉じ、落ちきると裏が開く", () => {
  const intact = freshDaily("t6");
  const openIntact = jobs.filter((j) => isOpen(j, intact));
  const fallen = { ...intact, axes: { 貞操: 0, 品位: 0, 威厳: 0 } };
  const openFallen = jobs.filter((j) => isOpen(j, fallen));
  assert(openFallen.length < openIntact.length, "選べる依頼は減る");
  assert(
    openIntact.filter((j) => j.kind === "裏").length === 0 &&
      openFallen.filter((j) => j.kind === "裏").length > 0,
    "裏の仕事は落ちて初めて開く",
  );
  assert(
    openIntact.some((j) => j.kind === "親交") &&
      !openFallen.some((j) => j.kind === "親交"),
    "親交の席は落ちると失われる",
  );
});

check("閉じる依頼は受ける前に予告し、受けたあと跡に残る", () => {
  let s = freshDaily("t7");
  s = markSeen(
    s,
    jobs.map((j) => j.id),
  );
  const job = jobs.find((j) => j.id === "escort");
  const preview = closingPreview(job, s);
  const out = dailyAction(s, { type: "take", job: job.id });
  const closed = out.outcome.closedNow.map((c) => c.title);
  for (const title of preview) assert(closed.includes(title), title);
  const traces = tracesOf(out.state).map((t) => t.job.title);
  for (const title of preview) assert(traces.includes(title), title);
});

check("体力が足りない依頼は選べない", () => {
  const s = { ...freshDaily("t8"), stamina: 5 };
  for (const job of jobs)
    if (staminaOf(job) > 5) assert(takeReason(job, s), job.title);
  const rested = { ...s, stamina: 100 };
  const open = jobs.filter((j) => !takeReason(j, rested));
  assert(open.length > 0, "体力があれば受けられる依頼はある");
});

check("同じ相手に通い詰めると買い叩かれる", () => {
  let s = freshDaily("t9");
  const job = jobs.find((j) => j.id === "ord-vernet-tisane");
  const first = payOf(job, s);
  s = dailyAction(s, { type: "take", job: job.id }).state;
  s = { ...s, stamina: 100 };
  const second = payOf(job, s);
  assert(second < first, `${second} < ${first}`);
});

check("章末は不足すると利息と罰が付き、次章へ繰り越す", () => {
  let s = { ...freshDaily("t10"), day: 14, money: 0 };
  s = dailyAction(s, { type: "rest" }).state;
  assert.equal(s.awaitingSettlement, true);
  const quota = quotaOf(s);
  const out = dailyAction(s, { type: "settle" });
  assert.equal(out.state.chapter, 2);
  assert.equal(out.state.day, 1);
  assert.equal(out.state.carryOver, quota + Math.ceil(quota * 0.25));
  assert.equal(out.state.axes.威厳, 100 - 15);
  assert.equal(out.state.stamina, 100);
});

check("全6章を通しで終えられる", () => {
  let s = freshDaily("t11");
  for (let guard = 0; guard < 200 && !s.ended; guard++) {
    if (s.awaitingSettlement) {
      s = dailyAction(s, { type: "settle" }).state;
      continue;
    }
    const job = offersOf(s).find((j) => !takeReason(j, s));
    const out = job
      ? dailyAction(s, { type: "take", job: job.id })
      : dailyAction(s, { type: "rest" });
    assert.equal(out.error, undefined);
    s = out.state;
  }
  assert.equal(s.ended, true);
  assert.equal(s.chapter, 6);
});

check("保存は往復し、壊れた保存は読まない", () => {
  let s = freshDaily("t12");
  s = dailyAction(s, { type: "take", job: offersOf(s)[0].id }).state;
  const back = parseDaily(JSON.stringify(s));
  assert.deepEqual(back, s);
  assert.equal(parseDaily("{}"), null);
  assert.equal(parseDaily("なにこれ"), null);
  assert.equal(parseDaily(JSON.stringify({ ...s, saveVersion: 13 })), null);
});

check("v13の保存からは、返済と評判だけを引き継ぐ", () => {
  const v13 = {
    saveVersion: 13,
    chapter: 2,
    day: 5,
    money: 800,
    debt: 9000,
    carryOver: 100,
    dignityCap: 95,
    axes: { 貞操: 88, 品位: 90, 威厳: 100 },
    relationPoints: { vernet: 6000, claire: 2500, marc: 0 },
    materials: { rose: 9 },
  };
  const s = migrateFromV13(JSON.stringify(v13));
  assert.equal(s.chapter, 2);
  assert.equal(s.money, 800);
  assert.equal("dignityCap" in s, false);
  assert.equal(s.axes.貞操, 88);
  assert.equal(s.relations.vernet, 2);
  assert.equal(s.relations.claire, 1);
  assert.equal(s.relations.marc, 0);
  assert.equal(s.stamina, 100);
  assert.equal(migrateFromV13("{}"), null);
});

check("調剤は素材ぶんの体力と自腹を依頼に畳んである", () => {
  const job = jobs.find((j) => j.id === "ord-vernet-tisane");
  assert(materialCostOf(job) > 0, "素材の自腹がある");
  assert(staminaOf(job) > job.stamina, "調合のぶん体力が要る");
  const plain = jobs.find((j) => j.id === "ledger");
  assert.equal(materialCostOf(plain), 0);
  assert.equal(staminaOf(plain), plain.stamina);
});

console.log(`\n${passed} daily engine checks passed`);
