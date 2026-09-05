import {
  ArrowRight,
  BookOpen,
  FlaskConical,
  Map,
  Moon,
  Package,
  ScrollText,
  Settings,
} from "lucide-react";
import { specialOffers } from "../content/support";
import { absoluteDay, offerReason } from "../contracts";
import { recipes, type GameState } from "../game";
import { brewCapacity, preparationNeeds, previewAction } from "../presentation";
import type { UIState } from "../uiState";

export type HomeAction = "orders" | "brew" | "map" | "rest";
export const actionLabels = {
  orders: "薬の依頼を見る",
  brew: "調合する",
  map: "出かける",
  rest: "休む",
};
export function Actions({
  s,
  ui,
  choose,
  active,
  compact = false,
}: {
  s: GameState;
  ui: UIState;
  choose: (action: HomeAction) => void;
  active?: HomeAction;
  compact?: boolean;
}) {
  const due = s.obligations.filter(
    (o) =>
      o.status === "active" &&
      o.terms.kind === "advance" &&
      o.due === absoluteDay(s),
  ).length;
  const offers = specialOffers.filter((o) => !offerReason(s, o)).length;
  const possible = recipes.filter((r) => brewCapacity(s, r.id) > 0).length;
  const preparing =
    Object.keys(preparationNeeds(s, ui.selection, ui.memo)).length > 0;
  const fresh = s.newPeople.length + s.newPlaces.length + s.newEvents.length;
  const rest = previewAction(s, { type: "rest" });
  const items = [
    {
      id: "orders" as const,
      icon: ScrollText,
      note: "薬を納める・特別な注文を引き受ける",
      status: due ? `本日納品 ${due}件` : offers ? `受付中 ${offers}件` : "",
      urgent: due > 0,
    },
    {
      id: "brew" as const,
      icon: FlaskConical,
      note: "素材と体力を使って薬を作る",
      status: possible
        ? `調合可能 ${possible}種`
        : preparing
          ? "準備中の薬あり"
          : "日数消費なし",
    },
    {
      id: "map" as const,
      icon: Map,
      note: "素材を採る・買う・人物に会う",
      status: fresh ? `新着 ${fresh}件` : "場所を見るだけなら0日",
    },
    {
      id: "rest" as const,
      icon: Moon,
      note: `体力 ＋${rest.stamina}・品位 ＋${rest.axes.find((a) => a.axis === "品位")?.delta ?? 0}`,
      status: "1日使って休養",
    },
  ];
  return (
    <nav
      aria-label={compact ? "行動の切替" : "今日の行動"}
      className={`commands ${compact ? "compact-commands" : ""}`}
    >
      {items.map(({ id, icon: Icon, note, status, urgent }) => (
        <button
          type="button"
          key={id}
          className={`command-button ${active === id ? "is-active" : ""}`}
          aria-label={actionLabels[id]}
          aria-current={active === id ? "page" : undefined}
          onClick={() => choose(id)}
        >
          <Icon aria-hidden="true" />
          <span className="command-copy">
            <b>{actionLabels[id]}</b>
            {!compact && <small>{note}</small>}
            <span className={`command-status ${urgent ? "urgent" : ""}`}>
              {status}
            </span>
          </span>
          <ArrowRight className="command-arrow" size={18} aria-hidden="true" />
        </button>
      ))}
    </nav>
  );
}
export function Utilities({
  journal,
  inventory,
  settings,
  due = 0,
}: {
  journal: () => void;
  inventory: () => void;
  settings: () => void;
  due?: number;
}) {
  return (
    <div className="home-utilities">
      <button type="button" aria-label="約束帳" onClick={journal}>
        <BookOpen size={17} />
        約束帳{due > 0 && <b className="due-dot">{due}</b>}
      </button>
      <button type="button" onClick={inventory}>
        <Package size={17} />
        持ち物
      </button>
      <button type="button" onClick={settings}>
        <Settings size={17} />
        記録・設定
      </button>
    </div>
  );
}
