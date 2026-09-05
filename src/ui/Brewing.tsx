import { ArrowLeft, ArrowRight } from "lucide-react";
import { backgroundSrc } from "../art";
import type { Action } from "../engine";
import {
  materialOf,
  materials,
  placeOpen,
  places,
  RECIPE_SOURCE,
  recipeOf,
  recipes,
  type GameState,
  type MaterialId,
  type PlaceId,
  type RecipeId,
} from "../game";
import { brewCapacity, preparationNeeds } from "../presentation";
import type { UIState } from "../uiState";
import {
  Art,
  Badge,
  Button,
  Heading,
  Item,
  Quantity,
  Tabs,
} from "./components";
export function Brewing({
  s,
  ui,
  patch,
  confirm,
  source,
  back,
}: {
  s: GameState;
  ui: UIState;
  patch: (p: Partial<UIState>) => void;
  confirm: (a: Action, title: string) => void;
  source: (p: PlaceId, id: MaterialId, n: number) => void;
  back: () => void;
}) {
  const detail = ui.brewDetail;
  const setDetail = (brewDetail: boolean) => patch({ brewDetail });
  const r = recipeOf(ui.recipe),
    capacity = brewCapacity(s, r.id),
    needs = preparationNeeds(s, ui.selection, ui.memo),
    missing = Math.max(0, (needs[r.id] ?? 0) - (s.stock[r.id] ?? 0));
  return (
    <>
      <Heading
        eyebrow="THE APOTHECARY"
        extra={
          <Button onClick={back}>
            <ArrowLeft size={16} />
            依頼書に戻る
          </Button>
        }
      >
        調合と在庫
      </Heading>
      <Tabs
        value={ui.brewTab}
        onChange={(brewTab) => patch({ brewTab })}
        options={[
          ["recipes", "処方"],
          ["potions", "所持薬"],
          ["materials", "素材"],
        ]}
      />
      {ui.brewTab === "recipes" && (
        <div className={`split brew-layout ${detail ? "show-detail" : ""}`}>
          <section className="recipe-list">
            <p className="intro">素材と体力で調合します。日数は進みません。</p>
            {recipes
              .filter((r) => s.known.includes(r.id))
              .map((recipe) => (
                <button
                  key={recipe.id}
                  className={`recipe-option ${r.id === recipe.id ? "selected" : ""}`}
                  onClick={() => {
                    patch({ recipe: recipe.id, quantity: 1 });
                    setDetail(true);
                  }}
                >
                  <Item id={recipe.id} />
                  <span>
                    <b>{recipe.name}</b>
                    <small>
                      所持 {s.stock[recipe.id] ?? 0} ／ 調合可能{" "}
                      {brewCapacity(s, recipe.id)}
                    </small>
                  </span>
                  {Math.max(
                    0,
                    (needs[recipe.id] ?? 0) - (s.stock[recipe.id] ?? 0),
                  ) > 0 && <Badge tone="warn">準備中</Badge>}
                  <ArrowRight size={16} />
                </button>
              ))}
            <details className="paper">
              <summary>
                未習得の処方 ({recipes.length - s.known.length})
              </summary>
              <p>人物との関係や頼まれごとを通じて覚えます。</p>
              {recipes
                .filter((r) => !s.known.includes(r.id))
                .map((r) => (
                  <p key={r.id}>
                    {r.name} <Badge>未習得</Badge>
                  </p>
                ))}
            </details>
          </section>
          <section className="paper recipe-detail">
            <Button className="mobile-back" onClick={() => setDetail(false)}>
              <ArrowLeft size={16} />
              処方一覧
            </Button>
            <div className="recipe-visual">
              <Art src={backgroundSrc("brew")} className="recipe-background" />
              <Item id={r.id} large />
              <span>RECIPE BOOK</span>
            </div>
            <div className="card-top">
              <h2>{r.name}</h2>
              <Badge>調合可能 {capacity}個</Badge>
            </div>
            <p>{r.note}</p>
            <small className="muted">{RECIPE_SOURCE[r.id]}</small>
            <div className="quantity-line">
              <label>作る数</label>
              <Quantity
                value={ui.quantity}
                onChange={(quantity) =>
                  patch({ quantity: Math.max(1, quantity) })
                }
              />
              <Button
                disabled={!missing}
                onClick={() => patch({ quantity: Math.min(99, missing) })}
              >
                必要数を作る ({missing})
              </Button>
            </div>
            <h3>必要な素材</h3>
            {Object.entries(r.needs).map(([key, n]) => {
              const id = key as MaterialId,
                needed = n! * ui.quantity,
                lack = Math.max(0, needed - s.materials[id]);
              return (
                <div className="material-block" key={id}>
                  <div className="material-need">
                    <Item id={id} />
                    <div>
                      <b>{materialOf(id).name}</b>
                      <small>
                        必要 {needed} ／ 手持ち {s.materials[id]}
                      </small>
                    </div>
                    <Badge tone={lack ? "warn" : "ready"}>
                      {lack ? `不足 ${lack}` : "準備済み"}
                    </Badge>
                  </div>
                  {lack > 0 && (
                    <div className="source-links">
                      {places
                        .filter(
                          (p) =>
                            placeOpen(p, s) &&
                            (p.gathers?.[id] || p.sells?.includes(id)),
                        )
                        .map((p) => (
                          <Button
                            key={p.id}
                            onClick={() => source(p.id, id, lack)}
                          >
                            {p.short}で
                            {p.sells?.includes(id) ? "仕入れ" : "採集"}{" "}
                            <ArrowRight size={14} />
                          </Button>
                        ))}
                      {!places.some(
                        (p) =>
                          placeOpen(p, s) &&
                          (p.gathers?.[id] || p.sells?.includes(id)),
                      ) && <small>現在、利用できる入手先はありません。</small>}
                    </div>
                  )}
                </div>
              );
            })}
            <div className="action-bar local">
              <div>
                <strong>体力 −{r.stamina * ui.quantity}</strong>
                <small>日数消費なし ／ 完成 {ui.quantity}個</small>
              </div>
              <Button
                primary
                disabled={capacity < ui.quantity || !s.known.includes(r.id)}
                onClick={() =>
                  confirm(
                    { type: "brew", recipe: r.id, quantity: ui.quantity },
                    `${r.name}を${ui.quantity}個調合`,
                  )
                }
              >
                調合を確認
              </Button>
            </div>
            {capacity < ui.quantity && (
              <p className="error">
                素材または体力が足りません。入手先や自室の休養を確認してください。
              </p>
            )}
          </section>
        </div>
      )}
      {ui.brewTab !== "recipes" && (
        <div className="inventory-grid">
          {(ui.brewTab === "potions" ? recipes : materials).map((item) => (
            <article className="paper" key={item.id}>
              <Item id={item.id} large />
              <h2>{item.name}</h2>
              <strong className="inventory-count">
                {ui.brewTab === "potions"
                  ? (s.stock[item.id as RecipeId] ?? 0)
                  : s.materials[item.id as MaterialId]}{" "}
                <small>個</small>
              </strong>
              <p>{item.note}</p>
              {ui.brewTab === "potions" &&
                s.known.includes(item.id as RecipeId) && (
                  <Button
                    onClick={() => {
                      patch({
                        recipe: item.id as RecipeId,
                        brewTab: "recipes",
                      });
                      setDetail(true);
                    }}
                  >
                    処方を開く
                  </Button>
                )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
