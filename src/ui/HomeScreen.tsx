import { heroSrc } from "../art";
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
          <span className="speaker-name">エレオノール</span>
          <h1>
            {s.stamina < 30
              ? "少し、ひと休みしようかしら。"
              : "今日は、何をしようかしら。"}
          </h1>
        </div>
        {(due.length > 0 ||
          s.obligations.some(
            (o) => o.outstanding > 0 && o.status !== "active",
          )) && (
          <button className="home-notice" onClick={journal}>
            {due.length
              ? `本日の納品・支払 ${due.length}件`
              : "前金の返還待ちがあります"}{" "}
            <span>確認 →</span>
          </button>
        )}
        <p className="browse-note">選ぶだけなら日数は進みません</p>
        <Actions s={s} ui={ui} choose={choose} />
        <Utilities
          brew={() => choose("brew")}
          inventory={inventory}
          settings={settings}
        />
        {!ui.helpSeen && (
          <div className="first-hint">
            <p>仕事を選び、必要ならその場で薬を準備できます。</p>
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
