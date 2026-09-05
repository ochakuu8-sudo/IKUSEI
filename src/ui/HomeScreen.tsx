import { backgroundSrc, heroSrc } from "../art";
import { absoluteDay } from "../contracts";
import type { GameState } from "../game";
import type { UIState } from "../uiState";
import { Actions, Utilities, type HomeAction } from "./Actions";
import { Art, AxisPanel } from "./components";

export function HomeScreen({
  s,
  ui,
  choose,
  journal,
  inventory,
  settings,
  patch,
  status,
}: {
  s: GameState;
  ui: UIState;
  choose: (a: HomeAction) => void;
  journal: () => void;
  inventory: () => void;
  settings: () => void;
  patch: (p: Partial<UIState>) => void;
  status: () => void;
}) {
  const due = s.obligations.filter(
    (o) => o.status === "active" && o.due === absoluteDay(s),
  );
  return (
    <div className="home-stage">
      <section className="home-character" aria-label="主人公の現在の状態">
        <div className="character-scene">
          <Art src={backgroundSrc("home")} className="room-art" />
          <Art src={heroSrc} className="hero-art" alt="エレオノール" />
          <div className="character-name">エレオノール・ラティエ</div>
        </div>
        <button
          className="character-status"
          aria-label="3軸の状態と意味を見る"
          onClick={status}
        >
          <AxisPanel state={s} />
        </button>
      </section>
      <section className="home-decisions">
        <div className="command-heading">
          <span className="eyebrow">ÉLÉONORE'S DAY</span>
          <h1>今日、どうする？</h1>
        </div>
        {due.length > 0 && (
          <button className="home-notice" onClick={journal}>
            本日の納品・支払 {due.length}件 <span>約束帳で確認 →</span>
          </button>
        )}
        <Actions s={s} ui={ui} choose={choose} />
        <Utilities
          journal={journal}
          inventory={inventory}
          settings={settings}
          due={due.length}
        />
        {!ui.helpSeen && (
          <div className="first-hint">
            <p>まずは「薬の依頼を見る」から、日々の稼ぎ口を探しましょう。</p>
            <button
              aria-label="初回のヒントを閉じる"
              onClick={() => patch({ helpSeen: true })}
            >
              ×
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
