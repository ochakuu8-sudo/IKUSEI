import { useEffect, useRef, useState } from "react";
import { BookOpen, Moon, Settings } from "lucide-react";
import {
  axes,
  axisStage,
  capDropOf,
  CHAPTER_DAYS,
  jobs,
  personOf,
  placeOf,
  relationStage,
  type Axis as AxisName,
  type Job,
} from "./game";
import {
  closingPreview,
  dailyAction,
  fatigueCount,
  fatigueRateOf,
  freshDaily,
  listPriceOf,
  markSeen,
  materialCostOf,
  offersOf,
  payOf,
  quotaOf,
  staminaOf,
  takeReason,
  tracesOf,
  type DailyState,
  type DayOutcome,
} from "./daily";
import { clearDaily, loadDaily, saveDaily, SAVE_KEY, UI_KEY } from "./saveV14";
import { catalogCounts, routes, type Route, type SceneEntry } from "./scenes";
import { clearGallery, loadGallery, recordScenes } from "./gallery";
import { Art, Modal } from "./ui/shell";
import { Mark } from "./marks";
import { Rings } from "./ui/symbols";
import { Dialogue } from "./ui/scene";
import { backgroundSrc, heroSrc } from "./art";
import { fullscreenSupported, useFullscreen } from "./ui/fullscreen";
import "./chapter.css";

const gold = (n: number) => `${n.toLocaleString()}G`;

type Tab = "today" | "journal";
type UI = { tab: Tab; sheet: string | null; speed: number; motion: boolean };
const freshUI = (): UI => ({
  tab: "today",
  sheet: null,
  speed: 24,
  motion: false,
});
function loadUI(): UI {
  try {
    const v = JSON.parse(localStorage.getItem(UI_KEY) ?? "null"),
      d = freshUI();
    if (!v) return d;
    if (v.tab === "journal") d.tab = "journal";
    if ([0, 24, 50].includes(v.speed)) d.speed = v.speed;
    d.motion = v.motion === true;
    return d;
  } catch {
    return freshUI();
  }
}

function Button({
  children,
  primary = false,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return (
    <button
      {...rest}
      type="button"
      className={`c-button ${primary ? "c-primary" : ""} ${rest.className ?? ""}`}
    >
      {children}
    </button>
  );
}

/** 三軸の1行。紋・ゲージ・段階の言葉・数値。品位だけ上限の刻みが入る。 */
function Axis({ axis, s }: { axis: AxisName; s: DailyState }) {
  return (
    <div className={`c-ax c-ax-${axis}`}>
      <Mark name={axis} label={axis} />
      <span className="c-axis-label">{axis}</span>
      <span className="c-gauge">
        <i style={{ width: `${s.axes[axis]}%` }} />
        {axis === "品位" && s.dignityCap < 100 && (
          <u
            style={{ left: `${s.dignityCap}%` }}
            aria-label={`品位上限 ${s.dignityCap}`}
          />
        )}
      </span>
      <em>{axisStage(axis, s.axes[axis])}</em>
      <b>{s.axes[axis]}</b>
    </div>
  );
}

/**
 * 手元にあるもの一覧。**いま自分が管理している資源を1枚に集める。**
 * 散らばっていると「あと何日で何G、そのとき何が閉じているか」が繋がらない。
 * 体力・金・三軸は立ち絵の裾へ。関係は依頼状と台帳、期限はHUDで読む。
 */
function Ledger({
  s,
  traces,
  onJournal,
}: {
  s: DailyState;
  traces: number;
  onJournal: () => void;
}) {
  return (
    <section className="c-ledger" aria-label="手元">
      <div className="c-ledger-row c-ledger-top">
        <span className="c-res">
          <Mark name="体力" decorative />
          <small>体力</small>
          <span className="c-gauge">
            <i style={{ width: `${s.stamina}%` }} />
          </span>
          <b>{s.stamina}</b>
        </span>
        <span className="c-res c-res-money">
          <i className="c-coin" aria-label="所持金" role="img" />
          <b>{gold(s.money)}</b>
        </span>
      </div>
      <div className="c-ledger-row c-ledger-axes">
        {axes.map((a) => (
          <Axis key={a} axis={a} s={s} />
        ))}
      </div>
      <button className="c-trace-link" onClick={onJournal}>
        <span>
          <Mark name="関係" decorative /> 台帳
        </span>
        <span>{traces > 0 ? `紹介停止 ${traces}件` : "関係・記録"} →</span>
      </button>
    </section>
  );
}

/**
 * 回想。**見た場面を読み返す場所であり、まだ見ていないものを数える場所。**
 * §14「引き継ぐ：回想」に従い、プレイの保存とは別に持つので、周回しても消えない。
 * 本文がまだ無い場面も並べる ── 伏せると、目録が制作の進捗表として使えない。
 */
function Gallery({
  seen,
  onPlay,
  onClose,
}: {
  seen: string[];
  onPlay: (entry: SceneEntry) => void;
  onClose: () => void;
}) {
  const [route, setRoute] = useState<Route | "すべて">("すべて");
  const { rows, seen: got, total, written } = catalogCounts(seen);
  const shown = rows.filter(
    (r) => route === "すべて" || r.entry.route === route,
  );
  return (
    <section className="c-screen c-gallery">
      <header className="c-gallery-head">
        <h2>回想</h2>
        <div className="c-gallery-tabs">
          {(["すべて", ...routes] as const).map((r) => {
            const n = rows.filter(
              (x) => (r === "すべて" || x.entry.route === r) && x.seen,
            ).length;
            const all = rows.filter(
              (x) => r === "すべて" || x.entry.route === r,
            ).length;
            return (
              <Button
                key={r}
                primary={route === r}
                onClick={() => setRoute(r)}
                className="c-gallery-tab"
              >
                {r !== "すべて" && r !== "共通" && r !== "清廉" && (
                  <Mark name={r} decorative />
                )}
                {r}
                <small>
                  {n}/{all}
                </small>
              </Button>
            );
          })}
        </div>
        <span className="c-gallery-count">
          回収 <b>{got}</b> / {total}
          {written < total && (
            <small>
              本文 {written}/{total}
            </small>
          )}
        </span>
      </header>
      <div className="c-gallery-grid">
        {shown.map(({ entry, seen: got, written }) => (
          <button
            key={entry.id}
            className={`c-recall ${got ? "c-got" : ""} ${written ? "" : "c-unwritten"}`}
            disabled={!got || !written}
            onClick={() => onPlay(entry)}
          >
            {entry.route !== "共通" && entry.route !== "清廉" ? (
              <Mark name={entry.route} className="c-recall-seal" decorative />
            ) : (
              <Mark name="関係" className="c-recall-seal" decorative />
            )}
            <span className="c-recall-kind">{entry.kind}</span>
            <b>{got ? entry.title : "？？？"}</b>
            <small>
              {got
                ? written
                  ? placeOf(entry.place).name
                  : "本文はこれから"
                : entry.hint}
            </small>
          </button>
        ))}
      </div>
      <footer className="c-footer">
        <Button primary onClick={onClose}>
          閉じる
        </Button>
        <span className="c-footer-note">回想は周回しても残ります</span>
      </footer>
    </section>
  );
}

/** 何を差し出すか。紋と「払ったあとの値」を並べる（§5「隠して受けさせない」）。 */
function Costs({
  job,
  s,
  compact = false,
}: {
  job: Job;
  s: DailyState;
  compact?: boolean;
}) {
  if (!job.costs.length)
    return (
      <span className="c-costs c-free">
        <Mark name="関係" decorative />
        {compact ? "三値 −0" : "差し出すものはない"}
      </span>
    );
  return (
    <span className={`c-costs ${compact ? "c-costs-compact" : ""}`}>
      {job.costs.map((c) => (
        <span key={c.axis} className={`c-cost c-cost-${c.axis}`}>
          <Mark name={c.axis} label={c.axis} />
          {!compact && `−${c.amount}`}
          <small>
            {s.axes[c.axis]}→{Math.max(0, s.axes[c.axis] - c.amount)}
          </small>
        </span>
      ))}
    </span>
  );
}

/** 依頼の地に押される紋。何を差し出す依頼かが、読む前に絵で分かる。 */
const sealOf = (job: Job): "貞操" | "品位" | "威厳" | "関係" =>
  axes.find((a) => job.costs.some((c) => c.axis === a && c.amount > 0)) ??
  "関係";

/**
 * 今日の1件。ボタンではなく**依頼状**として出す。
 * 種別の札、地の紋（透かし）、相手と関係の輪、差し出すものの紋、
 * 受け取る額、そして「残りの体力のどれだけを食うか」を1枚に並べる。
 */
function OfferCard({
  job,
  s,
  onOpen,
}: {
  job: Job;
  s: DailyState;
  onOpen: () => void;
}) {
  const reason = takeReason(job, s),
    tired = !!reason && reason.startsWith("体力"),
    cost = staminaOf(job),
    bite = Math.min(100, (cost / Math.max(1, s.stamina)) * 100),
    closed = closingPreview(job, s).length,
    cap = capDropOf(job),
    discounted = fatigueRateOf(job.person, s) < 1;
  return (
    <article
      className={`c-slip c-request-card ${job.costs.length ? "c-paid" : "c-clean"} ${reason ? "c-shut" : ""}`}
    >
      <button
        type="button"
        className="c-slip-face"
        onClick={onOpen}
        aria-label={`${job.title}の依頼状を読む。${personOf(job.person).name}、関係${s.relations[job.person]}／3。受け取る${gold(payOf(job, s))}、体力${cost}消費。${job.costs.length ? job.costs.map((c) => `${c.axis}${s.axes[c.axis]}から${Math.max(0, s.axes[c.axis] - c.amount)}`).join("、") : "三値の低下なし"}。${cap ? `品位上限−${cap}。` : ""}${discounted ? "値引きあり。" : ""}${closed ? `紹介停止${closed}件。` : ""}${reason ?? ""}`}
      >
        <Mark name={sealOf(job)} className="c-slip-seal" decorative />
        <span className="c-slip-head">
          <span className="c-slip-kind">{job.kind}</span>
          <span className={`c-wax c-wax-${sealOf(job)}`}>
            <Mark name={sealOf(job)} decorative />
          </span>
        </span>
        <span className="c-slip-main">
          <small>
            {personOf(job.person).name}
            <Rings
              stage={s.relations[job.person]}
              label={`${personOf(job.person).name}との関係 ${s.relations[job.person]}／3`}
            />
          </small>
          <b>{job.title}</b>
        </span>
        <span className="c-slip-terms">
          <span
            className="c-slip-pay"
            aria-label={`受け取る ${gold(payOf(job, s))}${discounted ? "、通い詰めによる値引きあり" : ""}`}
          >
            <i className="c-coin" aria-hidden="true" />
            <b>
              {payOf(job, s).toLocaleString()}
              <small>G</small>
            </b>
            {discounted && (
              <span className="c-discount" aria-hidden="true">
                ▼
              </span>
            )}
          </span>
          <span
            className="c-slip-stamina"
            aria-label={`体力 ${cost}消費、${s.stamina}から${Math.max(0, s.stamina - cost)}${tired ? "、体力不足" : ""}`}
          >
            <span>
              <Mark name="体力" label="体力" />−{cost}
            </span>
            <span className="c-gauge">
              <i
                className={tired ? "c-over" : ""}
                style={{ width: `${bite}%` }}
              />
            </span>
          </span>
        </span>
        <span className="c-slip-costline">
          <Costs job={job} s={s} compact />
          {cap > 0 && (
            <span
              className="c-cap-note"
              aria-label={`品位上限が${cap}下がる。戻らない`}
            >
              上限 −{cap}
            </span>
          )}
        </span>
        <span className="c-slip-foot">
          <span className={reason ? "c-unavailable" : "c-consequence"}>
            {reason
              ? tired
                ? "体力不足"
                : reason
              : closed > 0
                ? `紹介停止 ${closed}件`
                : ""}
          </span>
          <span>読む →</span>
        </span>
      </button>
    </article>
  );
}

/** 3枚の下に置く休養の札。体力回復と1日の消費を短く並べる（§6）。 */
function RestRow({ s, onPick }: { s: DailyState; onPick: () => void }) {
  return (
    <article className="c-slip c-rest">
      <button type="button" className="c-slip-face" onClick={onPick}>
        <Mark name="体力" className="c-slip-seal" decorative />
        <span className="c-slip-main">
          <b>今日は受けない</b>
        </span>
        <span className="c-rest-day">1日</span>
        <span className="c-slip-pay">
          <span className="c-slip-stamina">
            <Mark name="体力" label="体力" />
            <span className="c-gauge">
              <i className="c-met" style={{ width: "100%" }} />
            </span>
            {s.stamina}→100
          </span>
        </span>
      </button>
    </article>
  );
}

export default function DailyApp() {
  const [loaded] = useState(() => loadDaily(localStorage)),
    [s, setS] = useState<DailyState | null>(loaded.state),
    [ui, setUI] = useState<UI>(loadUI),
    [started, setStarted] = useState(false),
    [notice, setNotice] = useState(loaded.notice),
    [saveError, setSaveError] = useState(""),
    [settings, setSettings] = useState(false),
    [reset, setReset] = useState<"new" | "delete" | null>(null),
    [pending, setPending] = useState<Job | "rest" | null>(null),
    [scene, setScene] = useState<DayOutcome | null>(null),
    [result, setResult] = useState<DayOutcome | null>(null),
    /* 回想はプレイの保存とは別に持つ。周回しても消えない（§14）。 */
    [seenScenes, setSeenScenes] = useState<string[]>(() =>
      loadGallery(localStorage),
    ),
    [gallery, setGallery] = useState(false),
    [replay, setReplay] = useState<SceneEntry | null>(null);
  /* 場面を閉じた指が、そのまま下の札を押して次の場面を開いてしまわないようにする。
     最終行のタップは「閉じる」であって「次を選ぶ」ではない。 */
  const sceneClosedAt = useRef(0);
  const openReplay = (entry: SceneEntry) => {
    if (Date.now() - sceneClosedAt.current < 350) return;
    setReplay(entry);
  };
  const closeReplay = () => {
    sceneClosedAt.current = Date.now();
    setReplay(null);
  };
  const lock = useRef(false),
    stateRef = useRef(s);
  stateRef.current = s;
  const fullscreen = useFullscreen(),
    patch = (p: Partial<UI>) => setUI((u) => ({ ...u, ...p }));

  useEffect(() => {
    try {
      localStorage.setItem(UI_KEY, JSON.stringify(ui));
    } catch {
      /* 表示設定の失敗でゲームを止めない。 */
    }
    document.documentElement.dataset.motion = ui.motion ? "reduced" : "normal";
  }, [ui]);

  useEffect(() => {
    const probe = document.createElement("div");
    probe.style.cssText =
      "position:fixed;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)";
    document.body.appendChild(probe);
    const fit = () => {
      const css = getComputedStyle(probe),
        n = (x: string) => parseFloat(x) || 0,
        l = n(css.paddingLeft),
        r = n(css.paddingRight),
        t = n(css.paddingTop),
        b = n(css.paddingBottom);
      document.documentElement.style.setProperty(
        "--fit",
        String(
          Math.min((innerWidth - l - r) / 1200, (innerHeight - t - b) / 500),
        ),
      );
      document.documentElement.style.setProperty(
        "--shift-x",
        `${(l - r) / 2}px`,
      );
      document.documentElement.style.setProperty(
        "--shift-y",
        `${(t - b) / 2}px`,
      );
    };
    fit();
    window.addEventListener("resize", fit);
    window.visualViewport?.addEventListener("resize", fit);
    return () => {
      probe.remove();
      window.removeEventListener("resize", fit);
      window.visualViewport?.removeEventListener("resize", fit);
    };
  }, []);

  function persist(next: DailyState) {
    stateRef.current = next;
    setS(next);
    try {
      saveDaily(localStorage, next);
      setSaveError("");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "保存に失敗しました");
    }
  }

  /* 提示された依頼は「見た」ことにする。閉じたあと跡として残すため（§5）。 */
  useEffect(() => {
    if (!s || !started || s.awaitingSettlement || s.ended) return;
    const ids = offersOf(s).map((j) => j.id);
    const next = markSeen(s, ids);
    if (next !== s) persist(next);
  }, [s?.revision, s?.day, s?.chapter, started]);

  function commit(action: Parameters<typeof dailyAction>[1]) {
    if (lock.current || saveError || !stateRef.current) return;
    lock.current = true;
    setPending(null);
    const out = dailyAction(stateRef.current, action);
    if (out.error) setNotice(out.error);
    else {
      persist(out.state);
      patch({ sheet: null });
      if (out.outcome?.sceneIds.length)
        setSeenScenes((seen) =>
          recordScenes(localStorage, seen, out.outcome!.sceneIds),
        );
      if (out.outcome?.scene.length) setScene(out.outcome);
      else setResult(out.outcome ?? null);
    }
    window.setTimeout(() => {
      lock.current = false;
    }, 180);
  }

  function begin() {
    setUI(freshUI());
    setNotice("");
    setSaveError("");
    persist(freshDaily());
    setStarted(true);
    setReset(null);
  }

  const offers = s && started ? offersOf(s) : [];
  const sheetJob = ui.sheet ? jobs.find((j) => j.id === ui.sheet) : undefined;
  const due = s ? quotaOf(s) : 0;
  const traces = s ? tracesOf(s) : [];
  const showToday = !!(
    started &&
    s &&
    ui.tab === "today" &&
    !sheetJob &&
    !gallery &&
    !s.awaitingSettlement &&
    !s.ended
  );

  return (
    <>
      <div
        /* c-title は `display:block` ＋ 全面の覆い（:before）なので、回想を出すあいだは外す。
           付けたままだと回想が縦に伸びて器からはみ出し、覆いが触りを全部吸ってしまう。 */
        className={`chapter-app ${
          !started ? (gallery ? "" : "c-title") : showToday ? "c-home" : ""
        }`}
        style={{
          backgroundImage: `url(${backgroundSrc(!started ? "title" : "home")})`,
        }}
      >
        {!started && gallery ? (
          <Gallery
            seen={seenScenes}
            onPlay={openReplay}
            onClose={() => setGallery(false)}
          />
        ) : !started ? (
          <>
            <Art src={heroSrc} className="c-title-hero" alt="エレオノール" />
            <div className="c-title-panel">
              <div className="c-eyebrow">IKUSEI · CHAPTER ONE</div>
              <h1>没落令嬢の返済録</h1>
              <p>
                借金は返せる。
                <br />
                問題は、完済するために何を差し出すか。
              </p>
              <Button primary disabled={!s} onClick={() => setStarted(true)}>
                続きから
              </Button>
              <Button onClick={() => (s ? setReset("new") : begin())}>
                はじめから
              </Button>
              <Button onClick={() => setGallery(true)}>
                回想 <small>{catalogCounts(seenScenes).seen}</small>
              </Button>
              <Button onClick={() => setSettings(true)}>設定</Button>
              <small>
                1日 = 1行動 ／ 全6章 × 14日
                <br />
                全端末で縦横比固定・横持ちを想定
              </small>
              {notice && <p className="c-note">{notice}</p>}
            </div>
          </>
        ) : s ? (
          <>
            <header className="c-hud">
              <button onClick={() => patch({ tab: "journal" })}>
                <b>{s.day}日目</b>
                <small>第{s.chapter}章</small>
              </button>
              {/* 今日の画面は「手元」が持つので、HUDでは繰り返さない。 */}
              {!showToday && (
                <>
                  <span className="c-stamina">
                    <Mark name="体力" label="体力" />
                    <span className="c-gauge">
                      <i style={{ width: `${s.stamina}%` }} />
                    </span>
                    <b>{s.stamina}</b>
                  </span>
                  <span className="c-purse">
                    <b>{gold(s.money)}</b>
                  </span>
                </>
              )}
              <span className="c-debt">
                <b>{gold(s.debt)}</b>
                <small>
                  この章で納める {gold(due)} ・ 残り
                  {CHAPTER_DAYS - s.day + 1}日
                </small>
              </span>
              <Button aria-label="設定" onClick={() => setSettings(true)}>
                <Settings size={20} />
              </Button>
            </header>
            <div className="c-body">
              <aside className="c-portrait">
                <Art
                  src={heroSrc}
                  className="c-hero"
                  alt="エレオノール・ラティエ"
                />
                {/* 今日の画面は「手元」パネルが軸を持つので、裾には重ねない。 */}
                {showToday ? (
                  <Ledger
                    s={s}
                    traces={traces.length}
                    onJournal={() => patch({ tab: "journal" })}
                  />
                ) : (
                  <div className="c-axes">
                    {axes.map((a) => (
                      <Axis key={a} axis={a} s={s} />
                    ))}
                  </div>
                )}
              </aside>
              {!showToday && (
                <nav className="c-nav">
                  <button
                    className={ui.tab === "today" ? "selected" : ""}
                    onClick={() => patch({ tab: "today", sheet: null })}
                  >
                    <BookOpen size={22} />
                    今日
                  </button>
                  <button
                    className={ui.tab === "journal" ? "selected" : ""}
                    onClick={() => patch({ tab: "journal", sheet: null })}
                  >
                    <Moon size={22} />
                    台帳
                  </button>
                </nav>
              )}
              <main className="c-main">
                {gallery ? (
                  <Gallery
                    seen={seenScenes}
                    onPlay={openReplay}
                    onClose={() => setGallery(false)}
                  />
                ) : s.awaitingSettlement ? (
                  <section className="c-screen c-sheet">
                    <div className="c-sheet-body">
                      <h2>第{s.chapter}章 章末</h2>
                      <p className="c-who">返済の日。</p>
                      <div className="c-goods">
                        <span>
                          <b>{gold(due)}</b>
                          <small>
                            所持 {gold(s.money)}
                            {s.money < due
                              ? ` ・ ${gold(due - s.money)}足りない`
                              : " ・ 納められる"}
                          </small>
                        </span>
                      </div>
                      {s.money < due && (
                        <p className="c-warning">
                          不足分に利息25%が付いて次章へ。威厳−15・品位−10。
                        </p>
                      )}
                    </div>
                    <footer className="c-footer">
                      <Button
                        primary
                        onClick={() => commit({ type: "settle" })}
                      >
                        返済を確定する
                      </Button>
                    </footer>
                  </section>
                ) : s.ended ? (
                  <div className="c-empty">
                    <h1>{s.debt === 0 ? "完済した" : "返しきれなかった"}</h1>
                    <p>
                      残債 {gold(s.debt)} ／ 手元 {gold(s.money)}
                      <br />
                      {axes.map((a) => `${a} ${s.axes[a]}`).join(" ／ ")}
                      （品位上限 {s.dignityCap}）
                    </p>
                    <Button onClick={() => setStarted(false)}>
                      タイトルへ
                    </Button>
                  </div>
                ) : sheetJob ? (
                  <section className="c-screen c-sheet">
                    <div className="c-sheet-body">
                      <div className="c-eyebrow">{sheetJob.kind}</div>
                      <h2>{sheetJob.title}</h2>
                      <p className="c-who">
                        {personOf(sheetJob.person).name}
                        {s.relations[sheetJob.person] > 0 && (
                          <Rings stage={s.relations[sheetJob.person]} />
                        )}
                        · {placeOf(personOf(sheetJob.person).place).name}
                      </p>
                      <p className="c-lead">{sheetJob.description}</p>
                      <div className="c-terms">
                        <div>
                          <small>受け取る</small>
                          <b>{gold(payOf(sheetJob, s))}</b>
                          {fatigueCount(sheetJob.person, s) > 0 && (
                            <em>
                              ▼ 通い詰め{" "}
                              {Math.round(
                                (1 - fatigueRateOf(sheetJob.person, s)) * 100,
                              )}
                              %引き（定価 {gold(listPriceOf(sheetJob, s))}）
                            </em>
                          )}
                          {materialCostOf(sheetJob) > 0 && (
                            <em>素材の自腹 −{materialCostOf(sheetJob)}G</em>
                          )}
                        </div>
                        <div>
                          <small>使う体力</small>
                          <b>
                            <Mark name="体力" decorative />
                            {staminaOf(sheetJob)}
                          </b>
                          <em>
                            {s.stamina}→{s.stamina - staminaOf(sheetJob)}
                          </em>
                        </div>
                        <div>
                          <small>差し出すもの</small>
                          <Costs job={sheetJob} s={s} />
                          {!!sheetJob.costs.find((c) => c.axis === "品位") && (
                            <em className="c-warning">
                              品位の上限も下がる（戻らない）
                            </em>
                          )}
                        </div>
                      </div>
                      {closingPreview(sheetJob, s).length > 0 && (
                        <p className="c-closing">
                          これを受けると、もう紹介されなくなる：
                          <b>{closingPreview(sheetJob, s).join("、")}</b>
                        </p>
                      )}
                    </div>
                    <footer className="c-footer">
                      <div className="c-row">
                        <Button
                          primary
                          disabled={!!takeReason(sheetJob, s)}
                          onClick={() => setPending(sheetJob)}
                        >
                          この依頼を受ける
                        </Button>
                        <Button onClick={() => patch({ sheet: null })}>
                          戻る
                        </Button>
                        <span className="c-footer-note">
                          {takeReason(sheetJob, s)}
                        </span>
                      </div>
                    </footer>
                  </section>
                ) : ui.tab === "journal" ? (
                  <div className="c-scroll">
                    <h2>台帳</h2>
                    <h3>関係</h3>
                    {[...new Set(jobs.map((j) => j.person))]
                      .filter(
                        (p) =>
                          !personOf(p).requiresUnlock || s.unlocked.includes(p),
                      )
                      .map((p) => (
                        <p className="c-use-row" key={p}>
                          {personOf(p).name}
                          <Rings stage={s.relations[p]} />
                          <small>{relationStage(s.relations[p])}</small>
                        </p>
                      ))}
                    <h3>もう紹介されない依頼</h3>
                    {!traces.length && <p className="c-muted">まだ無い。</p>}
                    {traces.map((t) => (
                      <p className="c-use-row c-trace" key={t.job.id}>
                        {t.job.title}
                        <small>{t.reason}</small>
                      </p>
                    ))}
                    <h3>回想</h3>
                    <p className="c-use-row">
                      見た場面
                      <small>
                        {catalogCounts(seenScenes).seen} /{" "}
                        {catalogCounts(seenScenes).total}
                      </small>
                      <Button onClick={() => setGallery(true)}>開く</Button>
                    </p>
                    <h3>記録</h3>
                    {!s.log.length && <p className="c-muted">まだ無い。</p>}
                    {s.log.map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>
                ) : (
                  <div className="c-today">
                    <header className="c-today-heading">
                      <h2>本日の依頼状</h2>
                      <span>{offers.length}通</span>
                    </header>
                    <div className="c-offers">
                      {offers.map((job) => (
                        <OfferCard
                          key={job.id}
                          job={job}
                          s={s}
                          onOpen={() => patch({ sheet: job.id })}
                        />
                      ))}
                      {!offers.length && (
                        <p className="c-muted">
                          今日は誰からも声がかからない。
                        </p>
                      )}
                    </div>
                    <RestRow s={s} onPick={() => setPending("rest")} />
                  </div>
                )}
              </main>
            </div>
          </>
        ) : (
          <div className="c-empty">
            <h2>はじめから始めてください</h2>
            <Button primary onClick={begin}>
              はじめる
            </Button>
          </div>
        )}
      </div>

      {pending && s && (
        <Modal
          title={pending === "rest" ? "今日は受けない" : pending.title}
          onClose={() => setPending(null)}
          footer={
            <>
              <Button onClick={() => setPending(null)}>戻る</Button>
              <Button
                primary
                onClick={() =>
                  commit(
                    pending === "rest"
                      ? { type: "rest" }
                      : { type: "take", job: pending.id },
                  )
                }
              >
                確定する
              </Button>
            </>
          }
        >
          {pending === "rest" ? (
            <p>
              1日を使います。体力は100に戻り、何も受け取らず、何も差し出しません。
            </p>
          ) : (
            <>
              <p>
                {gold(payOf(pending, s))} を受け取り、体力を{" "}
                {staminaOf(pending)} 使います。
              </p>
              <p>
                <Costs job={pending} s={s} />
              </p>
              {!!pending.costs.find((c) => c.axis === "品位") && (
                <p className="c-warning">
                  品位の上限も下がります。上限は戻りません。
                </p>
              )}
              {closingPreview(pending, s).length > 0 && (
                <p className="c-warning">
                  これを受けると、
                  {closingPreview(pending, s).join("、")}
                  はもう紹介されません。
                </p>
              )}
            </>
          )}
        </Modal>
      )}

      {replay && (
        <Dialogue
          title={replay.title}
          lines={replay.lines}
          place={replay.place}
          speed={ui.speed}
          onDone={closeReplay}
        />
      )}

      {scene && s && (
        <Dialogue
          title={scene.title}
          lines={scene.scene}
          place={personOf(scene.person ?? "vernet").place}
          speed={ui.speed}
          onDone={() => {
            setResult(scene);
            setScene(null);
          }}
        />
      )}

      {result && s && (
        <Modal
          variant="result"
          title={result.title}
          onClose={() => setResult(null)}
          footer={
            <Button primary onClick={() => setResult(null)}>
              確認
            </Button>
          }
        >
          <div className="c-result">
            {result.pay !== 0 && (
              <p className="c-pay">
                <b>
                  {result.pay > 0 ? "+" : ""}
                  {gold(result.pay)}
                </b>
                <span>
                  {result.fatigueRate < 1
                    ? `定価 ${gold(result.listPrice)} から ${Math.round((1 - result.fatigueRate) * 100)}%引き`
                    : result.kind === "settle"
                      ? `納めた（ノルマ ${gold(result.listPrice)}）`
                      : "定価どおり"}
                </span>
              </p>
            )}
            {result.drops.map((d) => (
              <p className="c-move c-drop" key={d.axis}>
                <Mark name={d.axis} label={d.axis} />
                {d.axis} −{d.amount}
                <small>
                  {d.before}→{d.after}
                </small>
              </p>
            ))}
            {result.capDrop > 0 && (
              <p className="c-move c-capdrop">
                <Mark name="品位" decorative />
                品位の上限 −{result.capDrop}
                <small>戻らない</small>
              </p>
            )}
            {result.gains.map((g) => (
              <p className="c-move c-gain" key={g.axis}>
                <Mark name={g.axis} label={g.axis} />
                {g.axis} ＋{g.amount}
                <small>
                  {g.before}→{g.after}
                </small>
              </p>
            ))}
            {result.staminaDelta !== 0 && (
              <p className="c-move">
                <Mark name="体力" decorative />
                体力 {result.staminaDelta > 0 ? "＋" : "−"}
                {Math.abs(result.staminaDelta)}
                <small>いま {s.stamina}</small>
              </p>
            )}
            {result.relationUp && (
              <p className="c-move c-gain">
                <Mark name="関係" decorative />
                {result.relationUp.name}
                <small>{result.relationUp.stage}</small>
              </p>
            )}
            {result.closedNow.map((c) => (
              <p className="c-move c-closed" key={c.title}>
                {c.title}
                <small>もう紹介されない（{c.axis}）</small>
              </p>
            ))}
            {result.notices.map((n, i) => (
              <p key={i} className="c-muted">
                {n}
              </p>
            ))}
          </div>
        </Modal>
      )}

      {settings && (
        <Modal
          title="設定"
          onClose={() => setSettings(false)}
          footer={
            <Button primary onClick={() => setSettings(false)}>
              閉じる
            </Button>
          }
        >
          <div className="c-modal-content">
            <label>
              文字送りの速さ
              <select
                value={ui.speed}
                onChange={(e) => patch({ speed: Number(e.target.value) })}
              >
                <option value={50}>ゆっくり</option>
                <option value={24}>ふつう</option>
                <option value={0}>すぐ出す</option>
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={ui.motion}
                onChange={(e) => patch({ motion: e.target.checked })}
              />
              動きを減らす
            </label>
            {fullscreenSupported() && (
              <Button onClick={fullscreen.toggle}>
                {fullscreen.active ? "全画面をやめる" : "全画面で遊ぶ"}
              </Button>
            )}
            <Button onClick={() => setReset("delete")}>保存を消す</Button>
            <Button
              onClick={() => {
                clearGallery(localStorage);
                setSeenScenes([]);
              }}
            >
              回想を消す
            </Button>
            {saveError && <p className="c-warning">{saveError}</p>}
          </div>
        </Modal>
      )}

      {reset && (
        <Modal
          title={reset === "new" ? "はじめから" : "保存を消す"}
          onClose={() => setReset(null)}
          footer={
            <>
              <Button onClick={() => setReset(null)}>戻る</Button>
              <Button
                primary
                onClick={() => {
                  if (reset === "new") begin();
                  else {
                    clearDaily(localStorage);
                    setS(null);
                    setStarted(false);
                    setSettings(false);
                    setReset(null);
                  }
                }}
              >
                確定する
              </Button>
            </>
          }
        >
          <p>いまの記録（{SAVE_KEY}）は消えます。元に戻せません。</p>
        </Modal>
      )}

      {notice && started && (
        <Modal
          title="お知らせ"
          onClose={() => setNotice("")}
          footer={
            <Button primary onClick={() => setNotice("")}>
              閉じる
            </Button>
          }
        >
          <p>{notice}</p>
        </Modal>
      )}
    </>
  );
}
