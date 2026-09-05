import { backgroundSrc } from "../art";
import { outstandingTotal } from "../contracts";
import type { Action } from "../engine";
import { settlementOf, type GameState } from "../game";
import { Art, Badge, Button, Heading, money } from "./components";
import type { Route } from "./routes";

export function SettlementScreen({
  s,
  go,
  ask,
}: {
  s: GameState;
  go: (r: Route) => void;
  ask: (a: Action, t: string) => void;
}) {
  return (
    <>
      <Heading eyebrow="THE CHAPTER'S CLOSING">第{s.chapter}章の精算</Heading>
      <div className="settlement-layout">
        <Art src={backgroundSrc("settlement")} className="settlement-art" />
        <section className="paper">
          <Badge>返済前の見込み</Badge>
          <h2>帳面を閉じる前に</h2>
          <div className="stats">
            <div>
              <small>所持金</small>
              <b>{money(s.money)}</b>
            </div>
            <div>
              <small>今回の返済必要額</small>
              <b>{money(settlementOf(s).quota)}</b>
            </div>
            <div>
              <small>返済予定額</small>
              <b>{money(settlementOf(s).paid)}</b>
            </div>
            <div>
              <small>不足</small>
              <b>{money(settlementOf(s).shortfall)}</b>
            </div>
            <div>
              <small>追加利息</small>
              <b>{money(settlementOf(s).interest)}</b>
            </div>
            <div>
              <small>返済後の残債</small>
              <b>{money(settlementOf(s).debtAfter)}</b>
            </div>
          </div>
          <p>
            約束の未精算額：{money(outstandingTotal(s))}
            。約束への支払いは下の約束帳から行えます。支払うと章末に回せる所持金が変わります。
          </p>
          <Button onClick={() => go("journal")}>約束への支払いを確認</Button>
          {settlementOf(s).penalties.map((p) => (
            <p className="error" key={p.axis}>
              {p.axis} −{p.amount}
            </p>
          ))}
          <p>
            確定すると
            {s.chapter === 6
              ? "この育成を終了します。"
              : "次章の1日目へ進みます。"}
          </p>
          <Button
            primary
            onClick={() => ask({ type: "settle" }, "章末の返済を確定する")}
          >
            返済内容を確認して確定
          </Button>
        </section>
      </div>
    </>
  );
}
