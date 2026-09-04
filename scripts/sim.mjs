// 段階E：調剤ラインが入ったあとの「1章で稼げる額」を実測する。
// 正攻法＝尊厳を1点も払わない打ち方。これに対する比率で QUOTAS を引き直す。
import * as G from './game.built.mjs';

const CHAPTER_DAYS = G.CHAPTER_DAYS;

function clone(s) {
  return JSON.parse(JSON.stringify(s));
}

/** その日にできる「納品」候補。純利益ではなく単純な受取額で見る。 */
function deliverable(s, allowCost) {
  return G.jobs.filter((j) => G.isOpen(j, s) && G.hasStaminaFor(j, s) && G.hasStockFor(j, s))
    .filter((j) => allowCost || j.costs.length === 0)
    .map((j) => ({ job: j, pay: G.payWithRelation(j, s) }))
    .sort((a, b) => b.pay - a.pay);
}

/** いま調合できる処方のうち、まだ在庫が足りていない注文に効くもの。 */
function usefulBrew(s, allowCost) {
  const wanted = new Map();
  G.jobs.filter((j) => j.recipe && G.isOpen(j, s))
    .filter((j) => allowCost || j.costs.length === 0)
    .forEach((j) => {
      const need = (j.count ?? 1) - (s.stock[j.recipe] ?? 0);
      if (need > 0) wanted.set(j.recipe, Math.max(wanted.get(j.recipe) ?? 0, G.payWithRelation(j, s)));
    });
  return G.recipes.filter((r) => wanted.has(r.id) && G.canBrew(r, s))
    .map((r) => ({ recipe: r, worth: wanted.get(r.id) }))
    .sort((a, b) => b.worth - a.worth);
}

/** 素材が足りない注文のために、どこへ行くのが一番効くか。 */
function bestGather(s, allowCost) {
  const short = new Set();
  G.jobs.filter((j) => j.recipe && G.isOpen(j, s))
    .filter((j) => allowCost || j.costs.length === 0)
    .forEach((j) => {
      const r = G.recipeOf(j.recipe);
      if (!s.known.includes(r.id)) return;
      if ((s.stock[j.recipe] ?? 0) >= (j.count ?? 1)) return;
      G.materialIds.forEach((m) => { if (s.materials[m] < (r.needs[m] ?? 0)) short.add(m); });
    });
  if (!short.size) return null;
  return G.gatherPlaces(s)
    .filter((p) => s.stamina >= (p.gatherStamina ?? 20))
    .map((p) => ({ place: p, hits: G.gatherYield(p).filter((g) => short.has(g.id)).length }))
    .filter((p) => p.hits > 0)
    .sort((a, b) => b.hits - a.hits)[0]?.place ?? null;
}

function applyDay(s, patch, worked, publicWork) {
  const next = { ...s, ...patch };
  next.axes = { ...s.axes, ...(patch.axes ?? {}) };
  if (!publicWork) next.axes.威厳 = Math.min(100, next.axes.威厳 + 2);
  next.axes.品位 = Math.min(next.axes.品位, patch.dignityCap ?? s.dignityCap);
  next.recent = [worked, ...s.recent].slice(0, 6);
  next.day = s.day + 1;
  return next;
}

function takeJob(s, job) {
  const pay = G.payWithRelation(job, s);
  const axes = { ...s.axes };
  job.costs.forEach((c) => { axes[c.axis] = Math.max(0, axes[c.axis] - c.amount); });
  const cap = G.capDropOf(job);
  const relBefore = s.relations[job.person];
  const relAfter = Math.min(3, relBefore + (job.bond ?? 1));
  const stock = { ...s.stock };
  if (job.recipe) stock[job.recipe] = (stock[job.recipe] ?? 0) - (job.count ?? 1);
  const learned = [
    ...G.recipesTaughtBy(job.person, relBefore, relAfter, s.known),
    ...(job.teaches && !s.known.includes(job.teaches) ? [job.teaches] : []),
  ];
  return applyDay(s, {
    money: s.money + pay, stamina: s.stamina - job.stamina, axes,
    dignityCap: Math.max(0, s.dignityCap - cap),
    relations: { ...s.relations, [job.person]: relAfter },
    stock, known: [...s.known, ...learned],
  }, job.person, job.costs.some((c) => c.axis === '威厳'));
}

function doGather(s, place) {
  const materials = { ...s.materials };
  G.gatherYield(place).forEach((g) => { materials[g.id] += g.amount; });
  return applyDay(s, { stamina: s.stamina - (place.gatherStamina ?? 20), materials }, 'none', false);
}

/** 顔を出して関係を進める。次の段階で処方を教わるなら、これが一番効く。 */
function worthNetwork(s) {
  if (s.money < G.NETWORK_COST || s.stamina < G.NETWORK_STAMINA) return null;
  return G.people.find((p) => {
    const rel = s.relations[p.id];
    if (rel >= 3) return false;
    return G.recipesTaughtBy(p.id, rel, rel + 1, s.known).length > 0;
  }) ?? null;
}

function doNetwork(s, person) {
  const before = s.relations[person.id];
  const after = Math.min(3, before + 1);
  const learned = G.recipesTaughtBy(person.id, before, after, s.known);
  return applyDay(s, {
    money: s.money - G.NETWORK_COST, stamina: s.stamina - G.NETWORK_STAMINA,
    relations: { ...s.relations, [person.id]: after },
    known: [...s.known, ...learned],
  }, 'none', false);
}

function doRest(s) {
  const after = Math.min(s.dignityCap, s.axes.品位 + 6);
  return applyDay(s, {
    stamina: Math.min(G.MAX_STAMINA, s.stamina + G.REST_RECOVERY),
    axes: { ...s.axes, 品位: after },
  }, 'none', false);
}

/** 1章まわす。allowCost=false が正攻法（尊厳を1点も払わない）。 */
function runChapter(state, allowCost) {
  let s = clone(state);
  const start = s.money;
  while (s.day <= CHAPTER_DAYS) {
    const d = deliverable(s, allowCost);
    const b = usefulBrew(s, allowCost);
    // 在庫があるなら納める。調合は日を使わないので、先に打てるだけ打つ。
    while (b.length && G.canBrew(b[0].recipe, s)) { s = G.brewOnce(s, b[0].recipe.id); b.shift(); }
    const d2 = deliverable(s, allowCost);
    if (d2.length) { s = takeJob(s, d2[0].job); continue; }
    // 処方が開くなら、顔を出すのが最優先（レシピは金では買えない）
    const n = worthNetwork(s);
    if (n && !allowCost) { s = doNetwork(s, n); continue; }
    const g = bestGather(s, allowCost);
    if (g) { s = doGather(s, g); continue; }
    if (d.length) { s = takeJob(s, d[0].job); continue; }
    if (n) { s = doNetwork(s, n); continue; }
    s = doRest(s);
  }
  return { earned: s.money - start, state: s };
}

function run(allowCost) {
  let s = clone(G.initialState);
  s.money = 0;
  const rows = [];
  for (let ch = 1; ch <= G.CHAPTERS; ch++) {
    s.chapter = ch; s.day = 1;
    const r = runChapter(s, allowCost);
    rows.push(r.earned);
    s = r.state;
    s.stamina = G.MAX_STAMINA;
    s.axes.威厳 = Math.min(100, s.axes.威厳 + 6);
  }
  return { rows, final: s };
}

const honest = run(false);
const fallen = run(true);
console.log('正攻法（尊厳を1点も払わない）章ごとの稼ぎ:', honest.rows.map((r) => Math.round(r)));
console.log('  合計', Math.round(honest.rows.reduce((a, b) => a + b, 0)));
console.log('  終了時の3軸', honest.final.axes, '品位上限', honest.final.dignityCap);
console.log('  覚えた処方', honest.final.known.join(','));
console.log('堕ちる（何でも受ける）章ごとの稼ぎ:', fallen.rows.map((r) => Math.round(r)));
console.log('  合計', Math.round(fallen.rows.reduce((a, b) => a + b, 0)));
console.log('  終了時の3軸', fallen.final.axes);
const total = honest.rows.reduce((a, b) => a + b, 0);
console.log('QUOTAS', G.QUOTAS.join(' / '), '計', G.TOTAL_DEBT);
console.log('達成率（正攻法の稼ぎ ÷ ノルマ）',
  G.QUOTAS.map((q, i) => Math.round(honest.rows[i] / q * 100) + '%').join(' → '));
console.log('清廉プレイの余り', Math.round(total - G.TOTAL_DEBT) + 'G');
