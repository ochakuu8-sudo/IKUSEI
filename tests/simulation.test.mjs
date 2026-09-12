import assert from "node:assert/strict";
import { playJob, simulate, policies } from "@game/adv/simulate";
import { freshDaily, offersOf } from "@game/daily";
import { chapterAvailable } from "@game/campaign";
import { DAILY_UPKEEP } from "@game/game";
const pick = id => choices => choices.find(c=>c.id===id) ?? choices[0];
let s=playJob(freshDaily("simulation-path"),undefined,pick("vernet")).state;
for(let i=0;i<2;i++) s=playJob(s,"ch1-ledger",pick("negotiation")).state;
assert.equal(s.growthXP.negotiation,2);
// 3日目の枠は試作の夜会依頼。断る選択は何も動かさない。
assert(offersOf(s).some(j=>j.id==="ch1-cleanup"));
s=playJob(s,"ch1-cleanup",pick("refuse")).state;
assert.equal(s.axes.貞操,100,"断れば貞操は動かない");
assert(offersOf(s).some(j=>j.id==="ch1-negotiation"));
const branch=playJob(s,"ch1-negotiation",pick("negotiation"));
assert.equal(branch.outcome.bonusMoney,100);
assert.equal(branch.state.money-s.money,branch.outcome.pay-DAILY_UPKEEP);
assert.equal(branch.outcome.upkeep.due,DAILY_UPKEEP);assert.equal(branch.outcome.upkeep.unpaid,0);
assert.equal(branch.state.storyFlags["ch1.negotiated"],true);
assert.equal(branch.state.day,5);
for(const p of policies){
  const run=simulate(p,"simulation-end");
  assert.equal(run.chapters.length,1);
  assert(!run.final.ended && !chapterAvailable(run.final) && run.decisions>0);
  assert.equal(run.final.chapter,2); assert.equal(run.final.day,1);
  assert.equal(run.final.storyFlags["ch1.ending.done"],true);
  const sum=key=>run.chapters.reduce((n,c)=>n+c[key],0);
  assert.equal(sum("income")+120-sum("paid"),run.final.money);
  assert.equal(11850-sum("paid")+sum("interest")+run.arrears,run.final.debt);
  assert(run.used.every(id=>id.startsWith("ch1-")));
}
console.log("PASS simulation: chapter-one choices, 14 days, exactly-once repayment and sequel boundary");
