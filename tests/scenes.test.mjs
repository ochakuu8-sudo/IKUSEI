import assert from "node:assert/strict";
import { sceneCatalog, sceneOf, catalogCounts, routeOfJob, routes } from "@game/scenes";
import { loadGallery, recordScenes, clearGallery, GALLERY_KEY } from "@game/gallery";
import { jobs, people } from "@game/game";
import { dailyAction, freshDaily, offersOf } from "@game/daily";

let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log("PASS " + name); };

check("目録は依頼24件・関係21件・結末8件を漏れなく持つ", () => {
  const byKind = {};
  for (const e of sceneCatalog) byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
  assert.equal(byKind["依頼"], jobs.length);
  assert.equal(byKind["関係"], people.length * 3);
  assert.equal(byKind["結末"], 8, "§8の結末は8種");
  assert.equal(sceneCatalog.length, jobs.length + people.length * 3 + 8);
});

check("idは一意で、すべて引ける", () => {
  const ids = sceneCatalog.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert(sceneOf(id));
  assert.equal(sceneOf("なにこれ"), undefined);
});

check("依頼はすべて筋に振り分けられ、CGの発注名を持つ", () => {
  for (const e of sceneCatalog) {
    assert(routes.includes(e.route), `${e.id} の筋が不正: ${e.route}`);
    assert(e.image.endsWith(".png"), e.id);
    assert(e.title && e.hint, e.id);
  }
  const seals = new Set(sceneCatalog.map((e) => e.image));
  assert.equal(seals.size, sceneCatalog.length, "CGの発注名が重複している");
});

check("依頼の筋は、主に削る軸で決まる", () => {
  const escort = jobs.find((j) => j.id === "escort"); // 威厳−12・貞操−8
  assert.equal(routeOfJob(escort), "貞操", "軸の並び順で最初に当たるものを主軸にする");
  const ledger = jobs.find((j) => j.id === "ledger"); // 代償ゼロ
  assert.equal(routeOfJob(ledger), "清廉");
});

check("結末は本文がまだ無く、回想から再生できない", () => {
  const endings = sceneCatalog.filter((e) => e.kind === "結末");
  for (const e of endings) assert.equal(e.lines.length, 0);
  const { written, total } = catalogCounts([]);
  assert.equal(total - written, endings.length, "未着手は結末8件だけ");
});

check("依頼と関係の場面には本文がある", () => {
  for (const e of sceneCatalog.filter((x) => x.kind !== "結末"))
    assert(e.lines.length > 0, e.id);
});

check("行動すると、見た場面のidが結果に載る", () => {
  const s = freshDaily("g1");
  const job = offersOf(s)[0];
  const out = dailyAction(s, { type: "take", job: job.id });
  assert(out.outcome.sceneIds.includes(`job:${job.id}`));
  for (const id of out.outcome.sceneIds) assert(sceneOf(id), id);
  /* 関係が上がった日は、その一言も回収できる。 */
  if (out.outcome.relationUp)
    assert(out.outcome.sceneIds.some((id) => id.startsWith("bond:")));
});

check("回想はプレイの保存とは別に貯まり、知らないidは拾わない", () => {
  const store = new Map();
  const fake = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  };
  let seen = loadGallery(fake);
  assert.deepEqual(seen, []);
  seen = recordScenes(fake, seen, ["job:ledger", "でたらめ", "job:ledger"]);
  assert.deepEqual(seen, ["job:ledger"]);
  assert.deepEqual(loadGallery(fake), ["job:ledger"]);
  const same = recordScenes(fake, seen, ["job:ledger"]);
  assert.equal(same, seen, "追加が無ければ保存し直さない");
  fake.setItem(GALLERY_KEY, "こわれた");
  assert.deepEqual(loadGallery(fake), []);
  clearGallery(fake);
  assert.equal(fake.getItem(GALLERY_KEY), null);
});

check("回収率は筋ごとに数えられる", () => {
  const { rows, seen, total } = catalogCounts(["job:ledger"]);
  assert.equal(seen, 1);
  assert.equal(total, sceneCatalog.length);
  const chaste = rows.filter((r) => r.entry.route === "貞操");
  assert(chaste.length > 0, "貞操の筋に場面がある");
});

console.log(`\n${passed} scene catalog checks passed`);
