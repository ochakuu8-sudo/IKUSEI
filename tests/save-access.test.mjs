import assert from "node:assert/strict";
import { createSaveAccess, SaveConflict } from "@game/saveAccess";
import { freshDaily, dailyAction } from "@game/daily";
import { SAVE_KEY, saveDaily, clearDaily } from "@game/saveV14";
import { transition } from "@game/adv/engine";

const store = () => {
  const data = new Map();
  return { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v), removeItem: k => data.delete(k) };
};
function mutex() {
  let queue = Promise.resolve();
  return operation => {
    const result = queue.then(operation);
    queue = result.catch(() => {});
    return result;
  };
}
let count = 0;
async function check(name, fn) { await fn(); count++; console.log("PASS " + name); }

await check("stale tab cannot overwrite an advanced day, including retry", async () => {
  const db=store(), lock=mutex(), before=freshDaily("tabs");
  saveDaily(db,before);
  const a=createSaveAccess(db,lock), b=createSaveAccess(db,lock);
  const next=dailyAction(before,{type:"rest"}).state;
  await a.run(()=>saveDaily(db,next));
  for(let i=0;i<2;i++) await assert.rejects(b.run(()=>saveDaily(db,before)),SaveConflict);
  assert.equal(JSON.parse(db.getItem(SAVE_KEY)).day,2);
});
await check("simultaneous starts have exactly one writer", async () => {
  const db=store(), lock=mutex(), a=createSaveAccess(db,lock), b=createSaveAccess(db,lock);
  const results=await Promise.allSettled([a.run(()=>saveDaily(db,freshDaily("a"))),b.run(()=>saveDaily(db,freshDaily("b")))]);
  assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
  assert.equal(JSON.parse(db.getItem(SAVE_KEY)).runId,"a");
});
await check("cursor-only changes, legacy migration sources and deletion invalidate stale pages", async () => {
  for(const kind of ["cursor","legacy","delete"]){
    const db=store(), lock=mutex();
    if(kind==="legacy")db.setItem("ikusei-prototype-save-v15","old");
    else saveDaily(db,transition(freshDaily("same-revision"),{type:"begin",jobId:"debug-training"}).state);
    const access=createSaveAccess(db,lock);
    if(kind==="cursor"){
      const before=JSON.parse(db.getItem(SAVE_KEY)), session=before.activeSession;
      const out=transition(before,{type:"cursor",sessionId:session.id,nodeId:session.nodeId,revision:session.revision,cursor:{line:0,offset:0,chars:12}});
      assert.equal(out.error,undefined);
      assert.equal(out.state.revision,before.revision);
      assert.equal(out.state.activeSession.revision,session.revision);
      saveDaily(db,out.state);
    }
    if(kind==="legacy")db.setItem("ikusei-prototype-save-v15","changed");
    if(kind==="delete")clearDaily(db);
    const unchanged=db.getItem(SAVE_KEY);
    await assert.rejects(access.run(()=>saveDaily(db,freshDaily())),SaveConflict);
    assert.equal(db.getItem(SAVE_KEY),unchanged);
  }
});
await check("same-page successive writes, write failure retry and explicit reset remain possible", async () => {
  const db=store(), access=createSaveAccess(db,mutex()), s=freshDaily("retry");
  await assert.rejects(access.run(()=>{throw Error("quota");}),/quota/);
  await access.run(()=>saveDaily(db,s));
  await access.run(()=>saveDaily(db,dailyAction(s,{type:"rest"}).state));
  await access.run(()=>clearDaily(db));
  await access.run(()=>saveDaily(db,freshDaily("new")));
  assert.equal(JSON.parse(db.getItem(SAVE_KEY)).runId,"new");
});
console.log(`${count} save access checks passed`);
