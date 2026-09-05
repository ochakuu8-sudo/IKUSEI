import {
  materialOf,
  recipeOf,
  type GameState,
  type RecipeId,
  type MaterialId,
} from "../game";
import { Button, Item, Badge } from "./components";
export function Preparation({
  state: s,
  recipe,
  required,
  prepare,
}: {
  state: GameState;
  recipe: RecipeId;
  required: number;
  prepare: (recipe: RecipeId, required: number, collect: boolean) => void;
}) {
  const r = recipeOf(recipe),
    missing = Math.max(0, required - (s.stock[recipe] ?? 0));
  const shortages = Object.entries(r.needs)
    .map(
      ([id, n]) =>
        [
          id as MaterialId,
          Math.max(0, n! * missing - s.materials[id as MaterialId]),
        ] as const,
    )
    .filter(([, n]) => n > 0);
  return (
    <section className="preparation-summary">
      <div className="item-row">
        <Item id={recipe} />
        <span>
          <b>
            {r.name} ×{required}
          </b>
          <small>
            手持ち {s.stock[recipe] ?? 0}
            {missing ? ` ／ あと${missing}個` : " ／ 納品できます"}
          </small>
        </span>
      </div>
      {missing > 0 && (
        <>
          <h3>足りないもの</h3>
          {shortages.map(([id, n]) => (
            <p key={id}>
              {materialOf(id).name} <Badge tone="warn">あと{n}</Badge>
            </p>
          ))}
          {!shortages.length && <p>素材は揃っています。</p>}
        </>
      )}
    </section>
  );
}
