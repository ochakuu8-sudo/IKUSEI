import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { supportOffers } from "./content/support";
import { performAction, type Action, type ActionOutcome } from "./engine";
import {
  initialState,
  jobs,
  midGameState,
  people,
  personOf,
  type GameState,
  type MaterialId,
  type PlaceId,
  type RecipeId,
} from "./game";
import { cleanSelection, previewAction } from "./presentation";
import {
  LEGACY_SAVE_KEY,
  parseSave,
  PREVIOUS_SAVE_KEY,
  SAVE_KEY,
} from "./save";
import { Brewing } from "./ui/Brewing";
import { Button, Modal, money, Preview } from "./ui/components";
import { EndingScreen } from "./ui/EndingScreen";
import { HomeScreen } from "./ui/HomeScreen";
import { Journal } from "./ui/Journal";
import { Dialogue, ResultDetails } from "./ui/Narrative";
import { OfferDetails, Orders } from "./ui/Orders";
import type { Route } from "./ui/routes";
import { SettlementScreen } from "./ui/SettlementScreen";
import { Shell } from "./ui/Shell";
import { TitleScreen } from "./ui/TitleScreen";
import { Place, World } from "./ui/World";
import { freshUI, parseUI, UI_KEY, type UIState } from "./uiState";

type Receipt = { before: GameState; outcome: ActionOutcome; title: string };
function loadGame() {
  try {
    return (
      parseSave(localStorage.getItem(SAVE_KEY)) ??
      parseSave(localStorage.getItem(PREVIOUS_SAVE_KEY)) ??
      parseSave(localStorage.getItem(LEGACY_SAVE_KEY))
    );
  } catch {
    return null;
  }
}
function loadUI() {
  try {
    return parseUI(localStorage.getItem(UI_KEY));
  } catch {
    return freshUI();
  }
}
export default function App() {
  const [game, setGame] = useState<GameState | null>(loadGame),
    [ui, setUI] = useState<UIState>(loadUI),
    [route, setRoute] = useState<Route>("title"),
    [place, setPlace] = useState<PlaceId>("estate");
  const [calendar, setCalendar] = useState(false);
  const [settings, setSettings] = useState(false),
    [help, setHelp] = useState(false),
    [reset, setReset] = useState<"new" | "delete" | "demo" | null>(null),
    [error, setError] = useState(""),
    [saveError, setSaveError] = useState("");
  const [pending, setPending] = useState<{
      action: Action;
      title: string;
    } | null>(null),
    [receipt, setReceipt] = useState<Receipt | null>(null),
    [resultOpen, setResultOpen] = useState(false),
    [scene, setScene] = useState<{
      lines: NonNullable<ActionOutcome["scene"]>;
      title: string;
      place: PlaceId;
    } | null>(null);
  const gameRef = useRef(game),
    lock = useRef<object | null>(null),
    content = useRef<HTMLElement>(null);
  gameRef.current = game;
  const patch = (p: Partial<UIState>) => setUI((u) => ({ ...u, ...p }));
  function writeSave(next: GameState | null) {
    try {
      if (next) localStorage.setItem(SAVE_KEY, JSON.stringify(next));
      else
        [SAVE_KEY, PREVIOUS_SAVE_KEY, LEGACY_SAVE_KEY].forEach((k) =>
          localStorage.removeItem(k),
        );
      setSaveError("");
      return true;
    } catch {
      setSaveError(
        "保存できませんでした。画面を閉じず、保存を再試行してください。",
      );
      return false;
    }
  }
  useEffect(() => {
    try {
      localStorage.setItem(UI_KEY, JSON.stringify(ui));
    } catch {
      setSaveError(
        "準備メモ・設定を保存できませんでした。保存領域を確認して再試行してください。",
      );
    }
  }, [ui]);
  useEffect(() => {
    document.documentElement.dataset.motion = ui.motion ? "reduced" : "normal";
  }, [ui.motion]);
  useEffect(() => {
    if (!game) return;
    setUI((u) => {
      const selection = cleanSelection(game, u.selection);
      return JSON.stringify(selection) === JSON.stringify(u.selection)
        ? u
        : { ...u, selection };
    });
  }, [game]);
  const scrollKey = `${route}:${route === "orders" ? ui.orderTab : route === "brew" ? ui.brewTab : route === "place" ? place : ""}`;
  useLayoutEffect(() => {
    if (content.current) content.current.scrollTop = ui.scroll[scrollKey] ?? 0;
  }, [scrollKey]);
  function go(next: Route) {
    setReceipt(null);
    if (game?.awaitingSettlement && next !== "journal" && next !== "settlement")
      next = "settlement";
    if (game?.ended) next = "ending";
    if (content.current)
      patch({
        scroll: { ...ui.scroll, [scrollKey]: content.current.scrollTop },
      });
    setError("");
    setRoute(next);
  }
  function visit(id: PlaceId) {
    const current = gameRef.current;
    if (!current) return;
    const o = performAction(current, { type: "visit", place: id });
    if (o.error) {
      setError(o.error);
      return;
    }
    gameRef.current = o.state;
    setGame(o.state);
    writeSave(o.state);
    setPlace(id);
    go(id === "estate" ? "home" : "place");
  }
  function ask(action: Action, title: string) {
    setError("");
    setPending({ action, title });
  }
  function execute() {
    if (!pending || lock.current === pending || !gameRef.current) return;
    lock.current = pending;
    const before = gameRef.current,
      a = pending.action,
      outcome = performAction(before, a);
    if (outcome.error) {
      setError(outcome.error);
      lock.current = null;
      return;
    }
    gameRef.current = outcome.state;
    setGame(outcome.state);
    writeSave(outcome.state);
    setPending(null);
    if (a.type === "deliver")
      patch({
        selection: { ordinary: [], promises: [] },
        memo: ui.memo.filter((id) => !a.ordinary.includes(id)),
      });
    if (a.type === "buy") patch({ basket: {} });
    const record = { before, outcome, title: pending.title };
    setReceipt(record);
    const important =
      a.type === "accept" ||
      a.type === "fulfill" ||
      (a.type === "deliver" && a.promises.length > 0) ||
      people.some(
        (p) => outcome.state.relations[p.id] > before.relations[p.id],
      ) ||
      !!outcome.result?.notices?.length;
    const firstJob =
      a.type === "job" &&
      !before.history.some((h) => h.kind === "job" && h.target === a.id);
    if (outcome.scene && (firstJob || a.type === "accept")) {
      setScene({
        lines: outcome.scene,
        title: pending.title,
        place:
          a.type === "job"
            ? personOf(jobs.find((j) => j.id === a.id)!.person).place
            : a.type === "accept"
              ? personOf(supportOffers.find((o) => o.id === a.offer)!.person)
                  .place
              : place,
      });
      setResultOpen(true);
    } else setResultOpen(important);
    if (outcome.state.ended) setRoute("ending");
    else if (outcome.state.awaitingSettlement && route !== "journal")
      setRoute("settlement");
    else if (a.type === "settle") setRoute("home");
    // The committed confirmation object cannot execute twice, without delaying a new action.
  }
  function prepare(id: RecipeId, n: number) {
    patch({
      recipe: id,
      quantity: Math.max(1, Math.min(99, n - (game?.stock[id] ?? 0))),
      brewTab: "recipes",
      brewDetail: true,
    });
    go("brew");
  }
  function source(id: PlaceId, material: MaterialId, n: number) {
    patch({
      basket: {
        ...ui.basket,
        [material]: Math.max(ui.basket[material] ?? 0, n),
      },
    });
    visit(id);
  }
  function start(mode: "new" | "demo") {
    const next = structuredClone(mode === "demo" ? midGameState : initialState);
    setGame(next);
    gameRef.current = next;
    writeSave(next);
    setUI({ ...freshUI(), motion: ui.motion, speed: ui.speed });
    setRoute("home");
    setReset(null);
    setSettings(false);
    setReceipt(null);
    setHelp(true);
  }
  const s = game,
    event =
      route !== "title" && !scene && !resultOpen ? s?.eventQueue[0] : undefined;
  const pendingPreview = pending && s ? previewAction(s, pending.action) : null;
  return (
    <div
      className={`app ${route === "title" ? "title-app" : ""} ${saveError ? "save-failed" : ""}`}
    >
      {route === "title" ? (
        <TitleScreen
          s={s}
          setRoute={setRoute}
          setReset={setReset}
          start={start}
          setSettings={setSettings}
        />
      ) : (
        s && (
          <>
            <Shell
              s={s}
              route={route}
              setCalendar={setCalendar}
              go={go}
              setSettings={setSettings}
              setHelp={setHelp}
            />
            <main
              className={`content screen-${route}`}
              ref={content}
              id="main-content"
            >
              <div className="content-inner">
                {error && !pending && (
                  <p className="error" role="alert">
                    {error}
                  </p>
                )}
                {route === "home" && (
                  <HomeScreen
                    s={s}
                    ui={ui}
                    patch={patch}
                    go={go}
                    prepare={prepare}
                    ask={ask}
                  />
                )}
                {route === "orders" && (
                  <Orders
                    s={s}
                    ui={ui}
                    patch={patch}
                    confirm={ask}
                    prepare={prepare}
                    journal={() => go("journal")}
                  />
                )}
                {route === "brew" && (
                  <Brewing
                    s={s}
                    ui={ui}
                    patch={patch}
                    confirm={ask}
                    source={source}
                    back={() => go("orders")}
                  />
                )}
                {route === "map" && <World s={s} visit={visit} />}
                {route === "place" && (
                  <Place
                    key={place}
                    s={s}
                    id={place}
                    ui={ui}
                    patch={patch}
                    confirm={ask}
                    back={() => go("map")}
                    returnBrew={() => go("brew")}
                  />
                )}
                {route === "journal" && (
                  <>
                    {s.awaitingSettlement && (
                      <Button primary onClick={() => go("settlement")}>
                        章末の精算に戻る
                      </Button>
                    )}
                    <Journal
                      key={calendar ? "calendar" : "promises"}
                      initialTab={calendar ? "calendar" : "promises"}
                      s={s}
                      confirm={ask}
                      prepare={(id, n, today) => {
                        if (today) {
                          patch({ orderTab: "batch" });
                          go("orders");
                        } else prepare(id, n);
                      }}
                    />
                  </>
                )}
                {route === "settlement" && (
                  <SettlementScreen s={s} go={go} ask={ask} />
                )}
                {route === "ending" && (
                  <EndingScreen s={s} setRoute={setRoute} />
                )}
              </div>
            </main>
            {receipt && !resultOpen && !scene && (
              <div className="receipt" role="status">
                <span>✓ {receipt.title}</span>
                <Button onClick={() => setResultOpen(true)}>結果の詳細</Button>
                <Button
                  aria-label="結果通知を閉じる"
                  onClick={() => setReceipt(null)}
                >
                  ×
                </Button>
              </div>
            )}
          </>
        )
      )}
      {saveError && (
        <div className="save-error" role="alert">
          {saveError}
          <Button
            onClick={() => {
              writeSave(game);
              try {
                localStorage.setItem(UI_KEY, JSON.stringify(ui));
              } catch {
                setSaveError("準備メモ・設定を保存できませんでした");
              }
            }}
          >
            保存を再試行
          </Button>
        </div>
      )}
      {settings && (
        <Modal title="設定" onClose={() => setSettings(false)}>
          <label className="setting-row">
            文字の表示速度
            <select
              value={ui.speed}
              onChange={(e) => patch({ speed: Number(e.target.value) })}
            >
              <option value={24}>標準</option>
              <option value={50}>ゆっくり</option>
              <option value={0}>一括表示</option>
            </select>
          </label>
          <label className="setting-row">
            動きを減らす
            <input
              type="checkbox"
              checked={ui.motion}
              onChange={(e) => patch({ motion: e.target.checked })}
            />
          </label>
          <Button
            onClick={() => {
              setSettings(false);
              setHelp(true);
            }}
          >
            遊び方を読む
          </Button>
          <p>
            ゲーム進行は自動保存されます。準備メモと表示設定は別に保存します。
          </p>
          <details>
            <summary>試作メニュー</summary>
            <p>中盤の仮データで開始します。現在の記録を上書きします。</p>
            <Button onClick={() => setReset("demo")}>中盤から試す</Button>
          </details>
          <details>
            <summary>セーブデータの管理</summary>
            <Button onClick={() => setReset("delete")}>セーブを初期化</Button>
          </details>
          <Button
            onClick={() => {
              setSettings(false);
              setRoute("title");
            }}
          >
            タイトルへ戻る
          </Button>
        </Modal>
      )}
      {reset && (
        <Modal
          title={
            reset === "delete"
              ? "セーブを初期化しますか？"
              : "新しい記録を始めますか？"
          }
          onClose={() => setReset(null)}
          footer={
            <>
              <Button onClick={() => setReset(null)}>戻る</Button>
              <Button
                primary
                onClick={() => {
                  if (reset === "delete") {
                    if (writeSave(null)) {
                      setGame(null);
                      gameRef.current = null;
                      setUI(freshUI());
                      setRoute("title");
                      setReset(null);
                      setSettings(false);
                    }
                  } else start(reset);
                }}
              >
                現在の記録を消して実行
              </Button>
            </>
          }
        >
          <p>
            現在のゲーム進行と準備メモを上書きします。この操作は元に戻せません。
          </p>
        </Modal>
      )}
      {help && (
        <Modal
          title="薬房の最初の一日"
          onClose={() => {
            setHelp(false);
            patch({ helpSeen: true });
          }}
          footer={
            <Button
              primary
              onClick={() => {
                setHelp(false);
                patch({ helpSeen: true });
              }}
            >
              帳面を開く
            </Button>
          }
        >
          <ol className="help-steps">
            <li>
              <b>通常依頼で日々の収入を</b>
              <p>事前受注は不要。薬を揃えて選び、まとめて1日で納めます。</p>
            </li>
            <li>
              <b>足りない薬は調合で</b>
              <p>
                準備メモや納品の選択を残したまま、処方を確認。調合は体力を使い、日数は進みません。
              </p>
            </li>
            <li>
              <b>素材の入手先を調べる</b>
              <p>
                不足素材から地図や商会へ。見るだけは0日、採集・仕入れは1日です。
              </p>
            </li>
            <li>
              <b>指定日の約束を守る</b>
              <p>
                特別依頼は期間内に前金で受諾し、指定日当日に納品。予定表で返済と一緒に管理できます。
              </p>
            </li>
          </ol>
        </Modal>
      )}
      {pending && s && (
        <Modal
          title={pending.title}
          onClose={() => {
            setPending(null);
            setError("");
          }}
          footer={
            <>
              <Button
                onClick={() => {
                  setPending(null);
                  setError("");
                }}
              >
                戻る
              </Button>
              <Button
                primary
                disabled={!!pendingPreview?.error}
                onClick={execute}
              >
                この内容で実行
              </Button>
            </>
          }
        >
          <Preview state={s} action={pending.action} />
          {pending.action.type === "accept" && (
            <OfferDetails
              offer={
                supportOffers.find(
                  (o) =>
                    o.id ===
                    ("offer" in pending.action ? pending.action.offer : ""),
                )!
              }
            />
          )}{" "}
          {pending.action.type === "cancel" && (
            <p>
              前金の返還義務は残ります。返還まで同じ相手の新規支援が停止します。
            </p>
          )}
          {pending.action.type === "settle" && (
            <p>
              これは返済の確定です。確定後の所持金：
              {money(pendingPreview?.state.money ?? 0)}。
            </p>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </Modal>
      )}
      {resultOpen && receipt && !scene && (
        <Modal
          title={receipt.title}
          onClose={() => setResultOpen(false)}
          footer={
            <Button primary onClick={() => setResultOpen(false)}>
              続ける
            </Button>
          }
        >
          <ResultDetails before={receipt.before} outcome={receipt.outcome} />
        </Modal>
      )}
      {scene && (
        <Dialogue
          title={scene.title}
          lines={scene.lines}
          place={scene.place}
          speed={ui.speed}
          onDone={() => setScene(null)}
        />
      )}
      {event && (
        <Dialogue
          key={event.id}
          title={event.title}
          lines={event.lines.map((text) => ({ text }))}
          place={event.place}
          speed={ui.speed}
          onDone={() => {
            const current = gameRef.current!;
            const out = performAction(current, {
              type: "read-event",
              id: event.id,
            });
            if (!out.error) {
              gameRef.current = out.state;
              setGame(out.state);
              writeSave(out.state);
            }
          }}
        />
      )}
    </div>
  );
}
