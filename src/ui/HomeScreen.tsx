import { ArrowRight, Moon } from "lucide-react";
import { backgroundSrc, heroSrc } from "../art";
import { specialOffers } from "../content/support";
import { absoluteDay, offerReason } from "../contracts";
import type { Action } from "../engine";
import { recipeOf, type GameState, type RecipeId } from "../game";
import { preparationNeeds, previewAction } from "../presentation";
import type { UIState } from "../uiState";
import {
  Art,
  AxisPanel,
  Badge,
  Button,
  Heading,
  Item,
  money,
} from "./components";
import type { Route } from "./routes";

export function HomeScreen({
  s,
  ui,
  patch,
  go,
  prepare,
  ask,
}: {
  s: GameState;
  ui: UIState;
  patch: (p: Partial<UIState>) => void;
  go: (r: Route) => void;
  prepare: (id: RecipeId, n: number) => void;
  ask: (a: Action, t: string) => void;
}) {
  const rest = previewAction(s, { type: "rest" });
  const due = s.obligations.filter(
    (o) => o.status === "active" && o.due === absoluteDay(s),
  );
  const closing = specialOffers.filter(
    (o) => !offerReason(s, o) && o.schedule!.closes - absoluteDay(s) <= 1,
  );
  const needs = preparationNeeds(s, ui.selection, ui.memo);
  return (
    <>
      <Heading
        eyebrow="ELEONORE'S ROOM"
        extra={
          <Badge>
            第{s.chapter}章 · {s.day}日
          </Badge>
        }
      >
        自室
      </Heading>
      <div className="mobile-agenda">
        <Badge tone={due.length ? "warn" : ""}>
          本日の納品・支払 {due.length}件
        </Badge>
        <Button onClick={() => go("journal")}>予定を確認</Button>
      </div>
      <div className="home-layout">
        <section className="home-portrait">
          <Art src={backgroundSrc("home")} className="room-art" />
          <Art src={heroSrc} className="hero-art" alt="エレオノール" />
          <div className="hero-name">
            <span>ÉLÉONORE DE LATIER</span>
            <h2>エレオノール</h2>
          </div>
        </section>
        <section className="home-ledger">
          <div className="paper">
            <span className="eyebrow">WHAT WILL YOU KEEP?</span>
            <h2>守りたいもの</h2>
            <AxisPanel state={s} />
          </div>
          <div className="paper today-card">
            <span className="eyebrow">TODAY'S AGENDA</span>
            <h2>今日の帳面</h2>
            {due.map((o) => (
              <button
                className="agenda urgent"
                key={o.id}
                onClick={() => {
                  patch({ orderTab: "batch" });
                  go(o.terms.kind === "advance" ? "orders" : "journal");
                }}
              >
                <Badge tone="warn">
                  本日{o.terms.schedule ? "納品" : "期限"}
                </Badge>
                <b>{o.terms.title}</b>
                <ArrowRight size={18} />
              </button>
            ))}
            {closing.map((o) => (
              <button
                className="agenda"
                key={o.id}
                onClick={() => {
                  patch({ orderTab: "special" });
                  go("orders");
                }}
              >
                <Badge tone="warn">受付終了間近</Badge>
                <b>{o.title}</b>
              </button>
            ))}
            {Object.entries(needs).map(([id, n]) => (
              <button
                className="agenda"
                key={id}
                onClick={() => prepare(id as RecipeId, n!)}
              >
                <Item id={id as RecipeId} />
                <div>
                  <b>{recipeOf(id as RecipeId).name}</b>
                  <small>
                    必要 {n} ／ 在庫 {s.stock[id as RecipeId] ?? 0}
                  </small>
                </div>
                <Badge
                  tone={(s.stock[id as RecipeId] ?? 0) >= n! ? "ready" : ""}
                >
                  {(s.stock[id as RecipeId] ?? 0) >= n! ? "準備済み" : "準備中"}
                </Badge>
              </button>
            ))}
            {!due.length && !closing.length && !Object.keys(needs).length && (
              <p>
                急ぎの約束はありません。依頼書を読み、今日の支度を始めましょう。
              </p>
            )}
            <Button primary onClick={() => go("orders")}>
              薬の依頼書を開く <ArrowRight size={17} />
            </Button>
            {s.newPeople.length + s.newPlaces.length + s.newEvents.length >
              0 && (
              <Button onClick={() => go("map")}>新しく届いた紹介を見る</Button>
            )}
          </div>
          <div className="rest-card">
            <Moon />
            <div>
              <b>屋敷で休養する</b>
              <small>
                体力 ＋{rest?.stamina ?? 0} ／ 品位 ＋
                {rest?.axes.find((a) => a.axis === "品位")?.delta ?? 0} ／ 1日
              </small>
            </div>
            <Button onClick={() => ask({ type: "rest" }, "1日休養する")}>
              休養
            </Button>
          </div>
        </section>
      </div>
      <details className="paper history">
        <summary>最近の記録・残債 {money(s.debt)}</summary>
        {s.log.map((l, i) => (
          <p key={i}>{l}</p>
        ))}
      </details>
    </>
  );
}
