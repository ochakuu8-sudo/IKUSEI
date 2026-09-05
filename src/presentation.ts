import { performAction, type Action } from "./engine";
import {
  axes,
  recipes,
  materialIds,
  jobs,
  isOpen,
  type GameState,
  type RecipeId,
  type MaterialId,
} from "./game";
import { absoluteDay } from "./contracts";
import type { DeliverySelection } from "./delivery";

/** Every confirmation uses a dry run of the same engine action that will be committed. */
export function previewAction(state: GameState, action: Action) {
  const outcome = performAction(state, action);
  const next = outcome.state;
  return {
    ...outcome,
    money: next.money - state.money,
    stamina: next.stamina - state.stamina,
    day: absoluteDay(next),
    settlement: next.awaitingSettlement,
    cap: next.dignityCap - state.dignityCap,
    axes: axes.map((axis) => ({
      axis,
      delta: next.axes[axis] - state.axes[axis],
    })),
    stock: recipes
      .filter((r) => (next.stock[r.id] ?? 0) !== (state.stock[r.id] ?? 0))
      .map((r) => ({
        id: r.id,
        delta: (next.stock[r.id] ?? 0) - (state.stock[r.id] ?? 0),
      })),
    materials: materialIds
      .filter((id) => next.materials[id] !== state.materials[id])
      .map((id) => ({ id, delta: next.materials[id] - state.materials[id] })),
  };
}
export function brewCapacity(s: GameState, id: RecipeId) {
  const r = recipes.find((r) => r.id === id)!;
  if (!s.known.includes(id) || s.ended || s.awaitingSettlement) return 0;
  return Math.max(
    0,
    Math.min(
      Math.floor(s.stamina / r.stamina),
      ...Object.entries(r.needs).map(([id, n]) =>
        Math.floor(s.materials[id as MaterialId] / n!),
      ),
    ),
  );
}
export function cleanSelection(
  s: GameState,
  selection: DeliverySelection,
): DeliverySelection {
  return {
    ordinary: [...new Set(selection.ordinary)].filter((id) =>
      jobs.some(
        (j) => j.id === id && j.category === "ordinary" && isOpen(j, s),
      ),
    ),
    promises: selection.promises.filter(
      (p, i, all) =>
        all.findIndex((q) => q.id === p.id) === i &&
        s.obligations.some(
          (o) =>
            o.id === p.id &&
            o.status === "active" &&
            o.terms.options.some((c) => c.id === p.option && c.days === 1) &&
            (o.terms.schedule
              ? o.due === absoluteDay(s)
              : o.due >= absoluteDay(s)),
        ),
    ),
  };
}
export function preparationNeeds(
  s: GameState,
  selection: DeliverySelection,
  memo: string[],
) {
  const needs: Partial<Record<RecipeId, number>> = {};
  for (const id of new Set([...memo, ...selection.ordinary])) {
    const j = jobs.find((j) => j.id === id && j.category === "ordinary");
    if (j?.recipe && isOpen(j, s))
      needs[j.recipe] = (needs[j.recipe] ?? 0) + (j.count ?? 1);
  }
  // Accepted special orders remain preparation targets before their delivery date.
  for (const o of s.obligations.filter(
    (o) => o.status === "active" && o.terms.kind === "advance",
  )) {
    const option =
      o.terms.options.find((c) =>
        selection.promises.some((p) => p.id === o.id && p.option === c.id),
      ) ?? o.terms.options[0];
    if (option)
      needs[option.recipe] = (needs[option.recipe] ?? 0) + option.count;
  }
  return needs;
}

/** Missing ingredients for the entire preparation memo, counted once per item. */
export function preparationMaterials(
  s: GameState,
  selection: DeliverySelection,
  memo: string[],
) {
  const needed: Partial<Record<MaterialId, number>> = {};
  for (const [id, total] of Object.entries(
    preparationNeeds(s, selection, memo),
  )) {
    const count = Math.max(0, total! - (s.stock[id as RecipeId] ?? 0));
    const recipe = recipes.find((r) => r.id === id)!;
    for (const [material, n] of Object.entries(recipe.needs))
      needed[material as MaterialId] =
        (needed[material as MaterialId] ?? 0) + count * n!;
  }
  return Object.fromEntries(
    Object.entries(needed)
      .map(([id, n]) => [id, Math.max(0, n! - s.materials[id as MaterialId])])
      .filter(([, n]) => Number(n) > 0),
  ) as Partial<Record<MaterialId, number>>;
}
