import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { supportOffers } from "./content/support";
import { performAction, type Action, type ActionOutcome } from "./engine";
import {
  initialState,
  jobs,
  midGameState,
  people,
  placeOf,
  recipeOf,
  axes,
  axisStage,
  type GameState,
  type PlaceId,
} from "./game";
import { cleanSelection, previewAction } from "./presentation";
import {
  LEGACY_SAVE_KEY,
  V9_SAVE_KEY,
  V10_SAVE_KEY,
  parseSave,
  PREVIOUS_SAVE_KEY,
  SAVE_KEY,
} from "./save";
import { actionLabel } from "./workflow";
import { DeadlineWarning } from "./ui/ActionDock";
import { Brewing } from "./ui/Brewing";
import { Button, Modal, money, Preview, AxisPanel } from "./ui/components";
import type { HomeAction } from "./ui/Actions";
import { EndingScreen } from "./ui/EndingScreen";
import { HomeScreen } from "./ui/HomeScreen";
import { Journal } from "./ui/Journal";
import { Dialogue, ResultDetails } from "./ui/Narrative";
import { OfferDetails, Orders } from "./ui/Orders";
import type { Route } from "./ui/routes";
import { SettlementScreen } from "./ui/SettlementScreen";
import { Shell } from "./ui/Shell";
import { TitleScreen } from "./ui/TitleScreen";
import { World } from "./ui/World";
import { freshUI, parseUI, UI_KEY, type UIState } from "./uiState";

type Receipt = {
  before: GameState;
  outcome: ActionOutcome;
  title: string;
  returnTo: TrailEntry;
};
type TrailEntry = { route: Route; place: PlaceId; ui: Partial<UIState> };
function loadGame() {
  try {
    return (
      parseSave(localStorage.getItem(SAVE_KEY)) ??
      parseSave(localStorage.getItem(V10_SAVE_KEY)) ??
      parseSave(localStorage.getItem(V9_SAVE_KEY)) ??
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
  const [trail, setTrail] = useState<TrailEntry[]>([]),
    [statusOpen, setStatusOpen] = useState(false);
  const [settings, setSettings] = useState(false),
    [help, setHelp] = useState(false),
    [reset, setReset] = useState<"new" | "delete" | "demo" | null>(null),
    [error, setError] = useState(""),
    [saveError, setSaveError] = useState("");
  const [pending, setPending] = useState<{
      action: Action;
      title: string;
      returnTo?: TrailEntry;
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
        [
          SAVE_KEY,
          V10_SAVE_KEY,
          V9_SAVE_KEY,
          PREVIOUS_SAVE_KEY,
          LEGACY_SAVE_KEY,
        ].forEach(
          (k) => localStorage.removeItem(k),
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
  useEffect(() => {
    if (!receipt || resultOpen || scene) return;
    const timer = window.setTimeout(() => setReceipt(null), 2400);
    return () => clearTimeout(timer);
  }, [receipt, resultOpen, scene]);
  const scrollKey = `${route}:${ui.orderTab}:${ui.orderId}:${ui.brewTab}:${ui.brewDetail}:${ui.recipe}:${place}:${ui.placeMode}`;
  useLayoutEffect(() => {
    if (content.current) content.current.scrollTop = ui.scroll[scrollKey] ?? 0;
  }, [scrollKey]);
  function snapshot(): TrailEntry {
    return {
      route,
      place,
      ui: {
        filter: ui.filter,
        sort: ui.sort,
        personFilter: ui.personFilter,
        orderTab: ui.orderTab,
        orderId: ui.orderId,
        brewTab: ui.brewTab,
        brewDetail: ui.brewDetail,
        recipe: ui.recipe,
        placeMode: ui.placeMode,
        preparing: ui.preparing,
      },
    };
  }
  function go(next: Route, changes: Partial<UIState> = {}) {
    setReceipt(null);
    if (game?.awaitingSettlement && next !== "journal" && next !== "settlement")
      next = "settlement";
    if (game?.ended) next = "ending";
    if (content.current)
      patch({
        scroll: { ...ui.scroll, [scrollKey]: content.current.scrollTop },
      });
    setError("");
    if (next === "home") setTrail([]);
    else setTrail((t) => [...t, snapshot()]);
    patch(changes);
    setRoute(next);
  }
  function back() {
    if (route === "orders" && (ui.orderId || ui.orderTab === "batch")) {
      patch({
        orderId: null,
        ...(ui.orderTab === "batch" ? { orderTab: "all" } : {}),
      });
      return;
    }
    if (route === "brew" && ui.brewDetail) {
      patch({ brewDetail: false });
      return;
    }
    const previous = trail.at(-1);
    if (!previous) {
      go("home");
      return;
    }
    if (content.current)
      patch({
        scroll: { ...ui.scroll, [scrollKey]: content.current.scrollTop },
      });
    setTrail((t) => t.slice(0, -1));
    setRoute(previous.route);
    setPlace(previous.place);
    patch(previous.ui);
    setError("");
    setReceipt(null);
  }
  function choose(action: HomeAction) {
    if (action === "rest") {
      ask({ type: "end-day" }, "一日を終える");
      return;
    }
    go(action, {
      preparing: false,
      ...(action === "orders"
        ? {
            orderTab: "normal",
            orderId: null,
            personFilter: null,
            filter: "all",
          }
        : action === "brew"
          ? { brewTab: "recipes", brewDetail: false }
          : {}),
    });
    setTrail([{ route: "home", place: "estate", ui: {} }]);
  }
  function resume(target: Route, changes: Partial<UIState> = {}) {
    const index = trail.map((entry) => entry.route).lastIndexOf(target);
    if (index < 0) {
      go(target, changes);
      return;
    }
    const entry = trail[index];
    if (content.current)
      patch({
        scroll: { ...ui.scroll, [scrollKey]: content.current.scrollTop },
      });
    setTrail((t) => t.slice(0, index));
    setRoute(entry.route);
    setPlace(entry.place);
    patch({ ...entry.ui, ...changes });
    setError("");
    setReceipt(null);
  }
  function journal(showCalendar = false) {
    setCalendar(showCalendar);
    go("journal");
  }
  function inventory() {
    go("inventory", { brewTab: "potions", preparing: false });
  }
  /** 解禁された人物・場所・出来事の「新着」を、実際に見た時点で降ろす。 */
  function markSeen(id: PlaceId) {
    const current = gameRef.current;
    if (!current) return;
    const o = performAction(current, { type: "visit", place: id });
    if (o.error) return;
    gameRef.current = o.state;
    setGame(o.state);
    writeSave(o.state);
  }
  function ask(action: Action, title: string, returnTo?: TrailEntry) {
    setError("");
    setPending({ action, title, returnTo });
  }
  function arrive(target: TrailEntry, state: GameState) {
    const destination = state.ended
      ? "ending"
      : state.awaitingSettlement && target.route !== "journal"
        ? "settlement"
        : target.route;
    setRoute(destination);
    if (
      destination === "home" ||
      destination === "ending" ||
      destination === "settlement"
    )
      setTrail([]);
    else {
      setPlace(target.place);
      patch(target.ui);
    }
  }
  function finishResult() {
    setResultOpen(false);
    if (receipt && gameRef.current) arrive(receipt.returnTo, gameRef.current);
    setReceipt(null);
  }
  function execute(request = pending) {
    if (!request || lock.current === request || !gameRef.current) return;
    lock.current = request;
    const before = gameRef.current,
      a = request.action,
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
    const days = outcome.result?.days ?? 0;
    const returnTo =
      request.returnTo ??
      (days > 0 || a.type === "settle"
        ? { route: "home" as const, place: "estate" as const, ui: {} }
        : snapshot());
    const record = { before, outcome, title: request.title, returnTo };
    if (a.type === "accept" && route === "orders") {
      const accepted = outcome.state.obligations.find(
        (o) =>
          o.offerId === a.offer &&
          !before.obligations.some((old) => old.id === o.id),
      );
      if (accepted?.terms.kind === "advance")
        returnTo.ui = {
          ...returnTo.ui,
          orderTab: "special",
          orderId: `promise:${accepted.id}`,
        };
    }
    setReceipt(record);
    const important =
      days > 0 ||
      a.type === "accept" ||
      a.type === "fulfill" ||
      (a.type === "deliver" && a.promises.length > 0) ||
      people.some(
        (p) => outcome.state.relations[p.id] > before.relations[p.id],
      ) ||
      !!outcome.result?.notices?.length;
    if (outcome.scene?.length) {
      setScene({
        lines: outcome.scene,
        title: request.title,
        place: outcome.scenePlace ?? place,
      });
      setResultOpen(true);
    } else setResultOpen(important);
    if (!important && !outcome.scene) arrive(returnTo, outcome.state);
    // The committed confirmation object cannot execute twice, without delaying a new action.
  }
  /** 不足素材の入手先へ移る。買う数は準備中の処方と数量から引き直す。 */
  function source(id: PlaceId) {
    const current = gameRef.current;
    if (!current) return;
    const p = placeOf(id),
      r = recipeOf(ui.recipe);
    const basket = Object.fromEntries(
      (p.sells ?? []).map((item) => [
        item,
        Math.max(
          0,
          (r.needs[item] ?? 0) * ui.quantity - current.materials[item],
        ),
      ]),
    );
    go("map", {
      preparing: true,
      placeMode: p.sells ? "supply" : "menu",
      basket,
    });
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
    setHelp(false);
    setTrail([]);
  }
  const s = game,
    event =
      route !== "title" && !scene && !resultOpen ? s?.eventQueue[0] : undefined;
  const pendingPreview = pending && s ? previewAction(s, pending.action) : null;
  const routeLabel =
    route === "brew"
      ? `調合する${ui.brewDetail ? ` › ${recipeOf(ui.recipe).name}` : ""}`
      : route === "orders"
        ? "依頼"
        : route === "map"
          ? `収集${ui.placeMode === "supply" ? " › 仕入れ" : ""}`
          : route === "inventory"
            ? "持ち物"
            : "約束帳";
  return (
    <div
      className={`app command-app ${route === "title" ? "title-app" : ""} ${route === "home" || s?.ended || s?.awaitingSettlement ? "no-sidebar" : ""} ${saveError ? "save-failed" : ""}`}
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
              choose={choose}
              home={() => go("home")}
              back={back}
              trail={routeLabel}
              journal={journal}
              inventory={inventory}
              settings={() => setSettings(true)}
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
                    choose={choose}
                    journal={journal}
                    inventory={inventory}
                    settings={() => setSettings(true)}
                    status={() => setStatusOpen(true)}
                  />
                )}
                {route === "orders" && (
                  <Orders
                    s={s}
                    ui={ui}
                    patch={patch}
                    confirm={ask}
                    prepare={(recipe, required, collect) => {
                      if (
                        jobs.some(
                          (j) =>
                            j.id === ui.orderId && j.category === "ordinary",
                        )
                      )
                        patch({
                          memo: [...new Set([...ui.memo, ui.orderId!])],
                        });
                      go(collect ? "map" : "brew", {
                        preparing: true,
                        recipe,
                        quantity: Math.max(
                          1,
                          required - (s.stock[recipe] ?? 0),
                        ),
                        brewDetail: true,
                        brewTab: "recipes",
                        placeMode: "menu",
                      });
                    }}
                    back={back}
                    seen={markSeen}
                    journal={() => go("journal")}
                  />
                )}
                {(route === "brew" || route === "inventory") && (
                  <Brewing
                    s={s}
                    ui={ui}
                    patch={patch}
                    confirm={ask}
                    source={source}
                    back={back}
                    open={(changes) =>
                      route === "brew" ? patch(changes) : go("brew", changes)
                    }
                    inventory={route === "inventory"}
                    deliver={() => resume("orders", { preparing: false })}
                  />
                )}
                {route === "map" && (
                  <World
                    s={s}
                    ui={ui}
                    confirm={ask}
                    patch={patch}
                    toBrew={() =>
                      go("brew", { brewDetail: true, brewTab: "recipes" })
                    }
                    seen={markSeen}
                    back={back}
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
                      openPromise={(promiseId) =>
                        go("orders", {
                          orderTab: "special",
                          orderId: `promise:${promiseId}`,
                        })
                      }
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
                <span>✓ {receipt.title.replace(/する$/, "しました")}</span>
                <Button onClick={() => setResultOpen(true)}>内訳</Button>
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
          {s && (
            <details>
              <summary>最近の記録・残債 {money(s.debt)}</summary>
              {s.log.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </details>
          )}
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
          title="今日の行動を選ぶ"
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
              閉じて戻る
            </Button>
          }
        >
          <ol className="help-steps">
            <li>
              <b>通常依頼で日々の収入を</b>
              <p>通常依頼は事前受注不要。薬を揃えて納品します。</p>
            </li>
            <li>
              <b>足りない薬は調合で</b>
              <p>
                依頼の不足品を確認し、収集で素材を集め、調合で薬を作ります。
              </p>
            </li>
            <li>
              <b>素材の入手先を調べる</b>
              <p>
                採集・調合・納品はスタミナを使います。仕入れは資金だけを使い、行動では日付は進みません。
              </p>
            </li>
            <li>
              <b>一日の終わりに約束を確認</b>
              <p>
                特別依頼は指定日当日に納品。「一日を終える」で翌日へ進み、スタミナが回復します。日付から約束と返済予定を確認できます。
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
            <div className="confirmation-dock">
              <DeadlineWarning state={s} action={pending.action} />
              <div className="dock-buttons">
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
                  onClick={() => execute()}
                >
                  {actionLabel(pending.action)}
                </Button>
              </div>
            </div>
          }
        >
          <Preview state={s} action={pending.action} />
          {pending.returnTo && (
            <p className="muted">
              完了後はこの準備の続きを開きます。章末・結末がある場合は先に進みます。
            </p>
          )}
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
          onClose={finishResult}
          footer={
            <Button primary onClick={finishResult}>
              確認
            </Button>
          }
        >
          <ResultDetails before={receipt.before} outcome={receipt.outcome} />
        </Modal>
      )}
      {statusOpen && s && (
        <Modal title="守りたいもの" onClose={() => setStatusOpen(false)}>
          <AxisPanel state={s} />
          {axes.map((axis) => (
            <p key={axis}>
              <b>
                {axis}：{axisStage(axis, s.axes[axis])}
              </b>
            </p>
          ))}
          <p>
            3軸は依頼の紹介条件や結末に影響します。代償は行動を確定する前に確認できます。
          </p>
          <p>
            品位は休養で現在の上限まで回復します。品位上限が下がる行動は、その変化も表示します。
          </p>
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
