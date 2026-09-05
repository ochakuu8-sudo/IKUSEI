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
  people,
  personOpen,
  personOf,
  recipeOf,
  type GameState,
} from "../game";
import { previewAction } from "../presentation";
import type { UIState } from "../uiState";
export type HomeAction = "orders" | "brew" | "map" | "rest";
export const actionLabels = {
  orders: "仕事をする",
  brew: "調合",
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
  const person =
    people.find((p) => s.newPeople.includes(p.id) && personOpen(p, s)) ??
    people.find(
      (p) =>
        personOpen(p, s) &&
        jobs.some(
          (j) => j.person === p.id && j.category === "personal" && isOpen(j, s),
        ),
    );
  const rest = previewAction(s, { type: "rest" });
  const invitation = due
    ? `${personOf(due.terms.person).name}へ本日納品`
    : sale
      ? `${recipeOf(sale.recipe!).name}${sale.count ?? 1}個で${previewAction(s, { type: "deliver", ordinary: [sale.id], promises: [] }).money}G`
      : offer
        ? `${personOf(offer.person).name}から特別依頼`
        : prepare
          ? `${recipeOf(prepare.recipe!).name}をあと${Math.max(0, (prepare.count ?? 1) - (s.stock[prepare.recipe!] ?? 0))}個準備`
          : "人物からの依頼を探す";
  const items = [
    {
      id: "orders" as const,
      icon: ScrollText,
      note: "薬の納品・人物の依頼",
      status: invitation,
      urgent: !!due,
    },
    {
      id: "map" as const,
      icon: Map,
      note: "交流・採集・買い物",
      status: person ? `${person.name}の依頼を見る` : "街で素材を探す",
    },
    {
      id: "rest" as const,
      icon: Moon,
      note: "1日休養",
      status: `体力＋${rest.stamina}・品位＋${rest.axes.find((a) => a.axis === "品位")?.delta ?? 0}`,
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
            <b>
              {actionLabels[id]} <em>{id === "rest" ? "1日" : "実行1日"}</em>
            </b>
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
  brew,
  inventory,
  settings,
}: {
  brew: () => void;
  inventory: () => void;
  settings: () => void;
}) {
  return (
    <nav className="home-utilities" aria-label="準備と管理">
      <button type="button" aria-label="調合" onClick={brew}>
        <FlaskConical size={17} />
        <span>
          調合 <small>0日</small>
        </span>
      </button>
      <button type="button" onClick={inventory}>
        <Package size={17} />
        <span>
          持ち物 <small>0日</small>
        </span>
      </button>
      <button type="button" onClick={settings}>
        <Settings size={17} />
        設定
      </button>
    </nav>
  );
}
