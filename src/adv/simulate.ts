/** Developer simulation: the same acceptance, choices and settlement as the UI. */
import { transition, applyEffects, type Command } from "./engine";
import { evaluateCondition } from "./conditions";
import { dailyAction, freshDaily, offersOf, quotaOf, takeReason, type DailyState, type DayOutcome } from "../daily";
import { axes, CHAPTER_DAYS, CHAPTERS } from "../game";
import type { Choice, Snapshot } from "./types";

export type Policy = { name: string; growth: number; story: number; relation: number; preserveAxes?: boolean };
export const policies: Policy[] = [
  { name: "収入優先", growth: 0, story: 0, relation: 0 },
  { name: "育成・後続依頼優先", growth: 30, story: 35, relation: 10 },
  { name: "尊厳維持・関係優先", growth: 10, story: 15, relation: 45, preserveAxes: true },
];
function step(s: DailyState, command: Command): DailyState {
  const result = transition(s, command);
  if (result.error) throw new Error(result.error);
  return result.state;
}
export function playJob(s: DailyState, jobId: string, pick: (choices: Choice[], state: Snapshot) => Choice) {
  let next = step(s, { type: "begin", jobId });
  const bound = Object.keys(next.activeSession!.scenario.nodes).length + 1;
  for (let i = 0; i < bound; i++) {
    const session = next.activeSession!;
    const stamp = { sessionId: session.id, revision: session.revision };
    if (session.phase === "result") return {
      state: step(next, { type: "acknowledge", ...stamp }),
      outcome: session.outcome!, choices: session.choices.length,
    };
    const node = session.scenario.nodes[session.nodeId];
    if (node.kind === "text") next = step(next, { type: "advance", ...stamp, nodeId: node.id });
    else if (node.kind === "choice") {
      const available = node.choices.filter(c => evaluateCondition(c.condition, session.working).ok);
      const selected = pick(available, session.working);
      if (!available.includes(selected)) throw new Error("Simulation chose an unavailable option");
      next = step(next, { type: "choose", ...stamp, nodeId: node.id, choiceId: selected.id });
    } else throw new Error("Unsettled end node");
  }
  throw new Error("Simulation did not finish a scenario");
}
function score(before: Snapshot, after: Snapshot, policy: Policy) {
  const xp = Object.keys(before.growthXP).reduce((n, id) => n + after.growthXP[id] - before.growthXP[id], 0);
  const flags = Object.keys(after.storyFlags).filter(id => after.storyFlags[id] && !before.storyFlags[id]).length;
  const relation = Object.keys(before.relations).reduce((n, id) => n + after.relations[id as keyof typeof before.relations] - before.relations[id as keyof typeof before.relations], 0);
  return after.money - before.money + xp * policy.growth + flags * policy.story + relation * policy.relation;
}
function losesAxes(outcome: DayOutcome) {
  return [...outcome.drops, ...(outcome.choiceAxisMoves ?? [])].some(move => move.after < move.before);
}
export function simulate(policy: Policy, seed: string) {
  let state = freshDaily(seed), income = 0, bonus = 0, rests = 0, decisions = 0;
  const chapters: { chapter: number; income: number; bonus: number; quota: number; cash: number; debt: number; paid: number; interest: number }[] = [];
  const used = new Set<string>();
  // Known effects are evaluated here; these policies are not an optimal solver or a novice model.
  const choose = (choices: Choice[], before: Snapshot) => {
    const safe = policy.preserveAxes ? choices.filter(c => axes.every(axis => (c.effects?.axisDelta?.[axis] ?? 0) >= 0)) : choices;
    return [...(safe.length ? safe : choices)].sort((a, b) => score(before, applyEffects(before, b.effects), policy) - score(before, applyEffects(before, a.effects), policy))[0];
  };
  for (let guard = 0; guard < CHAPTERS * (CHAPTER_DAYS + 1) + 1 && !state.ended; guard++) {
    if (state.awaitingSettlement) {
      const row = { chapter: state.chapter, income, bonus, quota: quotaOf(state), cash: state.money };
      const result = dailyAction(state, { type: "settle" });
      if (result.error) throw new Error(result.error);
      const paid = state.money - result.state.money;
      const interest = result.state.debt - state.debt + paid;
      state = result.state;
      chapters.push({ ...row, debt: state.debt, paid, interest });
      income = 0; bonus = 0;
      continue;
    }
    const candidates = offersOf(state).filter(job => !takeReason(job, state))
      .map(job => ({ job, ...playJob(state, job.id, choose) }))
      .filter(result => !policy.preserveAxes || !losesAxes(result.outcome))
      .sort((a, b) => score(state, b.state, policy) - score(state, a.state, policy));
    const chosen = candidates[0];
    if (chosen) {
      income += chosen.state.money - state.money;
      bonus += chosen.outcome.bonusMoney ?? 0;
      decisions += chosen.choices;
      used.add(chosen.job.id);
      state = chosen.state;
    } else {
      const result = dailyAction(state, { type: "rest" });
      if (result.error) throw new Error(result.error);
      state = result.state;
      rests++;
    }
  }
  if (!state.ended || chapters.length !== CHAPTERS) throw new Error("Simulation did not reach the ending");
  return { chapters, rests, decisions, used: [...used], final: state };
}
