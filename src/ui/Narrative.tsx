import { useEffect, useRef, useState } from "react";
import { heroSrc, placeSrc } from "../art";
import type { ActionOutcome } from "../engine";
import {
  materialOf,
  people,
  recipeOf,
  relationStage,
  type GameState,
  type PlaceId,
  type SceneLine,
} from "../game";
import "./narrative.css";
import { Art, Button, Modal, money, sign } from "./components";
export function ResultDetails({
  before,
  outcome,
}: {
  before: GameState;
  outcome: ActionOutcome;
}) {
  const r = outcome.result,
    s = outcome.state;
  return (
    <>
      <div className="stats">
        <div>
          <small>所持金</small>
          <b>{sign(s.money - before.money)} G</b>
        </div>
        <div>
          <small>スタミナ</small>
          <b>{sign(s.stamina - before.stamina)}</b>
        </div>
        <div>
          <small>日付</small>
          <b>{r?.days ? "翌日へ" : "そのまま"}</b>
        </div>
      </div>
      {people
        .filter((p) => s.relations[p.id] > before.relations[p.id])
        .map((p) => (
          <div className="unlock" key={p.id}>
            ✧ {p.name}との関係が進みました{" "}
            <b>{relationStage(s.relations[p.id])}</b>
          </div>
        ))}
      {s.known
        .filter((id) => !before.known.includes(id))
        .map((id) => (
          <div className="unlock" key={id}>
            ✧ 新しい処方：{recipeOf(id).name}
          </div>
        ))}
      {r?.notices?.map((n, i) => (
        <p className="unlock" key={i}>
          {n}
        </p>
      ))}
      <details>
        <summary>行動の内訳を見る</summary>
        <p>{r?.narrative}</p>
        {r?.deliveries?.map((d, i) => (
          <p key={i}>
            {d.title}：{recipeOf(d.recipe).name} ×{d.count} ／ {money(d.pay)}
          </p>
        ))}
        {r?.axisDrops.map((a) => (
          <p key={a.axis}>
            {a.axis} −{a.amount}
          </p>
        ))}
        {r?.axisGains.map((a) => (
          <p key={a.axis}>
            {a.axis} ＋{a.amount}
          </p>
        ))}
        {r?.dignityCapDrop ? <p>品位上限 −{r.dignityCapDrop}</p> : null}
        {r?.materialDeltas?.map((m) => (
          <p key={m.id}>
            {materialOf(m.id).name} {sign(m.amount)}
          </p>
        ))}
      </details>
    </>
  );
}
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
