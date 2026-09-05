import { useEffect, useState } from "react";
import type { Action } from "../engine";
import {
  materialOf,
  placeOpen,
  places,
  recipeOf,
  type GameState,
  type MaterialId,
  type RecipeId,
} from "../game";
import { previewAction } from "../presentation";
import { quoteSummary } from "../workflow";
import { Badge, Button, Item, Quantity } from "./components";
import { DeadlineWarning } from "./ActionDock";

export function Preparation({
  state: s,
  recipe,
  required,
  confirm,
}: {
  state: GameState;
  recipe: RecipeId;
  required: number;
  confirm: (a: Action, title: string) => void;
}) {
  const r = recipeOf(recipe),
    missing = Math.max(0, required - (s.stock[recipe] ?? 0));
  const [quantity, setQuantity] = useState(Math.max(1, missing));
  useEffect(
    () => setQuantity(Math.max(1, missing)),
    [recipe, required, s.stock[recipe]],
  );
  if (!missing)
    return (
      <p className="preparation-ready">
        ✓ {r.name}は揃っています（必要{required}／所持{s.stock[recipe] ?? 0}）
      </p>
    );
  const shortages = Object.entries(r.needs)
    .map(
      ([id, n]) =>
        [
          id as MaterialId,
          Math.max(0, n! * quantity - s.materials[id as MaterialId]),
        ] as const,
    )
    .filter(([, n]) => n > 0);
  const sources = places
    .filter(
      (p) =>
        placeOpen(p, s) &&
        shortages.some(([id]) => p.sells?.includes(id) || p.gathers?.[id]),
    )
    .map((p) => {
      const a: Action = p.sells
        ? {
            type: "buy",
            place: p.id,
            basket: Object.fromEntries(
              shortages.filter(([id]) => p.sells!.includes(id)),
            ),
          }
        : { type: "gather", place: p.id };
      return { p, a, preview: previewAction(s, a) };
    });
  const brew: Action = { type: "brew", recipe, quantity },
    preview = previewAction(s, brew);
  return (
    <section className="inline-preparation" aria-label={`${r.name}の準備`}>
      <h3>足りないもの</h3>
      <p>
        <b>
          {r.name} あと{missing}個
        </b>{" "}
        <small>
          必要{required}／所持{s.stock[recipe] ?? 0}
        </small>
      </p>
      <div className="quantity-line">
        <label>作る数</label>
        <Quantity
          label={`${r.name}の調合数`}
          value={quantity}
          max={99}
          onChange={(n) => setQuantity(Math.max(1, n))}
        />
        <Button
          aria-label="不足数に合わせる"
          onClick={() => setQuantity(Math.min(99, missing))}
        >
          必要数
        </Button>
      </div>
      <div className="prep-materials">
        {Object.entries(r.needs).map(([id, n]) => (
          <div className="material-need" key={id}>
            <Item id={id as MaterialId} />
            <span>
              <b>{materialOf(id as MaterialId).name}</b>
              <small>
                必要{n! * quantity}／所持{s.materials[id as MaterialId]}
              </small>
            </span>
            <Badge
              tone={
                s.materials[id as MaterialId] < n! * quantity ? "warn" : "ready"
              }
            >
              {s.materials[id as MaterialId] < n! * quantity
                ? `不足 ${n! * quantity - s.materials[id as MaterialId]}`
                : "揃っています"}
            </Badge>
          </div>
        ))}
      </div>
      {sources.length > 0 && (
        <>
          <p className="muted">購入・採集後はこの依頼の準備に戻ります。</p>
          <DeadlineWarning state={s} action={sources[0].a} />
          {sources.map(({ p, a, preview: quote }) => (
            <div className="prep-source" key={p.id}>
              <Button
                disabled={!!quote.error}
                onClick={() =>
                  confirm(
                    a,
                    `${p.short}で${p.sells ? "不足分を買う" : "素材を採る"}`,
                  )
                }
              >
                {p.short}で{p.sells ? "不足分を買う" : "採る"}{" "}
                <small>{quoteSummary(s, a)}</small>
              </Button>
              <small>
                {p.sells
                  ? Object.entries(a.type === "buy" ? a.basket : {})
                      .map(
                        ([id, n]) =>
                          `${materialOf(id as MaterialId).name}×${n}`,
                      )
                      .join("・")
                  : Object.entries(p.gathers!)
                      .map(
                        ([id, n]) =>
                          `${materialOf(id as MaterialId).name}×${n}`,
                      )
                      .join("・")}
                {quote.error && ` ／ ${quote.error}`}
              </small>
            </div>
          ))}
        </>
      )}
      {!s.known.includes(recipe) && (
        <p className="error">この処方はまだ習得していません。</p>
      )}
      <Button
        primary
        disabled={!!preview.error}
        onClick={() => confirm(brew, `${r.name}を${quantity}個調合する`)}
      >
        {r.name}を{quantity}個調合する・0日{" "}
        <small>体力 −{r.stamina * quantity}</small>
      </Button>
      {preview.error && (
        <small className="muted">
          {shortages.length ? "素材を揃えると調合できます。" : preview.error}
        </small>
      )}
    </section>
  );
}
