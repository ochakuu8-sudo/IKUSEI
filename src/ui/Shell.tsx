import {
  CalendarDays,
  Coins,
  Heart,
  Home,
  ArrowLeft,
  Settings,
} from "lucide-react";
import { absoluteDay } from "../contracts";
import { backgroundSrc } from "../art";
import { quotaOf, type GameState } from "../game";
import type { UIState } from "../uiState";
import { Actions, Utilities, type HomeAction } from "./Actions";
import { Art, Button, money } from "./components";
import type { Route } from "./routes";

export function Shell({
  s,
  ui,
  route,
  choose,
  home,
  back,
  trail,
  journal,
  inventory,
  settings,
  place,
}: {
  s: GameState;
  ui: UIState;
  route: Route;
  choose: (a: HomeAction) => void;
  home: () => void;
  back: () => void;
  trail: string;
  journal: (calendar?: boolean) => void;
  inventory: () => void;
  settings: () => void;
  place: string;
}) {
  const dueCount = s.obligations.filter(
    (o) =>
      (o.status === "active" && o.due <= absoluteDay(s)) ||
      (o.status !== "active" && o.outstanding > 0),
  ).length;
  const navigating = route !== "home" && !s.awaitingSettlement && !s.ended;
  return (
    <>
      <Art
        className="game-backdrop"
        src={backgroundSrc(
          route === "place"
            ? place
            : route === "brew"
              ? "brew"
              : route === "map"
                ? "map"
                : "home",
        )}
      />
      <header className="hud">
        <button
          className="hud-date"
          onClick={() => journal(true)}
          aria-label="日付から予定表を開く"
        >
          <CalendarDays />
          {dueCount > 0 && (
            <b className="date-alert" aria-label={`期限・精算 ${dueCount}件`}>
              {dueCount}
            </b>
          )}
          <span>
            <small>第{s.chapter}章</small>
            <b>
              {absoluteDay(s)}
              <small>日目</small>
            </b>
          </span>
        </button>
        <div className="hud-resource hud-coins">
          <Coins />
          <span>
            <small>所持金</small>
            <b>{money(s.money)}</b>
          </span>
        </div>
        <div className="hud-resource hud-stamina">
          <Heart />
          <span>
            <small>スタミナ</small>
            <b>
              {s.stamina}
              <small> / 100</small>
            </b>
          </span>
        </div>
        <div className="hud-payment">
          <span>
            返済まで <b>{14 - s.day + 1}日</b>
            <small>必要 {money(quotaOf(s))}</small>
          </span>
          <span className={s.money < quotaOf(s) ? "text-crimson" : ""}>
            不足 {money(Math.max(0, quotaOf(s) - s.money))}
          </span>
        </div>
        <Button aria-label="設定" onClick={settings}>
          <Settings size={19} />
        </Button>
      </header>
      {navigating && (
        <>
          <aside className="action-sidebar">
            <Button onClick={home}>
              <Home size={17} />
              自室へ
            </Button>
            <p>今日の行動</p>
            <Actions
              s={s}
              ui={ui}
              choose={choose}
              compact
              active={
                route === "place"
                  ? "map"
                  : route === "orders" || route === "brew" || route === "map"
                    ? route
                    : undefined
              }
            />
            <Utilities
              brew={() => choose("rest")}
              inventory={inventory}
              settings={settings}
            />
          </aside>
          <div className="route-bar">
            <Button onClick={back} aria-label="ひとつ戻る">
              <ArrowLeft size={17} />
              戻る
            </Button>
            <span aria-label="現在の場所">{trail}</span>
            <Button onClick={home} className="route-home">
              <Home size={17} />
              自室へ
            </Button>
          </div>
        </>
      )}
    </>
  );
}
