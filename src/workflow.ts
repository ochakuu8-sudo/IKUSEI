import { specialOffers, supportOffers } from "./content/support";
import { absoluteDay, offerReason } from "./contracts";
import type { Action } from "./engine";
import {
  axes,
  closedBy,
  isOpen,
  jobs,
  materialIds,
  notYetFallen,
  personalLimitReason,
  personOf,
  personOpen,
  recipes,
  unknownRecipe,
  type GameState,
  type Job,
} from "./game";
import { previewAction } from "./presentation";

/** Presentation-only fallback quote: affordability never changes whether execution is allowed. */
export function actionQuote(s: GameState, action: Action) {
  const actual = previewAction(s, action);
  if (!actual.error) return actual;
  const funded = structuredClone(s);
  funded.money = Math.max(s.money, 1_000_000);
  funded.stamina = Math.max(s.stamina, 10_000);
  for (const id of materialIds)
    funded.materials[id] = Math.max(funded.materials[id], 100_000);
  for (const r of recipes)
    funded.stock[r.id] = Math.max(funded.stock[r.id] ?? 0, 100_000);
  const quote = previewAction(funded, action);
  return quote.error
    ? actual
    : { ...quote, error: actual.error, state: actual.state };
}
export function actionDays(s: GameState, action: Action) {
  return action.type === "end-day" ? 1 : 0;
}
export function actionLabel(s: GameState, a: Action) {
  const verbs: Record<Action["type"], string> = {
    "end-day": "一日を終える",
    deliver: "納品する",
    job: "仕事をする",
    rest: "休む",
    network: "交流する",
    gather: "採集する",
    buy: "購入する",
    brew: "調合する",
    accept: "引き受ける",
    pay: "支払う",
    cancel: "解消する",
    renegotiate: "延長する",
    fulfill: "納品する",
    decline: "断る",
    settle: "精算する",
    visit: "見る",
    "read-event": "読み終える",
  };
  return verbs[a.type];
}
export function deadlineWarnings(s: GameState, a: Action) {
  const days = actionDays(s, a);
  if (!days) return [];
  const preview = previewAction(s, a);
  const lastDay = absoluteDay(s) + days - 1;
  return [
    ...s.obligations
      .filter(
        (o) =>
          o.status === "active" &&
          o.due <= lastDay &&
          preview.state.obligations.find((n) => n.id === o.id)?.status !==
            "fulfilled",
      )
      .map(
        (o) =>
          `${o.terms.title}：${o.due === absoluteDay(s) ? "本日" : `${o.due}日目`}が${o.terms.schedule ? "指定納品日" : "支払・履行期限"}`,
      ),
    ...specialOffers
      .filter(
        (o) =>
          o.schedule!.closes >= absoluteDay(s) &&
          o.schedule!.closes <= lastDay &&
          !offerReason(s, o) &&
          !(a.type === "accept" && a.offer === o.id),
      )
      .map((o) => `${o.title}：受付が終了します`),
  ];
}
export function workReason(j: Job, s: GameState) {
  if (!personOpen(personOf(j.person), s)) return "この人物にはまだ会えません";
  if (j.requiresCapability && !s.capabilities.includes(j.requiresCapability))
    return "紹介の条件を満たしていません";
  if (unknownRecipe(j, s)) return "処方をまだ覚えていません";
  if (notYetFallen(j, s)) return "現在の立場では紹介されません";
  const closed = closedBy(j, s);
  if (closed.length)
    return `${closed.map((a) => `${a}${j.needs[a]}以上`).join("・")}が必要なため紹介されません`;
  return personalLimitReason(j, s) ?? null;
}
export function visibleJobs(s: GameState, seen: string[]) {
  return jobs.filter(
    (j) =>
      isOpen(j, s) ||
      (seen.includes(j.id) &&
        personOpen(personOf(j.person), s) &&
        !unknownRecipe(j, s) &&
        (!j.requiresCapability ||
          s.capabilities.includes(j.requiresCapability))),
  );
}
export function quoteSummary(s: GameState, action: Action) {
  const q = actionQuote(s, action);
  return `${q.money < 0 ? "費用" : "受取"} ${Math.abs(q.money).toLocaleString()}G・スタミナ ${q.stamina > 0 ? "+" : ""}${q.stamina}`;
}
