/**
 * 本番のADVパート。全画面の絵＋テキスト＋タップ送り。選択肢は出さない。
 * 依頼を受けるたびに必ず入る場所なので、送りきる以外の出口（とばす・ログ・隠す）を用意する。
 */
import { useEffect, useRef, useState } from "react";
import { heroSrc, placeSrc } from "../art";
import type { PlaceId, SceneLine } from "../game";
import "./narrative.css";
import { Art, Button, Modal } from "./shell";

export function Dialogue({
  title,
  lines,
  place,
  speed,
  onDone,
  image,
}: {
  title: string;
  lines: SceneLine[];
  place: PlaceId;
  speed: number;
  onDone: () => void;
  /** A complete scene CG can replace the temporary background/portrait composition. */
  image?: string;
}) {
  const [line, setLine] = useState(0);
  const [chars, setChars] = useState(0);
  const [log, setLog] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [menu, setMenu] = useState(false);
  const gesture = useRef<{
    x: number;
    y: number;
    moved: boolean;
    opened: boolean;
  } | null>(null);
  const hold = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(hold.current), []);
  const current = lines[line];
  const full = chars >= current.text.length;
  useEffect(() => {
    setChars(speed === 0 ? current.text.length : 0);
    if (!speed) return;
    const timer = window.setInterval(
      () => setChars((n) => Math.min(current.text.length, n + 1)),
      speed,
    );
    return () => clearInterval(timer);
  }, [line, current.text, speed]);
  const next = () => {
    if (!full) setChars(current.text.length);
    else if (line + 1 < lines.length) {
      setChars(speed === 0 ? lines[line + 1].text.length : 0);
      setLine(line + 1);
    } else onDone();
  };
  const tap = () => {
    if (hidden) {
      setHidden(false);
      return;
    }
    if (log || menu) {
      setLog(false);
      setMenu(false);
      return;
    }
    next();
  };
  const press = (e: React.PointerEvent<HTMLButtonElement>) => {
    clearTimeout(hold.current);
    gesture.current = {
      x: e.clientX,
      y: e.clientY,
      moved: false,
      opened: false,
    };
    hold.current = setTimeout(() => {
      if (gesture.current && !gesture.current.moved) {
        gesture.current.opened = true;
        setHidden(false);
        setMenu(true);
      }
    }, 450);
  };
  const move = (e: React.PointerEvent<HTMLButtonElement>) => {
    const g = gesture.current;
    if (!g) return;
    if (Math.hypot(e.clientX - g.x, e.clientY - g.y) > 12) {
      g.moved = true;
      clearTimeout(hold.current);
    }
  };
  const release = (e: React.PointerEvent<HTMLButtonElement>) => {
    clearTimeout(hold.current);
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    if (g.opened) return;
    if (e.clientY - g.y < -40) {
      setHidden(false);
      setMenu(true);
      return;
    }
    if (!g.moved && Math.hypot(e.clientX - g.x, e.clientY - g.y) < 12) tap();
  };
  const pointer = {
    onPointerDown: press,
    onPointerMove: move,
    onPointerUp: release,
    onPointerCancel: () => {
      clearTimeout(hold.current);
      gesture.current = null;
    },
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
      if (e.detail === 0) tap();
    },
  };
  return (
    <Modal
      title={title}
      variant="scenario"
      onClose={() => {
        if (log) setLog(false);
        else {
          setHidden(false);
          setMenu((v) => !v);
        }
      }}
    >
      <div className="scenario-art" aria-label="シナリオ画像">
        <Art
          src={image ?? placeSrc(place)}
          className="scenario-background"
          alt={title}
        />
        {!image && (
          <Art src={heroSrc} className="scenario-portrait" alt="エレオノール" />
        )}
      </div>
      <button
        className="scenario-tap-target"
        aria-label={
          hidden
            ? "セリフを表示"
            : menu || log
              ? "本文に戻る"
              : "画面をタップして次へ"
        }
        {...pointer}
      />
      {!hidden && (
        <>
          <button
            className="scenario-menu-toggle"
            aria-label="シナリオメニュー"
            aria-expanded={menu}
            onClick={() => {
              setLog(false);
              setMenu((v) => !v);
            }}
          >
            ⋯
          </button>
          {log ? (
            <section className="scenario-log" aria-label="会話ログ">
              <header>
                <h2>会話ログ</h2>
                <Button onClick={() => setLog(false)}>本文に戻る</Button>
              </header>
              <div className="scenario-log-lines">
                {lines.slice(0, line + 1).map((l, i) => (
                  <p key={i}>
                    {l.speaker && <b>{l.speaker}</b>}
                    {l.text}
                  </p>
                ))}
              </div>
            </section>
          ) : menu ? (
            <nav
              className="scenario-controls scenario-menu"
              aria-label="シナリオ操作"
            >
              <button
                onClick={() => {
                  setMenu(false);
                  setLog(true);
                }}
              >
                会話ログ
              </button>
              <button
                onClick={() => {
                  setMenu(false);
                  setHidden(true);
                }}
              >
                セリフを隠す
              </button>
              {/* 納品のたびに場面が入るので、送りきる以外の出口を必ず用意する。 */}
              <button onClick={onDone}>この場面をとばす</button>
              <button onClick={() => setMenu(false)}>本文に戻る</button>
            </nav>
          ) : (
            <section className="scenario-message" aria-label="セリフ">
              {current.speaker && (
                <div className="scenario-speaker">{current.speaker}</div>
              )}
              <button
                className="scenario-text"
                aria-label={current.text}
                {...pointer}
              >
                <span>{current.text.slice(0, chars)}</span>
                {full && (
                  <span className="scenario-next" aria-hidden="true">
                    ▼
                  </span>
                )}
              </button>
            </section>
          )}
        </>
      )}
    </Modal>
  );
}
