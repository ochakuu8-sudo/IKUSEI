import {
  initialState,
  materialIds,
  axes,
  people,
  places,
  recipes,
  jobs,
  personalRunKey,
  CHAPTERS,
  CHAPTER_DAYS,
  type GameState,
} from "./game";
import { emptySupportState } from "./supportTypes";
import { rewardValid } from "./rewards";
export const SAVE_KEY = "ikusei-prototype-save-v11";
export const V10_SAVE_KEY = "ikusei-prototype-save-v10";
export const V9_SAVE_KEY = "ikusei-prototype-save-v9";
export const PREVIOUS_SAVE_KEY = "ikusei-prototype-save-v8";
export const LEGACY_SAVE_KEY = "ikusei-prototype-save-v7";
/** v9以降は解禁と約束の形が同じ。v11は本日の納品回数だけを足している。 */
const tracked = (n: unknown) => n === 9 || n === 10 || n === 11;

/** v7は履歴や契約を捏造せず移行する。破損データはゲーム状態として使わない。 */
export function parseSave(raw: string | null): GameState | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    const number = (n: unknown, max = Number.MAX_SAFE_INTEGER) =>
      typeof n === "number" && Number.isSafeInteger(n) && n >= 0 && n <= max;
    if (
      !v ||
      typeof v !== "object" ||
      !number(v.chapter, CHAPTERS) ||
      v.chapter < 1 ||
      !number(v.day, CHAPTER_DAYS) ||
      v.day < 1
    )
      return null;
    if (
      !["money", "debt", "carryOver"].every((k) => number(v[k])) ||
      !number(v.stamina, 100) ||
      !number(v.dignityCap, 100)
    )
      return null;
    if (
      !axes.every((a) => number(v.axes?.[a], 100)) ||
      !people
        .filter((p) => !p.requiresUnlock || tracked(v.saveVersion))
        .every((p) => number(v.relations?.[p.id], 3)) ||
      !materialIds.every((id) => number(v.materials?.[id]))
    )
      return null;
    const recipeIds = recipes.map((r) => r.id);
    if (
      !v.stock ||
      Object.entries(v.stock).some(
        ([id, n]) =>
          !recipeIds.includes(id as (typeof recipeIds)[number]) || !number(n),
      )
    )
      return null;
    if (
      !Array.isArray(v.known) ||
      !v.known.every((id: never) => recipeIds.includes(id)) ||
      !Array.isArray(v.log) ||
      !v.log.every((x: unknown) => typeof x === "string") ||
      !Array.isArray(v.recent) ||
      !v.recent.every((id: string | string[]) =>
        Array.isArray(id)
          ? id.every((x) => people.some((p) => p.id === x))
          : id === "none" || people.some((p) => p.id === id),
      ) ||
      typeof v.ended !== "boolean" ||
      typeof v.awaitingSettlement !== "boolean"
    )
      return null;
    if (
      v.saveVersion !== undefined &&
      v.saveVersion !== 7 &&
      v.saveVersion !== 8 &&
      !tracked(v.saveVersion)
    )
      return null;
    if (v.saveVersion === 8 || tracked(v.saveVersion)) {
      if (
        !Array.isArray(v.obligations) ||
        !Array.isArray(v.capabilities) ||
        !v.capabilities.every((x: unknown) => typeof x === "string") ||
        !Array.isArray(v.history) ||
        !v.offerStates ||
        typeof v.offerStates !== "object"
      )
        return null;
      if (
        Object.values(v.offerStates).some(
          (x) => x !== "accepted" && x !== "declined",
        )
      )
        return null;
      const ids = new Set<string>();
      for (const o of v.obligations) {
        if (
          !o ||
          typeof o.id !== "string" ||
          ids.has(o.id) ||
          typeof o.offerId !== "string" ||
          !number(o.acceptedDay) ||
          !number(o.due, CHAPTERS * CHAPTER_DAYS) ||
          o.due < o.acceptedDay ||
          !number(o.outstanding) ||
          !number(o.extensions) ||
          !["active", "fulfilled", "cancelled", "defaulted"].includes(o.status)
        )
          return null;
        ids.add(o.id);
        const t = o.terms;
        if (
          !t ||
          typeof t.title !== "string" ||
          !people.some((p) => p.id === t.person) ||
          !["advance", "credit"].includes(t.kind) ||
          !number(t.totalPay) ||
          !number(t.money) ||
          t.totalPay < t.money ||
          !number(t.repayment) ||
          !number(t.extensionDays) ||
          !number(t.extensionLimit) ||
          !Array.isArray(t.options) ||
          !Array.isArray(t.unlocks) ||
          !t.unlocks.every((x: unknown) => typeof x === "string")
        )
          return null;
        if (
          t.schedule &&
          (!tracked(v.saveVersion) ||
            !number(t.schedule.appears) ||
            t.schedule.appears < 1 ||
            !number(t.schedule.closes) ||
            t.schedule.closes < t.schedule.appears ||
            !number(t.schedule.delivery, CHAPTERS * CHAPTER_DAYS) ||
            t.schedule.delivery <= t.schedule.closes ||
            o.due !== t.schedule.delivery ||
            t.extensionLimit !== 0 ||
            t.acceptDays !== 0 ||
            t.kind !== "advance" ||
            o.acceptedDay < t.schedule.appears ||
            o.acceptedDay > t.schedule.closes)
        )
          return null;
        if (
          t.rewards &&
          (!Array.isArray(t.rewards) || !t.rewards.every(rewardValid))
        )
          return null;
        for (const c of t.options) {
          if (
            !c ||
            typeof c.id !== "string" ||
            typeof c.label !== "string" ||
            !recipeIds.includes(c.recipe) ||
            !number(c.count) ||
            c.count < 1 ||
            !number(c.days) ||
            c.days < 1 ||
            !number(c.stamina) ||
            !Array.isArray(c.unlocks) ||
            !c.unlocks.every((x: unknown) => typeof x === "string")
          )
            return null;
          if (t.schedule && c.days !== 1) return null;
          if (
            c.costs &&
            (!Array.isArray(c.costs) ||
              c.costs.some(
                (cost: { axis: (typeof axes)[number]; amount: number }) =>
                  !axes.includes(cost.axis) || !number(cost.amount),
              ))
          )
            return null;
        }
      }
      if (
        v.history.some(
          (h: { day: number; kind: string; target: string; choice?: string }) =>
            !h ||
            !number(h.day) ||
            typeof h.kind !== "string" ||
            typeof h.target !== "string" ||
            (h.choice !== undefined && typeof h.choice !== "string"),
        )
      )
        return null;
    }
    const next: GameState = {
      ...structuredClone(initialState),
      ...v,
      ...(v.saveVersion === 8 || tracked(v.saveVersion)
        ? {}
        : emptySupportState()),
      relations: { ...initialState.relations, ...v.relations },
      saveVersion: 11,
    };
    if (tracked(v.saveVersion)) {
      const strings = (x: unknown): x is string[] =>
        Array.isArray(x) &&
        x.every((id) => typeof id === "string") &&
        new Set(x).size === x.length;
      for (const key of ["unlockedPeople", "newPeople"] as const)
        if (
          !strings(v[key]) ||
          !v[key].every((id: string) => people.some((p) => p.id === id))
        )
          return null;
      for (const key of ["unlockedPlaces", "newPlaces"] as const)
        if (
          !strings(v[key]) ||
          !v[key].every((id: string) => places.some((p) => p.id === id))
        )
          return null;
      if (
        !strings(v.newEvents) ||
        !strings(v.playedEvents) ||
        !strings(v.rewardedObligations) ||
        !Array.isArray(v.eventQueue) ||
        new Set(v.eventQueue.map((e: { id: string }) => e?.id)).size !==
          v.eventQueue.length ||
        v.eventQueue.some(
          (e: { id: string; title: string; place: string; lines: string[] }) =>
            !e ||
            typeof e.id !== "string" ||
            v.playedEvents.includes(e.id) ||
            typeof e.title !== "string" ||
            !places.some((p) => p.id === e.place) ||
            !Array.isArray(e.lines) ||
            !e.lines.length ||
            !e.lines.every((l) => typeof l === "string"),
        ) ||
        !v.personalRuns ||
        typeof v.personalRuns !== "object" ||
        Array.isArray(v.personalRuns) ||
        Object.values(v.personalRuns).some((n) => !number(n))
      )
        return null;
    } else {
      Object.assign(next, {
        unlockedPeople: [],
        unlockedPlaces: [],
        newPeople: [],
        newPlaces: [],
        newEvents: [],
        eventQueue: [],
        playedEvents: [],
        rewardedObligations: [],
        personalRuns: {},
      });
      // 新しい解禁は推測しない。実行回数のみ、対象IDと日付のある履歴から復元する。
      for (const h of next.history) {
        const j = jobs.find(
          (j) => j.id === h.target && j.category === "personal",
        );
        if (
          h.kind !== "job" ||
          !j ||
          h.day < 1 ||
          h.day > CHAPTERS * CHAPTER_DAYS
        )
          continue;
        const key = personalRunKey(j, {
          ...next,
          chapter: Math.floor((h.day - 1) / CHAPTER_DAYS) + 1,
        });
        next.personalRuns[key] = (next.personalRuns[key] ?? 0) + 1;
      }
    }
    const ids = (a: unknown): a is GameState["today"]["worked"] =>
      Array.isArray(a) &&
      new Set(a).size === a.length &&
      a.every((id) => people.some((p) => p.id === id));
    if (v.saveVersion === 10 || v.saveVersion === 11) {
      if (
        !v.today ||
        !ids(v.today.worked) ||
        !ids(v.today.relationGranted) ||
        typeof v.today.publicWork !== "boolean"
      )
        return null;
      // v11で足した納品回数。v10には無いので当日ぶんだけ空で始める。
      const deliveries = v.today.deliveries;
      if (
        v.saveVersion === 11 &&
        (!Array.isArray(deliveries) ||
          !deliveries.every((id: unknown) => people.some((p) => p.id === id)))
      )
        return null;
      next.today = {
        ...structuredClone(v.today),
        deliveries:
          v.saveVersion === 11 ? structuredClone(deliveries) : ([] as never[]),
      };
    } else
      next.today = {
        worked: [],
        relationGranted: [],
        publicWork: false,
        deliveries: [],
      };
    return next;
  } catch {
    return null;
  }
}
