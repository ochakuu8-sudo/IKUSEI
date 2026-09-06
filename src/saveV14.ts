/**
 * v14 の保存。1日1行動へ戻したので状態の形が変わり、版番号を上げた。
 *
 * v13（生産ラインの版）からは、続けられるぶんだけを引き継ぐ。素材・在庫・処方・
 * 品質・契約は新しい仕組みに対応する概念が無いので捨てる。**元の保存は消さない**ので、
 * 巻き戻したくなったら v13 のデータはそのまま残っている。
 */
import { axes, people, type Axis, type PersonId } from "./game";
import { freshDaily, SAVE_VERSION, type DailyState } from "./daily";

export const SAVE_KEY = "ikusei-prototype-save-v14";
export const UI_KEY = "ikusei-prototype-ui-v14";
const V13_KEY = "ikusei-prototype-save-v13";

const int = (v: unknown, lo: number, hi: number, fallback: number) =>
  typeof v === "number" && Number.isFinite(v)
    ? Math.min(hi, Math.max(lo, Math.round(v)))
    : fallback;

/** 壊れた保存を黙って読み込まない。足りない欄は新規の値で埋める。 */
export function parseDaily(text: string): DailyState | null {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  if (raw.saveVersion !== SAVE_VERSION) return null;
  const base = freshDaily(
    typeof raw.runId === "string" ? raw.runId : `run-${Date.now()}`,
  );
  const state: DailyState = {
    ...base,
    chapter: int(raw.chapter, 1, 6, 1),
    day: int(raw.day, 1, 14, 1),
    carryOver: int(raw.carryOver, 0, 9_999_999, 0),
    awaitingSettlement: raw.awaitingSettlement === true,
    ended: raw.ended === true,
    money: int(raw.money, 0, 9_999_999, base.money),
    debt: int(raw.debt, 0, 9_999_999, base.debt),
    stamina: int(raw.stamina, 0, 100, 100),
    dignityCap: int(raw.dignityCap, 0, 100, 100),
    revision: int(raw.revision, 0, 9_999_999, 0),
  };
  const a = raw.axes as Record<string, unknown> | undefined;
  for (const axis of axes)
    state.axes[axis] = int(a?.[axis], 0, 100, base.axes[axis]);
  state.axes.品位 = Math.min(state.axes.品位, state.dignityCap);
  const r = raw.relations as Record<string, unknown> | undefined;
  for (const p of people) state.relations[p.id] = int(r?.[p.id], 0, 3, 0);
  const ids = new Set(people.map((p) => p.id as string));
  state.unlocked = Array.isArray(raw.unlocked)
    ? (raw.unlocked.filter((x) => ids.has(x as string)) as PersonId[])
    : [];
  state.recent = Array.isArray(raw.recent)
    ? (raw.recent.filter(
        (x) => x === "none" || ids.has(x as string),
      ) as DailyState["recent"])
    : [];
  for (const key of ["seen", "doneOnce", "doneChapter", "log"] as const)
    state[key] = Array.isArray(raw[key])
      ? (raw[key] as unknown[])
          .filter((x) => typeof x === "string")
          .slice(0, 64)
      : [];
  return state;
}

/** v13の保存から、新しい仕組みでも意味が変わらないものだけを引き継ぐ。 */
export function migrateFromV13(text: string): DailyState | null {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object" || raw.saveVersion !== 13) return null;
  const s = freshDaily();
  s.chapter = int(raw.chapter, 1, 6, 1);
  s.day = int(raw.day, 1, 14, 1);
  s.money = int(raw.money, 0, 9_999_999, s.money);
  s.debt = int(raw.debt, 0, 9_999_999, s.debt);
  s.carryOver = int(raw.carryOver, 0, 9_999_999, 0);
  s.dignityCap = int(raw.dignityCap, 0, 100, 100);
  const a = raw.axes as Record<string, unknown> | undefined;
  for (const axis of axes as Axis[])
    s.axes[axis] = int(a?.[axis], 0, 100, s.axes[axis]);
  s.axes.品位 = Math.min(s.axes.品位, s.dignityCap);
  /* v13の関係は0〜10000点。段階（0〜3）へ落として引き継ぐ。 */
  const points = raw.relationPoints as Record<string, unknown> | undefined;
  for (const p of people) {
    const v = typeof points?.[p.id] === "number" ? (points[p.id] as number) : 0;
    s.relations[p.id] = v >= 10000 ? 3 : v >= 6000 ? 2 : v >= 2500 ? 1 : 0;
  }
  s.log = ["以前の記録から、返済と評判だけを引き継いだ。"];
  return s;
}

export type LoadResult = { state: DailyState | null; notice: string };

export function loadDaily(store: Storage): LoadResult {
  const text = store.getItem(SAVE_KEY);
  if (text) {
    const state = parseDaily(text);
    return state
      ? { state, notice: "" }
      : {
          state: null,
          notice: "保存が読めませんでした。新しく始めてください。",
        };
  }
  const old = store.getItem(V13_KEY);
  if (old) {
    const state = migrateFromV13(old);
    if (state)
      return {
        state,
        notice:
          "仕組みが変わったため、返済・尊厳・評判だけを引き継ぎました（素材と処方は使わなくなりました）。",
      };
  }
  return { state: null, notice: "" };
}

export function saveDaily(store: Storage, state: DailyState) {
  store.setItem(SAVE_KEY, JSON.stringify(state));
}

export function clearDaily(store: Storage) {
  store.removeItem(SAVE_KEY);
}
