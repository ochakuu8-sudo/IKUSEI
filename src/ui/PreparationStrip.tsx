import { materialOf, recipeOf, type GameState, type RecipeId } from "../game";
import { preparationMaterials, preparationNeeds } from "../presentation";
import type { UIState } from "../uiState";
import { Button, Item } from "./components";

/** 「あと何が足りないか」は依頼詳細・調合・収集の3画面に散っていた。
    1本の帯に集約して、どの作業画面でも同じ answer が見えるようにする。 */
export function PreparationStrip({
  s,
  ui,
  toCollect,
  toBrew,
}: {
  s: GameState;
  ui: UIState;
  toCollect: () => void;
  toBrew: () => void;
}) {
  const needs = preparationNeeds(s, ui.selection, ui.memo);
  const short = Object.entries(needs)
    .map(([id, total]) => ({
      id: id as RecipeId,
      total: total!,
      missing: Math.max(0, total! - (s.stock[id as RecipeId] ?? 0)),
    }))
    .filter((r) => r.missing > 0);
  if (!short.length) return null;
  const materials = Object.entries(preparationMaterials(s, ui.selection, ui.memo));
  return (
    <div className="prep-strip" role="status">
      <b>準備中</b>
      <span className="prep-items">
        {short.map((r) => (
          <span key={r.id} className="prep-item">
            <Item id={r.id} />
            {recipeOf(r.id).name} ×{r.total}
            <i>あと{r.missing}</i>
          </span>
        ))}
      </span>
      <span className="prep-lack">
        {materials.length
          ? materials
              .map(([id, n]) => `${materialOf(id as never).name} あと${n}`)
              .join("・")
          : "素材は揃っています"}
      </span>
      <span className="prep-actions">
        {materials.length > 0 && <Button onClick={toCollect}>収集へ</Button>}
        <Button primary={materials.length === 0} onClick={toBrew}>
          調合へ
        </Button>
      </span>
    </div>
  );
}
