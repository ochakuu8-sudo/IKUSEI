import assert from "node:assert/strict";
import {
  freshChapter,
  chapterRecipes,
  quoteGather,
  planBrew,
  quoteDelivery,
  migrateChapter,
  getStockTotal,
  quests,
} from "@game/chapter";
import { performAction } from "@game/engine";
import { parseChapter } from "@game/saveV13";
import { initialState } from "@game/game";
import { legacyOffers } from "@game/content/support";
let s = freshChapter(1),
  steps = 0;
function act(action) {
  const out = performAction(s, action);
  assert.equal(out.error, undefined, `${JSON.stringify(action)}: ${out.error}`);
  s = out.state;
  assert(
    parseChapter(JSON.stringify(s)),
    `save roundtrip after ${action.type}`,
  );
  steps++;
  while (s.eventQueue.length) {
    const read = performAction(s, {
      type: "read-event",
      id: s.eventQueue[0].id,
    });
    assert(!read.error);
    s = read.state;
  }
  return out;
}
const end = () => act({ type: "end-day" }),
  brew = (recipe, quantity) => act({ type: "brew", recipe, quantity }),
  deliver = (id) => act({ type: "quest-deliver", ids: [id] }),
  accept = (quest) => act({ type: "quest-accept", quest });
function supply(recipe, n) {
  const r = chapterRecipes.find((r) => r.id === recipe),
    basket = {};
  for (const [m, k] of Object.entries(r.needs)) {
    const count = Math.max(0, k * n - s.materials[m]);
    if (count) basket[m] = count;
  }
  if (basket.ambergris) {
    act({
      type: "buy",
      place: "backmarket",
      basket: { ambergris: basket.ambergris },
    });
    delete basket.ambergris;
  }
  if (Object.keys(basket).length) act({ type: "buy", place: "arnaud", basket });
}
assert(parseChapter(JSON.stringify(s)), "fresh save");
const before = structuredClone(s);
quoteGather(s, "hill");
quoteGather(s, "hill");
assert.deepEqual(s, before);
act({ type: "gather", place: "hill" });
assert.equal(s.materials.rose, 2);
assert.equal(s.materials.wormwood, 2);
brew("tisane", 1);
deliver("c1-01");
end();
supply("tisane", 2);
brew("tisane", 2);
deliver("c1-02");
end();
supply("balm", 2);
brew("balm", 2);
deliver("c1-03");
end();
accept("c1-04");
supply("tisane", 4);
brew("tisane", 4);
end();
supply("balm", 2);
brew("balm", 2);
end();
supply("perfume", 2);
brew("perfume", 2);
end();
accept("c1-06");
end();
deliver("c1-04");
accept("c1-05");
end();
supply("balm", 2);
brew("balm", 2);
end();
deliver("c1-05");
accept("c1-07");
brew("philtre", 1);
deliver("c1-07");
assert.equal(s.axes.貞操, 88);
assert.equal(s.axes.品位, 80);
assert.equal(s.dignityCap, 95);
supply("philtre", 2);
brew("philtre", 2);
deliver("c1-08");
end();
assert.equal(s.axes.品位, 86);
deliver("c1-06");
end();
while (s.day < 14) end();
end();
act({ type: "settle" });
assert.equal(s.chapter, 2);
assert.equal(s.money, 2511);
assert.equal(Object.keys(s.questCompletionCounts).length, 8);
assert.equal(s.eventQueue.length, 0);
assert.equal(s.playedEvents.length, 8);
console.log(
  `PASS all eight quests through chapter settlement: ${steps} actions, cash ${s.money}G, eight events persisted`,
);
const v = structuredClone(initialState);
v.stock = { tisane: 3 };
v.money = 700;
v.relations.vernet = 2;
v.today.relationGranted = ["vernet"];
const migrated = migrateChapter(v);
assert.equal(getStockTotal(migrated, "tisane"), 3);
assert.equal(migrated.stockByQuality.tisane["40"], 3);
assert.equal(migrated.relationPoints.vernet, 6000);
assert.equal(migrated.dailyRelationBest.vernet, 10000);
assert(parseChapter(JSON.stringify(migrated)));
let old = performAction(
  initialState,
  { type: "accept", offer: "reservation" },
  legacyOffers,
).state;
const legacy = migrateChapter(old);
legacy.materials.rose = 4;
legacy.materials.wormwood = 2;
const made = performAction(legacy, {
  type: "brew",
  recipe: "tisane",
  quantity: 2,
});
const delivered = performAction(made.state, {
  type: "fulfill",
  id: legacy.obligations[0].id,
  option: "standard",
});
assert(!delivered.error, delivered.error);
assert.equal(delivered.state.obligations[0].status, "fulfilled");
assert.equal(getStockTotal(delivered.state, "tisane"), 0);
assert(parseChapter(JSON.stringify(delivered.state)));
const credit = performAction(freshChapter(2), {
  type: "accept",
  offer: "supply-credit",
});
assert(!credit.error, credit.error);
assert(parseChapter(JSON.stringify(credit.state)));
const paidState = { ...credit.state, money: 300 };
const paid = performAction(paidState, {
  type: "pay",
  id: paidState.obligations[0].id,
});
assert(!paid.error);
assert.equal(paid.state.obligations[0].outstanding, 0);
assert(parseChapter(JSON.stringify(paid.state)));
console.log("PASS v12 migration, legacy fulfillment and credit settlement");
let x = freshChapter(1);
x.recipeXP.tisane = 2;
x.materials.rose = 8;
x.materials.wormwood = 4;
const plan = planBrew(x, "tisane", 4);
const bulk = performAction(x, { type: "brew", recipe: "tisane", quantity: 4 });
assert.deepEqual(plan.produced, { 40: 1, 50: 3 });
assert.deepEqual(bulk.state.stockByQuality.tisane, plan.produced);
assert.equal(bulk.state.recipeXP.tisane, 6);
x = freshChapter(1);
x.stockByQuality.tisane = { 40: 1, 60: 1 };
let low = performAction(x, {
  type: "quest-deliver",
  ids: ["c1-01"],
  priority: "low",
});
let next = low.state;
while (next.eventQueue.length)
  next = performAction(next, {
    type: "read-event",
    id: next.eventQueue[0].id,
  }).state;
const high = performAction(next, { type: "quest-deliver", ids: ["c1-01"] });
assert.equal(high.state.relationPoints.vernet, 280);
const blocked = performAction(x, {
  type: "brew",
  recipe: "tisane",
  quantity: 4,
});
assert(blocked.error);
assert.deepEqual(blocked.state, x);
const data = JSON.parse(JSON.stringify(s));
data.stockByQuality.tisane = { 101: 1 };
assert.equal(parseChapter(JSON.stringify(data)), null);
const original = quests.find((q) => q.id === "c1-01").qualityBonusBP;
const quote = quoteDelivery(x, ["c1-01"]);
assert.equal(quote.pay, 182);
assert.equal(quests.find((q) => q.id === "c1-01").qualityBonusBP, original);
console.log(
  "PASS batch quality, daily relationship top-up, atomic rejection and malformed-save rejection",
);
