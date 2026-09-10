import { simulate, policies } from "@game/adv/simulate";
const runs = Number(process.env.IKUSEI_SIM_RUNS ?? 24);
if (!Number.isInteger(runs) || runs < 1 || runs > 1000) throw Error("IKUSEI_SIM_RUNS must be an integer in 1..1000");
console.log(`${runs}周ずつ、ADVの受諾・選択・後続依頼・章末精算を通す方針比較。`);
console.log("既知の効果を評価する固定方針であり、最適攻略や初見の行動を再現するものではありません。\n");
for (const policy of policies) {
  const results = Array.from({ length: runs }, (_, i) => simulate(policy, `sim-${i}`));
  const mean = values => Math.round(values.reduce((a,b)=>a+b,0)/values.length);
  console.log(`── ${policy.name} ──`);
  for (let c=0;c<results[0].chapters.length;c++) {
    const rows=results.map(r=>r.chapters[c]);
    console.log(`第${c+1}章 平均収入 ${mean(rows.map(r=>r.income))}G（選択追加 ${mean(rows.map(r=>r.bonus))}G）／必要額 ${mean(rows.map(r=>r.quota))}G／精算前所持金 ${mean(rows.map(r=>r.cash))}G`);
  }
  console.log(`平均残債 ${mean(results.map(r=>r.final.debt))}G ／休息 ${mean(results.map(r=>r.rests))}日 ／選択 ${mean(results.map(r=>r.decisions))}回`);
  console.log(`依頼 ${[...new Set(results.flatMap(r=>r.used))].join(", ")}`);
  console.log(`成長の一例 ${JSON.stringify(results[0].final.growthXP)}\n`);
}
