import {
  ArrowRight,
  FlaskConical,
  Map,
  Moon,
  Package,
  ScrollText,
  Settings,
} from "lucide-react";
import { specialOffers } from "../content/support";
import { itemSrc } from "../art";
import { Art } from "./components";
import { absoluteDay, offerReason } from "../contracts";
import {
  isOpen,
  jobs,
  materialOf,
  personOf,
  recipeOf,
  recipes,
  type GameState,
} from "../game";
import { brewCapacity, previewAction } from "../presentation";
import { jobSupply } from "../workflow";
export type HomeAction = "orders" | "brew" | "map" | "rest";
export const actionLabels = {
  orders: "依頼",
  brew: "調合",
  map: "収集",
  rest: "一日を終える",
};
export function Actions({
  s,
  choose,
  active,
  compact = false,
}: {
  s: GameState;
  choose: (a: HomeAction) => void;
  active?: HomeAction;
  compact?: boolean;
}) {
  const due = s.obligations.find(
    (o) =>
      o.status === "active" &&
      o.terms.kind === "advance" &&
      o.due === absoluteDay(s),
  );
  const offer = specialOffers.find((o) => !offerReason(s, o));
  const sale = jobs.find(
    (j) =>
      j.category === "ordinary" &&
      isOpen(j, s) &&
      !previewAction(s, { type: "deliver", ordinary: [j.id], promises: [] })
        .error,
  );
  const prepare = jobs.find((j) => j.category === "ordinary" && isOpen(j, s));
  const invitation = due
    ? `${personOf(due.terms.person).name}へ本日納品`
    : sale
      ? `${recipeOf(sale.recipe!).name}${sale.count ?? 1}個で${previewAction(s, { type: "deliver", ordinary: [sale.id], promises: [] }).money}G`
      : offer
        ? `${personOf(offer.person).name}から特別依頼`
        : prepare
          ? `${recipeOf(prepare.recipe!).name}をあと${Math.max(0, (prepare.count ?? 1) - (s.stock[prepare.recipe!] ?? 0))}個準備`
          : "人物からの依頼を探す";
  // 副題は固定文ではなく、いまの盤面を書く。同じ面積で情報量だけ増える。
  const shortages = jobs
    .filter((j) => j.category === "ordinary" && isOpen(j, s))
    .map((j) => jobSupply(j, s))
    .filter((sp) => sp && sp.missing > 0 && sp.lacking.length)
    .flatMap((sp) => sp!.lacking);
  const lack = shortages.length
    ? `${materialOf(shortages[0].id).name}があと${Math.max(
        ...shortages
          .filter((l) => l.id === shortages[0].id)
          .map((l) => l.short),
      )}`
    : "素材は足りている";
  const brewable = recipes
    .filter((r) => s.known.includes(r.id) && brewCapacity(s, r.id) > 0)
    .map((r) => `${r.name}を${brewCapacity(s, r.id)}個`);
  const items = [
    {
      id: "orders" as const,
      icon: ScrollText,
      note: "薬の依頼を確認・納品",
      status: invitation,
      urgent: !!due,
    },
    {
      id: "map" as const,
      icon: Map,
      note: "素材を採る・買う",
      status: lack,
    },
    {
      id: "brew" as const,
      icon: FlaskConical,
      note: "素材から薬を作る",
      status: brewable.length
        ? `${brewable[0]}作れる`
        : "作れる薬がありません",
    },
  ];
  return (
    <nav
      aria-label={compact ? "行動の切替" : "今日の行動"}
      className={`commands day-commands ${compact ? "compact-commands" : ""}`}
    >
      {items.map(({ id, icon: Icon, note, status, urgent }) => (
        <button
          type="button"
          key={id}
          className={`command-button ${active === id ? "is-active" : ""}`}
          data-action={id}
          aria-label={actionLabels[id]}
          aria-current={active === id ? "page" : undefined}
          onClick={() => choose(id)}
        >
          <span className="command-emblem" aria-hidden="true">
            {!compact && id === "orders" ? (
              <Art src={itemSrc("perfume")} />
            ) : (
              <Icon />
            )}
          </span>
          <span className="command-copy">
            <b>{actionLabels[id]}</b>
            {!compact && <small>{note}</small>}
            {/* 側のレールでは進行中の急ぎだけを出す。常設の一言まで置くと
                3段になり、固定キャンバスの縦を食い切る。 */}
            {(!compact || urgent) && (
              <span className={`command-status ${urgent ? "urgent" : ""}`}>
                {status}
              </span>
            )}
          </span>
          <ArrowRight className="command-arrow" size={18} aria-hidden="true" />
        </button>
      ))}
    </nav>
  );
}
export function Utilities({
  endDay,
  inventory,
  settings,
  compact = false,
}: {
  endDay: () => void;
  inventory: () => void;
  settings: () => void;
  compact?: boolean;
}) {
  return (
    <nav className="home-utilities" aria-label="準備と管理">
      <button
        type="button"
        className="util-endday"
        aria-label="一日を終える"
        onClick={endDay}
      >
        <Moon size={17} />
        <span className="util-long">一日を終える</span>
        <span className="util-short">終了</span>
      </button>
      <button type="button" className="util-inventory" onClick={inventory}>
        <Package size={17} />
        <span className="util-long">持ち物</span>
        <span className="util-short">持物</span>
      </button>
      {/* レールでは設定をHUDの歯車に任せる。 */}
      {!compact && (
        <button type="button" className="util-settings" onClick={settings}>
          <Settings size={17} />
          設定
        </button>
      )}
    </nav>
  );
}
