import fixture from "./content/chapter1.json";
import {
  initialState,
  recipes,
  places,
  people,
  materialIds,
  materialOf,
  placeOpen,
  type GameState,
  type MaterialId,
  type RecipeId,
  type PersonId,
} from "./game";
import { supportOffers } from "./content/support";
import type {
  Allocation,
  ChapterAction,
  ChapterOutcome,
  ChapterState,
  Condition,
  Effect,
  EventDefinition,
  Location,
  Quest,
  Stock,
} from "./chapterTypes";
import type { Action, ActionOutcome } from "./engine";
export type {
  ChapterState,
  ChapterAction,
  ChapterOutcome,
  Quest,
  Allocation,
} from "./chapterTypes";
export const rules = fixture.rules;
export const quests = fixture.quests as Quest[];
export const events = fixture.events as EventDefinition[];
export const chapterPeople = [
  ...fixture.people,
  ...people
    .filter((p) => !fixture.people.some((n) => n.id === p.id))
    .map((p) => ({
      id: p.id,
      name: p.name,
      defaultPlaceId: p.place,
      introducedAtStart: false,
    })),
];
export const locations: Location[] = [
  ...(fixture.places as Location[]),
  ...places
    .filter((p) => !fixture.places.some((n) => n.id === p.id))
    .map((p) => ({
      id: p.id,
      name: p.name,
      kind: p.kind,
      map: { x: 50, y: 50 },
      introducedAtStart: false,
      accessConditions: [],
      staminaCost: p.gatherStamina,
      majorDrops: p.gathers
        ? Object.entries(p.gathers).map(([id, n]) => ({
            materialId: id as MaterialId,
            min: n!,
            max: n!,
          }))
        : undefined,
      prices: p.sells
        ? Object.fromEntries(p.sells.map((id) => [id, materialOf(id).buy]))
        : undefined,
    })),
];
export const chapterRecipes = recipes.map((r) => {
  const f = fixture.recipes.find((x) => x.id === r.id);
  return { ...r, ...(f ? { needs: f.needs, stamina: f.staminaCost } : {}) };
});
export const recipeName = (id: string) =>
  chapterRecipes.find((r) => r.id === id)?.name ?? id;
export const personName = (id: string) =>
  chapterPeople.find((p) => p.id === id)?.name ?? id;
export const locationName = (id: string) =>
  locations.find((p) => p.id === id)?.name ?? id;
export const dayOf = (s: ChapterState) => (s.chapter - 1) * 14 + s.day;
export const dateOf = (d: number) =>
  `第${Math.floor((d - 1) / 14) + 1}章${((d - 1) % 14) + 1}日`;
export const integer = (
  n: unknown,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
): n is number =>
  typeof n === "number" && Number.isSafeInteger(n) && n >= min && n <= max;
const ensure = (ok: unknown, message: string): void => {
  if (!ok) throw new Error(message);
};
export const levelForXP = (xp: number) =>
  rules.levelThresholds.filter((x) => xp >= x).length;
export const qualityForRecipe = (s: ChapterState, id: RecipeId) =>
  rules.qualityByLevel[levelForXP(s.recipeXP[id] ?? 0) - 1];
export const getStockTotal = (s: ChapterState, id: RecipeId) =>
  Object.values(s.stockByQuality[id] ?? {}).reduce((a, b) => a + b, 0);
export const recipeSource = (id: RecipeId) =>
  ({
    tisane: "最初から習得",
    balm: "商会の帳場へ薬湯を：初回納品",
    perfume: "書庫の夜仕事を支える薬湯：初回納品",
    philtre: "仲介窓口の契約受諾時",
    sleeper: "旧セーブで習得済みの場合に利用",
    tonic: "旧セーブで習得済みの場合に利用",
    abortive: "旧セーブで習得済みの場合に利用",
  })[id];
export function freshChapter(seed?: number): ChapterState {
  const {
    stock: _stock,
    relations: _relations,
    saveVersion: _version,
    ...base
  } = structuredClone(initialState);
  return {
    ...base,
    saveVersion: 13,
    runId: globalThis.crypto?.randomUUID?.() ?? `run-${Date.now()}`,
    revision: 0,
    contentVersion: fixture.id,
    rngState:
      (seed ??
        (globalThis.crypto?.getRandomValues(new Uint32Array(1))[0] ??
          Date.now()) >>> 0) ||
      1,
    stockByQuality: {},
    recipeXP: Object.fromEntries(recipes.map((r) => [r.id, 0])),
    relationPoints: Object.fromEntries(chapterPeople.map((p) => [p.id, 0])),
    dailyRelationBest: {},
    questCompletionCounts: {},
    acceptedQuestContracts: [],
    declinedQuests: [],
    initialGrantKeys: [],
    occurredEvents: [],
    seenQuests: [],
    eventQueue: [],
    introducedPeople: fixture.people
      .filter((p) => p.introducedAtStart)
      .map((p) => p.id),
    introducedPlaces: fixture.places
      .filter((p) => p.introducedAtStart)
      .map((p) => p.id),
  };
}
/** Temporary v12 projection only for legacy obligations; never stored as another inventory. */
export function projectLegacy(s: ChapterState): GameState {
  const {
    stockByQuality: _stock,
    recipeXP: _xp,
    relationPoints: _points,
    dailyRelationBest: _best,
    ...rest
  } = s;
  return {
    ...rest,
    saveVersion: 12,
    stock: Object.fromEntries(
      recipes.map((r) => [r.id, getStockTotal(s, r.id)]),
    ),
    relations: Object.fromEntries(
      people.map((p) => [
        p.id,
        rules.relationStageThresholds.filter(
          (t) => (s.relationPoints[p.id] ?? 0) >= t,
        ).length - 1,
      ]),
    ),
    today: {
      ...s.today,
      worked: s.today.worked.filter((x) =>
        people.some((p) => p.id === x),
      ) as PersonId[],
      relationGranted: s.today.relationGranted.filter((x) =>
        people.some((p) => p.id === x),
      ) as PersonId[],
      deliveries: s.today.deliveries.filter((x) =>
        people.some((p) => p.id === x),
      ) as PersonId[],
    },
    recent: s.recent.map((x) =>
      Array.isArray(x)
        ? x.filter((id) => people.some((p) => p.id === id))
        : people.some((p) => p.id === x)
          ? x
          : "none",
    ),
    eventQueue: s.eventQueue.map((e) => ({
      ...e,
      place: places.some((p) => p.id === e.place) ? e.place : "guild",
    })),
  } as unknown as GameState;
}
export function migrateChapter(old: GameState): ChapterState {
  const fresh = freshChapter();
  const { stock, relations, saveVersion: _v, ...rest } = structuredClone(old);
  return {
    ...fresh,
    ...rest,
    saveVersion: 13,
    stockByQuality: Object.fromEntries(
      Object.entries(stock).map(([id, n]) => [id, { "40": n }]),
    ),
    relationPoints: {
      ...fresh.relationPoints,
      ...Object.fromEntries(
        Object.entries(relations).map(([id, n]) => [
          id,
          rules.relationStageThresholds[n],
        ]),
      ),
    },
    dailyRelationBest: Object.fromEntries(
      old.today.relationGranted.map((id) => [id, 10000]),
    ),
    introducedPeople: [
      ...new Set([
        ...fresh.introducedPeople,
        ...people.filter((p) => !p.requiresUnlock).map((p) => p.id),
        ...old.unlockedPeople,
      ]),
    ],
    introducedPlaces: [
      ...new Set([
        ...fresh.introducedPlaces,
        ...places.filter((p) => placeOpen(p, old)).map((p) => p.id),
        ...old.unlockedPlaces,
      ]),
    ],
    occurredEvents: [
      ...new Set([...old.playedEvents, ...old.eventQueue.map((e) => e.id)]),
    ],
    eventQueue: old.eventQueue.map((e) => ({
      ...e,
      contentVersion: 0,
      imageId: null,
      changes: [],
    })),
  };
}
export function conditionReason(s: ChapterState, c: Condition): string | null {
  switch (c.kind) {
    case "questCompleted":
      return (s.questCompletionCounts[c.id] ?? 0) > 0
        ? null
        : "前提の依頼をまだ完了していません";
    case "recipeKnown":
      return s.known.includes(c.id as RecipeId)
        ? null
        : `${recipeName(c.id)}の処方が必要です`;
    case "eventOccurred":
      return s.occurredEvents.includes(c.id)
        ? null
        : "前提の出来事がまだ発生していません";
    case "axisMin":
      return s.axes[c.axis] >= c.value
        ? null
        : `${c.axis}${c.value}以上が必要です（現在${s.axes[c.axis]}）`;
    case "axisMax":
      return s.axes[c.axis] <= c.value
        ? null
        : `${c.axis}${c.value}以下で利用できます（現在${s.axes[c.axis]}）`;
  }
}
export const evaluateConditions = (s: ChapterState, cs: Condition[]) =>
  cs.map((c) => conditionReason(s, c)).filter((x): x is string => !!x);
export function visitReason(s: ChapterState, id: string): string | null {
  const p = locations.find((p) => p.id === id);
  if (!p || !s.introducedPlaces.includes(id)) return "まだ紹介されていません";
  return evaluateConditions(s, p.accessConditions)[0] ?? null;
}
export const canVisit = (s: ChapterState, id: string) => !visitReason(s, id);
export const contractFor = (s: ChapterState, id: string) =>
  s.acceptedQuestContracts.find((c) => c.id === id || c.questId === id);
export const questFor = (s: ChapterState, id: string) =>
  contractFor(s, id)?.terms ?? quests.find((q) => q.id === id);
export function questReason(
  s: ChapterState,
  q: Quest,
  accept = false,
): string | null {
  if (s.ended || s.awaitingSettlement) return "章末精算または終了状態です";
  const c = contractFor(s, q.id);
  if (c) {
    if (c.status !== "active")
      return {
        fulfilled: "納品完了",
        cancelled: "取消済み",
        defaulted: "不履行",
      }[c.status];
    if (accept) return "受諾済みです";
    return null;
  }
  if (s.declinedQuests.includes(q.id)) return "辞退済みです";
  if (dayOf(s) < q.appearsDay) return "まだ受付前です";
  if (q.acceptWindow && dayOf(s) > q.acceptWindow[1]) return "受付終了";
  if (!s.introducedPeople.includes(q.personId))
    return "まだ紹介されていない相手です";
  const condition = evaluateConditions(s, q.introductionConditions)[0];
  if (condition) return condition;
  if (
    accept &&
    q.mode === "contract" &&
    s.acceptedQuestContracts.filter((c) => c.status === "active").length >=
      rules.maxActiveQuestContracts
  )
    return "同時に受諾できる契約は2件です。完了・取消後に枠が空きます";
  return null;
}
export function questVisible(s: ChapterState, q: Quest): boolean {
  return (
    !!contractFor(s, q.id) ||
    s.seenQuests.includes(q.id) ||
    s.declinedQuests.includes(q.id) ||
    (s.questCompletionCounts[q.id] ?? 0) > 0 ||
    (dayOf(s) >= q.appearsDay &&
      s.introducedPeople.includes(q.personId) &&
      !evaluateConditions(
        s,
        q.introductionConditions.filter(
          (c) => c.kind !== "axisMin" && c.kind !== "axisMax",
        ),
      ).length)
  );
}
export function questStatus(s: ChapterState, q: Quest): string {
  const c = contractFor(s, q.id);
  if (c?.status === "active")
    return q.deliveryWindow && dayOf(s) < q.deliveryWindow[0]
      ? "受諾済み・準備中"
      : "本日納品可能";
  const r = questReason(s, q);
  if (r) return r;
  return q.mode === "repeat"
    ? s.questCompletionCounts[q.id]
      ? "反復依頼・初回完了"
      : "反復依頼"
    : "紹介可能";
}
function operational(s: ChapterState) {
  ensure(!s.ended, "この育成は終了しています");
  ensure(!s.awaitingSettlement, "章末の精算を先に終えてください");
}
export function planBrew(s: ChapterState, id: RecipeId, quantity = 1) {
  const r = chapterRecipes.find((r) => r.id === id);
  let error: string | undefined;
  if (!r || !s.known.includes(id)) error = "習得済みの処方を選んでください";
  else if (!integer(quantity, 1, 99)) error = "制作数は1〜99の整数です";
  else if (s.ended || s.awaitingSettlement) error = "今は制作できません";
  else if (s.stamina < r.stamina * quantity)
    error = `スタミナが${r.stamina * quantity - s.stamina}不足。一日終了で回復します`;
  else if (
    Object.entries(r.needs).some(
      ([m, n]) => s.materials[m as MaterialId] < n! * quantity,
    )
  )
    error = "素材が不足しています";
  const produced: Record<string, number> = {};
  let xp = s.recipeXP[id] ?? 0;
  if (integer(quantity, 1, 99))
    for (let i = 0; i < quantity; i++) {
      const q = rules.qualityByLevel[levelForXP(xp) - 1];
      produced[q] = (produced[q] ?? 0) + 1;
      xp++;
    }
  return {
    error,
    produced,
    xp,
    stamina: (r?.stamina ?? 0) * quantity,
    materials: Object.fromEntries(
      Object.entries(r?.needs ?? {}).map(([m, n]) => [m, n! * quantity]),
    ) as Partial<Record<MaterialId, number>>,
  };
}
export function brewCapacity(s: ChapterState, id: RecipeId) {
  const r = chapterRecipes.find((r) => r.id === id);
  if (!r || !s.known.includes(id) || s.awaitingSettlement || s.ended) return 0;
  return Math.max(
    0,
    Math.min(
      99,
      Math.floor(s.stamina / r.stamina),
      ...Object.entries(r.needs).map(([m, n]) =>
        Math.floor(s.materials[m as MaterialId] / n!),
      ),
    ),
  );
}
export function gatherBrewRange(s: ChapterState, place: string, id: RecipeId) {
  const plan = quoteGather(s, place);
  return ["min", "max"].map((bound) => {
    const after = structuredClone(s);
    after.stamina -= plan.stamina;
    for (const d of plan.major)
      after.materials[d.materialId] += d[bound as "min" | "max"];
    return brewCapacity(after, id);
  });
}
export function referencePay(q: Quest, quality = 40) {
  return halfUp(
    q.requirements.reduce(
      (sum, n) => sum + BigInt(n.count) * BigInt(n.baseUnitPrice),
      0n,
    ) *
      (1000000n + BigInt(q.qualityBonusBP) * BigInt(quality)),
    1000000n,
  );
}
export function quoteGather(s: ChapterState, id: string) {
  const p = locations.find((p) => p.id === id);
  let error = visitReason(s, id) ?? undefined;
  if (!p?.majorDrops?.length) error = "採集できない場所です";
  if (s.ended || s.awaitingSettlement) error = "今は採集できません";
  if (s.stamina < (p?.staminaCost ?? 0))
    error = `スタミナが${(p?.staminaCost ?? 0) - s.stamina}不足しています`;
  return {
    error,
    major: p?.majorDrops ?? [],
    bonus: p?.bonusDrops ?? [],
    stamina: p?.staminaCost ?? 0,
  };
}
function random(s: ChapterState) {
  let x = s.rngState;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  s.rngState = x >>> 0;
  return s.rngState / 4294967296;
}
export function resolveGather(before: ChapterState, id: string) {
  const s = structuredClone(before);
  const p = quoteGather(s, id);
  ensure(!p.error, p.error ?? "");
  const gained: Partial<Record<MaterialId, number>> = {};
  for (const d of p.major)
    gained[d.materialId] =
      (gained[d.materialId] ?? 0) +
      d.min +
      Math.floor(random(s) * (d.max - d.min + 1));
  for (const d of p.bonus)
    if (random(s) < d.probabilityBP / 10000)
      gained[d.materialId] = (gained[d.materialId] ?? 0) + d.count;
  s.stamina -= p.stamina;
  for (const [m, n] of Object.entries(gained))
    s.materials[m as MaterialId] += n!;
  return { state: s, gained };
}
export function quoteBuy(
  s: ChapterState,
  id: string,
  basket: Partial<Record<MaterialId, number>>,
) {
  const p = locations.find((p) => p.id === id);
  const entries = Object.entries(basket);
  let error = visitReason(s, id) ?? undefined;
  if (s.ended || s.awaitingSettlement) error = "今は購入できません";
  if (
    !entries.some(([, n]) => n! > 0) ||
    entries.some(
      ([m, n]) =>
        !integer(n, 0, 999) || p?.prices?.[m as MaterialId] === undefined,
    )
  )
    error = "この店の取扱品と数量を確認してください";
  const cost = entries.reduce(
    (a, [m, n]) => a + (p?.prices?.[m as MaterialId] ?? 0) * n!,
    0,
  );
  if (cost > s.money) error = `資金が${cost - s.money}G不足しています`;
  return { error, cost, moneyAfter: s.money - cost };
}
const halfUp = (n: bigint, d: bigint) => Number((2n * n + d) / (2n * d));
export function allocateDelivery(
  s: ChapterState,
  ids: string[],
  priority: "high" | "low" = "high",
): Allocation {
  const available = structuredClone(s.stockByQuality);
  const allocation: Allocation = {};
  for (const id of [...new Set(ids)].sort()) {
    const q = questFor(s, id);
    if (!q) continue;
    allocation[id] = {};
    for (const need of q.requirements) {
      let left = need.count;
      const buckets = available[need.recipeId] ?? {};
      const use: Record<string, number> = {};
      for (const key of Object.keys(buckets).sort((a, b) =>
        priority === "high" ? +b - +a : +a - +b,
      )) {
        if (+key < need.minQuality) continue;
        const n = Math.min(left, buckets[key]);
        if (n) {
          use[key] = n;
          buckets[key] -= n;
          left -= n;
        }
      }
      allocation[id][need.recipeId] = use;
    }
  }
  return allocation;
}
export function quoteDelivery(
  s: ChapterState,
  ids: string[],
  allocation?: Allocation,
  priority: "high" | "low" = "high",
) {
  const use = allocation ?? allocateDelivery(s, ids, priority);
  const lines: {
    id: string;
    quest: Quest;
    base: number;
    qualityBonus: number;
    pay: number;
    rate: number;
    score: number;
    relationGain: number;
    dailyBest: number;
    quality: number;
  }[] = [];
  const consumed: Stock = {};
  const virtualSales = [...s.today.deliveries];
  const best = { ...s.dailyRelationBest };
  const points = { ...s.relationPoints };
  let error: string | undefined;
  let stamina = 0;
  try {
    operational(s);
    ensure(
      ids.length &&
        new Set(ids.map((id) => questFor(s, id)?.id ?? id)).size === ids.length,
      "同じ依頼を重複選択できません",
    );
    for (const id of Object.keys(use))
      ensure(ids.includes(id), "選択外の品質割当があります");
    for (const id of [...ids].sort()) {
      const q = questFor(s, id);
      ensure(q, "依頼が見つかりません");
      if (!q) continue;
      const reason = questReason(s, q);
      ensure(!reason, reason ?? "");
      if (q.mode === "contract") {
        ensure(
          contractFor(s, id)?.status === "active",
          "先に契約を受諾してください",
        );
        ensure(
          q.deliveryWindow &&
            dayOf(s) >= q.deliveryWindow[0] &&
            dayOf(s) <= q.deliveryWindow[1],
          "納品期間外です",
        );
      } else
        ensure(
          canVisit(s, q.deliveryPlaceId),
          visitReason(s, q.deliveryPlaceId) ?? "",
        );
      const selected = use[id] ?? {};
      ensure(
        Object.keys(selected).every((r) =>
          q.requirements.some((n) => n.recipeId === r),
        ),
        "要求外の薬が選択されています",
      );
      let raw = 0n,
        base = 0,
        qualitySum = 0,
        count = 0;
      for (const need of q.requirements) {
        let total = 0;
        const buckets = selected[need.recipeId] ?? {};
        for (const [quality, n] of Object.entries(buckets)) {
          ensure(
            /^(0|[1-9]\d*)$/.test(quality) &&
              integer(+quality, 0, 100) &&
              +quality >= need.minQuality &&
              integer(n),
            "品質または数量が不正です",
          );
          total += n;
          qualitySum += +quality * n;
          count += n;
          base += need.baseUnitPrice * n;
          raw +=
            BigInt(need.baseUnitPrice) *
            BigInt(n) *
            (1000000n + BigInt(q.qualityBonusBP) * BigInt(+quality));
          const used = (consumed[need.recipeId] ??= {});
          used[quality] = (used[quality] ?? 0) + n;
          ensure(
            used[quality] <= (s.stockByQuality[need.recipeId]?.[quality] ?? 0),
            "品質別在庫が不足しています。他の依頼への割当も確認してください",
          );
        }
        ensure(
          total === need.count,
          `${recipeName(need.recipeId)}を${need.count}個、品質別に選んでください`,
        );
      }
      const history = [
        ...s.recent.slice(0, 3).flatMap((x) => (Array.isArray(x) ? x : [x])),
        ...virtualSales,
      ].filter((x) => x === q.personId).length;
      const rate = q.applyMarketFatigue
        ? rules.fatigueRatesBP[Math.min(3, history)]
        : 10000;
      const pay = halfUp(raw * BigInt(rate), 10000000000n);
      const score = halfUp(
        BigInt(q.relationBasePoints) * BigInt(count) * 100n +
          BigInt(q.relationQualityBonusPoints) * BigInt(qualitySum),
        BigInt(count) * 100n,
      );
      const dailyBest = best[q.personId] ?? 0;
      const relationGain = Math.max(
        0,
        Math.min(score - dailyBest, 10000 - (points[q.personId] ?? 0)),
      );
      best[q.personId] = Math.max(dailyBest, score);
      points[q.personId] = (points[q.personId] ?? 0) + relationGain;
      lines.push({
        id,
        quest: q,
        base,
        qualityBonus: Number(raw) / 1000000 - base,
        pay,
        rate,
        score,
        relationGain,
        dailyBest,
        quality: qualitySum / count,
      });
      stamina += q.staminaCost;
      if (q.applyMarketFatigue) virtualSales.push(q.personId);
    }
    ensure(
      s.stamina >= stamina,
      `スタミナが${stamina - s.stamina}不足しています`,
    );
  } catch (e) {
    error = e instanceof Error ? e.message : "納品できません";
  }
  const remaining = structuredClone(s.stockByQuality);
  for (const [r, b] of Object.entries(consumed))
    for (const [q, n] of Object.entries(b ?? {})) {
      const bucket = (remaining[r as RecipeId] ??= {});
      bucket[q] = (bucket[q] ?? 0) - n;
    }
  const warnings: string[] = [];
  const reserved: Partial<Record<RecipeId, number>> = {};
  for (const c of s.acceptedQuestContracts.filter(
    (c) =>
      c.status === "active" && !ids.includes(c.id) && !ids.includes(c.questId),
  ))
    for (const n of c.terms.requirements)
      reserved[n.recipeId] = (reserved[n.recipeId] ?? 0) + n.count;
  for (const [id, n] of Object.entries(reserved)) {
    const left = Object.values(remaining[id as RecipeId] ?? {}).reduce(
      (a, b) => a + b,
      0,
    );
    if (left < n!)
      warnings.push(
        `受諾済みの別契約用：${recipeName(id)}が納品後${n! - left}個不足します`,
      );
  }
  return {
    error,
    allocation: use,
    lines,
    stamina,
    pay: lines.reduce((a, b) => a + b.pay, 0),
    consumed,
    remaining,
    warnings,
  };
}
export function preparation(s: ChapterState, ids: string[]) {
  const needs: Partial<Record<RecipeId, number>> = {};
  for (const id of [...new Set(ids.map((id) => questFor(s, id)?.id ?? id))]) {
    const q = questFor(s, id);
    if (q)
      for (const n of q.requirements)
        needs[n.recipeId] = (needs[n.recipeId] ?? 0) + n.count;
  }
  const missing: Partial<Record<RecipeId, number>> = {},
    materials: Partial<Record<MaterialId, number>> = {};
  for (const [id, n] of Object.entries(needs)) {
    const recipe = chapterRecipes.find((r) => r.id === id)!;
    const left = Math.max(0, n! - getStockTotal(s, recipe.id));
    missing[recipe.id] = left;
    for (const [m, k] of Object.entries(recipe.needs))
      materials[m as MaterialId] =
        (materials[m as MaterialId] ?? 0) + left * k!;
  }
  for (const m of materialIds)
    if (materials[m])
      materials[m] = Math.max(0, materials[m]! - s.materials[m]);
  return { needs, missing, materials };
}
export function effectLabels(
  effects: Effect[],
  catalog: EventDefinition[] = events,
): string[] {
  return effects.flatMap((e) => {
    switch (e.kind) {
      case "learnRecipe":
        return [`処方：${recipeName(e.id)}`];
      case "introducePerson":
        return [`紹介：${personName(e.id)}`];
      case "introducePlace":
        return [`場所：${locationName(e.id)}`];
      case "grantMaterials":
        return [
          `一回限り・返還不要の支給：${Object.entries(e.items)
            .map(([m, n]) => `${materialOf(m as MaterialId).name}×${n}`)
            .join("、")}`,
        ];
      case "axisDelta":
        return [`${e.axis} ${e.amount < 0 ? "−" : "＋"}${Math.abs(e.amount)}`];
      case "dignityCapDelta":
        return [`品位上限 ${e.amount < 0 ? "−" : "＋"}${Math.abs(e.amount)}`];
      case "enqueueEvent":
        return [
          `出来事：${catalog.find((x) => x.id === e.id)?.title ?? e.id}`,
          ...effectLabels(
            catalog.find((x) => x.id === e.id)?.effects ?? [],
            [],
          ),
        ];
    }
  });
}
function applyEffects(
  s: ChapterState,
  list: Effect[],
  notices: string[],
  catalog: EventDefinition[] = events,
) {
  for (const e of list) {
    switch (e.kind) {
      case "learnRecipe":
        if (!s.known.includes(e.id as RecipeId)) {
          s.known.push(e.id as RecipeId);
          notices.push(`処方を習得：${recipeName(e.id)}`);
        }
        break;
      case "grantMaterials":
        for (const [m, n] of Object.entries(e.items))
          s.materials[m as MaterialId] += n!;
        notices.push(...effectLabels([e]));
        break;
      case "introducePerson":
        if (!s.introducedPeople.includes(e.id)) {
          s.introducedPeople.push(e.id);
          notices.push(`紹介：${personName(e.id)}`);
        }
        break;
      case "introducePlace":
        if (!s.introducedPlaces.includes(e.id)) {
          s.introducedPlaces.push(e.id);
          notices.push(`場所が開きました：${locationName(e.id)}`);
        }
        break;
      case "axisDelta": {
        const before = s.axes[e.axis];
        s.axes[e.axis] = Math.max(0, Math.min(100, before + e.amount));
        if (e.axis === "威厳" && e.amount < 0) s.today.publicWork = true;
        notices.push(`${e.axis} ${before}→${s.axes[e.axis]}`);
        break;
      }
      case "dignityCapDelta": {
        const before = s.dignityCap;
        s.dignityCap = Math.max(0, Math.min(100, before + e.amount));
        notices.push(`品位上限 ${before}→${s.dignityCap}`);
        break;
      }
      case "enqueueEvent":
        if (!s.occurredEvents.includes(e.id)) {
          const event = catalog.find((x) => x.id === e.id);
          ensure(event, "出来事の定義が見つかりません");
          if (event) {
            s.occurredEvents.push(event.id);
            const changes: string[] = [];
            applyEffects(s, event.effects, changes, catalog);
            notices.push(...changes);
            s.eventQueue.push({
              id: event.id,
              title: event.title,
              contentVersion: event.contentVersion,
              place: event.placeId,
              lines: [...event.lines],
              imageId: event.imageId,
              changes,
            });
          }
        }
        break;
    }
  }
  s.axes.品位 = Math.min(s.axes.品位, s.dignityCap);
}
type LegacyRunner = (s: GameState, a: Action) => ActionOutcome;
export function chapterAction(
  before: ChapterState,
  action: ChapterAction,
  legacy: LegacyRunner,
): ChapterOutcome {
  const s = structuredClone(before),
    notices: string[] = [];
  let title = "操作完了";
  try {
    ensure(
      action.expectedRevision === undefined ||
        action.expectedRevision === before.revision,
      "状態が変わりました。確認画面を開き直してください",
    );
    if (action.type === "read-event") {
      ensure(s.eventQueue[0]?.id === action.id, "未読イベントが見つかりません");
      s.eventQueue.shift();
      if (!s.playedEvents.includes(action.id)) s.playedEvents.push(action.id);
      title = "閲覧完了";
    } else if (action.type === "mark-seen") {
      for (const id of action.ids) {
        const q = quests.find((q) => q.id === id);
        if (q && questVisible(s, q) && !s.seenQuests.includes(id))
          s.seenQuests.push(id);
      }
      title = "依頼を確認";
    } else {
      ensure(
        !s.eventQueue.length,
        "未読の出来事を読了またはスキップしてください",
      );
      ensure(!s.ended, "この育成は終了しています");
      ensure(
        !s.awaitingSettlement ||
          action.type === "settle" ||
          action.type === "pay",
        "章末精算を先に終えてください",
      );
      if (action.type === "gather") {
        title = "採集";
        const resolved = resolveGather(s, action.place);
        Object.assign(s, resolved.state);
        notices.push(
          ...Object.entries(resolved.gained).map(
            ([m, n]) => `${materialOf(m as MaterialId).name} ＋${n}`,
          ),
        );
      } else if (action.type === "buy") {
        title = "購入";
        const p = quoteBuy(s, action.place, action.basket);
        ensure(!p.error, p.error ?? "");
        s.money -= p.cost;
        for (const [m, n] of Object.entries(action.basket))
          s.materials[m as MaterialId] += n!;
        notices.push(`${p.cost}Gで購入しました`);
      } else if (action.type === "brew") {
        title = "調合";
        const p = planBrew(s, action.recipe, action.quantity ?? 1);
        ensure(!p.error, p.error ?? "");
        s.stamina -= p.stamina;
        for (const [m, n] of Object.entries(p.materials))
          s.materials[m as MaterialId] -= n!;
        const bucket = (s.stockByQuality[action.recipe] ??= {});
        for (const [q, n] of Object.entries(p.produced))
          bucket[q] = (bucket[q] ?? 0) + n;
        s.recipeXP[action.recipe] = p.xp;
        notices.push(
          ...Object.entries(p.produced).map(
            ([q, n]) => `${recipeName(action.recipe)} 品質${q} ×${n}`,
          ),
        );
        if (levelForXP(p.xp) > levelForXP(before.recipeXP[action.recipe] ?? 0))
          notices.push(`制作Lv.${levelForXP(p.xp)}へ上がりました`);
      } else if (
        action.type === "quest-accept" ||
        action.type === "quest-decline"
      ) {
        const q = quests.find((q) => q.id === action.quest);
        ensure(q && q.mode === "contract", "契約が見つかりません");
        if (!q) throw new Error("契約不明");
        ensure(
          !questReason(s, q, action.type === "quest-accept"),
          questReason(s, q, action.type === "quest-accept") ?? "",
        );
        title = q.title;
        if (action.type === "quest-decline") {
          s.declinedQuests.push(q.id);
          notices.push("辞退しました。このプレイでは再受諾できません。");
        } else {
          ensure(
            q.acceptWindow &&
              dayOf(s) >= q.acceptWindow[0] &&
              dayOf(s) <= q.acceptWindow[1],
            "受付期間外です",
          );
          s.acceptedQuestContracts.push({
            id: `${s.runId}:${q.id}`,
            questId: q.id,
            acceptedDay: dayOf(s),
            status: "active",
            terms: structuredClone(q),
            events: structuredClone(events),
          });
          const key = `accept:${q.id}`;
          if (!s.initialGrantKeys.includes(key)) {
            s.initialGrantKeys.push(key);
            applyEffects(s, q.onAcceptOnce, notices);
          }
          notices.push(
            "契約条件を保存しました。受諾後に紹介条件が変わっても納品できます。",
          );
        }
      } else if (action.type === "quest-cancel") {
        const c = contractFor(s, action.id);
        ensure(c?.status === "active", "有効な契約だけ取消できます");
        c!.status = "cancelled";
        title = "契約取消";
        notices.push(
          "追加の返済義務はありません。支給済みの処方・残り材料は保持します。再受諾はできません。",
        );
      } else if (action.type === "quest-deliver") {
        const p = quoteDelivery(
          before,
          action.ids,
          action.allocation,
          action.priority,
        );
        ensure(!p.error, p.error ?? "");
        title = "納品";
        s.money += p.pay;
        s.stamina -= p.stamina;
        s.stockByQuality = p.remaining;
        for (const line of p.lines) {
          const q = line.quest;
          const first = !(s.questCompletionCounts[q.id] ?? 0);
          s.questCompletionCounts[q.id] =
            (s.questCompletionCounts[q.id] ?? 0) + 1;
          s.dailyRelationBest[q.personId] = Math.max(
            s.dailyRelationBest[q.personId] ?? 0,
            line.score,
          );
          s.relationPoints[q.personId] = Math.min(
            10000,
            (s.relationPoints[q.personId] ?? 0) + line.relationGain,
          );
          if (q.applyMarketFatigue) s.today.deliveries.push(q.personId);
          const c = contractFor(s, q.id);
          if (c) c.status = "fulfilled";
          notices.push(
            `${q.title}：${line.pay}G／平均品質${line.quality.toFixed(1)}／関係 ＋${(line.relationGain / 100).toFixed(2)}`,
          );
          if (first) applyEffects(s, q.onFirstComplete, notices, c?.events);
          applyEffects(s, q.onEveryComplete, notices, c?.events);
          if (!s.seenQuests.includes(q.id)) s.seenQuests.push(q.id);
        }
        for (const q of quests.filter(
          (q) => questVisible(before, q) && !contractFor(s, q.id),
        )) {
          const r = questReason(s, q);
          if (!questReason(before, q) && r) notices.push(`${q.title}：${r}`);
        }
        for (const c of s.acceptedQuestContracts.filter(
          (c) =>
            c.status === "active" &&
            evaluateConditions(s, c.terms.introductionConditions).length,
        ))
          notices.push(`${c.terms.title}：受諾済みのため納品権は有効です`);
      } else if (action.type === "end-day") {
        title = "一日を終える";
        for (const c of s.acceptedQuestContracts)
          if (c.status === "active" && c.terms.deliveryWindow![1] <= dayOf(s)) {
            c.status = "defaulted";
            notices.push(
              `${c.terms.title}：不履行。追加ペナルティはありません`,
            );
          }
        for (const o of s.obligations)
          if (o.status === "active" && o.due <= dayOf(s)) {
            o.status = "defaulted";
            notices.push(`${o.terms.title}：期限超過・未精算${o.outstanding}G`);
          }
        s.axes.品位 = Math.min(
          s.dignityCap,
          s.axes.品位 + rules.dailyDignityRecovery,
        );
        if (!s.today.publicWork)
          s.axes.威厳 = Math.min(
            100,
            s.axes.威厳 + rules.dailyPrestigeRecoveryIfNoLoss,
          );
        s.recent = [[...s.today.deliveries], ...s.recent].slice(0, 3);
        s.today = {
          worked: [],
          relationGranted: [],
          publicWork: false,
          deliveries: [],
          earned: 0,
        };
        s.dailyRelationBest = {};
        if (s.day === 14) s.awaitingSettlement = true;
        else {
          s.day++;
          s.stamina = 100;
        }
        notices.push(
          s.awaitingSettlement
            ? "第一章以降の章末返済を確定してください"
            : "翌朝、スタミナ100に回復しました",
        );
      } else if (action.type === "settle") {
        ensure(s.awaitingSettlement, "まだ章末ではありません");
        title = "章末精算";
        const quota = rules.quotas[s.chapter - 1] + s.carryOver;
        const paid = Math.min(s.money, quota);
        const shortfall = quota - paid;
        const interest = Math.ceil((shortfall * rules.lateInterestBP) / 10000);
        s.money -= paid;
        s.debt = Math.max(0, s.debt - paid) + interest;
        s.carryOver = shortfall + interest;
        if (shortfall) {
          s.axes.威厳 = Math.max(0, s.axes.威厳 - 15);
          s.axes.品位 = Math.max(0, s.axes.品位 - 10);
        }
        notices.push(`返済${paid}G／不足${shortfall}G／利息${interest}G`);
        s.awaitingSettlement = false;
        if (s.chapter === 6) s.ended = true;
        else {
          s.chapter++;
          s.day = 1;
          s.stamina = 100;
        }
        s.dailyRelationBest = {};
      } else {
        if (action.type === "accept" || action.type === "decline") {
          ensure(
            supportOffers.some(
              (o) => o.id === action.offer && o.kind === "credit",
            ),
            "新規の特別依頼は依頼一覧から受諾してください",
          );
        }
        const projected = projectLegacy(s);
        const result = legacy(projected, action as Action);
        ensure(!result.error, result.error ?? "");
        const old = result.state;
        const {
          stock,
          relations,
          saveVersion: _v,
          today: _today,
          recent: _recent,
          eventQueue: _queue,
          ...rest
        } = old;
        Object.assign(s, rest);
        s.saveVersion = 13;
        for (const r of recipes) {
          let used = getStockTotal(before, r.id) - (stock[r.id] ?? 0);
          if (used > 0) {
            const b = s.stockByQuality[r.id] ?? {};
            for (const q of Object.keys(b).sort((a, b) => +b - +a)) {
              const n = Math.min(used, b[q]);
              b[q] -= n;
              used -= n;
            }
          }
        }
        for (const p of people) {
          const difference = relations[p.id] - projected.relations[p.id];
          if (difference > 0)
            s.relationPoints[p.id] = Math.max(
              s.relationPoints[p.id] ?? 0,
              rules.relationStageThresholds[relations[p.id]],
            );
        }
        s.introducedPeople = [
          ...new Set([...s.introducedPeople, ...old.unlockedPeople]),
        ];
        s.introducedPlaces = [
          ...new Set([...s.introducedPlaces, ...old.unlockedPlaces]),
        ];
        s.today.publicWork ||= old.today.publicWork;
        for (const e of old.eventQueue)
          if (!s.occurredEvents.includes(e.id)) {
            s.occurredEvents.push(e.id);
            s.eventQueue.push({
              ...e,
              contentVersion: 0,
              imageId: null,
              changes: [],
            });
          }
        title = result.result?.title ?? "契約管理";
        notices.push(
          result.result?.narrative ?? "約束を更新しました",
          ...(result.result?.notices ?? []),
        );
      }
    }
    if (action.type !== "end-day" && s.money > before.money)
      s.today.earned += s.money - before.money;
    s.revision = before.revision + 1;
    s.history.push({
      day: dayOf(before),
      kind: action.type,
      target:
        "quest" in action ? action.quest : "id" in action ? action.id : title,
    });
    s.log = [...notices, ...s.log].slice(0, 30);
    for (const [id, b] of Object.entries(s.stockByQuality)) {
      for (const [q, n] of Object.entries(b ?? {})) if (!n) delete b![q];
      if (!Object.keys(b ?? {}).length) delete s.stockByQuality[id as RecipeId];
    }
    ensure(integer(s.money), "所持金が上限を超えました");
    ensure(
      Object.values(s.materials).every((n) => integer(n)),
      "素材数が不正です",
    );
    return { state: s, notices, title };
  } catch (e) {
    return {
      state: before,
      error: e instanceof Error ? e.message : "操作できません",
      notices: [],
      title,
    };
  }
}
