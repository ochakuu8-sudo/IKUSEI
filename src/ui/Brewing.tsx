import { ArrowRight } from "lucide-react";
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
import { brewCapacity, preparationNeeds, previewAction } from "../presentation";
import type { UIState } from "../uiState";
import { Badge, Button, Heading, Item, Quantity, Tabs } from "./components";
import { ActionDock } from "./ActionDock";

export function Brewing({
  s,
  ui,
  patch,
  confirm,
  source,
  back,
  open,
  inventory = false,
  deliver,
}: {
  s: GameState;
  ui: UIState;
  patch: (p: Partial<UIState>) => void;
  confirm: (a: Action, title: string) => void;
  source: (p: PlaceId, id: MaterialId, n: number) => void;
  back: () => void;
  open: (p: Partial<UIState>) => void;
  inventory?: boolean;
  deliver: () => void;
}) {
  const r = recipeOf(ui.recipe),
    capacity = brewCapacity(s, r.id);
  const needs = preparationNeeds(s, ui.selection, ui.memo);
  const target = needs[r.id] ?? 0,
    missing = Math.max(0, target - (s.stock[r.id] ?? 0));
  const shortages = Object.entries(r.needs)
    .map(
      ([id, n]) =>
        [
          id,
          Math.max(0, n! * ui.quantity - s.materials[id as MaterialId]),
        ] as const,
    )
    .filter(([, n]) => n > 0);
  const preview = previewAction(s, {
    type: "brew",
    recipe: r.id,
    quantity: ui.quantity,
  });
  const select = (id: RecipeId) =>
    open({
      recipe: id,
      quantity: Math.max(1, (needs[id] ?? 0) - (s.stock[id] ?? 0)),
      brewTab: "recipes",
      brewDetail: true,
    });
  return (
    <>
      <Heading eyebrow="THE APOTHECARY">
        {inventory ? "持ち物" : "調合する"}
      </Heading>
      {inventory ? (
        <Tabs
          value={ui.brewTab}
          onChange={(brewTab) => patch({ brewTab })}
          options={[
            ["potions", "所持薬"],
            ["materials", "素材"],
          ]}
        />
      ) : (
        <p className="intro">
          作る薬と数量を選びます。素材とスタミナを使います。
        </p>
      )}
      {!inventory && (
        <div className={`brew-workspace ${ui.brewDetail ? "detail-open" : ""}`}>
          <section className="recipe-list" aria-label="薬の一覧">
            {recipes
              .filter((r) => s.known.includes(r.id))
              .map((recipe) => (
                <button
                  className={`recipe-option ${ui.brewDetail && r.id === recipe.id ? "selected" : ""}`}
                  key={recipe.id}
                  onClick={() => select(recipe.id)}
                >
                  <Item id={recipe.id} />
                  <span>
                    <b>{recipe.name}</b>
                    <small>
                      所持 {s.stock[recipe.id] ?? 0} ／ 作れる数{" "}
                      {brewCapacity(s, recipe.id)}
                    </small>
                  </span>
                  <ArrowRight size={18} />
                </button>
              ))}
            <details>
              <summary>
                未習得の処方 ({recipes.length - s.known.length})
              </summary>
              <p>薬の取引や特別依頼で覚えます。</p>
              {recipes
                .filter((r) => !s.known.includes(r.id))
                .map((r) => (
                  <p key={r.id}>{r.name}</p>
                ))}
            </details>
          </section>
          {ui.brewDetail && (
            <section className="paper brew-sheet">
              <div className="card-top">
                <div className="item-row">
                  <Item id={r.id} />
                  <h2>{r.name}</h2>
                </div>
                <Badge>調合可能 {capacity}個</Badge>
              </div>
              {target > 0 && (
                <div className="preparation-line">
                  {missing
                    ? `納品に必要：あと${missing}個`
                    : "納品用の薬が揃いました"}
                </div>
              )}
              <div className="quantity-line">
                <label>作る数</label>
                <Quantity
                  value={ui.quantity}
                  onChange={(quantity) =>
                    patch({ quantity: Math.max(1, quantity) })
                  }
                />
                {missing > 0 && (
                  <Button
                    onClick={() => patch({ quantity: Math.min(99, missing) })}
                  >
                    不足数に合わせる ({missing})
                  </Button>
                )}
              </div>
              <div className="ingredient-list">
                {Object.entries(r.needs).map(([key, n]) => (
                  <div className="material-need" key={key}>
                    <Item id={key as MaterialId} />
                    <div>
                      <b>{materialOf(key as MaterialId).name}</b>
                      <small>
                        必要 {n! * ui.quantity} ／ 手持ち{" "}
                        {s.materials[key as MaterialId]}
                      </small>
                    </div>
                    <Badge
                      tone={
                        s.materials[key as MaterialId] >= n! * ui.quantity
                          ? "ready"
                          : "warn"
                      }
                    >
                      {s.materials[key as MaterialId] >= n! * ui.quantity
                        ? "揃っています"
                        : `不足 ${n! * ui.quantity - s.materials[key as MaterialId]}`}
                    </Badge>
                  </div>
                ))}
              </div>
              {shortages.length > 0 && (
                <section className="source-options">
                  <h3>不足素材を集める</h3>
                  {places
                    .filter(
                      (p) =>
                        placeOpen(p, s) &&
                        shortages.some(
                          ([id]) =>
                            p.sells?.includes(id as MaterialId) ||
                            p.gathers?.[id as MaterialId],
                        ),
                    )
                    .map((p) => {
                      const available = shortages.filter(
                        ([id]) =>
                          p.sells?.includes(id as MaterialId) ||
                          p.gathers?.[id as MaterialId],
                      );
                      const full = shortages.every(
                        ([id, n]) =>
                          p.sells?.includes(id as MaterialId) ||
                          (p.gathers?.[id as MaterialId] ?? 0) >= n,
                      );
                      const price = p.sells
                        ? available.reduce(
                            (sum, [id, n]) =>
                              sum + n * (materialOf(id as MaterialId).buy ?? 0),
                            0,
                          )
                        : 0;
                      return (
                        <button
                          className="source-option"
                          key={p.id}
                          onClick={() =>
                            source(
                              p.id,
                              available[0][0] as MaterialId,
                              available[0][1],
                            )
                          }
                        >
                          <span>
                            <b>
                              {p.short}で{p.sells ? "仕入れ" : "採集"}
                            </b>
                            <small>
                              {available
                                .map(
                                  ([id]) => materialOf(id as MaterialId).name,
                                )
                                .join("・")}{" "}
                              ／ {full ? "不足分が揃う" : "一部を入手"}
                            </small>
                          </span>
                          <span>
                            {p.sells
                              ? `${price}G`
                              : `スタミナ −${p.gatherStamina}`}
                            <small>体力 {p.gatherStamina ?? 0}</small>
                          </span>
                          <ArrowRight size={16} />
                        </button>
                      );
                    })}
                </section>
              )}
              <details>
                <summary>処方について</summary>
                <p>{r.note}</p>
                <p>{RECIPE_SOURCE[r.id]}</p>
              </details>
              <ActionDock
                next={
                  ui.preparing && target > 0 && !missing
                    ? { label: "依頼へ戻る", onClick: deliver }
                    : undefined
                }
                state={s}
                action={{ type: "brew", recipe: r.id, quantity: ui.quantity }}
                back={back}
                confirm={confirm}
                title={r.name + "を" + ui.quantity + "個調合する"}
                label={r.name + "を" + ui.quantity + "個調合する"}
              />
            </section>
          )}
        </div>
      )}
      {inventory && (
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
                  <Button onClick={() => select(item.id as RecipeId)}>
                    調合へ
                  </Button>
                )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
