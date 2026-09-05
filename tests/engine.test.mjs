import assert from 'node:assert/strict';
import * as G from '@game/game';
import { performAction as currentAction } from '@game/engine';
import { validateOffers, offerReason, offerKey, absoluteDay, outstandingTotal } from '@game/contracts';
import { legacyOffers as supportOffers, supportOffers as currentOffers, specialOffers } from '@game/content/support';
import { parseSave } from '@game/save';
// 旧契約の回帰検証は旧データを明示的に渡す。実ゲームに新規提示しない。
const performAction = (s, a, offers = supportOffers) => currentAction(s, a, offers);
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
  const migrated=parseSave(JSON.stringify(old)); assert.equal(migrated.saveVersion,9); assert.deepEqual(migrated.obligations,[]);
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

const now = (s, a, content) => { const out = currentAction(s, a, content); assert.equal(out.error, undefined, JSON.stringify(a)); return out.state; };
const at = (day) => ({ ...fresh(), chapter: Math.floor((day - 1) / 14) + 1, day: (day - 1) % 14 + 1 });
const special = (id = 'special-a', day = 2, content) => now(at(day), { type: 'accept', offer: id }, content);
const batch = (ordinary = [], ids = []) => ({ type: 'deliver', ordinary, promises: ids.map(id => ({ id, option: 'standard' })) });
const ready = () => ({ ...fresh(), known: G.recipes.map(r => r.id), stock: Object.fromEntries(G.recipes.map(r => [r.id, 20])), stamina: 100 });
test('new content replaces generic advances and validates schedules/rewards', () => {
  assert.deepEqual(validateOffers(currentOffers), []);
  assert.equal(currentOffers.filter(o => o.kind === 'advance' && !o.schedule).length, 0);
  for (const change of [o => o.schedule.closes = 8, o => o.schedule.delivery = 85, o => o.rewards[0] = { kind: 'place', id: 'missing' }, o => o.extensionLimit = 1]) {
    const content = structuredClone(currentOffers); change(content[0]); assert.ok(validateOffers(content).length);
  }
});
test('ordinary sheets repeat without acceptance, limits, or suspension', () => {
  let s = ready(); s = now(s, batch(['ord-tisane']));
  assert.equal(s.obligations.length, 0); assert.deepEqual(s.offerStates, {});
  s = now(s, batch(['ord-tisane'])); assert.equal(s.day, 3); assert.equal(s.stock.tisane, 16);
  let cancelled = now(special(), { type: 'cancel', id: 'special:special-a' }); cancelled.stock.tisane = 4;
  cancelled = now(cancelled, batch(['ord-tisane'])); assert.equal(cancelled.stock.tisane, 2);
});
test('batch sums inventory stamina axes and cap but uses one day', () => {
  const s = ready(); const before = structuredClone(s);
  const n = now(s, batch(['ord-philtre', 'ord-abortive', 'ord-tisane']));
  assert.equal(n.day, 2); assert.equal(n.stamina, 68); assert.equal(n.axes.威厳, 84); assert.equal(n.axes.品位, 94);
  assert.equal(n.dignityCap, 97); assert.equal(n.stock.philtre, 19); assert.equal(n.stock.abortive, 19); assert.equal(n.stock.tisane, 18);
  assert.deepEqual(s, before); assert.deepEqual(n.recent[0], ['claire', 'jean', 'marc']);
});
test('batch fails atomically for shared stock shortage, stamina, duplicate and invalid ids', () => {
  const s = special(); s.day = 8; s.stock.tisane = 3;
  const actions = [batch(['ord-tisane'], ['special:special-a']), batch(['ord-tisane', 'ord-tisane']), batch(['missing']), batch(['ledger']), batch([], ['special:special-a', 'special:special-a']), batch()];
  for (const a of actions) { const out = currentAction(s, a); assert.ok(out.error); assert.strictEqual(out.state, s); }
  s.stock.tisane = 4; s.stamina = 23; assert.ok(currentAction(s, actions[0]).error);
});
test('ordinary same-person relation grows once and every batch participant counts in fatigue', () => {
  const s = ready(), n = now(s, batch(['ord-tisane', 'ord-sleeper', 'ord-balm']));
  assert.equal(n.relations.claire, 1); assert.equal(n.relations.vernet, 1);
  assert.equal(G.personFatigue('claire', n), 1); assert.equal(G.personFatigue('vernet', n), 1);
  assert.equal(n.money - s.money, 330 + 430 + 360);
});
test('predeparture conditions and prices are unaffected by delivery ordering or rewards', () => {
  const s = ready(); s.axes.品位 = 45;
  const a = now(s, batch(['ord-tisane', 'ord-abortive']));
  const b = now(s, batch(['ord-abortive', 'ord-tisane'])); assert.deepEqual(a, b);
  const t = special(); t.day = 8; t.stock = { tisane: 4, sleeper: 2 };
  // A would teach sleeper, but an unknown sheet is not eligible at departure.
  assert.ok(currentAction(t, batch(['ord-sleeper'], ['special:special-a'])).error);
});
test('special acceptance only during fixed window, is free of days, stock optional, and unique', () => {
  for (const day of [1, 6, 8, 16]) assert.ok(currentAction(at(day), { type: 'accept', offer: 'special-a' }).error);
  for (const day of [2, 5]) {
    const s = special('special-a', day); assert.equal(absoluteDay(s), day); assert.equal(s.money, 280); assert.equal(s.obligations[0].due, 8);
    assert.ok(currentAction(s, { type: 'accept', offer: 'special-a' }).error);
  }
});
test('two specials may coexist separately from credit supports', () => {
  const content = structuredClone(currentOffers);
  content[1].schedule = { appears: 2, closes: 5, delivery: 8 };
  content.push({ ...structuredClone(content[0]), id: 'special-c' });
  let s = special('special-a', 2, content);
  s = now(s, { type: 'accept', offer: 'supply-credit' }, content);
  s = now(s, { type: 'accept', offer: 'special-b' }, content);
  assert.match(currentAction(s, { type: 'accept', offer: 'special-c' }, content).error, /2件/);
});
test('special cannot deliver early via either entry point or extend', () => {
  const s = special(); s.stock.tisane = 2;
  assert.ok(currentAction(s, batch([], ['special:special-a'])).error);
  assert.ok(currentAction(s, { type: 'fulfill', id: 'special:special-a', option: 'standard' }).error);
  assert.ok(currentAction(s, { type: 'renegotiate', id: 'special:special-a' }).error);
});
test('due-day mixed delivery pays remainder once and special relation is additional', () => {
  const s = special(); s.day = 8; s.stock.tisane = 4;
  const n = now(s, batch(['ord-tisane'], ['special:special-a']));
  assert.equal(n.money, 280 + 330 + 200); assert.equal(n.relations.claire, 2); assert.equal(n.day, 9);
  assert.equal(n.obligations[0].status, 'fulfilled'); assert.equal(n.obligations[0].outstanding, 0);
  assert.deepEqual(n.unlockedPeople, ['herbalist']);
  assert.ok(currentAction(n, batch([], ['special:special-a'])).error);
  assert.deepEqual(parseSave(JSON.stringify(n)), n);
});
test('same-day multiple specials produce identical state for both selection orders', () => {
  const content = structuredClone(currentOffers); content[1].schedule = { appears: 2, closes: 5, delivery: 8 };
  let s = special('special-a', 2, content); s = now(s, { type: 'accept', offer: 'special-b' }, content); s.day = 8; s.stock.tisane = 6;
  const n = now(s, batch(['ord-tisane'], ['special:special-a', 'special:special-b']));
  assert.deepEqual(n, now(s, batch(['ord-tisane'], ['special:special-b', 'special:special-a'])));
  assert.equal(n.eventQueue.length, 1); assert.equal(n.rewardedObligations.length, 2);
});
test('end of designated day defaults only the unselected promise without extra axis penalty', () => {
  const s = special(); s.day = 8; s.stock.tisane = 2; s.axes.威厳 = 70;
  const n = now(s, batch(['ord-tisane']));
  assert.equal(n.obligations[0].status, 'defaulted'); assert.equal(n.obligations[0].outstanding, 160); assert.equal(n.axes.威厳, 72);
  assert.equal(now(n, { type: 'rest' }).history.filter(h => h.kind === 'defaulted').length, 1);
});
test('refund blocks only same provider new support and never adds fees', () => {
  const content = structuredClone(currentOffers); content[1].person = 'claire';
  let s = special(); s = now(s, { type: 'cancel', id: 'special:special-a' }); s.day = 9;
  assert.match(offerReason(s, content[1]), /未精算/); assert.equal(offerReason(s, currentOffers[1]), null);
  s = now(s, { type: 'pay', id: 'special:special-a' }); assert.equal(s.money, 120); assert.equal(offerReason(s, content[1]), null);
});
test('all accepted terms including rewards and dates survive later definition changes', () => {
  const content = structuredClone(currentOffers), s = special('special-a', 2, content);
  content[0].schedule.delivery = 10; content[0].money = 1; content[0].totalPay = 9999; content[0].options[0].count = 9; content[0].rewards = [];
  s.day = 8; s.stock.tisane = 2; const n = now(s, batch([], ['special:special-a']), content);
  assert.equal(n.money, 480); assert.ok(n.unlockedPeople.includes('herbalist')); assert.equal(n.obligations[0].due, 8);
});
test('B crosses chapter boundary and unlocks place, event, recipe and additional sheet', () => {
  let s = special('special-b', 12); s.stock.tisane = 2; s.money = 2000;
  while (!s.awaitingSettlement) s = now(s, { type: 'rest' });
  assert.equal(s.obligations[0].status, 'active'); s = now(s, { type: 'settle' }); assert.equal(absoluteDay(s), 15);
  s = now(s, batch([], ['special:special-b']));
  assert.ok(G.placeOpen(G.placeOf('garden'), s)); assert.ok(s.known.includes('balm')); assert.ok(G.isOpen(G.jobs.find(j => j.id === 'ord-garden'), s));
  const loaded = parseSave(JSON.stringify(s)); assert.deepEqual(loaded.eventQueue, s.eventQueue);
  assert.equal(s.eventQueue[0].id, 'garden-introduction');
  const read = now(loaded, { type: 'read-event', id: 'garden-introduction' });
  assert.equal(absoluteDay(read), absoluteDay(s)); assert.equal(read.money, s.money); assert.equal(read.eventQueue.length, 0);
  assert.deepEqual(parseSave(JSON.stringify(read)), read); assert.ok(currentAction(read, { type: 'read-event', id: 'garden-introduction' }).error);
});
test('locked people and locations are blocked through all relevant action routes', () => {
  const s = ready(); assert.ok(!G.peopleAt('academy', s).some(p => p.id === 'herbalist'));
  for (const a of [{ type: 'network', person: 'herbalist' }, { type: 'visit', place: 'garden' }, { type: 'gather', place: 'garden' }, { type: 'buy', place: 'garden', basket: { rose: 1 } }, batch(['ord-garden'])]) assert.ok(currentAction(s, a).error);
  const content = structuredClone(currentOffers); content[0].person = 'herbalist';
  assert.ok(currentAction(at(2), { type: 'accept', offer: 'special-a' }, content).error);
  let n = special(); n.day = 8; n.stock.tisane = 2; n = now(n, batch([], ['special:special-a']));
  assert.ok(G.peopleAt('academy', n).some(p => p.id === 'herbalist')); assert.ok(n.newPeople.includes('herbalist'));
  const visited = now(n, { type: 'visit', place: 'academy' }); assert.equal(visited.day, n.day); assert.equal(visited.newPeople.length, 0);
  now(visited, { type: 'network', person: 'herbalist' });
});
test('personal job cadences are once, per chapter, or repeatable and visits are free', () => {
  let s = now(fresh(), { type: 'visit', place: 'academy' }); assert.equal(s.day, 1);
  s = now(s, { type: 'job', id: 'copyist' }); assert.ok(currentAction(s, { type: 'job', id: 'copyist' }).error);
  s = now(s, { type: 'job', id: 'salon' }); assert.ok(currentAction(s, { type: 'job', id: 'salon' }).error);
  s.chapter = 2; s.day = 1; s.stamina = 100; assert.equal(currentAction(s, { type: 'job', id: 'salon' }).error, undefined);
  assert.ok(currentAction(s, { type: 'job', id: 'copyist' }).error);
  s = now(s, { type: 'job', id: 'ledger' }); s = now(s, { type: 'job', id: 'ledger' }); assert.equal(s.personalRuns['once:ledger'], 2);
});
test('v8 migrates real history and old deadlines but never grants new unlocks', () => {
  const old = accept(); old.saveVersion = 8; delete old.relations.herbalist;
  for (const key of ['unlockedPeople','unlockedPlaces','newPeople','newPlaces','eventQueue','playedEvents','rewardedObligations','personalRuns']) delete old[key];
  old.history.push({ day: 1, kind: 'job', target: 'copyist' }, { day: 14, kind: 'job', target: 'salon' });
  const s = parseSave(JSON.stringify(old)); assert.ok(s); assert.equal(s.saveVersion, 9); assert.deepEqual(s.obligations, old.obligations);
  assert.equal(s.relations.herbalist, 0); assert.deepEqual(s.unlockedPeople, []); assert.deepEqual(s.eventQueue, []);
  assert.equal(s.personalRuns['once:copyist'], 1); assert.equal(s.personalRuns['chapter:1:salon'], 1);
  s.stock.tisane = 4; const n = now(s, batch(['ord-tisane'], ['1:reservation'])); assert.equal(n.money, 280 + 330 + 180); assert.equal(n.day, 2);
});
test('legacy two-day alternative remains individual after v8 migration', () => {
  const old = fresh(); old.capabilities.push('flexible-orders'); const accepted = accept(old, 'flexible-reservation'); accepted.saveVersion = 8;
  let s = parseSave(JSON.stringify(accepted)); s.stock.sleeper = 1;
  assert.ok(currentAction(s, { type: 'deliver', ordinary: [], promises: [{ id: '1:flexible-reservation', option: 'alternative' }] }).error);
  s = now(s, { type: 'fulfill', id: '1:flexible-reservation', option: 'alternative' }); assert.equal(s.day, 3);
});
test('final-day batch grants rewards before settlement and event replay is still available after ending', () => {
  const content = structuredClone(currentOffers); content[1].schedule = { appears: 80, closes: 83, delivery: 84 };
  let s = special('special-b', 80, content); s.day = 14; s.stock.tisane = 4;
  s = now(s, batch(['ord-tisane'], ['special:special-b'])); assert.ok(s.awaitingSettlement); assert.equal(s.obligations[0].status, 'fulfilled');
  s = now(s, { type: 'settle' }); assert.ok(s.ended); assert.equal(s.eventQueue.length, 1);
  s = now(parseSave(JSON.stringify(s)), { type: 'read-event', id: 'garden-introduction' }); assert.equal(s.playedEvents.length, 1);
});
test('malformed v9 schedules, rewards, queues and counters are rejected', () => {
  for (const change of [s => s.obligations[0].due++, s => s.obligations[0].terms.rewards = [{ kind: 'place', id: 'fake' }], s => s.eventQueue = [{ id: 'bad' }], s => s.personalRuns = { copyist: -1 }, s => s.unlockedPeople = ['fake']]) {
    const s = special(); change(s); assert.equal(parseSave(JSON.stringify(s)), null);
  }
});
console.log(`${checks} engine checks passed`);
import {parseUI, freshUI} from '@game/uiState';
import {cleanSelection, preparationNeeds, previewAction, brewCapacity} from '@game/presentation';
test('bulk brewing equals repeated individual brewing with no extra day or economic effects',()=>{
 for(const recipe of G.recipes){const s=fresh();s.known=G.recipes.map(r=>r.id);s.stamina=100;for(const id of G.materialIds)s.materials[id]=50;
 const count=3;const batch=currentAction(s,{type:'brew',recipe:recipe.id,quantity:count});assert.equal(batch.error,undefined);let singles=s;for(let i=0;i<count;i++)singles=currentAction(singles,{type:'brew',recipe:recipe.id}).state;assert.deepEqual(batch.state,singles);assert.equal(batch.state.day,s.day);assert.equal(batch.state.money,s.money);assert.equal(brewCapacity(s,recipe.id),Math.floor(100/recipe.stamina));}
});
test('bulk brewing rejects invalid count and all shortages atomically',()=>{
 const s=fresh();s.materials.rose=4;s.materials.wormwood=2;
 for(const quantity of [0,-1,1.5,NaN,Infinity,3,100000000000000000]){const r=currentAction(s,{type:'brew',recipe:'tisane',quantity});assert.ok(r.error);assert.strictEqual(r.state,s);}
 s.stamina=16;assert.strictEqual(currentAction(s,{type:'brew',recipe:'tisane',quantity:2}).state,s);
});
test('action preview is nonmutating and exactly matches committed outcome',()=>{
 const s=fresh();const before=structuredClone(s);const p=previewAction(s,{type:'rest'});assert.deepEqual(s,before);assert.deepEqual(p.state,currentAction(s,{type:'rest'}).state);assert.equal(p.stamina,18);assert.equal(p.day,2);
});
test('UI storage parses separately and rejects corrupt quantities and unknown references',()=>{
 assert.deepEqual(parseUI('{broken'),freshUI());const u=parseUI(JSON.stringify({memo:['ord-tisane','wrong','ord-tisane'],quantity:-8,recipe:'fake',basket:{rose:1.5,wax:2},selection:{ordinary:['wrong'],promises:[null,{id:'x',option:'y'}]}}));assert.deepEqual(u.memo,['ord-tisane']);assert.equal(u.recipe,'tisane');assert.equal(u.quantity,1);assert.deepEqual(u.basket,{wax:2});assert.equal(u.selection.promises.length,1);
});
test('preparation survives UI roundtrip and stale selections are removed without creating obligations',()=>{
 const s=fresh();const ui=freshUI();ui.memo=['ord-tisane'];ui.selection.ordinary=['ord-tisane','ord-balm'];const u=parseUI(JSON.stringify(ui));const selection=cleanSelection(s,u.selection);assert.deepEqual(selection.ordinary,['ord-tisane']);assert.deepEqual(preparationNeeds(s,selection,u.memo),{tisane:2});assert.equal(s.obligations.length,0);assert.deepEqual(s.stock,{});
 const a=currentAction({...s,day:2},{type:'accept',offer:'special-a'}).state;assert.equal(preparationNeeds(a,{ordinary:[],promises:[]},[]).tisane,2);assert.deepEqual(cleanSelection(a,{ordinary:[],promises:[{id:a.obligations[0].id,option:a.obligations[0].terms.options[0].id}]}).promises,[]);
});
console.log(`${checks} total checks passed including UI helpers and bulk brewing`);
import {preparationMaterials} from '@game/presentation';
test('preparation basket sums shared ingredients and subtracts existing medicine/material stock',()=>{
 const s=fresh();s.known.push('balm');s.stock.tisane=1;s.materials.rose=1;s.materials.wormwood=2;
 assert.deepEqual(preparationMaterials(s,{ordinary:['ord-tisane','ord-balm'],promises:[]},['ord-tisane']),{rose:1,wormwood:3,wax:2});
});
console.log(`${checks} final engine and presentation checks passed`);
