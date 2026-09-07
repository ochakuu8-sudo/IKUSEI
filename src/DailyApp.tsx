import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Settings } from "lucide-react";
import {
  axes,
  axisStage,
  capDropOf,
  CHAPTER_DAYS,
  jobs,
  personOf,
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
import { clearDaily, loadDaily, saveDaily, UI_KEY } from "./saveV14";
import { catalogCounts, type SceneEntry } from "./scenes";
import { clearGallery, loadGallery, recordScenes } from "./gallery";
import { Art, Modal } from "./ui/shell";
import { Mark } from "./marks";
import { Rings } from "./ui/symbols";
import { Dialogue } from "./ui/scene";
import { preloadScene } from "./ui/sceneVisuals";
import { personSrc, manorMaterialStyle } from "./art";
import { paperSound } from "./ui/paperAudio";
import {
  animatePaper,
  capturePaper,
  type PaperMotion,
  type PaperOrigin,
} from "./ui/letterMotion";
import { fullscreenSupported, useFullscreen } from "./ui/fullscreen";
import "./chapter.css";
import "./manor.css";
import {
  ReformGallery as Gallery,
  Journal,
  Settlement,
  DayRecord,
  Ending,
  GameSettings,
  reformArt,
} from "./ui/ReformScreens";
import { READ_SCENES_KEY } from "./ui/readScenes";
import "./reform.css";
import "./ornaments.css";

const gold = (n: number) => `${n.toLocaleString()}G`;

type Tab = "today" | "journal";
type UI = {
  tab: Tab;
  sheet: string | null;
  speed: number;
  motion: boolean;
  volume: number;
  textSize: number;
  strongText: boolean;
};
const freshUI = (): UI => ({
  tab: "today",
  sheet: null,
  speed: 24,
  motion: false,
  volume: 30,
  textSize: 24,
  strongText: false,
});
function loadUI(): UI {
  try {
    const v = JSON.parse(localStorage.getItem(UI_KEY) ?? "null"),
      d = freshUI();
    if (!v) return d;
    if (v.tab === "journal") d.tab = "journal";
    if ([0, 24, 50].includes(v.speed)) d.speed = v.speed;
    d.motion = v.motion === true;
    if (typeof v.volume === "number" && Number.isFinite(v.volume))
      d.volume = Math.max(0, Math.min(100, v.volume));
    if ([22, 24, 26, 28].includes(v.textSize)) d.textSize = v.textSize;
    d.strongText = v.strongText === true;
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

/** The three crests share a vertical reading order: emblem, value, state. */
function StatusAxis({ axis, s }: { axis: AxisName; s: DailyState }) {
  const value = s.axes[axis];
  const cap = axis === "品位" ? s.dignityCap : 100;
  return (
    <div className="r-status-axis" data-axis={axis}>
      <div className="r-status-emblem">
        <Mark name={axis} decorative />
        <span>{axis}</span>
      </div>
      <b className="r-status-value">{value}</b>
      <div
        className="r-status-meter"
        role="progressbar"
        aria-label={axis}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-valuetext={`${value}、${axisStage(axis, value)}${axis === "品位" ? `、上限${cap}` : ""}`}
      >
        <i style={{ width: `${value}%` }} />
        {cap < 100 && (
          <span className="r-status-cap-track" style={{ left: `${cap}%` }} />
        )}
      </div>
      <small className="r-status-limit">
        {axis === "品位" ? `上限 ${cap}` : ""}
      </small>
      <p className="r-status-state">{axisStage(axis, value)}</p>
    </div>
  );
}

/** Resources above; the three personal parameters below, inside one illustrated window. */
function Ledger({ s }: { s: DailyState }) {
  return (
    <section className="r-status-window" aria-label="エレオノールの状態">
      <div className="r-status-resources">
        <div className="r-status-stamina">
          <div className="r-status-resource-label">
            <Mark name="体力" decorative />
            <span>体力</span>
          </div>
          <div className="r-status-resource-value">
            <b>{s.stamina}</b>
            <small>/ 100</small>
          </div>
          <div
            className="r-status-meter"
            role="progressbar"
            aria-label="体力"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={s.stamina}
          >
            <i style={{ width: `${s.stamina}%` }} />
          </div>
        </div>
        <div className="r-status-money">
          <div className="r-status-resource-label">
            <i className="c-coin" aria-hidden="true" />
            <span>所持金</span>
          </div>
          <div className="r-status-resource-value">
            <b>{s.money.toLocaleString()}</b>
            <small>G</small>
          </div>
        </div>
      </div>
      <div className="r-status-axes">
        {axes.map((axis) => (
          <StatusAxis key={axis} axis={axis} s={s} />
        ))}
      </div>
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
        {compact ? "代償なし" : "差し出すものはない"}
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

const stationeryOf = (job: Job) =>
  job.person === "count" || job.person === "guillaume"
    ? "noble"
    : job.person === "claire" || job.person === "herbalist"
      ? "academy"
      : "commerce";

/** The family's rose is separate from the three resource emblems. */
function FamilyStamp() {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <circle cx="32" cy="32" r="27" />
      <circle cx="32" cy="32" r="23" />
      <path d="M32 14c5-4 10 0 10 5 7-1 10 5 6 10 6 5 3 12-4 13-1 7-9 9-13 4-6 4-12 0-12-6-7-2-8-10-2-14-3-6 2-12 8-10 1-4 5-5 7-2Z" />
      <path d="M32 22c8-2 14 6 10 12-2 6-10 9-15 4-6-2-7-11-1-14 5-3 12 1 10 6-1 5-7 5-9 1m4 10-1 10m-1-4c-5 0-8-3-8-6 5 0 8 2 8 6m2-1c5-1 8-4 8-7-5 1-7 3-8 7" />
    </svg>
  );
}

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
      data-job={job.id}
      data-stationery={stationeryOf(job)}
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
          <span className={`c-wax c-wax-person c-wax-${job.person}`}>
            <img src={personSrc(job.person)} alt="" />
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
          <span className="c-slip-warnings">
            {reason && (
              <span className="c-unavailable">
                {tired ? "体力不足" : reason}
              </span>
            )}
            {closed > 0 && (
              <span className="c-consequence">紹介停止 {closed}件</span>
            )}
          </span>
          <span>手に取る →</span>
        </span>
      </button>
    </article>
  );
}

/** 開いた手紙が受諾前の確認を兼ねる。条件と操作を本文の外に置く。 */
function LetterSheet({
  job,
  s,
  onAccept,
  onBack,
  signing = false,
}: {
  job: Job;
  s: DailyState;
  onAccept: () => void;
  onBack: () => void;
  signing?: boolean;
}) {
  const reason = takeReason(job, s);
  const closing = closingPreview(job, s);
  const cap = capDropOf(job);
  return (
    <section
      className={`c-screen c-sheet c-reading-sheet ${signing ? "c-ritual-sign" : ""}`}
      data-stationery={stationeryOf(job)}
      data-paper-state={signing ? "signing" : "reading"}
      aria-label={`${job.title}の依頼状`}
    >
      <div className="c-letter-story">
        <span
          className={`c-wax c-wax-person c-wax-${job.person} c-letter-sender-seal`}
          aria-hidden="true"
        >
          <img src={personSrc(job.person)} alt="" />
        </span>
        <div className="c-letter-address">
          エレオノール・ラティエ様 <span>{job.kind}</span>
        </div>
        <h2 className="c-letter-heading" tabIndex={-1}>
          {job.title}
        </h2>
        <p className="c-letter-body">{job.description}</p>
        <p className="c-letter-signature">
          {personOf(job.person).name} <Rings stage={s.relations[job.person]} />
        </p>
      </div>
      {signing && (
        <div className="c-letter-response" aria-hidden="true">
          <span className="c-response-caption">承りました</span>
          <span className="c-response-signature">Éléonore</span>
          <span className="c-response-stamp">
            <FamilyStamp />
          </span>
        </div>
      )}
      <div className="c-letter-conditions">
        <div className="c-letter-terms">
          <div>
            <small>受け取る</small>
            <b>
              <i className="c-coin" aria-hidden="true" />
              {gold(payOf(job, s))}
            </b>
            {fatigueCount(job.person, s) > 0 && (
              <em>
                ▼ {Math.round((1 - fatigueRateOf(job.person, s)) * 100)}%引き ·
                定価 {gold(listPriceOf(job, s))}
              </em>
            )}
            {materialCostOf(job) > 0 && (
              <em>素材費 {materialCostOf(job)}G 差引済</em>
            )}
          </div>
          <div>
            <small>使う体力</small>
            <b>
              <Mark name="体力" decorative />−{staminaOf(job)}
            </b>
            <em>
              {s.stamina} → {Math.max(0, s.stamina - staminaOf(job))}
            </em>
          </div>
          <div>
            <small>差し出すもの</small>
            <Costs job={job} s={s} compact />
            {cap > 0 && (
              <em className="c-cap-note">
                品位上限 {s.dignityCap} → {Math.max(0, s.dignityCap - cap)}
                （戻らない）
              </em>
            )}
          </div>
        </div>
        {closing.length > 0 && (
          <div className="c-letter-closing">
            <b>紹介停止 {closing.length}件</b>
            <span>{closing.join("、")}</span>
          </div>
        )}
      </div>
      <footer className="c-footer c-letter-footer">
        <Button onClick={onBack}>机に戻す</Button>
        <span className="c-footer-note">{reason ?? "1日が過ぎる"}</span>
        <Button primary disabled={!!reason} onClick={onAccept}>
          この依頼を受ける
        </Button>
      </footer>
    </section>
  );
}

function RestSheet({
  s,
  onAccept,
  onBack,
}: {
  s: DailyState;
  onAccept: () => void;
  onBack: () => void;
}) {
  return (
    <section className="c-screen c-sheet c-reading-sheet c-rest-sheet">
      <div className="c-letter-story">
        <div className="c-letter-address">ラティエ邸</div>
        <h2 className="c-letter-heading" tabIndex={-1}>
          今日は受けない
        </h2>
        <p className="c-letter-body">手紙を置いて、身体を休める。</p>
      </div>
      <div className="c-letter-conditions">
        <div className="c-letter-terms">
          <div>
            <small>体力</small>
            <b>
              <Mark name="体力" decorative />
              {s.stamina} → 100
            </b>
          </div>
          <div>
            <small>過ぎる時間</small>
            <b>1日</b>
          </div>
          <div>
            <small>受け取る・差し出す</small>
            <b>なし</b>
          </div>
        </div>
      </div>
      <footer className="c-footer c-letter-footer">
        <Button onClick={onBack}>机に戻す</Button>
        <Button primary onClick={onAccept}>
          今日は休む
        </Button>
      </footer>
    </section>
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
    [savedState, setS] = useState<DailyState | null>(loaded.state),
    [deskSnapshot, setDeskSnapshot] = useState<DailyState | null>(null),
    [ui, setUI] = useState<UI>(loadUI),
    [started, setStarted] = useState(false),
    [notice, setNotice] = useState(loaded.notice),
    [saveError, setSaveError] = useState(""),
    [settings, setSettings] = useState(false),
    [reset, setReset] = useState<"new" | "delete" | "gallery" | null>(null),
    [pending, setPending] = useState<"rest" | null>(null),
    [ritual, setRitual] = useState<"sign" | "rest" | null>(null),
    [scene, setScene] = useState<DayOutcome | null>(null),
    [result, setResult] = useState<DayOutcome | null>(null),
    /* 回想はプレイの保存とは別に持つ。周回しても消えない（§14）。 */
    [seenScenes, setSeenScenes] = useState<string[]>(() =>
      loadGallery(localStorage),
    ),
    [gallery, setGallery] = useState(false),
    [replay, setReplay] = useState<SceneEntry | null>(null);
  /* The action is saved before animation; its new day stays hidden until the result. */
  const s = deskSnapshot ?? savedState;
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
    stateRef = useRef(savedState);
  const transitionTimer = useRef<number | undefined>(undefined);
  const mounted = useRef(true);
  const lastLetter = useRef<string | null>(null);
  const returnToDesk = useRef(false);
  const returnFromResult = useRef(false);
  const paperOrigin = useRef<PaperOrigin | null>(null);
  const paperMotion = useRef<PaperMotion | null>(null);
  const paperReturning = useRef(false);
  stateRef.current = savedState;
  const fullscreen = useFullscreen(),
    patch = (p: Partial<UI>) => setUI((u) => ({ ...u, ...p }));

  function openLetter(id: string) {
    if (lock.current || paperReturning.current) return;
    const job = jobs.find((j) => j.id === id);
    if (job)
      void preloadScene(
        [{ text: "", sceneId: `job:${id}` }],
        personOf(job.person).place,
      );
    lastLetter.current = id;
    const card = document.querySelector<HTMLElement>(
      `[data-job="${CSS.escape(id)}"]`,
    );
    const stage = document.querySelector<HTMLElement>(".c-manor");
    paperOrigin.current = card && stage ? capturePaper(card, stage) : null;
    paperSound(ui.volume);
    patch({ sheet: id });
  }
  function closeLetter() {
    if (lock.current || paperReturning.current) return;
    const finish = () => {
      paperReturning.current = false;
      if (!mounted.current) return;
      returnToDesk.current = true;
      setPending(null);
      patch({ sheet: null });
    };
    const sheet = document.querySelector<HTMLElement>(
      ".c-manor .c-reading-sheet",
    );
    const stage = document.querySelector<HTMLElement>(".c-manor");
    const currentTransform = sheet
      ? getComputedStyle(sheet).transform
      : undefined;
    paperMotion.current?.cancel();
    if (ui.sheet && sheet && stage) {
      paperReturning.current = true;
      paperMotion.current = animatePaper(
        sheet,
        stage,
        paperOrigin.current,
        "close",
        reduceMotion(),
        finish,
        currentTransform,
      );
    } else finish();
    paperSound(ui.volume, "place");
  }
  function openJournal() {
    if (lock.current || paperReturning.current) return;
    paperMotion.current?.cancel();
    setPending(null);
    patch({ tab: "journal", sheet: null });
    paperSound(ui.volume, "book");
  }
  function reduceMotion() {
    return (
      ui.motion || window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }
  useLayoutEffect(() => {
    if (!ui.sheet) return;
    const sheet = document.querySelector<HTMLElement>(
      ".c-manor .c-reading-sheet",
    );
    const stage = document.querySelector<HTMLElement>(".c-manor");
    if (sheet && stage)
      paperMotion.current = animatePaper(
        sheet,
        stage,
        paperOrigin.current,
        "open",
        reduceMotion(),
      );
    return () => {
      paperMotion.current?.cancel();
    };
  }, [ui.sheet]);
  useEffect(() => {
    if (ui.sheet || pending) {
      document
        .querySelector<HTMLElement>(".c-manor .c-letter-heading")
        ?.focus({ preventScroll: true });
    } else if (returnToDesk.current) {
      returnToDesk.current = false;
      const selector = lastLetter.current
        ? `[data-job="${CSS.escape(lastLetter.current)}"] .c-slip-face`
        : ".c-rest .c-slip-face";
      document
        .querySelector<HTMLElement>(selector)
        ?.focus({ preventScroll: true });
    }
  }, [ui.sheet, pending]);
  useEffect(() => {
    if (result || !returnFromResult.current) return;
    returnFromResult.current = false;
    document
      .querySelector<HTMLElement>(
        ".c-main .c-request-card .c-slip-face, .c-main .c-footer .c-primary, .c-main .c-empty button",
      )
      ?.focus({ preventScroll: true });
  }, [result]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        (ui.sheet || pending) &&
        !document.querySelector("dialog[open]")
      ) {
        event.preventDefault();
        closeLetter();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ui.sheet, pending, ui.volume, ui.motion]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      window.clearTimeout(transitionTimer.current);
      paperMotion.current?.cancel();
    };
  }, []);

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
    document.documentElement.style.setProperty(
      "--reform-paper",
      `url("${reformArt.paper}")`,
    );
    document.documentElement.style.setProperty(
      "--reform-book",
      `url("${reformArt.book}")`,
    );
    document.documentElement.style.setProperty(
      "--reform-room",
      `url("${reformArt.room}")`,
    );
    const fit = () => {
      const css = getComputedStyle(probe),
        n = (x: string) => parseFloat(x) || 0,
        l = n(css.paddingLeft),
        r = n(css.paddingRight),
        t = n(css.paddingTop),
        b = n(css.paddingBottom);
      const width = Math.min(1280, innerWidth - l - r);
      const height =
        innerWidth < innerHeight
          ? innerHeight - t - b
          : Math.min(innerHeight - t - b, (width * 9) / 16);
      document.documentElement.style.setProperty("--fit", "1");
      document.documentElement.style.setProperty("--stage-w", `${width}px`);
      document.documentElement.style.setProperty("--stage-h", `${height}px`);
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

  /* 裏に描かれた翌日の札は、結果などを閉じて実際に提示されるまでは未見。 */
  const offersVisible = !!(
    s &&
    started &&
    !s.awaitingSettlement &&
    !s.ended &&
    ui.tab === "today" &&
    !ui.sheet &&
    !pending &&
    !deskSnapshot &&
    !ritual &&
    !scene &&
    !result &&
    !gallery &&
    !replay &&
    !settings &&
    !reset &&
    !notice
  );
  useEffect(() => {
    if (!s || !offersVisible) return;
    const ids = offersOf(s).map((j) => j.id);
    const next = markSeen(s, ids);
    if (next !== s) persist(next);
  }, [s?.revision, s?.day, s?.chapter, offersVisible]);

  function commit(action: Parameters<typeof dailyAction>[1]) {
    if (
      lock.current ||
      ritual ||
      scene ||
      result ||
      paperReturning.current ||
      saveError ||
      !stateRef.current
    )
      return;
    lock.current = true;
    paperMotion.current?.finish();
    const out = dailyAction(stateRef.current, action);
    if (out.error) {
      setNotice(out.error);
      lock.current = false;
    } else {
      setDeskSnapshot(stateRef.current);
      persist(out.state);
      if (out.outcome?.sceneIds.length)
        setSeenScenes((seen) =>
          recordScenes(localStorage, seen, out.outcome!.sceneIds),
        );
      const reveal = () => {
        if (!mounted.current) return;
        setRitual(null);
        setPending(null);
        patch({ sheet: null });
        if (out.outcome?.scene.length) setScene(out.outcome);
        else {
          setResult(out.outcome ?? null);
          if (!out.outcome) lock.current = false;
        }
      };
      if (action.type === "settle") reveal();
      else {
        const reduce = reduceMotion();
        paperSound(ui.volume, action.type === "take" ? "sign" : "rest");
        setRitual(action.type === "take" ? "sign" : "rest");
        const ready = out.outcome?.scene.length
          ? preloadScene(
              out.outcome.scene,
              personOf(out.outcome.person ?? "vernet").place,
              out.outcome.sceneIds[0],
            )
          : Promise.resolve();
        transitionTimer.current = window.setTimeout(
          () => {
            void ready.then(reveal, reveal);
          },
          reduce ? 0 : action.type === "take" ? 520 : 380,
        );
      }
    }
  }

  function begin() {
    paperMotion.current?.cancel();
    paperReturning.current = false;
    setDeskSnapshot(null);
    setPending(null);
    patch({ tab: "today", sheet: null });
    setNotice("");
    setSaveError("");
    persist(freshDaily());
    setStarted(true);
    setReset(null);
    lock.current = false;
    paperSound(ui.volume, "place");
  }

  function closeResult() {
    lock.current = false;
    returnFromResult.current = true;
    setResult(null);
    setDeskSnapshot(null);
    paperSound(ui.volume, "place");
  }

  const offers = s && started ? offersOf(s) : [];
  const sheetJob = ui.sheet ? jobs.find((j) => j.id === ui.sheet) : undefined;
  const due = s ? quotaOf(s) : 0;
  const traces = s ? tracesOf(s) : [];
  const showDesk = !!(
    started &&
    s &&
    !gallery &&
    ((!s.awaitingSettlement && !s.ended) || ritual)
  );

  return (
    <>
      <div
        /* c-title は `display:block` ＋ 全面の覆い（:before）なので、回想を出すあいだは外す。
           付けたままだと回想が縦に伸びて器からはみ出し、覆いが触りを全部吸ってしまう。 */
        className={`chapter-app r-game ${gallery ? "r-gallery-stage" : ui.tab === "journal" && started ? "r-journal-stage" : ""} ${result ? "r-night" : ""} ${s?.awaitingSettlement && started ? "r-settlement-stage" : ""} ${s?.ended && started ? "r-ending-stage" : ""} ${
          !started
            ? gallery
              ? ""
              : "c-title"
            : showDesk
              ? `c-home c-manor ${sheetJob || pending ? "c-reading" : ""} ${ui.tab === "journal" ? "c-journal" : ""} ${ritual ? "c-ritual" : ""}`
              : ""
        }`}
        inert={!!ritual || !!scene || !!result || undefined}
        aria-busy={!!ritual || undefined}
        style={
          {
            ...manorMaterialStyle,
            "--reform-paper": `url("${reformArt.paper}")`,
            "--reform-book": `url("${reformArt.book}")`,
            "--reform-closed-book": `url("${reformArt.closedBook}")`,
            "--reform-window": `url("${reformArt.window}")`,
            backgroundImage: `url("${reformArt.room}")`,
          } as React.CSSProperties
        }
      >
        {!started && gallery ? (
          <Gallery
            seen={seenScenes}
            onPlay={openReplay}
            onSettings={() => setSettings(true)}
            onClose={() => setGallery(false)}
          />
        ) : !started ? (
          <>
            <Art
              src={reformArt.hero}
              className="c-title-hero"
              alt="エレオノール"
            />
            <div className="c-title-panel">
              <div className="c-eyebrow">THE LATIER CHRONICLE</div>
              <div className="r-title-crest">
                <FamilyStamp />
              </div>
              <h1>
                没落令嬢の<span>返済録</span>
              </h1>
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
                回想{" "}
                <small>
                  {
                    catalogCounts(seenScenes).rows.filter(
                      (r) => r.written && r.seen,
                    ).length
                  }
                </small>
              </Button>
              <Button onClick={() => setSettings(true)}>設定</Button>
              {notice && <p className="c-note">{notice}</p>}
            </div>
          </>
        ) : s ? (
          <>
            <header className="c-hud">
              <button onClick={openJournal}>
                <b>{s.day}日目</b>
                <small>第{s.chapter}章</small>
              </button>
              <button
                className="r-goal"
                onClick={openJournal}
                aria-label="返済の予定を台帳で確認"
              >
                <small>
                  {s.awaitingSettlement
                    ? "今日は返済の日"
                    : `返済まで、あと${CHAPTER_DAYS - s.day + 1}日`}
                </small>
                <b>
                  {s.money >= due
                    ? "必要額を確保"
                    : `あと ${gold(due - s.money)}`}
                </b>
                <span>
                  手元 {gold(s.money)} ／ 納入 {gold(due)}
                </span>
              </button>
              <Button
                className="r-gallery-shortcut"
                onClick={() => setGallery(true)}
              >
                回想
              </Button>
              <Button aria-label="設定" onClick={() => setSettings(true)}>
                <Settings size={20} />
              </Button>
            </header>
            <div className="c-body">
              <aside className="c-portrait">
                <Art
                  src={reformArt.hero}
                  className="c-hero"
                  alt="エレオノール・ラティエ"
                />
              </aside>
              {showDesk && <Ledger s={s} />}
              <main className="c-main">
                {gallery ? (
                  <Gallery
                    seen={seenScenes}
                    onPlay={openReplay}
                    onSettings={() => setSettings(true)}
                    onClose={() => setGallery(false)}
                  />
                ) : s.awaitingSettlement ? (
                  <Settlement
                    s={s}
                    onAccept={() => commit({ type: "settle" })}
                  />
                ) : s.ended ? (
                  <Ending
                    s={s}
                    onTitle={() => setStarted(false)}
                    onGallery={() => setGallery(true)}
                  />
                ) : pending === "rest" ? (
                  <RestSheet
                    s={s}
                    onBack={closeLetter}
                    onAccept={() => commit({ type: "rest" })}
                  />
                ) : sheetJob ? (
                  <LetterSheet
                    job={sheetJob}
                    s={s}
                    onBack={closeLetter}
                    onAccept={() => commit({ type: "take", job: sheetJob.id })}
                    signing={ritual === "sign"}
                  />
                ) : ui.tab === "journal" ? (
                  <Journal
                    s={s}
                    onClose={() => {
                      patch({ tab: "today", sheet: null });
                      requestAnimationFrame(() =>
                        document.querySelector<HTMLElement>(".c-book")?.focus(),
                      );
                    }}
                    onGallery={() => setGallery(true)}
                  />
                ) : (
                  <div className="c-today">
                    <header className="r-desk-heading">
                      <small>本日の便り</small>
                      <h2>今日は、どの依頼を。</h2>
                    </header>
                    <div className="c-offers">
                      {offers.map((job) => (
                        <OfferCard
                          key={job.id}
                          job={job}
                          s={s}
                          onOpen={() => openLetter(job.id)}
                        />
                      ))}
                      {!offers.length && (
                        <p className="c-muted">
                          今日は誰からも声がかからない。
                        </p>
                      )}
                    </div>
                    <div className="c-desk-actions">
                      <button
                        type="button"
                        className="c-book"
                        onClick={openJournal}
                      >
                        <span className="c-book-pages" aria-hidden="true" />
                        <span className="c-book-spine" aria-hidden="true" />
                        <span className="c-book-cover">
                          <span className="c-book-ribbon" aria-hidden="true" />
                          <span className="c-book-label">返済帳・台帳</span>
                          {traces.length > 0 && (
                            <small>紹介停止 {traces.length}件</small>
                          )}
                        </span>
                      </button>
                      <RestRow
                        s={s}
                        onPick={() => {
                          lastLetter.current = null;
                          paperSound(ui.volume);
                          setPending("rest");
                        }}
                      />
                    </div>
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

      {ritual === "rest" && (
        <div
          className={`c-letter-ritual c-ritual-${ritual}`}
          role="status"
          aria-live="polite"
        >
          <div>
            <span>手紙を置いて、ひと休み</span>
            <b>夜が過ぎる</b>
          </div>
        </div>
      )}
      <span className="c-sr-only" role="status" aria-live="polite">
        {ritual === "sign" ? "返事をしたためる" : ""}
      </span>

      {replay && (
        <Dialogue
          title={replay.title}
          lines={replay.lines}
          place={replay.place}
          speed={ui.speed}
          sceneId={replay.id}
          textSize={ui.textSize}
          strongText={ui.strongText}
          motion={ui.motion}
          onSettingsChange={patch}
          onDone={closeReplay}
        />
      )}

      {scene && s && (
        <Dialogue
          title={scene.title}
          lines={scene.scene}
          place={personOf(scene.person ?? "vernet").place}
          speed={ui.speed}
          sceneId={scene.sceneIds[0]}
          textSize={ui.textSize}
          strongText={ui.strongText}
          motion={ui.motion}
          onSettingsChange={patch}
          onDone={() => {
            setResult(scene);
            setScene(null);
          }}
        />
      )}

      {result && savedState && s && (
        <Modal
          variant="result"
          title={result.kind === "settle" ? "返済の記録" : "本日の記録"}
          onClose={closeResult}
          footer={
            <>
              <small role={saveError ? "alert" : undefined}>
                {saveError
                  ? "保存できませんでした。再読込する前に保存を再試行してください。"
                  : result.title}
              </small>
              {saveError && (
                <Button
                  onClick={() => {
                    if (stateRef.current) persist(stateRef.current);
                  }}
                >
                  保存を再試行
                </Button>
              )}
              <Button primary onClick={closeResult}>
                {savedState.ended
                  ? "結末へ"
                  : savedState.awaitingSettlement
                    ? "返済へ"
                    : result.kind === "settle"
                      ? "次章へ"
                      : "翌朝へ"}
              </Button>
            </>
          }
        >
          <DayRecord before={s} after={savedState} result={result} />
        </Modal>
      )}

      {settings && (
        <Modal
          variant="settings"
          title="設定"
          onClose={() => setSettings(false)}
          footer={
            <Button primary onClick={() => setSettings(false)}>
              閉じる
            </Button>
          }
        >
          <GameSettings
            value={ui}
            onChange={patch}
            volume={ui.volume}
            onVolume={(volume) => patch({ volume })}
            screen={
              <>
                {fullscreenSupported() && (
                  <Button onClick={fullscreen.toggle}>
                    {fullscreen.active ? "全画面をやめる" : "全画面で遊ぶ"}
                  </Button>
                )}
                <p>横向きで、絵と依頼状を広く見られます。</p>
                <Button
                  onClick={() => {
                    setSettings(false);
                    setStarted(false);
                    setGallery(false);
                  }}
                >
                  タイトルへ戻る
                </Button>
              </>
            }
            data={
              <>
                <h3>進行の記録</h3>
                <p>はじめから遊んでも、回想は残ります。</p>
                <Button onClick={() => setReset("delete")}>保存を消す</Button>
                <h3>回想の記録</h3>
                <p>解禁した回想と、本文の読了記録を消します。</p>
                <Button onClick={() => setReset("gallery")}>回想を消す</Button>
              </>
            }
          />
        </Modal>
      )}

      {reset && (
        <Modal
          title={
            reset === "new"
              ? "はじめから"
              : reset === "gallery"
                ? "回想を消す"
                : "保存を消す"
          }
          onClose={() => setReset(null)}
          footer={
            <>
              <Button onClick={() => setReset(null)}>戻る</Button>
              <Button
                primary
                onClick={() => {
                  if (reset === "new") begin();
                  else if (reset === "gallery") {
                    clearGallery(localStorage);
                    localStorage.removeItem(READ_SCENES_KEY);
                    setSeenScenes([]);
                    setReset(null);
                  } else {
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
          <p>
            {reset === "gallery"
              ? "解禁した回想と本文の読了記録を消します。ゲームの進行は残ります。"
              : "現在の進行記録は消えます。回想は残ります。"}{" "}
            この操作は元に戻せません。
          </p>
        </Modal>
      )}

      {saveError && started && !result && !scene && (
        <div className="r-save-error" role="alert">
          <b>保存できませんでした</b>
          <span>再読込すると最後の保存時点に戻ります。</span>
          <Button
            onClick={() => {
              if (stateRef.current) persist(stateRef.current);
            }}
          >
            保存を再試行
          </Button>
        </div>
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
