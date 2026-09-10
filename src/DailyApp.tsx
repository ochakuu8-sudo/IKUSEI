import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { BookOpen, Settings } from "lucide-react";
import {
  jobs,
  personOf,
} from "./game";
import {
  dailyAction,
  freshDaily,
  markSeen,
  offersOf,
  type DailyState,
  type DayOutcome,
} from "./daily";
import { clearDaily, loadDaily, saveDaily, UI_KEY, SAVE_KEY } from "./saveV14";
import { persistTransition, type Command } from "./adv/engine";
import { AdvSession } from "./ui/AdvSession";
import { GrowthPanel, DignityPanel } from "./ui/CharacterPanels";
import { ADV_ARCHIVE_KEY, loadArchive, syncArchive } from "./adv/archive";
import type { ReplayRecord } from "./adv/types";
import { type SceneEntry } from "./scenes";
import { clearGallery, loadGallery, recordScenes } from "./gallery";
import { Art, Modal, GameButton as Button } from "./ui/shell";
import { Dialogue } from "./ui/scene";
import { preloadScene } from "./ui/sceneVisuals";
import { manorMaterialStyle } from "./art";
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
import "./ui/presentation.css";
import "./ui/atelier.css";
import "./ui/stationery.css";
import { DeskBinding, DeskHeader, StatusRibbon, EnvelopeOffer as OfferCard, OpenLetter as LetterSheet, DeskRest as RestSheet } from "./ui/DeskPresentation";
import { GameGlyph } from "./ui/GameGlyph";


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
  const [advError, setAdvError] = useState("");
  const pendingAdv = useRef<Command | null>(null);
  const pendingNewSave = useRef(false);
  const [growthOpen, setGrowthOpen] = useState(false);
  const [dignityOpen, setDignityOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archive, setArchive] = useState(() => loadArchive(localStorage));
  const [advReplay, setAdvReplay] = useState<ReplayRecord | null>(null);
  const activeAdv = started && savedState?.activeSession;
  useEffect(() => {
    if (!savedState) return;
    try { setArchive(syncArchive(localStorage, savedState.recordings)); }
    catch { setNotice("回想を保存できませんでした。本編の記録は保存済みです。「選択の回想」を開くと保存を再試行します。"); }
  }, [savedState?.recordings.length]);
  function preserveArchive() {
    try { setArchive(syncArchive(localStorage, stateRef.current?.recordings ?? [])); return true; }
    catch { setNotice("回想を保存できませんでした。本編の記録は残っています。容量などを確認して再試行してください。"); return false; }
  }
  function openArchive() {
    if (preserveArchive()) setArchiveOpen(true);
  }
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
    if (stateRef.current?.activeSession || lock.current || paperReturning.current) return;
    const job = jobs.find((j) => j.id === id);
    if (job)
      void preloadScene(
        [{ text: "", sceneId: `job:${id}` }],
        personOf(job.person).place,
      );
    lastLetter.current = id;
    const card = document.querySelector<HTMLElement>(
      `[data-job="${CSS.escape(id)}"] .a-envelope-face`,
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
      ".c-manor .a-open-letter",
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
      ".c-manor .a-open-letter",
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
        ? `[data-job="${CSS.escape(lastLetter.current)}"] .a-envelope`
        : ".a-rest-action";
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
        ".c-main .a-envelope, .c-main .a-accept, .c-main .c-empty button",
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
    [
      reformArt.paper,
      reformArt.book,
      reformArt.plaque,
      reformArt.binding,
    ].forEach((src) => {
      const img = new Image();
      img.src = src;
    });
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
      "--journal-binding",
      `url("${reformArt.binding}")`,
    );
    document.documentElement.style.setProperty(
      "--stationery-button",
      `url("${reformArt.button}")`,
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
      // One landscape canvas on every device, including portrait phones.
      const scale = Math.min(
        (innerWidth - l - r) / 1200,
        (innerHeight - t - b) / 500,
      );
      document.documentElement.style.setProperty("--fit", String(scale));
      document.documentElement.style.setProperty("--stage-w", "1200px");
      document.documentElement.style.setProperty("--stage-h", "500px");
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
    try {
      saveDaily(localStorage, next);
      stateRef.current = next;
      setS(next);
      setSaveError("");
      return true;
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "保存に失敗しました");
      return false;
    }
  }

  function sendAdv(command: Command) {
    const before = stateRef.current;
    if (!before || (pendingAdv.current && command.type === "cursor")) return;
    if (command.type === "cursor") {
      const old = before.activeSession;
      if (!old || old.id !== command.sessionId || old.nodeId !== command.nodeId || old.phase !== "playing") return;
      if (JSON.stringify(old.cursor) === JSON.stringify(command.cursor)) return;
    }
    const out = persistTransition(localStorage, SAVE_KEY, before, command);
    if (out.error) {
      if (out.error.startsWith("保存")) { pendingAdv.current = command; setAdvError(out.error); }
      else if (command.type !== "cursor") setNotice(out.error);
      return;
    }
    pendingAdv.current = null;
    setAdvError("");
    stateRef.current = out.state;
    setS(out.state);
    if (command.type === "begin") {
      patch({ sheet: null });
      setDeskSnapshot(null);
      setNotice("");
    }
    if (out.state.activeSession?.phase === "result") {
      setSeenScenes(seen => recordScenes(localStorage, seen, out.state.activeSession!.outcome!.sceneIds));
    }
    if (command.type === "acknowledge" || command.type === "restore") {
      lock.current = false;
      setDeskSnapshot(null);
    }
  }
  function retryAdv() {
    const command = pendingAdv.current;
    pendingAdv.current = null;
    if (command) sendAdv(command);
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
    && !activeAdv
  );
  useEffect(() => {
    if (!s || !offersVisible) return;
    const ids = offersOf(s).map((j) => j.id);
    const next = markSeen(s, ids);
    if (next !== s) persist(next);
  }, [s?.revision, s?.day, s?.chapter, offersVisible]);

  function commit(action: Parameters<typeof dailyAction>[1]) {
    if (action.type === "take") { sendAdv({ type: "begin", jobId: action.job }); return; }
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
      const before = stateRef.current;
      if (!persist(out.state)) { lock.current = false; return; }
      setDeskSnapshot(before);
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
        paperSound(ui.volume, "rest");
        setRitual("rest");
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
          reduce ? 0 : 380,
        );
      }
    }
  }

  function begin() {
    if (!preserveArchive()) return;
    paperMotion.current?.cancel();
    paperReturning.current = false;
    setDeskSnapshot(null);
    setPending(null);
    patch({ tab: "today", sheet: null });
    setNotice("");
    setSaveError("");
    const fresh = freshDaily();
    if (!persist(fresh)) { pendingNewSave.current = true; return; }
    pendingNewSave.current = false;
    pendingAdv.current = null;
    setAdvError("");
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
        className={`chapter-app r-game ${showDesk && ui.tab === "today" ? "a-desk-layout" : ""} ${gallery ? "r-gallery-stage" : ui.tab === "journal" && started ? "r-journal-stage" : ""} ${result ? "r-night" : ""} ${s?.awaitingSettlement && started ? "r-settlement-stage" : ""} ${s?.ended && started ? "r-ending-stage" : ""} ${
          !started
            ? gallery
              ? ""
              : "c-title"
            : showDesk
              ? `c-home c-manor ${sheetJob || pending ? "c-reading" : ""} ${ui.tab === "journal" ? "c-journal" : ""} ${ritual ? "c-ritual" : ""}`
              : ""
        }`}
        inert={!!ritual || !!scene || !!result || !!activeAdv || undefined}
        aria-busy={!!ritual || undefined}
        style={
          {
            ...manorMaterialStyle,
            "--reform-paper": `url("${reformArt.paper}")`,
            "--folded-paper": `url("${reformArt.foldedPaper}")`,
            "--open-paper": `url("${reformArt.openPaper}")`,
            "--reform-book": `url("${reformArt.book}")`,
            "--reform-closed-book": `url("${reformArt.closedBook}")`,
            "--reform-window": `url("${reformArt.window}")`,
            "--character-plaque": `url("${reformArt.plaque}")`,
            "--journal-binding": `url("${reformArt.binding}")`,
            "--stationery-button": `url("${reformArt.button}")`,
            "--letter-bookmark": `url("${reformArt.bookmark}")`,
            "--manor-wax": `url("${reformArt.wax}")`,
            backgroundImage: `url("${reformArt.room}")`,
          } as React.CSSProperties
        }
      >
        {!started && gallery ? (
          <Gallery
            seen={seenScenes}
            onPlay={openReplay}
            onSettings={() => setSettings(true)}
            onOpenArchive={openArchive}
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
              <nav className="title-actions" aria-label="ゲームメニュー">
                <Button primary disabled={!s} onClick={() => setStarted(true)}>続きから <span aria-hidden="true">›</span></Button>
                <Button onClick={() => { if (s) setReset("new"); else begin(); }}>はじめから</Button>
                <Button onClick={() => setGallery(true)}><BookOpen size={23} aria-hidden="true" />回想</Button>
                <Button onClick={() => setSettings(true)}><Settings size={23} aria-hidden="true" />設定</Button>
              </nav>
              {notice && <p className="c-note">{notice}</p>}
            </div>
          </>
        ) : s ? (
          <>
            <DeskHeader s={s} onJournal={openJournal} onGallery={() => setGallery(true)} onSettings={() => setSettings(true)} />
            <div className="c-body">
              <aside className="c-portrait">
                <Art
                  src={reformArt.hero}
                  className="c-hero"
                  alt="エレオノール・ラティエ"
                />
              </aside>
              {showDesk && ui.tab === "today" && <><DeskBinding/><div className="a-character-name"><small>LATIER</small>エレオノール</div><StatusRibbon s={s} onDignity={() => setDignityOpen(true)} onGrowth={() => setGrowthOpen(true)} /></>}
              <main className="c-main">
                {showDesk && ui.tab === "today" && (sheetJob || pending) && <header className="a-desk-heading"><span>本日の便り</span></header>}
                {gallery ? (
                  <Gallery
                    seen={seenScenes}
                    onPlay={openReplay}
                    onSettings={() => setSettings(true)}
            onOpenArchive={openArchive}
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
                  <>
                    <LetterSheet
                      job={sheetJob}
                      s={s}
                      onBack={closeLetter}
                      onAccept={() => commit({ type: "take", job: sheetJob.id })}
                      signing={ritual === "sign"}
                    />
                  </>
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
                    <header className="a-desk-heading"><span>本日の便り</span><button className="a-rest-action" onClick={() => { lastLetter.current=null; paperSound(ui.volume); setPending("rest"); }}><GameGlyph name="moon"/>今日は受けない</button></header>
                    <div className="a-offers">
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

      {growthOpen && savedState && <Modal variant="folio" title="主人公の成長" onClose={() => setGrowthOpen(false)}><GrowthPanel state={savedState} /></Modal>}
      {dignityOpen && savedState && <Modal variant="folio" title="三つの尊厳" onClose={() => setDignityOpen(false)}><DignityPanel state={savedState} /></Modal>}
      {archiveOpen && <Modal variant="folio" title="選択の回想" onClose={() => setArchiveOpen(false)}>
        <p>到達した本文と選んだ対応を、その時の記録で読み返します。</p>
        <div className="adv-archive-list">{archive.length ? archive.map((r, i) => <Button key={r.id} onClick={() => { setArchiveOpen(false); setAdvReplay(r); }}><span className="archive-number">{String(i + 1).padStart(2, "0")}</span><span><b>{r.title}</b><small>{r.choices.map(c => c.text).join(" → ") || "本文の記録"}</small></span><BookOpen aria-hidden="true" /></Button>) : <div className="archive-empty"><BookOpen aria-hidden="true" /><h3>まだ綴られていない記憶</h3><p>依頼で選んだ対応が、ここに残ります。</p></div>}</div>
      </Modal>}
      {advReplay && <Dialogue title={advReplay.title} lines={advReplay.lines} place={personOf(advReplay.person).place} speed={ui.speed} textSize={ui.textSize} strongText={ui.strongText} motion={ui.motion} sceneId={advReplay.id} onSettingsChange={patch} onDone={() => { setAdvReplay(null); setArchiveOpen(true); }} />}
      {activeAdv && savedState && <AdvSession state={savedState} send={sendAdv} error={advError} retry={retryAdv}
        onTitle={() => { if (!pendingAdv.current) { setStarted(false); lock.current = false; } }}
        settings={ui} onSettingsChange={patch} />}
      {advError && !activeAdv && <Modal title="保存できませんでした" onClose={() => {}}><p role="alert">{advError}</p><Button onClick={retryAdv}>保存を再試行</Button></Modal>}

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
                    localStorage.removeItem(ADV_ARCHIVE_KEY);
                    setArchive([]);
                    if (stateRef.current && !persist({ ...stateRef.current, recordings: [] })) return;
                    clearGallery(localStorage);
                    localStorage.removeItem(READ_SCENES_KEY);
                    setSeenScenes([]);
                    setReset(null);
                  } else {
                    if (!preserveArchive()) return;
                    clearDaily(localStorage);
                    stateRef.current = null;
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

      {saveError && !result && !scene && (
        <div className="r-save-error" role="alert">
          <b>保存できませんでした</b>
          <span>操作は確定していません。保存を再試行してから、もう一度操作してください。</span>
          <Button
            onClick={() => {
              if (pendingNewSave.current) begin();
              else if (stateRef.current) persist(stateRef.current);
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
