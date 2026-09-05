import {
  axes,
  jobs,
  isOpen,
  payWithRelation,
  capDropOf,
  type GameState,
  type RecipeId,
  type JobCost,
  type PersonId,
} from "./game";
import { absoluteDay } from "./contracts";
export type DeliverySelection = {
  ordinary: string[];
  promises: { id: string; option: string }[];
};
export type DeliveryLine = {
  id: string;
  title: string;
  recipe: RecipeId;
  count: number;
  pay: number;
  stamina: number;
  costs: JobCost[];
  cap: number;
  person: PersonId;
  option?: string;
};

/** 出発時の状態だけを読み、順序によらない計画を作る。在庫等はまだ変更しない。 */
export function planDelivery(s: GameState, selection: DeliverySelection) {
  if (s.ended || s.awaitingSettlement)
    throw new Error("本日の行動は終了しています");
  if (!selection.ordinary.length && !selection.promises.length)
    throw new Error("納品する依頼書を選んでください");
  if (
    new Set(selection.ordinary).size !== selection.ordinary.length ||
    new Set(selection.promises.map((p) => p.id)).size !==
      selection.promises.length
  )
    throw new Error("同じ依頼書は1回の出発に1件までです");
  const lines: DeliveryLine[] = [];
  for (const id of [...selection.ordinary].sort()) {
    const j = jobs.find((j) => j.id === id);
    if (!j || j.category !== "ordinary" || !j.recipe || !isOpen(j, s))
      throw new Error("紹介条件を満たさない通常依頼があります");
    lines.push({
      id,
      title: j.title,
      recipe: j.recipe,
      count: j.count ?? 1,
      pay: payWithRelation(j, s),
      stamina: j.stamina,
      costs: j.costs,
      cap: capDropOf(j),
      person: j.person,
    });
  }
  for (const entry of [...selection.promises].sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    const o = s.obligations.find((o) => o.id === entry.id),
      c = o?.terms.options.find((c) => c.id === entry.option);
    if (!o || o.status !== "active" || o.terms.kind !== "advance" || !c)
      throw new Error("まとめ納品できない約束があります");
    if (o.terms.schedule ? absoluteDay(s) !== o.due : absoluteDay(s) > o.due)
      throw new Error(
        o.terms.schedule
          ? "特別依頼は指定日当日のみ納品できます"
          : "期限を過ぎています",
      );
    const costs = c.costs ?? [];
    lines.push({
      id: o.id,
      option: c.id,
      title: o.terms.title,
      recipe: c.recipe,
      count: c.count,
      pay: o.terms.totalPay - o.terms.money,
      stamina: c.stamina,
      costs,
      cap: Math.ceil(
        costs
          .filter((c) => c.axis === "品位")
          .reduce((n, c) => n + c.amount, 0) / 2,
      ),
      person: o.terms.person,
    });
  }
  const stock: Partial<Record<RecipeId, number>> = {};
  lines.forEach((l) => {
    stock[l.recipe] = (stock[l.recipe] ?? 0) + l.count;
  });
  const stamina = lines.reduce((sum, l) => sum + l.stamina, 0);
  const costs = axes.map((axis) => ({
    axis,
    amount: lines.reduce(
      (sum, l) =>
        sum +
        l.costs
          .filter((c) => c.axis === axis)
          .reduce((n, c) => n + c.amount, 0),
      0,
    ),
  }));
  // 1件だけ選んでいるときに「まとめて」「合計」と言わない。
  const many = lines.length > 1;
  const error = Object.entries(stock).some(
    ([id, count]) => (s.stock[id as RecipeId] ?? 0) < count!,
  )
    ? many
      ? "まとめて納めるための在庫が足りません"
      : "納める薬の在庫が足りません"
    : s.stamina < stamina
      ? many
        ? "合計のスタミナが足りません"
        : "スタミナが足りません"
      : undefined;
  return {
    lines,
    stock,
    stamina,
    costs,
    cap: lines.reduce((sum, l) => sum + l.cap, 0),
    pay: lines.reduce((sum, l) => sum + l.pay, 0),
    error,
  };
}
