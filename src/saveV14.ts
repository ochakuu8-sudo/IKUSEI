/**
 * v16 の保存。独立した品位上限を廃止し、尊厳条件をランクへ移行する。
 * ファイル名は既存の参照との互換のため維持。旧保存の報酬は再実行しない。
 *
 * v13（生産ラインの版）からは、続けられるぶんだけを引き継ぐ。素材・在庫・処方・
 * 品質・契約は新しい仕組みに対応する概念が無いので捨てる。**元の保存は消さない**ので、
 * 巻き戻したくなったら v13 のデータはそのまま残っている。
 */
import { axes, people, type Axis, type PersonId } from "./game";
import { freshDaily, SAVE_VERSION, type DailyState } from "./daily";
import { growthDefinitions, initialGrowth, rankOf } from "./adv/growth";
import type { ActiveSession, ReplayRecord, Snapshot } from "./adv/types";
import { dignityRank } from "./dignity";

export const SAVE_KEY = "ikusei-prototype-save-v16";
export const UI_KEY = "ikusei-prototype-ui-v14";
const V15_KEY = "ikusei-prototype-save-v15";
const V14_KEY = "ikusei-prototype-save-v14";
const V13_KEY = "ikusei-prototype-save-v13";

const int = (v: unknown, lo: number, hi: number, fallback: number) =>
  typeof v === "number" && Number.isFinite(v)
    ? Math.min(hi, Math.max(lo, Math.round(v)))
    : fallback;

/** 壊れた保存を黙って読み込まない。足りない欄は新規の値で埋める。 */
function parseBase(text: string): DailyState | null {
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
    revision: int(raw.revision, 0, 9_999_999, 0),
  };
  const a = raw.axes as Record<string, unknown> | undefined;
  for (const axis of axes)
    state.axes[axis] = int(a?.[axis], 0, 100, base.axes[axis]);
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
      : [];
  return state;
}

const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const strings = (x: unknown): x is string[] => Array.isArray(x) && x.every(s => typeof s === "string");
const whole = (x: unknown, max = 9_999_999): x is number => typeof x === "number" && Number.isInteger(x) && x >= 0 && x <= max;
const safeId = (id: string) => /^[a-zA-Z0-9_.:-]+$/.test(id) && !["__proto__", "constructor", "prototype"].includes(id);
function lines(x: unknown): boolean {
  return Array.isArray(x) && x.every(l => object(l) && typeof l.text === "string" && typeof l.sceneId === "string" && (l.speaker === undefined || typeof l.speaker === "string") && (l.visual === undefined || typeof l.visual === "string"));
}
function choices(x: unknown): boolean {
  return Array.isArray(x) && x.every(c => object(c) && typeof c.nodeId === "string" && typeof c.choiceId === "string" && typeof c.text === "string");
}
export function validReplay(x: unknown): x is ReplayRecord {
  return object(x) && typeof x.id === "string" && typeof x.title === "string" && people.some(p => p.id === x.person) && typeof x.scenarioId === "string" && whole(x.version) && lines(x.lines) && choices(x.choices);
}
function parseSnapshot(raw: unknown): Snapshot | null {
  if (!object(raw) || raw.activeSession !== undefined || raw.saveVersion !== SAVE_VERSION) return null;
  const s = parseBase(JSON.stringify(raw));
  if (!s || !object(raw.growthXP) || !object(raw.storyFlags) || !strings(raw.capabilities) || typeof raw.debugMode !== "boolean" || !Array.isArray(raw.recordings) || !raw.recordings.every(validReplay)) return null;
  if (Object.keys(raw.growthXP).some(id => !growthDefinitions.some(d => d.id === id))) return null;
  try {
    for (const d of growthDefinitions) {
      rankOf(d.id, raw.growthXP[d.id] as number);
      s.growthXP[d.id] = raw.growthXP[d.id] as number;
    }
  } catch { return null; }
  if (Object.entries(raw.storyFlags).some(([id, v]) => !safeId(id) || typeof v !== "boolean") || !raw.capabilities.every(safeId)) return null;
  s.storyFlags = { ...raw.storyFlags } as Record<string, boolean>;
  s.capabilities = [...raw.capabilities];
  s.debugMode = raw.debugMode;
  s.recordings = structuredClone(raw.recordings);
  return s;
}
function parseSession(raw: unknown): ActiveSession | null {
  if (!object(raw) || typeof raw.id !== "string" || !whole(raw.revision) || !object(raw.job) || typeof raw.job.id !== "string" || typeof raw.job.title !== "string" || !people.some(p => p.id === (raw.job as Record<string, unknown>).person) || !object(raw.quote) || ![raw.quote.pay, raw.quote.listPrice].every(n => whole(n)) || typeof raw.quote.fatigueRate !== "number" || raw.quote.fatigueRate < 0 || raw.quote.fatigueRate > 1 || !Number.isFinite(raw.quote.fatigueRate)) return null;
  const entry = parseSnapshot(raw.entrySnapshot), working = parseSnapshot(raw.working);
  if (!entry || !working || !object(raw.scenario) || typeof raw.nodeId !== "string" || !object(raw.cursor) || ![raw.cursor.line, raw.cursor.offset, raw.cursor.chars].every(n => whole(n)) || !["playing", "result"].includes(raw.phase as string) || !choices(raw.choices) || !lines(raw.transcript) || !strings(raw.visited) || typeof raw.lostPrestige !== "boolean") return null;
  if (raw.phase === "result" && (!object(raw.outcome) || !Array.isArray(raw.outcome.drops) || !Array.isArray(raw.outcome.gains) || !Array.isArray(raw.outcome.closedNow) || !strings(raw.outcome.notices) || typeof raw.outcome.pay !== "number")) return null;
  // An unavailable scenario can still carry a valid pre-entry snapshot for explicit recovery.
  return { ...structuredClone(raw), entrySnapshot: entry, working } as unknown as ActiveSession;
}
export function parseDaily(text: string): DailyState | null {
  try {
    const raw = JSON.parse(text);
    if (!object(raw)) return null;
    const { activeSession, ...plain } = raw;
    const state: DailyState | null = parseSnapshot(plain);
    if (!state) return null;
    if (activeSession !== undefined) {
      const session = parseSession(activeSession);
      if (!session) return null;
      state.activeSession = session;
    }
    return state;
  } catch { return null; }
}

/** Convert only known content fields; malformed definitions remain recoverable or invalid. */
function upgradeCondition(value: unknown): unknown {
  if (!object(value)) return value;
  if ((value.kind === "all" || value.kind === "any") && Array.isArray(value.items))
    return { ...value, items: value.items.map(upgradeCondition) };
  if (value.kind !== "range" || !object(value.value) || value.value.kind !== "axis") return value;
  const result = { ...value };
  for (const key of ["min", "max"])
    if (result[key] !== undefined) {
      if (typeof result[key] !== "number" || !Number.isFinite(result[key]) || result[key] < 0 || result[key] > 100) throw new Error("旧尊厳条件が不正です");
      result[key] = dignityRank(result[key]);
    }
  return result;
}
function upgradeEffects(value: unknown): unknown {
  if (!object(value)) return value;
  const { dignityCapDrop: _removed, ...effects } = value;
  return effects;
}
function upgradeSnapshot(value: unknown): Record<string, unknown> {
  if (!object(value) || value.saveVersion !== 15) throw new Error("旧保存の形式が不正です");
  const { dignityCap: _removed, ...snapshot } = value;
  return { ...snapshot, saveVersion: SAVE_VERSION };
}
export function migrateFromV15(text: string): DailyState | null {
  try {
    const raw: unknown = JSON.parse(text);
    const upgraded = upgradeSnapshot(raw);
    if (object(upgraded.activeSession)) {
      const session = upgraded.activeSession;
      session.entrySnapshot = upgradeSnapshot(session.entrySnapshot);
      session.working = upgradeSnapshot(session.working);
      if (object(session.job)) {
        for (const key of ["needs", "opensBelow"])
          if (object(session.job[key])) session.job[key] = Object.fromEntries(Object.entries(session.job[key]).map(([axis, n]) => {
            if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 100) throw new Error("旧依頼条件が不正です");
            return [axis, dignityRank(n)];
          }));
        if (session.job.entryCondition !== undefined) session.job.entryCondition = upgradeCondition(session.job.entryCondition);
      }
      if (object(session.scenario) && object(session.scenario.nodes))
        for (const node of Object.values(session.scenario.nodes)) {
          if (!object(node)) continue;
          if (node.effects !== undefined) node.effects = upgradeEffects(node.effects);
          if (Array.isArray(node.choices)) for (const choice of node.choices) {
            if (!object(choice)) continue;
            if (choice.effects !== undefined) choice.effects = upgradeEffects(choice.effects);
            if (choice.condition !== undefined) choice.condition = upgradeCondition(choice.condition);
          }
        }
      if (object(session.outcome)) delete session.outcome.capDrop;
    }
    return parseDaily(JSON.stringify(upgraded));
  } catch { return null; }
}
export function migrateFromV14(text: string): DailyState | null {
  try {
    const raw = JSON.parse(text);
    if (!object(raw) || raw.saveVersion !== 14) return null;
    return parseDaily(JSON.stringify({ ...raw, saveVersion: SAVE_VERSION, growthXP: initialGrowth(), storyFlags: {}, capabilities: [], recordings: [], debugMode: false, activeSession: undefined }));
  } catch { return null; }
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
  const a = raw.axes as Record<string, unknown> | undefined;
  for (const axis of axes as Axis[])
    s.axes[axis] = int(a?.[axis], 0, 100, s.axes[axis]);
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
  const v15 = store.getItem(V15_KEY);
  if (v15) {
    const state = migrateFromV15(v15);
    return state
      ? { state, notice: "尊厳をランク制へ移行しました。数値・成長・進行中の依頼を引き継ぎ、品位上限を廃止しました。回復は同ランク内だけです。" }
      : { state: null, notice: "以前の保存を移行できませんでした。元の記録は保持しています。" };
  }
  const v14 = store.getItem(V14_KEY);
  if (v14) {
    const state = migrateFromV14(v14);
    return state
      ? { state, notice: "以前の記録を引き継ぎました。成長は初期値から始まります。完了済みの報酬は再実行しません。" }
      : { state: null, notice: "以前の保存が読めません。元の記録は保持しています。" };
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
  store.removeItem(V15_KEY);
  store.removeItem(V14_KEY);
  store.removeItem(V13_KEY);
}
