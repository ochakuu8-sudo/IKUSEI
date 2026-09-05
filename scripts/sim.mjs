// 方針の比較。最適収入の証明ではない。UIと同じperformActionで購入・期限・精算も処理する。
import * as G from '@game/game';
import { performAction } from '@game/engine';
import { supportOffers } from '@game/content/support';
import { offerReason, outstandingTotal, absoluteDay } from '@game/contracts';
import assert from 'node:assert/strict';

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
  if(s.awaitingSettlement) {
    const pay=s.obligations.find(o=>o.outstanding>0 && (o.status!=='active'||o.terms.kind==='credit') && s.money>=o.outstanding);
    return pay && policy!=='independent' ? {type:'pay',id:pay.id} : {type:'settle'};
  }
  const offerId=policy==='advance'?'reservation':policy==='credit'?'supply-credit':null;
  const offer=supportOffers.find(o=>o.id===offerId);
  if(offer && !offerReason(s,offer)) return {type:'accept',offer:offer.id};
  const obligation=s.obligations.find(o=>o.status==='active' && o.terms.kind==='advance');
  if(obligation) {
    const c=obligation.terms.options[0];
    const prepared=prepare(s,c.recipe,c.count,c.stamina);
    if(prepared?.ready) return {type:'fulfill',id:obligation.id,option:c.id};
    if(prepared?.action) return prepared.action;
  }
  const repay=s.obligations.find(o=>o.outstanding>0 && o.terms.kind==='credit' && s.money>=o.outstanding+120);
  if(repay) return {type:'pay',id:repay.id};
  // 初回の筆耕で処方を知る。その後は手持ちと純利益で注文を比較する。
  if(!s.known.includes('perfume') && G.isOpen(G.jobs.find(j=>j.id==='copyist'),s) && s.stamina>=20) return {type:'job',id:'copyist'};
  const candidates=G.jobs.filter(j=>G.isOpen(j,s)&&(policy==='short-term'||!j.costs.length));
  const ready=candidates.filter(j=>G.hasStaminaFor(j,s)&&G.hasStockFor(j,s)).sort((a,b)=>G.payWithRelation(b,s)-G.payWithRelation(a,s));
  if(ready[0]?.recipe || (policy==='short-term' && ready[0]?.costs.length)) return {type:'job',id:ready[0].id};
  const orders=candidates.filter(j=>j.recipe).sort((a,b)=>net(b,s)-net(a,s));
  const order=orders[0];
  if(order && net(order,s)>=(ready[0]?G.payWithRelation(ready[0],s):0)) {
    const p=prepare(s,order.recipe,order.count??1,order.stamina);
    if(p?.ready) return {type:'job',id:order.id};
    if(p?.action) return p.action;
  }
  if(ready.length) return {type:'job',id:ready[0].id};
  return {type:'rest'};
}
function net(j,s) {
  const r=G.recipeOf(j.recipe);
  return G.payWithRelation(j,s)-Object.entries(r.needs).reduce((sum,[id,n])=>sum+(G.materialOf(id).buy??100)*n,0)*(j.count??1);
}
function simulate(policy, chapters) {
  let s=structuredClone(G.initialState), iterations=0;
  const rows=[], counts={}; let start=s.money;
  while(!s.ended && s.chapter<=chapters) {
    assert.ok(++iterations<2000,'policy loop');
    const a=choose(s,policy), previous=s;
    s=step(s,a); counts[a.type]=(counts[a.type]??0)+1;
    if(a.type==='settle') {
      const sheet=G.settlementOf(previous);
      rows.push({chapter:previous.chapter,netBeforeSettlement:previous.money-start,paid:sheet.paid,shortfall:sheet.shortfall});
      start=s.money;
      if(previous.chapter===chapters) break;
    }
  }
  return {policy,days:chapters*14,money:s.money,debt:s.debt,unsettled:outstandingTotal(s),
    fulfilled:s.obligations.filter(o=>o.status==='fulfilled').length,
    defaults:s.obligations.filter(o=>o.status==='defaulted').length,
    capabilities:s.capabilities,axes:s.axes,counts,rows};
}
for(const chapters of [2,6]) {
  console.log(`\n${chapters*14}日間：仮データと行動方針の比較（前金は純利益ではありません）`);
  for(const policy of ['independent','advance','credit','short-term']) console.log(JSON.stringify(simulate(policy,chapters)));
}
