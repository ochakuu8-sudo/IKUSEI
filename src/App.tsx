import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { supportOffers } from "./content/support";
import { specialOffers } from "./content/support";
import { absoluteDay, offerReason } from "./contracts";
import { performAction, type Action, type ActionOutcome } from "./engine";
import {
  initialState,
  jobs,
  midGameState,
  people,
  personOf,
  placeOf,
  recipeOf,
  axes,
  axisStage,
  type GameState,
  type MaterialId,
  type PlaceId,
  type PersonId,
  type RecipeId,
} from "./game";
import {
  cleanSelection,
  previewAction,
  preparationMaterials,
} from "./presentation";
import {
  LEGACY_SAVE_KEY,
  parseSave,
  PREVIOUS_SAVE_KEY,
  SAVE_KEY,
} from "./save";
import { actionDays, actionLabel } from "./workflow";
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
import { Place, World } from "./ui/World";
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
  const scrollKey = `${route}:${ui.orderTab}:${ui.orderId}:${ui.brewTab}:${ui.brewDetail}:${ui.recipe}:${place}:${ui.placeMode}:${ui.person}`;
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
        workKind: ui.workKind,
        orderTab: ui.orderTab,
        orderId: ui.orderId,
        brewTab: ui.brewTab,
        brewDetail: ui.brewDetail,
        recipe: ui.recipe,
        placeMode: ui.placeMode,
        person: ui.person,
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
    if (route === "map" && ui.person) {
      patch({ person: null });
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
      ask({ type: "rest" }, "屋敷で休養する");
      return;
    }
    go(action, {
      preparing: false,
      ...(action === "orders"
        ? {
            orderTab: "all",
            orderId: null,
            personFilter: null,
            workKind: "all",
            filter: "all",
          }
        : action === "brew"
          ? { brewTab: "recipes", brewDetail: false }
          : { person: null }),
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
  function visit(id: PlaceId, mode: UIState["placeMode"] = "menu") {
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
    go(id === "estate" ? "home" : "place", { placeMode: mode, person: null });
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
  function viewPerson(id: PersonId | null) {
    if (id && gameRef.current) {
      const out = performAction(gameRef.current, {
        type: "visit",
        place: personOf(id).place,
      });
      if (out.error) {
        setError(out.error);
        return;
      }
      gameRef.current = out.state;
      setGame(out.state);
      writeSave(out.state);
    }
    patch({ person: id });
  }
  function personJobs(id: PersonId) {
    go("orders", {
      orderTab: "all",
      orderId: null,
      personFilter: id,
      workKind: "all",
      filter: "all",
    });
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
    const firstJob =
      a.type === "job" &&
      !before.history.some((h) => h.kind === "job" && h.target === a.id);
    if (outcome.scene && (firstJob || a.type === "accept")) {
      setScene({
        lines: outcome.scene,
        title: request.title,
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
    if (!important && !outcome.scene) arrive(returnTo, outcome.state);
    // The committed confirmation object cannot execute twice, without delaying a new action.
  }
  function source(id: PlaceId, material: MaterialId, n: number) {
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
    ask(
      p.sells
        ? { type: "buy", place: id, basket }
        : { type: "gather", place: id },
      `${p.short}で素材を入手する`,
      snapshot(),
    );
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
    route === "place"
      ? `出かける › ${placeOf(place).short}${ui.placeMode === "supply" ? " › 素材を買う" : ui.placeMode === "people" ? " › 人物に会う" : ui.placeMode === "person" && ui.person ? ` › ${personOf(ui.person as Parameters<typeof personOf>[0]).name}` : ""}`
      : route === "brew"
        ? `調合する${ui.brewDetail ? ` › ${recipeOf(ui.recipe).name}` : ""}`
        : route === "orders"
          ? "仕事をする"
          : route === "map"
            ? "出かける"
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
              place={place}
              ui={ui}
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
                    prepareAction={(action, title) => {
                      if (
                        jobs.some(
                          (j) =>
                            j.id === ui.orderId && j.category === "ordinary",
                        )
                      )
                        patch({
                          memo: [...new Set([...ui.memo, ui.orderId!])],
                        });
                      ask(action, title, snapshot());
                    }}
                    back={back}
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
                    deliver={() =>
                      go("orders", {
                        orderTab:
                          ui.selection.ordinary.length +
                          ui.selection.promises.length
                            ? "batch"
                            : "normal",
                      })
                    }
                  />
                )}
                {route === "map" && (
                  <World
                    s={s}
                    ui={ui}
                    confirm={ask}
                    shop={(id) => visit(id, "supply")}
                    viewPerson={viewPerson}
                    personJobs={personJobs}
                    back={back}
                  />
                )}
                {route === "place" && (
                  <Place
                    key={place}
                    s={s}
                    id={place}
                    ui={ui}
                    patch={patch}
                    confirm={ask}
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
                      prepare={(id, n, today, promiseId) =>
                        go("orders", {
                          orderTab: "special",
                          orderId: promiseId ? `promise:${promiseId}` : null,
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
              <p>事前受注は不要。薬を揃えて選び、まとめて1日で納めます。</p>
            </li>
            <li>
              <b>足りない薬は調合で</b>
              <p>
                仕事の詳細で不足する薬・素材を確認し、その場で調合できます。調合は体力を使いますが0日です。
              </p>
            </li>
            <li>
              <b>素材の入手先を調べる</b>
              <p>
                依頼の詳細から「買う」「採る」を選ぶと、そのまま内容を確認できます。実行は1日、終わったら同じ依頼へ戻ります。
              </p>
            </li>
            <li>
              <b>指定日の約束を守る</b>
              <p>
                特別依頼は期間内に前金で受諾し、指定日当日に納品。画面上の日付から約束と返済予定を確認できます。
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
                  {actionLabel(s, pending.action)}
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
