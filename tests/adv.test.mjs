import assert from "node:assert/strict";
import { transition, persistTransition, scenarioFor, sessionError } from "@game/adv/engine";
import { evaluateCondition, validateCondition, validateEffects, validateScenario, validateJob } from "@game/adv/conditions";
import { changeDignity, dignityRank } from "@game/dignity";
import { growthDefinitions, rankOf } from "@game/adv/growth";
import { scenarios } from "@game/content/scenarios";
import { freshDaily, offersOf, isOpen, dailyAction, payOf } from "@game/daily";
import { jobs } from "@game/game";
import { parseDaily, migrateFromV15, migrateFromV14, loadDaily, SAVE_KEY, clearDaily } from "@game/saveV14";
import { syncArchive, loadArchive, ADV_ARCHIVE_KEY } from "@game/adv/archive";
let count = 0;
const check = (name, fn) => { fn(); count++; console.log("PASS " + name); };
const fresh = () => freshDaily("adv-test");
const issue = (s, extra) => ({ ...extra, sessionId: s.activeSession.id, revision: s.activeSession.revision, nodeId: s.activeSession.nodeId });
function step(s, extra) {
  const out = transition(s, extra.type === "begin" ? extra : issue(s, extra));
  assert.equal(out.error, undefined, out.error);
  return out.state;
}
const begin = (s, jobId) => step(s, { type: "begin", jobId });
function throughText(s) {
  while (s.activeSession.phase === "playing" && s.activeSession.scenario.nodes[s.activeSession.nodeId].kind === "text") s = step(s, { type: "advance" });
  return s;
}
const choose = (s, choiceId) => throughText(step(throughText(s), { type: "choose", choiceId }));
const ack = s => step(s, { type: "acknowledge" });
function train(s, id) {
  const done = choose(begin(s, "debug-training"), id);
  assert.equal(done.activeSession.phase, "result");
  return ack(done);
}
const range = (kind, id, min, max) => ({ kind: "range", value: kind === "relation" ? { kind, personId: id } : { kind, id }, ...(min === undefined ? {} : { min }), ...(max === undefined ? {} : { max }) });
class MemoryStore {
  data = new Map(); fail = false;
  getItem(k) { return this.data.get(k) ?? null; }
  setItem(k, v) { if (this.fail) throw Error("quota"); this.data.set(k, v); }
  removeItem(k) { this.data.delete(k); }
}
check("content definitions and all authored scenarios validate", () => {
  assert.equal(new Set(scenarios.map(s => s.id)).size, scenarios.length);
  for (const s of scenarios) assert.deepEqual(validateScenario(s), [], s.id);
  for (const j of jobs) assert.deepEqual(validateJob(j), [], j.id);
});
check("main game shares prototype scenarios; growth recurs; follow-ups have priority", () => {
  assert.deepEqual(offersOf(fresh()).map(j => j.id), ["debug-training", "debug-challenge", "debug-axes"]);
  assert.deepEqual(offersOf({ ...fresh(), debugMode: true }).map(j => j.id), offersOf(fresh()).map(j => j.id));
  assert(offersOf(freshDaily()).every(j => j.scenarioId));
  let s = fresh();
  for (let i = 0; i < 8; i++) {
    assert(offersOf(s).some(j => j.id === "debug-training"));
    assert(offersOf(s).some(j => j.id === "debug-challenge"));
    s = dailyAction(s, { type: "rest" }).state;
  }
  const withFollowup = { ...fresh(), storyFlags: { "route.charm": true } };
  assert.equal(offersOf(withFollowup)[0].id, "debug-followup-charm");
  assert.equal(offersOf(withFollowup).length, 3);
});
check("A01-A03: registered parameters, all boundary directions, AND and OR", () => {
  const s = fresh(); s.growthXP.negotiation = 2; s.axes.威厳 = 60; s.relations.marc = 1;
  for (const [c, ok] of [
    [range("skill", "negotiation", 1), true], [range("skill", "negotiation", 2), false],
    [range("axis", "威厳", 3, 3), true], [range("axis", "威厳", 4), false],
    [range("axis", "威厳", undefined, 2), false], [range("axis", "威厳", 2, 4), true],
    [range("relation", "marc", 1), true], [range("relation", "claire", 1), false],
  ]) assert.equal(evaluateCondition(c, s).ok, ok);
  assert.equal(evaluateCondition({ kind: "all", items: [range("skill", "negotiation", 1), range("relation", "marc", 1)] }, s).ok, true);
  assert.equal(evaluateCondition({ kind: "any", items: [range("skill", "charm", 3), range("relation", "marc", 1)] }, s).ok, true);
  assert.equal(evaluateCondition(range("axis", "威厳", undefined, 2), s).text.includes("上限を超過"), true);
});
check("A04: malformed conditions and effects never become unlocked", () => {
  for (const c of [
    { kind: "all", items: [] }, { kind: "any", items: [] },
    range("skill", "typo", 1), range("axis", "威厳", NaN),
    range("axis", "威厳"), range("axis", "威厳", 4, 2),
    range("relation", "unknown", 1), range("axis", "威厳", -1),
  ]) { assert(validateCondition(c).length); assert.equal(evaluateCondition(c, fresh()).ok, false); }
  assert(validateEffects({ growthXP: { typo: 1 } }).length);
  assert(validateEffects({ growthXP: { charm: -1 } }).length);
  assert(validateEffects({ bonusMoney: -10 }).length);
  assert(validateEffects({ grantCapabilities: null }).length);
  const missing = fresh(); delete missing.growthXP.charm;
  assert(evaluateCondition(range("skill", "charm", 1), missing).error);
});
check("A04: dangling nodes, cycles, duplicate choices, and missing unconditional exits fail", () => {
  for (const mutate of [
    s => { s.nodes.intro.next = "missing"; },
    s => { s.nodes.intro.next = "intro"; },
    s => { s.nodes.role.choices[1].id = s.nodes.role.choices[0].id; },
    s => { s.nodes.role.choices.forEach(c => c.condition = range("skill", "charm", 1)); },
  ]) { const s = structuredClone(scenarios[0]); mutate(s); assert(validateScenario(s).length); }
});
check("A05-A07: begin does not pay/advance, unavailable choices reject all direct calls", () => {
  const before = fresh(), s = throughText(begin(before, "debug-challenge"));
  assert.equal(s.money, before.money); assert.equal(s.day, before.day);
  assert.deepEqual(s.relations, before.relations);
  const rejected = transition(s, issue(s, { type: "choose", choiceId: "negotiation" }));
  assert(rejected.error); assert.strictEqual(rejected.state, s);
  assert(transition(s, issue(s, { type: "choose", choiceId: "invented" })).error);
  assert(transition(s, { ...issue(s, { type: "choose", choiceId: "normal" }), nodeId: "intro" }).error);
  assert(dailyAction(s, { type: "rest" }).error);
  assert(transition(s, { type: "begin", jobId: "debug-training" }).error);
  const off = jobs.find(j => isOpen(j, freshDaily()) && !offersOf(freshDaily()).some(o => o.id === j.id));
  assert(transition(freshDaily(), { type: "begin", jobId: off.id }).error);
});
check("A08/A18: all four rewards open distinct choices and only selected follow-ups", () => {
  for (const d of growthDefinitions) {
    let s = train(fresh(), d.id);
    assert.equal(rankOf(d.id, s.growthXP[d.id]), 1);
    s = choose(begin(s, "debug-challenge"), d.id);
    assert.equal(s.activeSession.phase, "result");
    assert.equal(s.storyFlags["route." + d.id], true);
    for (const other of growthDefinitions.filter(o => o.id !== d.id)) assert.notEqual(s.storyFlags["route." + other.id], true);
    assert(s.activeSession.transcript.some(l => l.sceneId.endsWith(":" + d.id)));
    s = ack(s);
    assert(offersOf(s).some(j => j.id === "debug-followup-" + d.id));
    s = choose(begin(s, "debug-followup-" + d.id), "finish");
    assert.equal(s.growthXP[d.id], 5);
    assert.equal(s.storyFlags["completed." + d.id], true);
    s = ack(s);
    assert(!offersOf(s).some(j => j.id === "debug-followup-" + d.id));
  }
});
check("A07: same-session changes affect later conditions, never earlier eligibility", () => {
  let s = throughText(begin(fresh(), "debug-axes"));
  s = step(s, { type: "choose", choiceId: "prestige" });
  assert.equal(s.activeSession.working.axes.威厳, 60);
  assert.equal(s.axes.威厳, 100);
  assert.equal(evaluateCondition(range("axis", "威厳", 5), s.activeSession.working).ok, false);
  assert.equal(evaluateCondition(range("axis", "威厳", 3, 4), s.activeSession.working).ok, true);
  s = choose(s, "band");
  assert.equal(s.axes.威厳, 60, "no prestige recovery on the day it was reduced");
});
check("dignity recovery never raises rank, and independent caps are removed", () => {
  let s = throughText(begin(fresh(), "debug-axes"));
  s = step(s, { type: "choose", choiceId: "dignity" });
  assert.equal(s.activeSession.working.axes.品位, 60);
  assert.equal("dignityCap" in s.activeSession.working, false);
  s = choose(s, "normal");
  assert.equal(s.axes.品位, 60);
  assert.equal("capDrop" in s.activeSession.outcome, false);
  assert.deepEqual(s.activeSession.outcome.choiceAxisMoves, [{ axis: "品位", before: 100, after: 60, amount: 40 }]);
  s = ack(s);
  s.axes.品位 = 45;
  s = choose(choose(begin(s, "debug-axes"), "recover"), "normal");
  assert.deepEqual(s.activeSession.outcome.choiceAxisMoves, [{ axis: "品位", before: 45, after: 60, amount: 15 }]);
  assert.equal(s.axes.品位, 60);
  assert(validateEffects({ dignityCapDrop: 10 }).length, "removed effect is rejected, never silently applied");
});
check("A09: repeated choice, stale revision, finalization and acknowledgement cannot duplicate rewards", () => {
  let s = throughText(begin(fresh(), "debug-training"));
  const c = issue(s, { type: "choose", choiceId: "charm" });
  const chosen = transition(s, c).state;
  assert(transition(chosen, c).error);
  s = throughText(chosen);
  const before = { money: s.money, xp: s.growthXP.charm, day: s.day };
  assert(transition(s, issue(s, { type: "advance" })).error);
  const c2 = issue(s, { type: "acknowledge" });
  s = transition(s, c2).state;
  assert(transition(s, c2).error);
  assert.deepEqual({ money: s.money, xp: s.growthXP.charm, day: s.day }, before);
});
check("A09: storage failure leaves old state intact and retry is applied once", () => {
  const store = new MemoryStore();
  let s = fresh();
  store.setItem(SAVE_KEY, JSON.stringify(s));
  const cmd = { type: "begin", jobId: "debug-training" };
  store.fail = true;
  const failed = persistTransition(store, SAVE_KEY, s, cmd);
  assert(failed.error); assert.strictEqual(failed.state, s);
  assert.equal(parseDaily(store.getItem(SAVE_KEY)).activeSession, undefined);
  store.fail = false;
  s = persistTransition(store, SAVE_KEY, s, cmd).state;
  s = throughText(s); s = step(s, { type: "choose", choiceId: "charm" });
  const finish = issue(s, { type: "advance" });
  store.fail = true;
  const rejected = persistTransition(store, SAVE_KEY, s, finish);
  assert.strictEqual(rejected.state, s); assert.equal(s.growthXP.charm, 0);
  store.fail = false;
  s = persistTransition(store, SAVE_KEY, s, finish).state;
  assert.equal(s.growthXP.charm, 2);
  assert.equal(parseDaily(store.getItem(SAVE_KEY)).activeSession.phase, "result");
});
check("A10: text cursor, choice, chosen branch and result round-trip exactly", () => {
  let s = begin(fresh(), "debug-training");
  s = step(s, { type: "cursor", cursor: { line: 0, offset: 0, chars: 5 } });
  for (let i = 0; i < 4; i++) {
    assert.deepEqual(parseDaily(JSON.stringify(s)), s);
    if (i === 0) s = throughText(s);
    else if (i === 1) s = step(s, { type: "choose", choiceId: "knowledge" });
    else if (i === 2) s = throughText(s);
  }
});
check("A11: text advancement cannot skip a choice", () => {
  const s = throughText(begin(fresh(), "debug-training"));
  assert(transition(s, issue(s, { type: "advance" })).error);
});
check("A12: archive contains only reached branches and remains independent of replay-time stats", () => {
  let s = train(fresh(), "courage");
  s = choose(begin(s, "debug-challenge"), "courage");
  const store = new MemoryStore(), before = JSON.stringify(s);
  syncArchive(store, s.recordings); syncArchive(store, s.recordings);
  const archived = loadArchive(store);
  assert.equal(archived.length, s.recordings.length);
  const last = archived.at(-1);
  assert(last.lines.some(l => l.sceneId.endsWith(":courage")));
  assert(!last.lines.some(l => l.sceneId.endsWith(":knowledge")));
  assert.equal(JSON.stringify(s), before);
  assert(store.getItem(ADV_ARCHIVE_KEY));
});
check("A13: v14 migration preserves settled values, never guesses growth, leaves original save", () => {
  let old = freshDaily("old"); old = dailyAction(old, { type: "take", job: offersOf(old)[0].id }).state;
  old.saveVersion = 14;
  delete old.growthXP; delete old.storyFlags; delete old.capabilities; delete old.recordings; delete old.debugMode;
  const raw = JSON.stringify(old), migrated = migrateFromV14(raw);
  assert(migrated); assert.equal(migrated.money, old.money); assert.equal(migrated.day, old.day);
  assert.equal(migrated.activeSession, undefined);
  assert(growthDefinitions.every(d => migrated.growthXP[d.id] === 0));
  const store = new MemoryStore(); store.setItem("ikusei-prototype-save-v14", raw);
  assert.deepEqual(loadDaily(store).state, migrated);
  assert.equal(store.getItem("ikusei-prototype-save-v14"), raw);
  store.setItem(SAVE_KEY, "{}");
  assert.equal(loadDaily(store).state, null, "do not silently roll back to old data");
});
check("new format rejects missing/NaN growth, malformed sessions and invalid flags", () => {
  const s = fresh();
  for (const mutate of [
    s => delete s.growthXP.charm,
    s => s.growthXP.charm = NaN,
    s => s.activeSession = {},
    s => s.storyFlags = { x: 4 },
    s => s.capabilities = ["__proto__"],
  ]) { const copy = structuredClone(s); mutate(copy); assert.equal(parseDaily(JSON.stringify(copy)), null); }
});
check("A14: main scenario without extra rewards keeps the same daily settlement", () => {
  for (const seed of ["reg1", "reg2", "reg3"]) {
    const before = freshDaily(seed), job = jobs.find(j => j.id === "debug-challenge");
    const expected = dailyAction(before, { type: "take", job: job.id }).state;
    const actual = ack(choose(begin(before, job.id), "normal"));
    for (const key of ["money", "day", "chapter", "axes", "stamina", "relations", "unlocked", "doneOnce", "doneChapter", "recent", "awaitingSettlement", "debt"]) assert.deepEqual(actual[key], expected[key], key);
  }
});
check("A15: final-day job settles only after ADV completion and cannot settle twice", () => {
  const before = { ...fresh(), day: 14 };
  let s = throughText(begin(before, "debug-training"));
  assert.equal(s.awaitingSettlement, false);
  s = choose(s, "charm");
  assert.equal(s.awaitingSettlement, true);
  assert(dailyAction(s, { type: "settle" }).error);
  s = ack(s);
  s = dailyAction(s, { type: "settle" }).state;
  assert.equal(s.chapter, 2);
  assert(dailyAction(s, { type: "settle" }).error);
});
check("A17: low state still has an unconditional exit, without opening a locked route", () => {
  const s = choose(begin(fresh(), "debug-challenge"), "normal");
  assert.equal(s.activeSession.phase, "result");
  assert.deepEqual(s.storyFlags, {});
});
check("frozen scenario version survives story edits; incompatible node offers explicit recovery only", () => {
  const s = begin(fresh(), "debug-training");
  const oldVersion = scenarios[0].version;
  scenarios[0].version++;
  assert.equal(s.activeSession.scenario.version, oldVersion);
  assert.equal(sessionError(s.activeSession), undefined);
  scenarios[0].version = oldVersion;
  const broken = structuredClone(s); broken.activeSession.nodeId = "gone";
  assert(sessionError(broken.activeSession));
  const store = new MemoryStore();
  const restored = persistTransition(store, SAVE_KEY, broken, issue(broken, { type: "restore" }));
  assert.equal(restored.error, undefined);
  assert.equal(restored.state.money, s.money);
  assert.equal(restored.state.activeSession, undefined);
  assert(store.getItem(SAVE_KEY + "-recovery-backup"));
  const completed = choose(throughText(s), "charm");
  assert(transition(completed, issue(completed, { type: "restore" })).error);
});
check("fixed quote does not recalculate using relation gained during the session", () => {
  let s = throughText(begin(fresh(), "debug-axes"));
  const pay = s.activeSession.quote.pay;
  s = step(s, { type: "choose", choiceId: "bond" });
  assert.equal(s.activeSession.working.relations.marc, 1);
  s = choose(s, "normal");
  assert.equal(s.activeSession.outcome.pay, pay);
});
check("capability gate is active and entry flags are not replaced by replay records", () => {
  const s = freshDaily(), j = jobs.find(j => j.id === "ord-garden");
  assert.equal(isOpen(j, s), false);
  assert.equal(isOpen(j, { ...s, capabilities: ["garden-orders"] }), true);
  assert.equal(isOpen(jobs.find(j => j.id === "debug-followup-charm"), fresh()), false);
});
check("delete save does not revive earlier formats on reload", () => {
  const store = new MemoryStore();
  store.setItem(SAVE_KEY, JSON.stringify(fresh()));
  store.setItem("ikusei-prototype-save-v15", "{}");
  store.setItem("ikusei-prototype-save-v14", "{}");
  store.setItem("ikusei-prototype-save-v13", "{}");
  clearDaily(store);
  assert.equal(loadDaily(store).state, null);
  assert.equal(store.getItem("ikusei-prototype-save-v15"), null);
});
check("six dignity ranks include every boundary and rank zero starts below one", () => {
  for (const [value, rank] of [[100,5],[81,5],[80,4],[61,4],[60,3],[41,3],[40,2],[21,2],[20,1],[1,1],[0.99,0],[0,0]])
    assert.equal(dignityRank(value), rank, String(value));
  assert.throws(() => dignityRank(NaN));
  for (let value = 0; value <= 100; value++) for (let delta = -100; delta <= 100; delta++) {
    const after = changeDignity(value, delta);
    assert(after >= 0 && after <= 100);
    assert(dignityRank(after) <= dignityRank(value), `${value} + ${delta}`);
    if (delta >= 0) assert(after >= value);
  }
});
check("daily recovery and ADV rewards cannot escape any of the six bands", () => {
  for (const value of [0,1,19,20,21,39,40,41,59,60,61,79,80,81,99,100]) {
    const before = fresh(); before.axes = { 貞操: value, 品位: value, 威厳: value };
    const rested = dailyAction(before, { type: "rest" }).state;
    assert.equal(rested.axes.貞操, value, "chastity has no automatic daily recovery");
    assert.equal(rested.axes.品位, changeDignity(value, 6));
    assert.equal(rested.axes.威厳, changeDignity(value, 2));
    const done = choose(choose(begin(before, "debug-axes"), "recover"), "normal");
    for (const axis of ["貞操", "品位", "威厳"]) assert.equal(done.axes[axis], dignityRank(value) * 20);
    assert.deepEqual(parseDaily(JSON.stringify(done)), done);
  }
});
check("request and ADV gates use ranks, never hidden point thresholds inside a rank", () => {
  const s = freshDaily();
  const job = { ...jobs.find(j => j.id === "ledger"), needs: { 品位: 3 }, opensBelow: undefined };
  for (const value of [41,45,60]) {
    s.axes.品位 = value;
    assert.equal(isOpen(job, s), true);
    assert.equal(evaluateCondition(range("axis", "品位", 3, 3), s).ok, true);
  }
  s.axes.品位 = 40;
  assert.equal(isOpen(job, s), false);
  assert.equal(evaluateCondition(range("axis", "品位", 3), s).ok, false);
  assert(validateCondition(range("axis", "品位", 6)).length);
  assert(validateCondition(range("axis", "品位", 2.5)).length);
  const zeroJob = { ...job, needs: {}, opensBelow: { 品位: 0 } };
  s.axes.品位 = 1; assert.equal(isOpen(zeroJob, s), false);
  s.axes.品位 = 0; assert.equal(isOpen(zeroJob, s), true);
});
function oldV15(current) {
  const old = structuredClone(current);
  old.saveVersion = 15; old.dignityCap = 90;
  if (old.activeSession) {
    for (const name of ["entrySnapshot", "working"]) {
      old.activeSession[name].saveVersion = 15;
      old.activeSession[name].dignityCap = 90;
    }
    if (old.activeSession.outcome) old.activeSession.outcome.capDrop = 10;
  }
  return old;
}
check("v15 mid-choice migration removes caps, preserves applied effects and resumes once", () => {
  const before = step(throughText(begin(fresh(), "debug-axes")), { type: "choose", choiceId: "dignity" });
  const old = oldV15(before);
  old.activeSession.job.needs = { 品位: 45 };
  old.activeSession.scenario.nodes.change.choices.find(c => c.id === "dignity").effects.dignityCapDrop = 10;
  old.activeSession.scenario.nodes.check.choices.find(c => c.id === "high").condition = range("axis", "威厳", 76);
  const raw = JSON.stringify(old), store = new MemoryStore();
  store.setItem("ikusei-prototype-save-v15", raw);
  let s = loadDaily(store).state;
  assert(s); assert.equal(s.saveVersion, 16);
  assert.equal(sessionError(s.activeSession), undefined);
  assert.equal(JSON.stringify(s).includes("dignityCap"), false);
  assert.equal(s.activeSession.working.axes.品位, 60);
  assert.equal(s.activeSession.choices.length, 1);
  assert.equal(s.activeSession.job.needs.品位, 3);
  assert.equal(s.activeSession.scenario.nodes.check.choices.find(c => c.id === "high").condition.min, 4);
  const quote = s.activeSession.quote.pay;
  s = choose(s, "normal");
  assert.equal(s.day, old.day + 1);
  assert.equal(s.money, old.money + quote);
  assert.equal(s.axes.品位, 60, "old chosen drop is not repeated; recovery stays in rank 3");
  assert.equal(store.getItem("ikusei-prototype-save-v15"), raw);
  store.setItem(SAVE_KEY, "{}");
  assert.equal(loadDaily(store).state, null, "broken v16 never falls back to v15");
});
check("completed v15 results migrate without replaying payouts or historical recovery", () => {
  const old = oldV15(choose(begin(fresh(), "debug-training"), "charm"));
  old.axes.品位 = 86; // already settled by the previous rules
  const migrated = migrateFromV15(JSON.stringify(old));
  assert(migrated); assert.equal(migrated.axes.品位, 86);
  assert.equal(migrated.activeSession.phase, "result");
  assert.equal("capDrop" in migrated.activeSession.outcome, false);
  const after = ack(migrated);
  for (const k of ["money", "axes", "day", "growthXP", "relations", "recordings"]) assert.deepEqual(after[k], old[k]);
});
console.log(count + " ADV engine checks passed");
