import { useEffect, useState } from "react";
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
          <small>体力</small>
          <b>{sign(s.stamina - before.stamina)}</b>
        </div>
        <div>
          <small>日数</small>
          <b>{r?.days ?? 0}日</b>
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
  const nextLabel = !full
    ? "全文を表示"
    : line + 1 < lines.length
      ? "次へ"
      : "読み終える";
  return (
    <Modal
      title={title}
      variant="scenario"
      onClose={() => {
        if (log) setLog(false);
        else setHidden((value) => !value);
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
      {hidden ? (
        <button className="scenario-restore" onClick={() => setHidden(false)}>
          セリフを表示
        </button>
      ) : (
        <>
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
          ) : (
            <section className="scenario-message" aria-label="セリフ">
              {current.speaker && (
                <div className="scenario-speaker">{current.speaker}</div>
              )}
              <button
                className="scenario-text"
                onClick={next}
                aria-label={current.text}
              >
                <span>{current.text.slice(0, chars)}</span>
                {full && (
                  <span className="scenario-next" aria-hidden="true">
                    ▼
                  </span>
                )}
              </button>
              <nav className="scenario-controls" aria-label="シナリオ操作">
                <button onClick={() => setLog(true)}>会話ログ</button>
                <button onClick={() => setHidden(true)}>セリフを隠す</button>
                <span className="scenario-position">
                  {line + 1} / {lines.length}
                </span>
                <button className="scenario-forward" onClick={next}>
                  {nextLabel} <span aria-hidden="true">▸</span>
                </button>
              </nav>
            </section>
          )}
        </>
      )}
    </Modal>
  );
}
