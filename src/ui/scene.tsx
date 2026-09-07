import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Ellipsis, Eye } from "lucide-react";
import { placeOf, type PlaceId, type SceneLine } from "../game";
import { Modal } from "./shell";
import { graphemes, paginateText } from "./novelText";
import { prepareVisual, visualFor, type SceneVisual } from "./sceneVisuals";
import "./narrative.css";

export type ReadingSettings = {
  speed: number;
  textSize: number;
  strongText: boolean;
  motion: boolean;
};
type View = "reading" | "hidden" | "menu" | "log" | "settings";

/** 絵を全面に、原則2行の字幕を下端に。読書操作はゲームの確定処理を持たない。 */
export function Dialogue({
  title,
  lines,
  place,
  speed,
  onDone,
  image,
  sceneId,
  textSize = 24,
  strongText = false,
  motion = false,
  onSettingsChange,
}: {
  title: string;
  lines: SceneLine[];
  place: PlaceId;
  speed: number;
  onDone: () => void;
  image?: string;
  sceneId?: string;
  textSize?: number;
  strongText?: boolean;
  motion?: boolean;
  onSettingsChange?: (settings: Partial<ReadingSettings>) => void;
}) {
  const [position, setPosition] = useState({ line: 0, offset: 0 });
  const [chars, setChars] = useState(0),
    [view, setView] = useState<View>("reading");
  const [reader, setReader] = useState({ speed, textSize, strongText, motion });
  const [systemMotion, setSystemMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [metrics, setMetrics] = useState({
    font: `${textSize}px serif`,
    width: 870,
    version: 0,
  });
  const [prepared, setPrepared] = useState<{ key: string; art: SceneVisual }>();
  const [placeVisible, setPlaceVisible] = useState(true);
  const stageRef = useRef<HTMLDivElement>(null),
    textRef = useRef<HTMLButtonElement>(null),
    tapRef = useRef<HTMLButtonElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const finished = useRef(false),
    blockedUntil = useRef(0);
  const hold = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const gesture = useRef<{
    x: number;
    y: number;
    moved: boolean;
    opened: boolean;
  } | null>(null);
  const current = lines[position.line] ?? { text: "" },
    reduce = reader.motion || systemMotion;

  useEffect(
    () => setReader({ speed, textSize, strongText, motion }),
    [speed, textSize, strongText, motion],
  );
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const changed = () => setSystemMotion(media.matches);
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, []);
  useEffect(() => () => clearTimeout(hold.current), []);
  useLayoutEffect(() => {
    if (view === "log" && logRef.current)
      logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [view]);
  function updateSettings(patch: Partial<ReadingSettings>) {
    setReader((value) => ({ ...value, ...patch }));
    onSettingsChange?.(patch);
  }

  const raw = useMemo(() => {
    let id = sceneId,
      cue: string | undefined;
    for (const line of lines.slice(0, position.line + 1)) {
      if (line.sceneId && line.sceneId !== id) {
        id = line.sceneId;
        cue = undefined;
      }
      if (line.visual) cue = line.visual;
    }
    const visual = visualFor(id, place, cue);
    return image ? { ...visual, image } : visual;
  }, [sceneId, lines, position.line, place, image]);
  const visualKey = JSON.stringify(raw),
    ready = prepared?.key === visualKey,
    art = prepared?.art;
  useEffect(() => {
    let active = true;
    void prepareVisual(raw).then((art) => {
      if (active) setPrepared({ key: visualKey, art });
    });
    return () => {
      active = false;
    };
  }, [visualKey]);
  useEffect(() => {
    if (!ready) return;
    setPlaceVisible(true);
    const timer = setTimeout(() => setPlaceVisible(false), 1400);
    return () => clearTimeout(timer);
  }, [ready, visualKey]);
  useLayoutEffect(() => {
    let active = true;
    const measure = () => {
      if (!active || !textRef.current) return;
      const style = getComputedStyle(textRef.current);
      // font-variant-numericを継承するとfont短縮形が空文字になるブラウザがある。
      const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`,
        width = textRef.current.clientWidth || 870;
      setMetrics((previous) => ({
        font,
        width,
        version: previous.version + 1,
      }));
    };
    measure();
    void document.fonts.ready.then(measure);
    return () => {
      active = false;
    };
  }, [reader.textSize, ready]);
  const pages = useMemo(() => {
    const context = document.createElement("canvas").getContext("2d")!;
    context.font = metrics.font;
    return paginateText(
      current.text,
      metrics.width - 3,
      (text) => context.measureText(text).width,
    );
  }, [current.text, metrics]);
  const pageIndex = Math.max(
      0,
      pages.findIndex(
        (p) => p.end > position.offset || p.end === current.text.length,
      ),
    ),
    page = pages[pageIndex];
  const letters = useMemo(() => graphemes(page.text), [page.text]),
    full = chars >= letters.length;
  useLayoutEffect(() => {
    setChars(reader.speed === 0 ? letters.length : 0);
  }, [position.line, page.start, page.text]);
  useEffect(() => {
    if (!ready || view !== "reading") return;
    if (reader.speed === 0) {
      setChars(letters.length);
      return;
    }
    if (full) return;
    const timer = setInterval(
      () => setChars((n) => Math.min(letters.length, n + 1)),
      reader.speed,
    );
    return () => clearInterval(timer);
  }, [ready, view, reader.speed, letters.length, full]);
  useEffect(() => {
    const selector =
      view === "menu"
        ? ".scenario-menu button"
        : view === "log"
          ? ".scenario-log button"
          : view === "settings"
            ? ".scenario-settings select"
            : ".scenario-tap-target";
    stageRef.current
      ?.querySelector<HTMLElement>(selector)
      ?.focus({ preventScroll: true });
  }, [view]);
  function finish() {
    if (finished.current) return;
    finished.current = true;
    clearTimeout(hold.current);
    onDone();
  }
  function restore() {
    setView("reading");
    blockedUntil.current = performance.now() + 160;
  }
  function tap() {
    if (finished.current || performance.now() < blockedUntil.current) return;
    if (view !== "reading") {
      restore();
      return;
    }
    if (!ready) return;
    blockedUntil.current = performance.now() + 100;
    if (!full) setChars(letters.length);
    else if (pageIndex + 1 < pages.length)
      setPosition({ line: position.line, offset: pages[pageIndex + 1].start });
    else if (position.line + 1 < lines.length)
      setPosition({ line: position.line + 1, offset: 0 });
    else finish();
  }
  function cancelGesture() {
    clearTimeout(hold.current);
    gesture.current = null;
  }
  const pointer = {
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!e.isPrimary || e.button !== 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      cancelGesture();
      gesture.current = {
        x: e.clientX,
        y: e.clientY,
        moved: false,
        opened: false,
      };
      if (view === "hidden") return;
      hold.current = setTimeout(() => {
        if (gesture.current && !gesture.current.moved) {
          gesture.current.opened = true;
          setView("menu");
        }
      }, 450);
    },
    onPointerMove: (e: React.PointerEvent<HTMLButtonElement>) => {
      if (
        gesture.current &&
        Math.hypot(
          e.clientX - gesture.current.x,
          e.clientY - gesture.current.y,
        ) > 12
      ) {
        gesture.current.moved = true;
        clearTimeout(hold.current);
      }
    },
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
      const g = gesture.current;
      cancelGesture();
      if (!g || g.opened) return;
      if (view !== "hidden" && e.clientY - g.y < -40) {
        setView("menu");
        return;
      }
      if (!g.moved && Math.hypot(e.clientX - g.x, e.clientY - g.y) < 12) tap();
    },
    onPointerCancel: cancelGesture,
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
      if (e.detail === 0) tap();
    },
  };
  return (
    <Modal
      title={title}
      variant="scenario"
      onClose={() => {
        if (view !== "reading") restore();
        else setView("menu");
      }}
    >
      <div
        ref={stageRef}
        className={`scenario-stage ${reader.strongText ? "scenario-strong" : ""} ${reduce ? "scenario-reduced" : ""}`}
        data-view={view}
        data-ready={ready}
        data-subtitle={art?.subtitle ?? "bottom"}
        style={{ "--novel-font-size": `${reader.textSize}px` } as CSSProperties}
        onKeyDown={(e) => {
          if (
            (e.key === "Enter" || e.key === " ") &&
            (e.target === tapRef.current || e.target === textRef.current)
          ) {
            e.preventDefault();
            if (!e.repeat) tap();
          }
        }}
      >
        <div
          className="scenario-art"
          aria-label="シナリオ画像"
          aria-busy={!ready}
        >
          {art && (
            <>
              <img
                key={art.image ?? art.background}
                src={art.image ?? art.background}
                className={`scenario-background ${art.image ? "scenario-cg" : ""}`}
                style={{
                  objectFit: art.image ? art.fit : "cover",
                  objectPosition: art.image ? art.focus : "center",
                }}
                alt={title}
              />
              {!art.image && (
                <img
                  src={art.portrait}
                  className={`scenario-portrait scenario-anchor-${art.anchor}`}
                  alt="エレオノール"
                />
              )}
            </>
          )}
        </div>
        <div className="scenario-shade" hidden={view === "hidden"} />
        <button
          ref={tapRef}
          type="button"
          className="scenario-tap-target"
          aria-label={
            view === "hidden"
              ? "セリフを表示"
              : view !== "reading"
                ? "余白をタップして本文に戻る"
                : "画面をタップして次へ"
          }
          {...pointer}
        />
        {!ready && (
          <div className="scenario-loading" role="status">
            場面を開いています…
          </div>
        )}
        {ready && placeVisible && view === "reading" && (
          <div className="scenario-place">
            {placeOf(art?.place ?? place).name}
          </div>
        )}
        <section
          className="scenario-message"
          aria-label="セリフ"
          hidden={!ready || view !== "reading"}
        >
          <div className="scenario-speaker">{current.speaker ?? ""}</div>
          <button
            ref={textRef}
            type="button"
            className="scenario-text"
            aria-label={page.text}
            data-line={position.line}
            data-page={pageIndex}
            {...pointer}
          >
            <span>{letters.slice(0, chars).join("")}</span>
          </button>
          {full && (
            <span className="scenario-next" aria-hidden="true">
              ▾
            </span>
          )}
        </section>
        {ready && view === "reading" && (
          <nav className="scenario-controls" aria-label="会話操作">
            <button
              type="button"
              className="scenario-hide"
              aria-label="セリフを隠す"
              onClick={() => setView("hidden")}
            >
              <Eye size={24} />
              <small>絵だけ</small>
            </button>
            <button
              type="button"
              className="scenario-menu-toggle"
              aria-label="シナリオメニュー"
              aria-expanded={false}
              onClick={() => setView("menu")}
            >
              <Ellipsis size={28} />
              <small>メニュー</small>
            </button>
          </nav>
        )}
        {view === "menu" && (
          <nav className="scenario-menu" aria-label="シナリオ操作">
            <button type="button" onClick={() => setView("log")}>
              会話ログ
            </button>
            <button type="button" onClick={() => setView("settings")}>
              読書設定
            </button>
            <button type="button" onClick={finish}>
              この場面をとばす
            </button>
            <button type="button" onClick={restore}>
              本文に戻る
            </button>
          </nav>
        )}
        {view === "log" && (
          <section className="scenario-log" aria-label="会話ログ">
            <header>
              <h2>会話ログ</h2>
              <button type="button" onClick={restore}>
                本文に戻る
              </button>
            </header>
            <div className="scenario-log-lines" ref={logRef}>
              {lines.slice(0, position.line + 1).map((row, i) => (
                <p key={i}>
                  {row.speaker && <b>{row.speaker}</b>}
                  {i === position.line ? row.text.slice(0, page.end) : row.text}
                </p>
              ))}
            </div>
          </section>
        )}
        {view === "settings" && (
          <section className="scenario-settings" aria-label="読書設定">
            <header>
              <h2>読書設定</h2>
              <button type="button" onClick={restore}>
                本文に戻る
              </button>
            </header>
            <div className="scenario-settings-body">
              <label>
                文字の大きさ
                <select
                  aria-label="文字の大きさ"
                  value={reader.textSize}
                  onChange={(e) =>
                    updateSettings({ textSize: Number(e.target.value) })
                  }
                >
                  {[22, 24, 26, 28].map((n) => (
                    <option key={n} value={n}>
                      {n}px{n === 24 ? "（標準）" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                文字送り
                <select
                  aria-label="文字送り"
                  value={reader.speed}
                  onChange={(e) =>
                    updateSettings({ speed: Number(e.target.value) })
                  }
                >
                  <option value={50}>ゆっくり</option>
                  <option value={24}>ふつう</option>
                  <option value={0}>すぐ出す</option>
                </select>
              </label>
              <label className="scenario-check">
                <input
                  type="checkbox"
                  checked={reader.strongText}
                  onChange={(e) =>
                    updateSettings({ strongText: e.target.checked })
                  }
                />
                字幕の地を濃くする
              </label>
              <label className="scenario-check">
                <input
                  type="checkbox"
                  checked={reader.motion}
                  onChange={(e) => updateSettings({ motion: e.target.checked })}
                />
                動きを減らす
              </label>
            </div>
          </section>
        )}
      </div>
    </Modal>
  );
}
