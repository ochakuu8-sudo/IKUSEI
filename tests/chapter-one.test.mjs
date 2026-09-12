import assert from "node:assert/strict";
import { freshDaily, dailyAction, offersOf, payOf, takeReason } from "@game/daily";
import { campaignChapters, chapterAvailable, pendingStoryEvent } from "@game/campaign";
import { chapterOneJobs, chapterOneScenarios } from "@game/content/chapterOne";
import { chapterOneEndingLines } from "@game/content/chapterOne";
import { transition, persistTransition } from "@game/adv/engine";
import { playJob, simulate, policies } from "@game/adv/simulate";
import { validateScenario } from "@game/adv/conditions";
import { parseDaily, SAVE_KEY } from "@game/saveV14";
import { exportSave, importSave } from "@game/saveTransfer";

let count=0;
const check=(name,fn)=>{fn();count++;console.log("PASS "+name);};
const pick=id=>choices=>choices.find(c=>c.id===id)??choices[0];
const action=(s,a)=>{const out=dailyAction(s,a);assert.equal(out.error,undefined);return out.state;};
const fresh=()=>playJob(freshDaily("chapter-test"),undefined,pick("vernet")).state;
const readEvent=(s,choice="vernet")=>playJob(s,undefined,pick(choice)).state;
function finish(route="vernet",restOnly=false){
  let s=fresh(),actions=0; const seen=new Set();
  for(let guard=0;guard<30;guard++){
    if(pendingStoryEvent(s)){s=readEvent(s,route);continue;}
    if(!chapterAvailable(s)) break;
    if(s.awaitingSettlement){s=action(s,{type:"settle"});continue;}
    const offers=offersOf(s);offers.forEach(j=>seen.add(j.id));
    const job=offers.filter(j=>!takeReason(j,s)).sort((a,b)=>Number(b.cadence==="once")-Number(a.cadence==="once")||payOf(b,s)-payOf(a,s))[0];
    s=restOnly||!job?action(s,{type:"rest"}):playJob(s,job.id,pick("cash")).state;
    actions++;
    assert.deepEqual(parseDaily(JSON.stringify(s)),s,"every transition round-trips");
  }
  assert.equal(actions,14);assert.equal(s.chapter,2);assert.equal(s.day,1);assert.equal(s.ended,false);
  assert.equal(s.storyFlags["ch1.ending.done"],true);return {state:s,seen};
}
check("shipping catalog has one chapter, seven jobs and three supporting people",()=>{
  assert.deepEqual(Object.keys(campaignChapters),["1"]);
  assert.equal(chapterOneJobs.length,7);
  assert.deepEqual(campaignChapters[1].people,["vernet","claire","marc"]);
  for(const s of chapterOneScenarios) assert.deepEqual(validateScenario(s),[],s.id);
  assert(!JSON.stringify(chapterOneScenarios).includes("検証用"));
  assert(transition(freshDaily(),{type:"begin",jobId:"debug-training"}).error);
});
check("intro and day-seven promise are saved, unavoidable and cost no day or money",()=>{
  let s=freshDaily("events"); assert(dailyAction(s,{type:"rest"}).error);
  const before=structuredClone(s); s=readEvent(s);
  for(const k of ["money","stamina","day","chapter"])assert.equal(s[k],before[k]);
  for(let i=0;i<7;i++)s=action(s,{type:"rest"});
  assert.equal(s.day,8); assert.equal(pendingStoryEvent(s).id,"ch1.promise");
  assert(dailyAction(s,{type:"rest"}).error);
  s=readEvent(s,"claire");assert.equal(s.day,8);assert.equal(s.storyFlags["ch1.promise.claire"],true);
  assert.equal(s.storyFlags["ch1.promise.vernet"],false);assert.equal(pendingStoryEvent(s),undefined);
  assert(transition(s,{type:"begin-event"}).error);
});
/* 3枠目は日替わりなので、日数を決め打ちせず提示されるまで待つ。 */
function restUntilOffered(s,id){
  for(let i=0;i<8&&!offersOf(s).some(j=>j.id===id);i++)
    s=pendingStoryEvent(s)?readEvent(s):action(s,{type:"rest"});
  assert(offersOf(s).some(j=>j.id===id),id+" が提示されない");
  return s;
}
check("all four skills unlock a repeatable role; repeat visits use short text",()=>{
  for(const [skill,basic,special] of [["negotiation","ledger","negotiation"],["courage","ledger","negotiation"],["knowledge","library","research"],["charm","library","research"]]){
    let s=fresh();
    for(let i=0;i<2;i++)s=playJob(s,"ch1-"+basic,pick(skill)).state;
    assert.equal(s.growthXP[skill],2);
    s=restUntilOffered(s,"ch1-"+special);
    const run=playJob(s,"ch1-"+special,pick(skill));assert(run.outcome.bonusMoney>0);s=run.state;
    s=restUntilOffered(s,"ch1-"+special);
    const again=transition(s,{type:"begin",jobId:"ch1-"+special});assert.equal(again.error,undefined);
    assert(again.state.activeSession.scenario.id.endsWith(".repeat"));
    assert(again.state.activeSession.scenario.nodes.intro.lines[0].text.length<=80);
  }
});
check("both promises finish in exactly fourteen actions; unmet payment also reaches ending",()=>{
  const v=finish("vernet"),c=finish("claire"),r=finish("claire",true);
  assert.equal(new Set([...v.seen,...c.seen]).size,7);
  assert.equal(v.state.storyFlags["ch1.followup.vernet"],true);
  assert.equal(c.state.storyFlags["ch1.followup.claire"],true);
  assert.equal(v.state.storyFlags["ch1.followup.claire"],undefined);
  assert.notDeepEqual(chapterOneEndingLines(v.state),chapterOneEndingLines(c.state));
  const receipt=r.state.chapterResults[0];
  // 14 rest days owe 840G of upkeep against 120G of starting money: nothing is left to repay.
  assert.deepEqual(receipt,{chapter:1,quota:1050,paid:0,shortfall:1050,interest:263});
  assert.equal(r.state.money,0);
  assert.equal(r.state.carryOver,1313);assert.equal(r.state.debt,12833);
  assert(chapterOneEndingLines(r.state).some(l=>l.text.includes("263G")));
  assert(chapterOneEndingLines(r.state).some(l=>l.text.includes("机の席")),"rest-only play invents no completed promise");
});
check("settlement cannot run twice; sequel preserves all progression without starting over",()=>{
  const s=simulate(policies[1],"sequel").final;
  assert(s.money>0); assert.equal(s.debt,10800);
  for(const a of [{type:"rest"},{type:"settle"},{type:"take",job:"ch1-ledger"}]){
    const out=dailyAction(s,a);assert(out.error);assert.strictEqual(out.state,s);
  }
  assert.deepEqual(offersOf(s),[]);
  const backup=importSave(exportSave(s,s.recordings));assert.deepEqual(backup.state,s);
  campaignChapters[2]={title:"続編の接続試験",jobIds:["ch1-ledger"],people:["vernet","claire"],events:[]};
  try {
    assert(chapterAvailable(backup.state));
    const next=playJob(backup.state,"ch1-ledger",pick("cash")).state;
    assert.equal(next.chapter,2);assert.equal(next.day,2);
    assert.equal(next.debt,s.debt);assert.deepEqual(next.chapterResults,s.chapterResults);
    assert.deepEqual(next.growthXP,s.growthXP);assert.deepEqual(next.axes,s.axes);
    assert.equal(next.recordings.length,s.recordings.length+1);
    assert(next.money>s.money);
  } finally {delete campaignChapters[2];}
});
check("old later-chapter saves retain their exact position, money and frozen accepted job",()=>{
  const raw={...freshDaily("old"),chapter:3,day:9,money:1900,carryOver:71,debt:8900};
  delete raw.chapterResults;
  const old=parseDaily(JSON.stringify(raw));assert.equal(old.chapter,3);assert.equal(old.day,9);assert.equal(old.money,1900);assert.equal(old.carryOver,71);
  assert.deepEqual(old.chapterResults,[]);assert.equal(chapterAvailable(old),false);
  const current=campaignChapters[1]; let s;
  try {
    campaignChapters[1]={...current,jobIds:["debug-training"],events:[],alwaysOfferIds:undefined};
    s=transition(freshDaily("old-active"),{type:"begin",jobId:"debug-training"}).state;
  } finally {campaignChapters[1]=current;}
  s=parseDaily(JSON.stringify(s));
  while(s.activeSession.phase!=="result"){
    const a=s.activeSession,n=a.scenario.nodes[a.nodeId];
    const out=transition(s,{type:n.kind==="text"?"advance":"choose",choiceId:"charm",sessionId:a.id,nodeId:n.id,revision:a.revision});
    assert.equal(out.error,undefined);s=out.state;
  }
  assert.equal(s.day,2);assert.equal(s.growthXP.charm,2);
});
check("bad imports and save failures do not replace the current game",()=>{
  const s=fresh(),data=JSON.parse(exportSave(s,[]));
  assert.throws(()=>importSave("not json"));
  assert.throws(()=>importSave(JSON.stringify({...data,version:99})));
  assert.throws(()=>importSave(JSON.stringify({...data,state:{...s,chapter:999}})));
  assert.throws(()=>importSave(JSON.stringify({...data,archive:[{}]})));
  const store={setItem(){throw Error("quota");}};
  const before=freshDaily("failure");
  const out=persistTransition(store,SAVE_KEY,before,{type:"begin-event"});
  assert(out.error);assert.strictEqual(out.state,before);assert.equal(before.recordings.length,0);
});
console.log(`${count} chapter-one checks passed`);
