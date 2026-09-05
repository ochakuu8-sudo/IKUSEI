// 方針の比較。最適収入の証明ではない。UIと同じperformActionで購入・期限・精算も処理する。
import * as G from '@game/game';
import { performAction } from '@game/engine';
import { supportOffers } from '@game/content/support';
import { offerReason, outstandingTotal, absoluteDay } from '@game/contracts';
import assert from 'node:assert/strict';
import { planDelivery } from '@game/delivery';
import { parseSave } from '@game/save';

function step(s, a) { const out=performAction(s,a); assert.equal(out.error,undefined,JSON.stringify(a)); return out.state; }
function prepare(s, recipe, count, stamina) {
  const r=G.recipeOf(recipe), held=s.stock[recipe]??0;
  if(held>=count && s.stamina>=stamina) return {ready:true};
  if(held>=count || s.stamina < r.stamina+stamina) return {action:{type:'rest'}};
  if(G.canBrew(r,s)) return {action:{type:'brew',recipe}};
  const basket={};
  for(const id of G.materialIds) {
    const n=Math.max(0,(r.needs[id]??0)*(count-held)-s.materials[id]);
    if(n) basket[id]=n;
  }
  const spend=Object.entries(basket).reduce((sum,[id,n])=>sum+(G.materialOf(id).buy??Infinity)*n,0);
  if(spend>0 && spend<=s.money) return {action:{type:'buy',place:'arnaud',basket}};
  const gather=G.gatherPlaces(s).filter(p=>s.stamina>=(p.gatherStamina??20))
    .sort((a,b)=>Object.keys(b.gathers).filter(id=>basket[id]).length-Object.keys(a.gathers).filter(id=>basket[id]).length)[0];
  if(gather && Object.keys(gather.gathers).some(id=>basket[id])) return {action:{type:'gather',place:gather.id}};
  return null;
}
function choose(s, policy) {
  if(s.eventQueue.length) return {type:'read-event',id:s.eventQueue[0].id};
  if(s.awaitingSettlement) return {type:'settle'};
  const withSpecial=policy==='special', withPeople=policy==='personal';
  if(withSpecial) {
    const offer=supportOffers.find(o=>o.schedule && !offerReason(s,o));
    if(offer) return {type:'accept',offer:offer.id};
  }
  const active=s.obligations.filter(o=>o.status==='active' && o.terms.schedule).sort((a,b)=>a.due-b.due);
  const due=active.filter(o=>o.due===absoluteDay(s));
  if(due.length) {
    const selection={ordinary:[],promises:due.map(o=>({id:o.id,option:o.terms.options[0].id}))};
    const required=planDelivery(s,selection);
    if(!required.error) {
      // 本日分を予約してから、同じ出発に通常販売を追加する。
      for(const j of G.jobs.filter(j=>j.category==='ordinary' && G.isOpen(j,s))) {
        const next={...selection,ordinary:[...selection.ordinary,j.id]};
        if(!planDelivery(s,next).error) selection.ordinary.push(j.id);
      }
      return {type:'deliver',...selection};
    }
    const o=due[0],c=o.terms.options[0],p=prepare(s,c.recipe,c.count,c.stamina);
    if(p?.action?.type==='brew') return p.action;
    return {type:'rest'}; // 不履行も実際の日末処理で計上する。
  }
  if(active.length) {
    const o=active[0],c=o.terms.options[0],p=prepare(s,c.recipe,c.count,c.stamina);
    if(p?.action) return p.action;
    if(p?.ready && o.due-absoluteDay(s)<=2) return {type:'rest'};
  }
  // 人物併用方針では、未習得処方と関係の入口を頼まれごとで開く。
  if(withPeople) {
    const introductory=['ledger','copyist'].map(id=>G.jobs.find(j=>j.id===id)).find(j=>!s.history.some(h=>h.kind==='job'&&h.target===j.id)&&G.isOpen(j,s)&&G.hasStaminaFor(j,s));
    if(introductory) return {type:'job',id:introductory.id};
  }
  const available=structuredClone(s);
  // 指定日用の完成品を通常販売に使わない。
  for(const o of active) { const c=o.terms.options[0]; available.stock[c.recipe]=Math.max(0,(available.stock[c.recipe]??0)-c.count); }
  const orders=G.jobs.filter(j=>j.category==='ordinary' && G.isOpen(j,s) && !j.costs.length)
    .sort((a,b)=>net(b,s)-net(a,s) || a.id.localeCompare(b.id));
  const group=policy==='ordinary' ? orders.slice(0,1) : orders.filter((j,i,all)=>all.findIndex(x=>x.recipe===j.recipe)===i).slice(0,2);
  if(group.length) {
    const selection={ordinary:group.map(j=>j.id),promises:[]},plan=planDelivery(available,selection);
    if(!plan.error) return {type:'deliver',...selection};
    const missing=group.find(j=>(available.stock[j.recipe]??0)<(j.count??1));
    if(missing) {
      const prep=prepare(available,missing.recipe,missing.count??1,plan.stamina);
      if(prep?.action) return prep.action;
    }
  }
  if(withPeople) {
    const work=G.jobs.filter(j=>j.category==='personal' && G.isOpen(j,s)&&G.hasStaminaFor(j,s)&&!j.costs.length).sort((a,b)=>G.payWithRelation(b,s)-G.payWithRelation(a,s))[0];
    if(work) return {type:'job',id:work.id};
  }
  return {type:'rest'};
}
function net(j,s) {
  const r=G.recipeOf(j.recipe);
  return G.payWithRelation(j,s)-Object.entries(r.needs).reduce((sum,[id,n])=>sum+(G.materialOf(id).buy??100)*n,0)*(j.count??1);
}
function simulate(policy, chapters) {
  let s=structuredClone(G.initialState), iterations=0;
  const rows=[], counts={}; let start=s.money, batches=0, deliveries=0;
  while(!s.ended && s.chapter<=chapters) {
    assert.ok(++iterations<2000,'policy loop');
    const a=choose(s,policy), previous=s;
    s=step(s,a); counts[a.type]=(counts[a.type]??0)+1;
    if(a.type==='deliver') { deliveries+=a.ordinary.length+a.promises.length; if(a.ordinary.length+a.promises.length>1) batches++; }
    assert.deepEqual(parseSave(JSON.stringify(s)),s,'every simulated action survives reload');
    if(a.type==='settle') {
      const sheet=G.settlementOf(previous);
      rows.push({chapter:previous.chapter,netBeforeSettlement:previous.money-start,paid:sheet.paid,shortfall:sheet.shortfall});
      start=s.money;
      if(previous.chapter===chapters) break;
    }
  }
  if(policy==='special') { assert.equal(s.obligations.filter(o=>o.status==='fulfilled').length,2); assert.ok(s.unlockedPeople.includes('herbalist')); assert.ok(s.unlockedPlaces.includes('garden')); assert.ok(s.playedEvents.includes('garden-introduction')); }
  if(policy==='batch') assert.ok(batches>0,'batch policy actually combines deliveries');
  return {policy,batches,deliveries,days:chapters*14,money:s.money,debt:s.debt,unsettled:outstandingTotal(s),
    fulfilled:s.obligations.filter(o=>o.status==='fulfilled').length,
    defaults:s.obligations.filter(o=>o.status==='defaulted').length,
    capabilities:s.capabilities,axes:s.axes,counts,rows};
}
for(const chapters of [2,6]) {
  console.log(`\n${chapters*14}日間：仮データと行動方針の比較（前金は純利益ではありません）`);
  for(const policy of ['ordinary','batch','special','personal']) console.log(JSON.stringify(simulate(policy,chapters)));
}
