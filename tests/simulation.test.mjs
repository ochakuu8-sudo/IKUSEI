import assert from "node:assert/strict";
import { playJob, simulate, policies } from "@game/adv/simulate";
import { freshDaily, offersOf } from "@game/daily";
const pick = id => choices => choices.find(c=>c.id===id) ?? choices[0];
let s=freshDaily("simulation-path");
s=playJob(s,"debug-training",pick("negotiation")).state;
assert.equal(s.growthXP.negotiation,2);
const branch=playJob(s,"debug-challenge",pick("negotiation"));
assert.equal(branch.outcome.bonusMoney,30);
assert.equal(branch.state.money-s.money,branch.outcome.pay);
assert.equal(branch.state.storyFlags["route.negotiation"],true);
assert(offersOf(branch.state).some(j=>j.id==="debug-followup-negotiation"));
const follow=playJob(branch.state,"debug-followup-negotiation",pick("finish"));
assert.equal(follow.state.growthXP.negotiation,5);
assert.equal(follow.state.storyFlags["completed.negotiation"],true);
assert.equal(follow.state.day,4);
assert.equal(follow.state.activeSession,undefined);
for(const p of policies){
  const run=simulate(p,"simulation-end");
  assert.equal(run.chapters.length,6);
  assert(run.final.ended && run.decisions>0);
  const sum=key=>run.chapters.reduce((n,c)=>n+c[key],0);
  assert.equal(sum("income")+120-sum("paid"),run.final.money);
  assert.equal(11850-sum("paid")+sum("interest"),run.final.debt);
}
console.log("PASS simulation: growth, conditional bonus, follow-up, day advancement and full-chapter accounting");
