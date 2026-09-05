import { ArrowLeft, Home, Settings } from "lucide-react";
import { absoluteDay } from "../contracts";
import { backgroundSrc } from "../art";
import { Mark } from "../marks";
import { CHAPTER_DAYS, MAX_STAMINA, quotaOf, type GameState } from "../game";
import { Actions, Utilities, type HomeAction } from "./Actions";
import { Art, Button, money } from "./components";
import type { Route } from "./routes";

/** 画面の外枠。HUDと、唯一のナビゲーション層を持つ。
    route-bar は廃止した ── 戻る・自室へ・3コマンドが3層に散り、
    「戻る」も「自室へ」も2つずつ出ていた。 */
export function Shell({
  s,
  route,
  choose,
  home,
  back,
  journal,
  inventory,
  settings,
}: {
  s: GameState;
  route: Route;
  choose: (a: HomeAction) => void;
  home: () => void;
  back: () => void;
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
  const left = CHAPTER_DAYS - s.day + 1;
  const short = quotaOf(s) - s.money;
  return (
    <>
      <Art
        className="game-backdrop"
        src={backgroundSrc(
          route === "brew" ? "brew" : route === "map" ? "map" : "home",
        )}
      />
      {/* HUDは2つの塊にする。左＝いま自分を縛っているもの、右＝章を通した圧力。 */}
      <header className="hud">
        <button
          className="hud-clock"
          onClick={() => journal(true)}
          aria-label={`約束帳を開く。第${s.chapter}章${s.day}日目、返済まであと${left}日`}
        >
          <span className="hud-chapter">第{s.chapter}章</span>
          <span className="hud-days" aria-hidden="true">
            {Array.from({ length: CHAPTER_DAYS }, (_, i) => (
              <i key={i} className={i < s.day ? "spent" : ""} />
            ))}
          </span>
          <b>
            あと{left}日<small>／{s.day}日目</small>
          </b>
          {dueCount > 0 && (
            <em className="date-alert" aria-label={`期限・精算 ${dueCount}件`}>
              {dueCount}
            </em>
          )}
        </button>
        <div className="hud-stamina" aria-label={`スタミナ ${s.stamina}`}>
          <Mark name="体力" label="スタミナ" />
          <span className="hud-gauge">
            <i style={{ width: `${(s.stamina / MAX_STAMINA) * 100}%` }} />
          </span>
          <b>{s.stamina}</b>
        </div>
        {/* HUDの中央は530px空いていた。章の圧と、当日の記録を置く。 */}
        <div className="hud-board">
          <div
            className="hud-quota"
            aria-label={`第${s.chapter}章のノルマ ${quotaOf(s)}G のうち ${s.money}G`}
          >
            <span>
              章ノルマ
              <b>
                {money(s.money)}
                <small>／{money(quotaOf(s))}</small>
              </b>
            </span>
            <span className="hud-quota-bar" aria-hidden="true">
              <i
                className={short > 0 ? "" : "done"}
                style={{
                  width: `${Math.min(100, (s.money / Math.max(1, quotaOf(s))) * 100)}%`,
                }}
              />
            </span>
          </div>
          {/* 今日いくら稼いだかは、どこにも出ていなかった。
              納品回数は買い叩きの直接の原因なので並べて出す。 */}
          <div className="hud-today">
            <small>本日</small>
            <b>
              {s.today.deliveries.length}件
              <i>
                {s.today.earned > 0 ? `＋${money(s.today.earned)}` : "±0 G"}
              </i>
            </b>
          </div>
        </div>
        <div className="hud-spacer" />
        <div className="hud-purse">
          <small>所持金</small>
          <b>{money(s.money)}</b>
        </div>
        <button
          className="hud-debt"
          onClick={() => journal(true)}
          aria-label="残債と返済予定を開く"
        >
          <small>残債</small>
          <b>{money(s.debt)}</b>
          <span>
            第{s.chapter}章 {money(quotaOf(s))}
            <i className={short > 0 ? "text-crimson" : ""}>
              {short > 0 ? `不足 ${money(short)}` : "達成"}
            </i>
          </span>
        </button>
        <Button aria-label="設定" onClick={settings}>
          <Settings size={19} />
        </Button>
      </header>
      {navigating && (
        <>
          <aside className="action-sidebar">
            {/* 戻ると自室は同じ「移動」なので1行に並べ、
                固定キャンバスの縦をコマンドに回す。 */}
            <div className="rail-top">
              <Button onClick={back} aria-label="ひとつ戻る">
                <ArrowLeft size={17} />
                戻る
              </Button>
              <Button onClick={home} aria-label="自室へ">
                <Home size={17} />
                自室
              </Button>
            </div>
            <Actions s={s} choose={choose} compact active={current} />
            <Utilities
              compact
              endDay={() => choose("rest")}
              inventory={inventory}
              settings={settings}
            />
          </aside>
          {/* 縦持ちの唯一のナビ。戻ると自室もここに入れて1層に保つ。 */}
          <nav className="command-bar" aria-label="移動">
            <button
              type="button"
              className="bar-edge"
              onClick={back}
              aria-label="ひとつ戻る"
            >
              <ArrowLeft size={17} />
              <b>戻る</b>
            </button>
            <Actions s={s} choose={choose} compact active={current} />
            <button
              type="button"
              className="bar-edge"
              onClick={home}
              aria-label="自室へ"
            >
              <Home size={17} />
              <b>自室</b>
            </button>
          </nav>
        </>
      )}
    </>
  );
}
