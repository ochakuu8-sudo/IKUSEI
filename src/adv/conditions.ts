import { axes, people, type Job } from "../game";
import { dignityRank } from "../dignity";
import { growthOf, rankOf } from "./growth";
import type { Condition, Effects, Scenario, Snapshot } from "./types";

export type Evaluation = { ok: boolean; text: string; children?: Evaluation[]; error?: string };
const own = (obj: object, key: string) => Object.prototype.hasOwnProperty.call(obj, key);
const idOK = (id: unknown): id is string => typeof id === "string" && /^[a-zA-Z0-9_.:-]+$/.test(id) && !["__proto__", "constructor", "prototype"].includes(id);
const finite = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
export function validateCondition(c: Condition, depth = 0): string[] {
  if (!c || typeof c !== "object" || depth > 16) return ["条件が不正です"];
  if (c.kind === "all" || c.kind === "any")
    return !Array.isArray(c.items) || !c.items.length ? ["空の複合条件"] : c.items.flatMap(x => validateCondition(x, depth + 1));
  if (c.kind === "flag") return idOK(c.id) && typeof c.equals === "boolean" ? [] : ["不正な出来事条件"];
  if (c.kind !== "range" || !c.value) return ["未知の条件形式"];
  const v = c.value;
  let max: number;
  if (v.kind === "skill") {
    const d = growthOf(v.id);
    if (!d) return ["未登録の成長項目"];
    max = d.thresholds.length - 1;
  } else if (v.kind === "axis" && axes.includes(v.id)) max = 5;
  else if (v.kind === "relation" && people.some(p => p.id === v.personId)) max = 3;
  else return ["不正な参照先"];
  if (c.min === undefined && c.max === undefined) return ["境界のない条件"];
  if ([c.min, c.max].some(n => n !== undefined && (!finite(n) || !Number.isInteger(n) || n < 0 || n > max))) return ["不正な境界"];
  return c.min !== undefined && c.max !== undefined && c.min > c.max ? ["逆転した範囲"] : [];
}
export function evaluateCondition(c: Condition | undefined, s: Snapshot): Evaluation {
  if (c === undefined) return { ok: true, text: "条件なし" };
  const errors = validateCondition(c);
  if (errors.length) return { ok: false, text: "条件定義エラー", error: errors.join("・") };
  if (c.kind === "all" || c.kind === "any") {
    const children = c.items.map(x => evaluateCondition(x, s));
    const invalid = children.find(x => x.error);
    return { ok: !invalid && (c.kind === "all" ? children.every(x => x.ok) : children.some(x => x.ok)), text: c.kind === "all" ? "すべて必要（かつ）" : "いずれか必要（または）", children, error: invalid?.error };
  }
  if (c.kind === "flag") return { ok: (s.storyFlags[c.id] === true) === c.equals, text: "必要な出来事" + ((s.storyFlags[c.id] === true) === c.equals ? "：達成" : "：未達") };
  if (c.kind !== "range") return { ok: false, text: "不正な条件" };
  try {
    const v = c.value;
    const value = v.kind === "skill" ? rankOf(v.id, s.growthXP[v.id]) : v.kind === "axis" ? dignityRank(s.axes[v.id]) : s.relations[v.personId];
    if (!finite(value)) throw new Error("現在値がありません");
    const label = v.kind === "skill" ? growthOf(v.id)!.label : v.kind === "axis" ? v.id + "ランク" : people.find(p => p.id === v.personId)!.name + "との関係";
    const bounds = (c.min !== undefined ? c.min + "以上" : "") + (c.min !== undefined && c.max !== undefined ? "・" : "") + (c.max !== undefined ? c.max + "以下" : "");
    const ok = (c.min === undefined || value >= c.min) && (c.max === undefined || value <= c.max);
    return { ok, text: label + " " + bounds + " ／ 現在 " + value + (ok ? "（達成）" : c.max !== undefined && value > c.max ? "（上限を超過）" : "（不足）") };
  } catch {
    return { ok: false, text: "現在値が不正です", error: "現在値が不正です" };
  }
}
export function validateEffects(e?: Effects): string[] {
  if (e === undefined) return [];
  if (!e || typeof e !== "object" || Array.isArray(e)) return ["不正な効果"];
  const errors: string[] = [];
  const fields = ["bonusMoney", "growthXP", "axisDelta", "relationDelta", "storyFlags", "grantCapabilities"];
  if (Object.keys(e).some(k => !fields.includes(k))) errors.push("未知の効果");
  for (const k of ["bonusMoney"] as const)
    if (e[k] !== undefined && (!finite(e[k]) || !Number.isInteger(e[k]) || e[k]! < 0)) errors.push("不正な効果量");
  for (const k of ["growthXP", "axisDelta", "relationDelta", "storyFlags"] as const) {
    const map = e[k];
    if (map === undefined) continue;
    if (!map || typeof map !== "object" || Array.isArray(map)) { errors.push("不正な効果表"); continue; }
    for (const [id, n] of Object.entries(map)) {
      if (k === "storyFlags") { if (!idOK(id) || typeof n !== "boolean") errors.push("不正な出来事"); }
      else {
        if (!finite(n) || !Number.isInteger(n)) errors.push("不正な効果量");
        if (k === "growthXP" && (!growthOf(id) || !finite(n) || n < 0)) errors.push("不正な成長報酬");
        if (k === "axisDelta" && (!axes.includes(id as never) || !finite(n) || Math.abs(n) > 100)) errors.push("不正な尊厳効果");
        if (k === "relationDelta" && (!people.some(p => p.id === id) || !finite(n) || Math.abs(n) > 3)) errors.push("不正な関係効果");
      }
    }
  }
  if (e.grantCapabilities !== undefined && (!Array.isArray(e.grantCapabilities) || !e.grantCapabilities.every(idOK))) errors.push("不正な資格");
  return errors;
}
export function validateJob(job: Job): string[] {
  if (!job || typeof job !== "object" || !idOK(job.id) || typeof job.title !== "string" || !people.some(p => p.id === job.person) || !["repeat", "once", "chapter"].includes(job.cadence) || !finite(job.pay) || job.pay < 0 || !finite(job.stamina) || job.stamina < 0 || !Array.isArray(job.costs) || !job.needs || typeof job.needs !== "object") return ["不正な依頼"];
  const errors = validateEffects({ growthXP: job.growthRewards });
  if (job.costs.some(c => !c || !axes.includes(c.axis) || !finite(c.amount) || c.amount < 0 || c.amount > 100)) errors.push("不正な固定代償");
  if (job.entryCondition !== undefined) errors.push(...validateCondition(job.entryCondition));
  for (const field of [job.requiresStoryFlags, job.forbidsStoryFlags])
    if (field !== undefined && (!Array.isArray(field) || !field.every(idOK))) errors.push("不正な依頼フラグ");
  if (job.requiresCapability !== undefined && !idOK(job.requiresCapability)) errors.push("不正な資格");
  for (const map of [job.needs, job.opensBelow]) {
    if (map !== undefined && (!map || typeof map !== "object" || Object.entries(map).some(([id, n]) => !axes.includes(id as never) || !finite(n) || !Number.isInteger(n) || n < 0 || n > 5))) errors.push("不正な依頼条件");
  }
  return errors;
}
export function validateScenario(s: Scenario): string[] {
  if (!s || typeof s !== "object" || !idOK(s.id) || !Number.isInteger(s.version) || s.version < 1 || !s.nodes || typeof s.nodes !== "object" || !idOK(s.entry) || !own(s.nodes, s.entry)) return ["不正なシナリオ"];
  const errors: string[] = [], visiting = new Set<string>(), visited = new Set<string>();
  const walk = (id: string) => {
    if (visiting.has(id)) { errors.push("循環: " + id); return; }
    if (visited.has(id)) return;
    const n = own(s.nodes, id) ? s.nodes[id] : undefined;
    if (!n || n.id !== id || !idOK(id)) { errors.push("遷移先不正: " + id); return; }
    visiting.add(id);
    if (n.kind === "text") {
      if (!Array.isArray(n.lines) || !n.lines.length || n.lines.some(l => !l || typeof l.text !== "string" || (l.speaker !== undefined && typeof l.speaker !== "string") || (l.sceneId !== undefined && !idOK(l.sceneId)) || (l.visual !== undefined && typeof l.visual !== "string"))) errors.push("本文不正: " + id);
      walk(n.next);
    } else if (n.kind === "choice") {
      if (typeof n.prompt !== "string" || !Array.isArray(n.choices) || !n.choices.length) errors.push("選択不正: " + id);
      else {
        if (!n.choices.some(c => c.condition === undefined)) errors.push("条件なしの出口が必要: " + id);
        const ids = new Set<string>();
        for (const c of n.choices) {
          if (!idOK(c.id) || ids.has(c.id) || typeof c.text !== "string") errors.push("選択ID・本文不正: " + id);
          ids.add(c.id);
          if (c.condition !== undefined) errors.push(...validateCondition(c.condition));
          errors.push(...validateEffects(c.effects));
          walk(c.next);
        }
      }
    } else if (n.kind === "end") errors.push(...validateEffects(n.effects));
    else errors.push("未知のノード: " + id);
    visiting.delete(id);
    visited.add(id);
  };
  walk(s.entry);
  for (const id of Object.keys(s.nodes)) walk(id);
  return errors;
}
