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
  const settlement = settlementOf(s);
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
              <b>{money(settlement.quota)}</b>
            </div>
            <div>
              <small>返済予定額</small>
              <b>{money(settlement.paid)}</b>
            </div>
            <div>
              <small>不足</small>
              <b>{money(settlement.shortfall)}</b>
            </div>
            <div>
              <small>追加利息</small>
              <b>{money(settlement.interest)}</b>
            </div>
          </div>
          {/* 残債は常に画面で最も大きい数値にする(GAME_DESIGN §9)。 */}
          <div className="settlement-debt">
            <small>返済後の残債</small>
            <strong>{money(settlement.debtAfter)}</strong>
          </div>
          <p>
            約束の未精算額：{money(outstandingTotal(s))}
            。約束への支払いは約束帳から行えます。支払うと章末に回せる所持金が変わります。
          </p>
          {settlement.penalties.length > 0 && (
            <div className="settlement-penalty" role="note">
              <b>納められないと、返せない見本として扱われる</b>
              {settlement.penalties.map((p) => (
                <span key={p.axis}>
                  {p.axis} −{p.amount}
                </span>
              ))}
              <small>
                下がった尊厳は、その分だけ紹介される依頼を閉じます。
              </small>
            </div>
          )}
          {/* 主要動作は画面外に出さない。狭い画面では下端に貼り付ける。 */}
          <div className="settlement-actions">
            <small>
              確定すると
              {s.chapter === 6
                ? "この育成を終了します。"
                : "次章の1日目へ進みます。"}
            </small>
            <Button onClick={() => go("journal")}>約束への支払い</Button>
            <Button
              primary
              onClick={() => ask({ type: "settle" }, "章末の返済を確定する")}
            >
              返済内容を確認して確定
            </Button>
          </div>
        </section>
      </div>
    </>
  );
}
