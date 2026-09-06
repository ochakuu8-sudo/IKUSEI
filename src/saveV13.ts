import { parseSave as parseLegacySave } from "./save";
import {
  chapterPeople,
  events,
  integer,
  locations,
  migrateChapter,
  projectLegacy,
  quests,
} from "./chapter";
import { axes, materialIds, recipes } from "./game";
import type {
  ChapterState,
  Condition,
  Effect,
  EventDefinition,
  Quest,
} from "./chapterTypes";
export const SAVE_KEY = "ikusei-prototype-save-v13";
export const UI_KEY = "ikusei-ui-v2";
export const OLD_KEYS = [12, 11, 10, 9, 8, 7].map(
  (v) => `ikusei-prototype-save-v${v}`,
);
const strings = (x: unknown): x is string[] =>
  Array.isArray(x) &&
  x.every((x) => typeof x === "string") &&
  new Set(x).size === x.length;
const record = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x);
const recipeIds = recipes.map((r) => r.id),
  personIds = chapterPeople.map((p) => p.id),
  placeIds = locations.map((p) => p.id),
  questIds = quests.map((q) => q.id);
const numbers = (v: unknown, ids: string[], max = Number.MAX_SAFE_INTEGER) =>
  record(v) &&
  Object.entries(v).every(([id, n]) => ids.includes(id) && integer(n, 0, max));
function validCondition(c: Condition) {
  return (
    c &&
    (["questCompleted", "recipeKnown", "eventOccurred"].includes(c.kind)
      ? "id" in c &&
        (c.kind === "questCompleted"
          ? questIds
          : c.kind === "recipeKnown"
            ? recipeIds
            : events.map((e) => e.id)
        ).includes(c.id as never)
      : "axis" in c &&
        ["axisMin", "axisMax"].includes(c.kind) &&
        axes.includes(c.axis) &&
        integer(c.value, 0, 100))
  );
}
function validEffect(e: Effect) {
  if (!e) return false;
  switch (e.kind) {
    case "learnRecipe":
      return recipeIds.includes(e.id as never);
    case "introducePerson":
      return personIds.includes(e.id);
    case "introducePlace":
      return placeIds.includes(e.id);
    case "enqueueEvent":
      return events.some((x) => x.id === e.id);
    case "grantMaterials":
      return numbers(e.items, materialIds);
    case "axisDelta":
      return axes.includes(e.axis) && integer(e.amount, -100, 100);
    case "dignityCapDelta":
      return integer(e.amount, -100, 100);
    default:
      return false;
  }
}
function validEvent(e: EventDefinition) {
  return (
    e &&
    typeof e.id === "string" &&
    integer(e.contentVersion) &&
    typeof e.title === "string" &&
    placeIds.includes(e.placeId) &&
    Array.isArray(e.lines) &&
    e.lines.length > 0 &&
    e.lines.every((l) => typeof l === "string") &&
    (e.imageId === null || typeof e.imageId === "string") &&
    Array.isArray(e.effects) &&
    e.effects.every(validEffect)
  );
}
function validQuest(q: Quest) {
  const window = (w: unknown) =>
    w === null ||
    (Array.isArray(w) &&
      w.length === 2 &&
      integer(w[0], 1, 84) &&
      integer(w[1], w[0], 84));
  return (
    q &&
    questIds.includes(q.id) &&
    integer(q.contentVersion) &&
    typeof q.title === "string" &&
    typeof q.normalResultText === "string" &&
    personIds.includes(q.personId) &&
    placeIds.includes(q.deliveryPlaceId) &&
    ["repeat", "contract"].includes(q.mode) &&
    integer(q.appearsDay, 1, 84) &&
    window(q.acceptWindow) &&
    window(q.deliveryWindow) &&
    (q.mode !== "contract" || (!!q.acceptWindow && !!q.deliveryWindow)) &&
    Array.isArray(q.requirements) &&
    q.requirements.length > 0 &&
    new Set(q.requirements.map((n) => n.recipeId)).size ===
      q.requirements.length &&
    q.requirements.every(
      (n) =>
        n &&
        recipeIds.includes(n.recipeId) &&
        integer(n.count, 1, 999) &&
        integer(n.baseUnitPrice) &&
        integer(n.minQuality, 0, 100),
    ) &&
    Array.isArray(q.introductionConditions) &&
    q.introductionConditions.every(validCondition) &&
    [
      q.staminaCost,
      q.qualityBonusBP,
      q.relationBasePoints,
      q.relationQualityBonusPoints,
      q.advanceMoney,
    ].every((n) => integer(n)) &&
    typeof q.applyMarketFatigue === "boolean" &&
    [q.onAcceptOnce, q.onFirstComplete, q.onEveryComplete].every(
      (es) => Array.isArray(es) && es.every(validEffect),
    )
  );
}
export function parseChapter(raw: string | null): ChapterState | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as ChapterState;
    if (
      !v ||
      v.saveVersion !== 13 ||
      typeof v.runId !== "string" ||
      !v.runId ||
      !integer(v.revision) ||
      v.contentVersion !== "ch1-integration-v1" ||
      !integer(v.rngState, 1, 4294967295)
    )
      return null;
    if (
      !numbers(v.recipeXP, recipeIds) ||
      !recipeIds.every((id) => integer(v.recipeXP[id])) ||
      !numbers(v.relationPoints, personIds, 10000) ||
      !personIds.every((id) => integer(v.relationPoints[id], 0, 10000)) ||
      !numbers(v.dailyRelationBest, personIds, 10000) ||
      !numbers(v.questCompletionCounts, questIds)
    )
      return null;
    if (
      !record(v.stockByQuality) ||
      Object.entries(v.stockByQuality).some(
        ([id, b]) =>
          !recipeIds.includes(id as never) ||
          !record(b) ||
          Object.entries(b).some(
            ([q, n]) =>
              !/^(0|[1-9]\d*)$/.test(q) || !integer(+q, 0, 100) || !integer(n),
          ),
      )
    )
      return null;
    if (["stock", "relations"].some((key) => key in v)) return null;
    for (const key of [
      "declinedQuests",
      "seenQuests",
      "introducedPeople",
      "introducedPlaces",
      "initialGrantKeys",
      "occurredEvents",
      "playedEvents",
    ] as const)
      if (!strings(v[key])) return null;
    if (
      !v.declinedQuests.every((id) => questIds.includes(id)) ||
      !v.seenQuests.every((id) => questIds.includes(id)) ||
      !v.introducedPeople.every((id) => personIds.includes(id)) ||
      !v.introducedPlaces.every((id) => placeIds.includes(id))
    )
      return null;
    if (
      !v.today ||
      !["worked", "relationGranted", "deliveries"].every(
        (key) =>
          Array.isArray(v.today[key as "worked"]) &&
          v.today[key as "worked"].every((id) => personIds.includes(id)),
      ) ||
      typeof v.today.publicWork !== "boolean" ||
      !integer(v.today.earned) ||
      !Array.isArray(v.recent) ||
      !v.recent.every((x) =>
        Array.isArray(x)
          ? x.every((id) => personIds.includes(id))
          : x === "none" || personIds.includes(x),
      )
    )
      return null;
    if (
      !Array.isArray(v.acceptedQuestContracts) ||
      new Set(v.acceptedQuestContracts.map((c) => c.questId)).size !==
        v.acceptedQuestContracts.length ||
      v.acceptedQuestContracts.some(
        (c) =>
          !c ||
          typeof c.id !== "string" ||
          !questIds.includes(c.questId) ||
          !integer(c.acceptedDay, 1, 84) ||
          !["active", "fulfilled", "cancelled", "defaulted"].includes(
            c.status,
          ) ||
          !validQuest(c.terms) ||
          c.terms.id !== c.questId ||
          c.terms.mode !== "contract" ||
          c.acceptedDay < c.terms.acceptWindow![0] ||
          c.acceptedDay > c.terms.acceptWindow![1] ||
          !Array.isArray(c.events) ||
          !c.events.every(validEvent),
      )
    )
      return null;
    if (
      v.acceptedQuestContracts.filter((c) => c.status === "active").length > 2
    )
      return null;
    if (
      !Array.isArray(v.eventQueue) ||
      new Set(v.eventQueue.map((e) => e.id)).size !== v.eventQueue.length ||
      v.eventQueue.some(
        (e) =>
          !e ||
          !v.occurredEvents.includes(e.id) ||
          v.playedEvents.includes(e.id) ||
          !integer(e.contentVersion) ||
          typeof e.title !== "string" ||
          !placeIds.includes(e.place) ||
          !Array.isArray(e.lines) ||
          !e.lines.length ||
          !e.lines.every((l) => typeof l === "string") ||
          !Array.isArray(e.changes) ||
          !e.changes.every((l) => typeof l === "string") ||
          (e.imageId !== null && typeof e.imageId !== "string"),
      )
    )
      return null;
    if (
      v.axes?.品位 > v.dignityCap ||
      !parseLegacySave(JSON.stringify(projectLegacy(v)))
    )
      return null;
    return v;
  } catch {
    return null;
  }
}
export function saveChapter(storage: Storage, s: ChapterState) {
  const raw = JSON.stringify(s);
  if (!parseChapter(raw))
    throw new Error(
      "保存データの整合性を確認できません。画面を閉じずにデータを保持してください。",
    );
  storage.setItem(SAVE_KEY, raw);
}
export function loadChapter(storage: Storage): {
  state: ChapterState | null;
  error?: string;
} {
  try {
    const current = storage.getItem(SAVE_KEY);
    if (current) {
      const state = parseChapter(current);
      return state
        ? { state }
        : {
            state: null,
            error:
              "v13の保存データに不整合があります。新規開始へ自動置換はしていません。",
          };
    }
    for (const key of OLD_KEYS) {
      const raw = storage.getItem(key);
      if (!raw) continue;
      const old = parseLegacySave(raw);
      if (!old)
        return {
          state: null,
          error: `${key}に不整合があります。元の保存は保持しています。`,
        };
      const next = migrateChapter(old);
      try {
        storage.setItem(`${key}-backup`, raw);
        saveChapter(storage, next);
      } catch {
        return {
          state: next,
          error:
            "旧保存の移行結果を保持しています。保存できるまで再試行してください。",
        };
      }
      return { state: next };
    }
    return { state: null };
  } catch {
    return { state: null, error: "保存領域を読み込めませんでした。" };
  }
}
