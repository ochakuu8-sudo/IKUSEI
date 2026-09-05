import {
  jobs,
  recipes,
  materialIds,
  type RecipeId,
  type MaterialId,
} from "./game";
import type { DeliverySelection } from "./delivery";
export const UI_KEY = "ikusei-ui-v1";
export type UIState = {
  memo: string[];
  selection: DeliverySelection;
  orderTab: string;
  filter: string;
  sort: string;
  recipe: RecipeId;
  brewTab: string;
  brewDetail: boolean;
  quantity: number;
  basket: Partial<Record<MaterialId, number>>;
  motion: boolean;
  speed: number;
  helpSeen: boolean;
  scroll: Record<string, number>;
};
export const freshUI = (): UIState => ({
  memo: [],
  selection: { ordinary: [], promises: [] },
  orderTab: "normal",
  filter: "all",
  sort: "name",
  recipe: "tisane",
  brewTab: "recipes",
  brewDetail: false,
  quantity: 1,
  basket: {},
  motion: false,
  speed: 24,
  helpSeen: false,
  scroll: {},
});
export function parseUI(raw: string | null): UIState {
  const d = freshUI();
  try {
    const v = JSON.parse(raw ?? "null");
    if (!v || typeof v !== "object") return d;
    const ids = (a: unknown) =>
      Array.isArray(a)
        ? ([
            ...new Set(
              a.filter(
                (id) =>
                  typeof id === "string" &&
                  jobs.some((j) => j.id === id && j.category === "ordinary"),
              ),
            ),
          ] as string[])
        : [];
    d.memo = ids(v.memo);
    d.selection.ordinary = ids(v.selection?.ordinary);
    d.selection.promises = Array.isArray(v.selection?.promises)
      ? v.selection.promises
          .filter(
            (p: any) =>
              p && typeof p.id === "string" && typeof p.option === "string",
          )
          .map((p: any) => ({ id: p.id, option: p.option }))
      : [];
    const tabs = {
      orderTab: ["normal", "special", "batch"],
      filter: ["all", "ready", "need"],
      sort: ["name", "pay"],
      brewTab: ["recipes", "potions", "materials"],
    };
    for (const key of ["orderTab", "filter", "sort", "brewTab"] as const)
      if (tabs[key].includes(v[key])) d[key] = v[key];
    if (recipes.some((r) => r.id === v.recipe)) d.recipe = v.recipe;
    if (Number.isSafeInteger(v.quantity) && v.quantity > 0 && v.quantity <= 99)
      d.quantity = v.quantity;
    for (const id of materialIds)
      if (
        Number.isSafeInteger(v.basket?.[id]) &&
        v.basket[id] >= 0 &&
        v.basket[id] <= 999
      )
        d.basket[id] = v.basket[id];
    d.brewDetail = v.brewDetail === true;
    d.motion = v.motion === true;
    d.helpSeen = v.helpSeen === true;
    if ([0, 24, 50].includes(v.speed)) d.speed = v.speed;
    if (v.scroll && typeof v.scroll === "object")
      for (const [key, value] of Object.entries(v.scroll))
        if (typeof value === "number" && Number.isFinite(value) && value >= 0)
          d.scroll[key] = value;
    return d;
  } catch {
    return d;
  }
}
