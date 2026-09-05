import { mapSrc, personSrc } from "../art";
import { supportOffers } from "../content/support";
import { offerReason } from "../contracts";
import type { Action } from "../engine";
import {
  recipeOf,
  materialOf,
  people,
  personOf,
  personOpen,
  personalJobsAt,
  placeOf,
  placeOpen,
  places,
  relationStage,
  type GameState,
  type MaterialId,
  type PersonId,
  type PlaceId,
} from "../game";
import { preparationMaterials, previewAction } from "../presentation";
import { quoteSummary } from "../workflow";
import type { UIState } from "../uiState";
import {
  Tabs,
  Art,
  Badge,
  Button,
  Empty,
  Heading,
  Item,
  Quantity,
  money,
  Preview,
} from "./components";
import { ActionDock } from "./ActionDock";
export function World({
  s,
  ui,
  confirm,
  patch,
  toBrew,
  back,
}: {
  s: GameState;
  ui: UIState;
  confirm: (a: Action, title: string) => void;
  patch: (p: Partial<UIState>) => void;
  toBrew: () => void;
  back: () => void;
  shop: (id: PlaceId) => void;
  viewPerson: (id: PersonId | null) => void;
  personJobs: (id: PersonId) => void;
}) {
  const recipe = recipeOf(ui.recipe);
  const missing = Object.entries(recipe.needs).filter(
    ([id, n]) => s.materials[id as MaterialId] < n! * ui.quantity,
  );
  const vendor = places.find((p) => p.sells && placeOpen(p, s));
  return (
    <div className="collection-screen">
      <Heading eyebrow="GATHERING">収集</Heading>
      {ui.preparing && (
        <div className="preparation-line">
          <b>
            準備中：{recipe.name} ×{ui.quantity}
          </b>
          {missing.length ? (
            <span>
              {missing
                .map(
                  ([id, n]) =>
                    materialOf(id as MaterialId).name +
                    " あと" +
                    (n! * ui.quantity - s.materials[id as MaterialId]),
                )
                .join(" ／ ")}
            </span>
          ) : (
            <Button primary onClick={toBrew}>
              調合へ
            </Button>
          )}
        </div>
      )}
      <Tabs
        value={ui.placeMode === "supply" ? "supply" : "menu"}
        onChange={(placeMode) =>
          patch({ placeMode: placeMode as UIState["placeMode"] })
        }
        options={[
          ["menu", "採集"],
          ["supply", "仕入れ"],
        ]}
      />
      {ui.placeMode === "supply" && vendor ? (
        <Place
          s={s}
          id={vendor.id}
          ui={ui}
          patch={patch}
          confirm={confirm}
          back={back}
        />
      ) : (
        <div className="gather-list">
          {places
            .filter((p) => p.gathers && placeOpen(p, s))
            .map((p) => {
              const action: Action = { type: "gather", place: p.id },
                preview = previewAction(s, action);
              return (
                <article className="paper gather-card" key={p.id}>
                  <h2>{p.name}</h2>
                  <div>
                    {Object.entries(p.gathers!).map(([id, n]) => (
                      <div className="item-row" key={id}>
                        <Item id={id as MaterialId} />
                        <span>
                          {materialOf(id as MaterialId).name} ×{n}
                          <small>手持ち {s.materials[id as MaterialId]}</small>
                        </span>
                      </div>
                    ))}
                  </div>
                  <p>スタミナ −{p.gatherStamina}</p>
                  <Button
                    primary={!ui.preparing || missing.length > 0}
                    disabled={!!preview.error}
                    onClick={() => confirm(action, p.name + "で採集する")}
                  >
                    採集する
                  </Button>
                  {preview.error && (
                    <small className="error">{preview.error}</small>
                  )}
                </article>
              );
            })}
        </div>
      )}
    </div>
  );
}
export function Place({
  s,
  id,
  ui,
  patch,
  confirm,
  back,
}: {
  s: GameState;
  id: PlaceId;
  ui: UIState;
  patch: (p: Partial<UIState>) => void;
  confirm: (a: Action, title: string) => void;
  back: () => void;
}) {
  const p = placeOf(id);
  if (!placeOpen(p, s) || !p.sells)
    return <Empty>この買い物先は利用できません。</Empty>;
  const basket = Object.fromEntries(
    Object.entries(ui.basket).filter(([id]) =>
      p.sells!.includes(id as MaterialId),
    ),
  );
  const shortages = ui.preparing
    ? Object.fromEntries(
        Object.entries(recipeOf(ui.recipe).needs).map(([id, n]) => [
          id,
          Math.max(0, n! * ui.quantity - s.materials[id as MaterialId]),
        ]),
      )
    : preparationMaterials(s, ui.selection, ui.memo);
  const purchase: Action = { type: "buy", place: id, basket };
  return (
    <div className="shop-screen">
      <Heading eyebrow="SHOP">{p.name}で買い物</Heading>
      <p className="intro">必要な数量を選びます。購入は資金のみを使います。</p>
      <section className="paper supply">
        {p.sells.some((id) => (shortages[id] ?? 0) > 0) && (
          <Button
            onClick={() =>
              patch({
                basket: {
                  ...basket,
                  ...Object.fromEntries(
                    p.sells!.map((id) => [
                      id,
                      Math.max(basket[id] ?? 0, shortages[id] ?? 0),
                    ]),
                  ),
                },
              })
            }
          >
            準備中の不足分を追加
          </Button>
        )}
        {p.sells.map((id) => (
          <div className="material-need" key={id}>
            <Item id={id} />
            <div>
              <b>{materialOf(id).name}</b>
              <small>
                単価 {money(materialOf(id).buy ?? 0)} ／ 所持{s.materials[id]}
              </small>
            </div>
            <Quantity
              label={`${materialOf(id).name}の購入数`}
              value={ui.basket[id] ?? 0}
              max={999}
              onChange={(n) => patch({ basket: { ...ui.basket, [id]: n } })}
            />
          </div>
        ))}
      </section>
      <details className="credit-options">
        <summary>掛け仕入れを相談する</summary>
        {supportOffers
          .filter((o) => o.kind === "credit" && personOf(o.person).place === id)
          .map((o) => (
            <section key={o.id}>
              <h3>{o.title}</h3>
              <p>{o.description}</p>
              <p>
                {Object.entries(o.materials)
                  .map(
                    ([id, n]) => materialOf(id as MaterialId).name + " ×" + n,
                  )
                  .join(" ／ ")}{" "}
                ／ 支払額 {money(o.repayment)}
              </p>
              <Button
                disabled={!!offerReason(s, o)}
                onClick={() =>
                  confirm({ type: "accept", offer: o.id }, o.title)
                }
              >
                条件を確認する
              </Button>
              {offerReason(s, o) && <p>{offerReason(s, o)}</p>}
            </section>
          ))}
      </details>
      <ActionDock
        state={s}
        action={purchase}
        confirm={confirm}
        back={back}
        title="素材をまとめて購入する"
      />
    </div>
  );
}
