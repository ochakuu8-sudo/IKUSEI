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
import { CHAPTER_DAYS, quotaOf, type GameState } from "../game";
import { Actions, Utilities, type HomeAction } from "./Actions";
import { Art, Button, money } from "./components";
import type { Route } from "./routes";

export function Shell({
  s,
  route,
  choose,
  home,
  back,
  trail,
  journal,
  inventory,
  settings,
}: {
  s: GameState;
  route: Route;
  choose: (a: HomeAction) => void;
  home: () => void;
  back: () => void;
  trail: string;
  journal: (calendar?: boolean) => void;
  inventory: () => void;
  settings: () => void;
}) {
  const dueCount = s.obligations.filter(
    (o) =>
      (o.status === "active" && o.due <= absoluteDay(s)) ||
      (o.status !== "active" && o.outstanding > 0),
  ).length;
  const navigating = route !== "home" && !s.awaitingSettlement && !s.ended;
  const current: HomeAction | undefined =
    route === "orders" || route === "brew" || route === "map"
      ? route
      : undefined;
  return (
    <>
      <Art
        className="game-backdrop"
        src={backgroundSrc(
          route === "brew" ? "brew" : route === "map" ? "map" : "home",
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
        {/* 残債はこの画面で最も大きい数値にする(GAME_DESIGN §9)。
            今章のノルマ・不足・残り日数は、その下に1行で畳む。 */}
        <button
          className="hud-payment hud-debt"
          onClick={() => journal(true)}
          aria-label="残債と返済予定を開く"
        >
          <small>残債</small>
          <b>{money(s.debt)}</b>
          <span>
            第{s.chapter}章 {money(quotaOf(s))}
            <i className={s.money < quotaOf(s) ? "text-crimson" : ""}>
              {s.money < quotaOf(s)
                ? `不足 ${money(quotaOf(s) - s.money)}`
                : "達成"}
            </i>
            <i>あと{CHAPTER_DAYS - s.day + 1}日</i>
          </span>
        </button>
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
            <Actions s={s} choose={choose} compact active={current} />
            <Utilities
              endDay={() => choose("rest")}
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
          {/* サイドバーが出ない幅では、この下段が3コマンドの入口になる。 */}
          <div className="command-bar">
            <Actions s={s} choose={choose} compact active={current} />
          </div>
        </>
      )}
    </>
  );
}
