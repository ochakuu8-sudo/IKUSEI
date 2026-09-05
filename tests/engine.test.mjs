import assert from 'node:assert/strict';
import * as G from '@game/game';
import { performAction } from '@game/engine';
import { validateOffers, offerReason, offerKey, absoluteDay, outstandingTotal } from '@game/contracts';
import { supportOffers } from '@game/content/support';
import { parseSave } from '@game/save';
const fresh = () => structuredClone(G.initialState);
const run = (s, a, offers) => { const r = performAction(s, a, offers); assert.equal(r.error, undefined); return r.state; };
const accept = (s = fresh(), id = 'reservation', offers) => run(s, { type: 'accept', offer: id }, offers);
let checks = 0;
function test(name, fn) { fn(); checks++; console.log('PASS', name); }

test('default content has valid references and terms', () => assert.deepEqual(validateOffers(supportOffers), []));
test('acceptance is atomic and cannot pay twice', () => {
  const s = fresh(), original = structuredClone(s), a = accept(s);
  assert.deepEqual(s, original); assert.equal(a.money, 280); assert.equal(a.day, 1);
  assert.equal(a.obligations[0].outstanding, 160);
  const rejected = performAction(a, { type: 'accept', offer: 'reservation' });
  assert.ok(rejected.error); assert.strictEqual(rejected.state, a);
});
test('fulfillment pays only remainder and spends stock once', () => {
  const s = accept(); s.stock.tisane = 2;
  const n = run(s, { type: 'fulfill', id: '1:reservation', option: 'standard' });
  assert.equal(n.money, 460); assert.equal(n.stock.tisane, 0); assert.equal(n.day, 2);
  assert.equal(n.obligations[0].status, 'fulfilled'); assert.equal(outstandingTotal(n), 0);
  assert.ok(n.capabilities.includes('flexible-orders'));
  assert.ok(performAction(n, { type: 'fulfill', id: '1:reservation', option: 'standard' }).error);
});
test('acceptance and brewing cannot claim an unearned unlock', () => {
  const s = accept(); s.materials.rose = 2; s.materials.wormwood = 1;
  const n = run(s, { type: 'brew', recipe: 'tisane' });
  assert.deepEqual(n.capabilities, []); assert.ok(offerReason(n, supportOffers[2]));
});
test('credit supplies inventory and a real liability', () => {
  const s = accept(fresh(), 'supply-credit');
  assert.equal(s.day, 2); assert.equal(s.money, 120); assert.equal(s.materials.rose, 6);
  assert.equal(outstandingTotal(s), 138);
  assert.ok(performAction(s, { type: 'pay', id: '1:supply-credit' }).error);
  s.money = 200;
  const n = run(s, { type: 'pay', id: '1:supply-credit' });
  assert.equal(n.money, 62); assert.equal(n.day, 2); assert.equal(outstandingTotal(n), 0);
  assert.ok(n.capabilities.includes('extended-credit'));
  assert.ok(performAction(n, { type: 'pay', id: '1:supply-credit' }).error);
});
test('cancellation keeps debt and blocks provider until refund', () => {
  const s = run(accept(), { type: 'cancel', id: '1:reservation' });
  s.capabilities.push('flexible-orders');
  assert.equal(s.money, 280); assert.equal(outstandingTotal(s), 160);
  assert.match(offerReason(s, supportOffers[2]), /未精算/);
  const n = run(s, { type: 'pay', id: '1:reservation' });
  assert.equal(n.money, 120); assert.equal(n.obligations[0].status, 'cancelled');
  assert.equal(offerReason(n, supportOffers[2]), null);
});
test('declining is free and only closes this chapter offer', () => {
  const s = run(fresh(), { type: 'decline', offer: 'reservation' });
  assert.equal(s.money, 120); assert.equal(s.day, 1); assert.equal(s.obligations.length, 0);
  assert.equal(s.offerStates['1:reservation'], 'declined');
  s.chapter = 2; assert.equal(offerReason(s, supportOffers[0]), null);
});
test('unaccepted expiry causes no penalty', () => {
  const s = fresh(); s.day = 10;
  const n = run(s, { type: 'rest' });
  assert.match(offerReason(n, supportOffers[0]), /提示期限/);
  assert.equal(n.obligations.length, 0); assert.equal(n.money, 120);
});
test('delivery succeeds on due day', () => {
  const s = accept(); s.day = s.obligations[0].due; s.stock.tisane = 2;
  const n = run(s, { type: 'fulfill', id: '1:reservation', option: 'standard' });
  assert.equal(n.obligations[0].status, 'fulfilled');
});
test('end of due day defaults once without removing debt', () => {
  const s = accept(); s.day = s.obligations[0].due;
  const n = run(s, { type: 'rest' });
  assert.equal(n.obligations[0].status, 'defaulted'); assert.equal(outstandingTotal(n), 160);
  const r = run(n, { type: 'rest' });
  assert.equal(r.history.filter(h => h.kind === 'defaulted').length, 1);
});
test('extension costs a day and is capped', () => {
  const s = accept(); s.day = 8;
  const n = run(s, { type: 'renegotiate', id: '1:reservation' });
  assert.equal(n.day, 9); assert.equal(n.obligations[0].due, 11);
  assert.equal(n.obligations[0].status, 'active');
  assert.ok(performAction(n, { type: 'renegotiate', id: '1:reservation' }).error);
});
test('two active obligations limit accepting more', () => {
  const s = accept(accept(), 'supply-credit'); s.capabilities.push('flexible-orders');
  assert.match(performAction(s, { type: 'accept', offer: 'flexible-reservation' }).error, /2件/);
});
test('alternative delivery changes days, stock and choice history', () => {
  const s = fresh(); s.capabilities.push('flexible-orders'); s.stock.sleeper = 1;
  const a = accept(s, 'flexible-reservation');
  const n = run(a, { type: 'fulfill', id: '1:flexible-reservation', option: 'alternative' });
  assert.equal(n.day, 3); assert.equal(n.stock.sleeper, 0);
  assert.equal(n.history.at(-1).choice, 'alternative');
});
test('multi-day delivery cannot jump a settlement or miss deadline', () => {
  const s = fresh(); s.capabilities.push('flexible-orders'); s.day = 12; s.stock.sleeper = 1;
  const a = accept(s, 'flexible-reservation'); a.day = 14;
  assert.match(performAction(a, { type: 'fulfill', id: '1:flexible-reservation', option: 'alternative' }).error, /残り日数/);
  a.day = 13; a.obligations[0].due = 13;
  assert.match(performAction(a, { type: 'fulfill', id: '1:flexible-reservation', option: 'alternative' }).error, /期限/);
});
test('obligations survive chapter settlement', () => {
  const s = fresh(); s.day = 10; s.money = 2000;
  let n = accept(s); const due = n.obligations[0].due;
  while (!n.awaitingSettlement) n = run(n, { type: 'rest' });
  n = run(n, { type: 'settle' });
  assert.equal(n.chapter, 2); assert.equal(n.day, 1); assert.equal(n.obligations[0].due, due);
  assert.equal(n.obligations[0].status, 'active');
});
test('chapter-end allocation is explicit and normal actions blocked', () => {
  let s = accept(fresh(), 'supply-credit'); s.day = 14; s.money = 1100;
  s = run(s, { type: 'rest' });
  assert.ok(s.awaitingSettlement);
  assert.ok(performAction(s, { type: 'rest' }).error);
  assert.ok(performAction(s, { type: 'brew', recipe: 'tisane' }).error);
  const debtFirst = run(s, { type: 'settle' });
  const creditFirst = run(run(s, { type: 'pay', id: '1:supply-credit' }), { type: 'settle' });
  assert.equal(debtFirst.money, 50); assert.equal(outstandingTotal(debtFirst), 138);
  assert.equal(creditFirst.money, 0); assert.equal(outstandingTotal(creditFirst), 0);
  assert.ok(creditFirst.carryOver > 0);
});
test('final day cannot create or extend a post-game obligation', () => {
  const s = fresh(); s.chapter = 6; s.day = 10;
  assert.match(performAction(s, { type: 'accept', offer: 'reservation' }).error, /最終期限/);
  s.day = 7; const a = accept(s); assert.equal(a.obligations[0].due, 84);
  assert.ok(performAction(a, { type: 'renegotiate', id: '6:reservation' }).error);
});
test('ended game rejects all further actions', () => {
  const s = fresh(); s.chapter = 6; s.day = 14; s.awaitingSettlement = true;
  const n = run(s, { type: 'settle' }); assert.ok(n.ended);
  for (const action of [{type:'rest'}, {type:'settle'}, {type:'accept',offer:'reservation'}]) assert.ok(performAction(n,action).error);
});
test('terms snapshot survives content edits', () => {
  const content = structuredClone(supportOffers);
  const s = accept(fresh(), 'reservation', content);
  content[0].totalPay = 9999; content[0].options[0].count = 99;
  s.stock.tisane = 2;
  const n = run(s, { type: 'fulfill', id: '1:reservation', option: 'standard' }, content);
  assert.equal(n.money, 460);
});
test('different providers and materials work without engine changes', () => {
  const content = structuredClone(supportOffers);
  content[0].person = 'marc'; content[0].options[0].recipe = 'perfume';
  content[1].person = 'jean'; content[1].materials = { wax: 2, silversand: 1 };
  assert.deepEqual(validateOffers(content), []);
  const a = accept(fresh(), 'supply-credit', content);
  assert.equal(a.materials.wax, 2); assert.equal(a.materials.rose, 0);
  const b = accept(fresh(), 'reservation', content); b.stock.perfume = 2;
  const n = run(b, { type: 'fulfill', id: '1:reservation', option: 'standard' }, content);
  assert.equal(n.stock.perfume, 0); assert.equal(n.relations.marc, 1);
});
test('relation and fulfillment requirements are evaluated', () => {
  const content = structuredClone(supportOffers);
  content[0].requirements = [{kind:'relation',person:'jean',level:1},{kind:'fulfilled',count:1}];
  let s=accept(fresh(),'supply-credit',content); s.money=200;
  s=run(s,{type:'pay',id:'1:supply-credit'},content);
  assert.ok(offerReason(s,content[0])); s.relations.jean=1; assert.equal(offerReason(s,content[0]),null);
});
test('invalid references and economic conditions are rejected', () => {
  for (const change of [o=>o.materials.fake=1,o=>o.options[0].count=-1,o=>o.totalPay=10,o=>o.person='missing',o=>o.term=0]) {
    const content=structuredClone(supportOffers); change(content[0]);
    assert.ok(validateOffers(content).length); assert.ok(performAction(fresh(),{type:'accept',offer:'reservation'},content).error);
  }
});
test('legacy save migration does not invent obligations', () => {
  const old=fresh(); for(const k of ['saveVersion','obligations','offerStates','capabilities','history']) delete old[k];
  const migrated=parseSave(JSON.stringify(old)); assert.equal(migrated.saveVersion,8); assert.deepEqual(migrated.obligations,[]);
  assert.equal(migrated.money,old.money);
});
test('v8 save retains snapshots and chapter-end state', () => {
  const s=accept(); s.awaitingSettlement=true; s.day=14;
  assert.deepEqual(parseSave(JSON.stringify(s)),s);
});
test('malformed saves are rejected rather than reset into a windfall', () => {
  assert.equal(parseSave('{'),null);
  const s=fresh(); s.money=-1; assert.equal(parseSave(JSON.stringify(s)),null);
  const a=accept(); a.obligations[0].terms.options[0].count=-1; assert.equal(parseSave(JSON.stringify(a)),null);
});
test('ordinary jobs use the shared rules and teach recipes', () => {
  const s=run(fresh(),{type:'job',id:'copyist'});
  assert.equal(s.day,2); assert.equal(s.money,240); assert.ok(s.known.includes('perfume'));
  assert.ok(s.known.includes('sleeper')); assert.equal(s.relations.claire,1);
});
test('invalid ordinary actions do not mutate state', () => {
  const s=fresh(), original=structuredClone(s);
  for(const a of [{type:'gather',place:'backstreet'},{type:'buy',place:'academy',basket:{rose:1}},{type:'buy',place:'arnaud',basket:{rose:-1}},{type:'job',id:'ord-tisane'}]) {
    assert.ok(performAction(s,a).error); assert.deepEqual(s,original);
  }
});
test('paying does not recover axes or advance time', () => {
  const s=accept(fresh(),'supply-credit'); s.money=200; s.axes.威厳=50;
  const n=run(s,{type:'pay',id:'1:supply-credit'});
  assert.equal(n.axes.威厳,50); assert.equal(absoluteDay(n),absoluteDay(s));
});
console.log(`${checks} engine checks passed`);
