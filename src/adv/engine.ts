import { jobs, axes, people, personOf, type Job } from "../game";
import { dailyAction, closedSince, isOpen, fatigueRateOf, listPriceOf, offersOf, payOf, settleJob, takeReason, type DailyState } from "../daily";
import { scenarios } from "../content/scenarios";
import { growthDefinitions, growthOf, rankOf } from "./growth";
import { evaluateCondition, validateEffects, validateScenario, validateJob } from "./conditions";
import type { ActiveSession, Effects, ReplayRecord, Scenario, Snapshot } from "./types";

export type Command =
  | { type: "begin"; jobId: string }
  | { type: "advance"; sessionId: string; nodeId: string; revision: number }
  | { type: "choose"; sessionId: string; nodeId: string; choiceId: string; revision: number }
  | { type: "cursor"; sessionId: string; nodeId: string; revision: number; cursor: ActiveSession["cursor"] }
  | { type: "acknowledge"; sessionId: string; revision: number }
  | { type: "restore"; sessionId: string; revision: number };
export type Transition = { state: DailyState; error?: string };
export function snapshot(s: DailyState): Snapshot {
  const copy = structuredClone(s);
  delete copy.activeSession;
  return copy;
}
/** Existing linear scripts use the same persisted session as authored branches. */
export function scenarioFor(job: Job, state: DailyState): Scenario {
  if (job.scenarioId) {
    const scenario = scenarios.find(s => s.id === job.scenarioId);
    if (!scenario) throw new Error("シナリオが登録されていません: " + job.scenarioId);
    return structuredClone(scenario);
  }
  const preview = dailyAction(snapshot(state), { type: "take", job: job.id });
  if (preview.error || !preview.outcome) throw new Error(preview.error ?? "依頼の定義が不正です");
  return {
    id: "legacy." + job.id, version: 1, entry: "body",
    nodes: {
      body: { id: "body", kind: "text", lines: preview.outcome.scene, next: "end" },
      end: { id: "end", kind: "end" },
    },
  };
}
export function applyEffects(s: Snapshot, effects?: Effects): Snapshot {
  const errors = validateEffects(effects);
  if (errors.length) throw new Error(errors.join("・"));
  const n = structuredClone(s);
  if (!effects) return n;
  n.money = Math.min(9_999_999, n.money + (effects.bonusMoney ?? 0));
  for (const [id, xp] of Object.entries(effects.growthXP ?? {}))
    n.growthXP[id] = Math.min(growthOf(id)!.thresholds.at(-1)!, n.growthXP[id] + xp);
  for (const axis of axes)
    n.axes[axis] = Math.min(100, Math.max(0, n.axes[axis] + (effects.axisDelta?.[axis] ?? 0)));
  n.dignityCap = Math.max(0, n.dignityCap - (effects.dignityCapDrop ?? 0));
  n.axes.品位 = Math.min(n.axes.品位, n.dignityCap);
  for (const p of people)
    n.relations[p.id] = Math.min(3, Math.max(0, n.relations[p.id] + (effects.relationDelta?.[p.id] ?? 0)));
  Object.assign(n.storyFlags, effects.storyFlags);
  n.capabilities = [...new Set([...n.capabilities, ...(effects.grantCapabilities ?? [])])];
  return n;
}
function apply(session: ActiveSession, effects?: Effects) {
  if ((effects?.axisDelta?.威厳 ?? 0) < 0) session.lostPrestige = true;
  session.working = applyEffects(session.working, effects);
}
export function sceneKey(session: ActiveSession, nodeId = session.nodeId) {
  return "adv:" + session.scenario.id + ":" + session.scenario.version + ":" + nodeId;
}
function complete(state: DailyState, session: ActiveSession): DailyState {
  const node = session.scenario.nodes[session.nodeId];
  if (node.kind !== "end") return state;
  apply(session, node.effects);
  apply(session, { growthXP: session.job.growthRewards });
  const settled = settleJob(session.working, session.job, session.quote, session.lostPrestige);
  if (settled.error || !settled.outcome) throw new Error(settled.error ?? "精算できません");
  const result = settled.state;
  const outcome = settled.outcome;
  outcome.bonusMoney = session.working.money - session.entrySnapshot.money;
  outcome.pay += outcome.bonusMoney;
  outcome.growthGains = growthDefinitions.map(d => ({
    id: d.id, before: session.entrySnapshot.growthXP[d.id], after: result.growthXP[d.id],
  })).filter(d => d.before !== d.after);
  outcome.scene = session.transcript;
  outcome.sceneIds = [...new Set(session.transcript.map(l => l.sceneId))];
  outcome.choiceAxisMoves = axes.filter(a => session.working.axes[a] !== session.entrySnapshot.axes[a]).map(axis => ({
    axis, amount: Math.abs(session.entrySnapshot.axes[axis] - session.working.axes[axis]),
    before: session.entrySnapshot.axes[axis], after: session.working.axes[axis],
  }));
  outcome.closedNow = closedSince(jobs.filter(j => isOpen(j, session.entrySnapshot)), result);
  result.log[0] = `${session.entrySnapshot.day}日目。${session.job.title}（${outcome.pay.toLocaleString()}G）。`;
  outcome.capDrop += session.entrySnapshot.dignityCap - session.working.dignityCap;
  const changedRelations = people.filter(p => session.working.relations[p.id] !== session.entrySnapshot.relations[p.id]);
  outcome.notices.push(...changedRelations.map(p => p.name + "との関係 " + session.entrySnapshot.relations[p.id] + " → " + session.working.relations[p.id] + "（選択による変化）"));
  const record: ReplayRecord = {
    id: session.id, title: session.job.title, person: session.job.person,
    scenarioId: session.scenario.id, version: session.scenario.version,
    lines: structuredClone(session.transcript), choices: structuredClone(session.choices),
  };
  result.recordings = [...result.recordings.filter(r => r.id !== record.id), record];
  session.phase = "result";
  session.outcome = outcome;
  session.revision++;
  result.activeSession = session;
  result.revision = state.revision + 1;
  return result;
}
export function sessionError(s: ActiveSession): string | undefined {
  try {
    const errors = [...validateScenario(s.scenario), ...validateJob(s.job)];
    if (errors.length) return errors.join("・");
    if (!s.scenario.nodes[s.nodeId]) return "保存した場面が見つかりません";
    const node = s.scenario.nodes[s.nodeId];
    if (s.phase === "playing" && node.kind === "text" && (s.cursor.line >= node.lines.length || s.cursor.offset > node.lines[s.cursor.line].text.length || s.cursor.chars > node.lines[s.cursor.line].text.length + 2)) return "保存した本文位置が不正です";
    if (s.phase === "playing" && node.kind === "end") return "未完了の終了処理が保存されています";
    if (s.choices.some(c => {
      const n = s.scenario.nodes[c.nodeId];
      return n?.kind !== "choice" || !n.choices.some(x => x.id === c.choiceId);
    })) return "保存した選択が見つかりません";
    for (const d of growthDefinitions) rankOf(d.id, s.working.growthXP[d.id]);
    if (!people.some(p => p.id === s.job.person)) return "保存した依頼主が見つかりません";
    return undefined;
  } catch { return "保存したシナリオを再開できません"; }
}
export function transition(state: DailyState, command: Command): Transition {
  try {
    if (command.type === "begin") {
      if (state.activeSession) throw new Error("進行中の依頼があります");
      const job = jobs.find(j => j.id === command.jobId);
      if (!job || !offersOf(state).some(j => j.id === command.jobId)) throw new Error("今日届いた依頼ではありません");
      const reason = takeReason(job, state);
      if (reason) throw new Error(reason);
      const scenario = scenarioFor(job, state);
      const errors = [...validateScenario(scenario), ...validateJob(job)];
      if (errors.length) throw new Error(errors.join("・"));
      const entry = snapshot(state);
      const activeSession: ActiveSession = {
        id: state.runId + ":" + state.revision + ":" + job.id, revision: 0,
        job: structuredClone(job), scenario,
        entrySnapshot: entry, working: structuredClone(entry),
        quote: { pay: payOf(job, state), listPrice: listPriceOf(job, state), fatigueRate: fatigueRateOf(job.person, state) },
        nodeId: scenario.entry, cursor: { line: 0, offset: 0, chars: 0 },
        phase: "playing", choices: [], transcript: [], visited: [], lostPrestige: false,
      };
      const next = { ...structuredClone(state), activeSession, revision: state.revision + 1 };
      return { state: complete(next, activeSession) };
    }
    const previous = state.activeSession;
    if (!previous || previous.id !== command.sessionId || previous.revision !== command.revision) throw new Error("古い操作です。現在の場面を確認してください");
    if (command.type === "acknowledge") {
      if (previous.phase !== "result") throw new Error("まだ依頼が完了していません");
      return { state: { ...snapshot(state), revision: state.revision + 1 } };
    }
    if (command.type === "restore") {
      if (previous.phase === "result" || !sessionError(previous)) throw new Error("この依頼は巻き戻せません");
      return { state: { ...structuredClone(previous.entrySnapshot), revision: state.revision + 1 } };
    }
    if (previous.phase !== "playing" || previous.nodeId !== command.nodeId) throw new Error("現在の場面に対する操作ではありません");
    const error = sessionError(previous);
    if (error) throw new Error(error);
    const next = structuredClone(state), session = next.activeSession!;
    const node = session.scenario.nodes[session.nodeId];
    if (command.type === "cursor") {
      const c = command.cursor;
      // The two-line renderer inserts a visual line break into its grapheme count.
      if (node.kind !== "text" || ![c.line, c.offset, c.chars].every(v => Number.isInteger(v) && v >= 0) || c.line >= node.lines.length || c.offset > node.lines[c.line].text.length || c.chars > node.lines[c.line].text.length + 2) throw new Error("不正な本文位置");
      session.cursor = c;
      return { state: next };
    }
    if (command.type === "advance") {
      if (node.kind !== "text") throw new Error("選択待ちでは本文をスキップできません");
      session.transcript.push(...node.lines.map(l => ({ ...l, sceneId: l.sceneId ?? sceneKey(session) })));
      session.visited.push(node.id);
      session.nodeId = node.next;
    } else {
      if (node.kind !== "choice") throw new Error("選択する場面ではありません");
      const choice = node.choices.find(c => c.id === command.choiceId);
      if (!choice || !evaluateCondition(choice.condition, session.working).ok) throw new Error("この選択の条件を満たしていません");
      apply(session, choice.effects);
      session.choices.push({ nodeId: node.id, choiceId: choice.id, text: choice.text });
      session.transcript.push({ text: "選択：" + choice.text, sceneId: sceneKey(session) });
      session.visited.push(node.id);
      session.nodeId = choice.next;
    }
    session.cursor = { line: 0, offset: 0, chars: 0 };
    session.revision++;
    next.revision++;
    return { state: complete(next, session) };
  } catch (e) {
    return { state, error: e instanceof Error ? e.message : "進行できませんでした" };
  }
}
/** The caller swaps the in-memory state only after this succeeds. */
export function persistTransition(store: Storage, key: string, before: DailyState, command: Command): Transition {
  const result = transition(before, command);
  if (result.error) return result;
  try {
    if (command.type === "restore") store.setItem(key + "-recovery-backup", JSON.stringify(before));
    store.setItem(key, JSON.stringify(result.state));
    return result;
  } catch {
    return { state: before, error: "保存できませんでした。操作は確定していません。保存を再試行してください。" };
  }
}
export function personLabel(session: ActiveSession) {
  return personOf(session.job.person).name;
}
