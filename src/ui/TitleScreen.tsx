import { ArrowRight, Flower2, Settings } from "lucide-react";
import { backgroundSrc, heroSrc } from "../art";
import { type GameState } from "../game";
import { Art, Button } from "./components";
import type { Route } from "./routes";
export function TitleScreen({
  s,
  setRoute,
  setReset,
  start,
  setSettings,
}: {
  s: GameState | null;
  setRoute: (r: Route) => void;
  setReset: (r: "new") => void;
  start: (r: "new" | "demo") => void;
  setSettings: (v: boolean) => void;
}) {
  return (
    <main className="title-screen">
      <Art src={backgroundSrc("title")} className="title-background" />
      <div className="title-portrait">
        <Art src={heroSrc} alt="主人公 エレオノール" />
      </div>
      <section className="title-copy">
        <Flower2 className="title-rose" />
        <span className="eyebrow">THE APOTHECARY'S LEDGER</span>
        <h1>
          <span>没落令嬢の</span>返済録
        </h1>
        <p className="title-motto">一瓶の薬に、明日を託して。</p>
        <p>
          母から受け継いだ処方と、残された帳面。
          <br />
          何を守り、誰と約束を結ぶのか。
        </p>
        <div className="title-actions">
          <Button
            primary
            disabled={!s}
            onClick={() =>
              setRoute(
                s?.ended
                  ? "ending"
                  : s?.awaitingSettlement
                    ? "settlement"
                    : "home",
              )
            }
          >
            続きから <ArrowRight size={18} />
          </Button>
          <Button onClick={() => (s ? setReset("new") : start("new"))}>
            はじめから
          </Button>
          <Button onClick={() => setSettings(true)}>
            <Settings size={17} />
            設定
          </Button>
        </div>
        <small>薬房経営・育成シミュレーション / 開発版</small>
      </section>
    </main>
  );
}
