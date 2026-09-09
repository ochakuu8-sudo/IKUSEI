/**
 * 章ごとの稼ぎを実測する。**依頼・報酬・体力・軸の数値を触ったら必ず走らせる。**
 *
 * 見るのは「ノルマに対して、どの遊び方がどれだけ届くか」。
 * 企画書 §4 は「章末の返済額は、代償ゼロの依頼だけを順調に重ねれば達成できる水準」
 * と決めている。清廉プレイの比率が 100% を大きく超えているうちは、
 * 何も差し出さずに完済できてしまい、選択が成立しない。
 */
import {
  dailyAction,
  freshDaily,
  offersOf,
  payOf,
  quotaOf,
  staminaOf,
  takeReason,
} from "@game/daily";
import { QUOTAS } from "@game/game";

const SEEDS = 24;

/** ひとつの方針で1周まわし、章ごとの稼ぎを返す。 */
function run(pick, seed) {
  let s = freshDaily(`sim-${seed}`);
  const chapters = [];
  let earned = 0,
    rests = 0,
    paidDays = 0,
    idle = 0;
  for (let guard = 0; guard < 200 && !s.ended; guard++) {
    if (s.awaitingSettlement) {
      chapters.push({ chapter: s.chapter, quota: quotaOf(s), earned });
      earned = 0;
      s = dailyAction(s, { type: "settle" }).state;
      continue;
    }
    const open = offersOf(s).filter((j) => !takeReason(j, s));
    if (!open.length) idle++;
    const job = pick(open, s);
    if (!job) {
      rests++;
      s = dailyAction(s, { type: "rest" }).state;
      continue;
    }
    if (job.costs.length) paidDays++;
    earned += payOf(job, s);
    s = dailyAction(s, { type: "take", job: job.id }).state;
  }
  return { chapters, rests, paidDays, idle, final: s };
}

const strategies = {
  "清廉（代償ゼロだけ）": (open) =>
    open
      .filter((j) => !j.costs.length)
      .sort((a, b) => b.pay / staminaOf(b) - a.pay / staminaOf(a))[0] ?? null,
  "効率（体力あたり最大）": (open, s) =>
    open.sort(
      (a, b) => payOf(b, s) / staminaOf(b) - payOf(a, s) / staminaOf(a),
    )[0] ?? null,
  "高額（額の大きい順）": (open, s) =>
    open.sort((a, b) => payOf(b, s) - payOf(a, s))[0] ?? null,
};

console.log(`${SEEDS}周ぶんの平均。ノルマに対する比率が読みどころ。\n`);
for (const [name, pick] of Object.entries(strategies)) {
  const runs = Array.from({ length: SEEDS }, (_, i) => run(pick, i));
  console.log(`── ${name} ──`);
  for (let c = 0; c < QUOTAS.length; c++) {
    const rows = runs.map((r) => r.chapters[c]).filter(Boolean);
    if (!rows.length) continue;
    const earned = rows.reduce((a, r) => a + r.earned, 0) / rows.length;
    const quota = rows[0].quota;
    console.log(
      `  第${c + 1}章  稼ぎ ${Math.round(earned).toLocaleString().padStart(6)}G` +
        ` ／ ノルマ ${quota.toLocaleString().padStart(5)}G` +
        ` ＝ ${Math.round((earned / quota) * 100)
          .toString()
          .padStart(4)}%`,
    );
  }
  const avg = (f) =>
    (runs.reduce((a, r) => a + f(r), 0) / runs.length).toFixed(1);
  const axesOf = (a) =>
    ["貞操", "品位", "威厳"].map((k) => `${k}${a[k]}`).join(" ");
  console.log(
    `  休んだ日 ${avg((r) => r.rests)}日 ／ 代償を払った日 ${avg((r) => r.paidDays)}日` +
      ` ／ 受けられる依頼が0件だった日 ${avg((r) => r.idle)}日`,
  );
  console.log(
    `  最終 残債 ${Math.round(runs.reduce((a, r) => a + r.final.debt, 0) / runs.length)}G` +
      ` ／ ${axesOf(runs[0].final.axes)}\n`,
  );
}
console.log(
  "企画書§4：ノルマは『代償ゼロの依頼だけを順調に重ねれば達成できる水準』。\n" +
    "清廉の比率が 100% を大きく超えるなら、何も差し出さずに完済でき、選択が成立しない。",
);
