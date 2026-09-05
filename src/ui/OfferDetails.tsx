import { dateLabel } from "../contracts";
import { recipeOf } from "../game";
import { rewardLabel } from "../rewards";
import type { SupportOffer } from "../supportTypes";
import { Item, money } from "./components";
export function OfferDetails({ offer }: { offer: SupportOffer }) {
  return (
    <>
      <div className="stats">
        <div>
          <small>受付期間</small>
          <b>
            {offer.schedule
              ? `${offer.schedule.appears}〜${offer.schedule.closes}日目`
              : `${offer.opens}〜${offer.closes}日`}
          </b>
        </div>
        <div>
          <small>{offer.schedule ? "指定日当日のみ" : "支払期限"}</small>
          <b>
            {offer.schedule
              ? dateLabel(offer.schedule.delivery)
              : `相談から${offer.term}日`}
          </b>
        </div>
        <div>
          <small>前金 / 残額</small>
          <b>
            {money(offer.money)} / {money(offer.totalPay - offer.money)}
          </b>
        </div>
      </div>
      {offer.options.map((o) => (
        <div className="item-row" key={o.id}>
          <Item id={o.recipe} />
          <div>
            <b>
              {recipeOf(o.recipe).name} × {o.count}
            </b>
            <small>スタミナ {o.stamina}</small>
          </div>
        </div>
      ))}
      <div className="reward-list">
        {offer.rewards?.map((r, i) => (
          <span key={i}>✧ {rewardLabel(r)}</span>
        ))}
      </div>
    </>
  );
}
