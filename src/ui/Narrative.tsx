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
import { Art, Badge, Button, Modal, money, sign } from "./components";
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
}: {
  title: string;
  lines: SceneLine[];
  place: PlaceId;
  speed: number;
  onDone: () => void;
}) {
  const [line, setLine] = useState(0),
    [chars, setChars] = useState(0),
    [log, setLog] = useState(false);
  const current = lines[line],
    full = chars >= current.text.length;
  useEffect(() => {
    setChars(speed === 0 ? current.text.length : 0);
    if (!speed) return;
    const timer = window.setInterval(
      () => setChars((n) => Math.min(current.text.length, n + 1)),
      speed,
    );
    return () => clearInterval(timer);
  }, [line, current.text, speed]);
  return (
    <Modal
      title={title}
      onClose={onDone}
      footer={
        <>
          <Button onClick={() => setLog(!log)}>
            {log ? "本文に戻る" : "会話ログ"}
          </Button>
          <span>
            {line + 1} / {lines.length}
          </span>
          <Button
            primary
            onClick={() => {
              if (!full) setChars(current.text.length);
              else if (line + 1 < lines.length) setLine(line + 1);
              else onDone();
            }}
          >
            {!full
              ? "全文を表示"
              : line + 1 < lines.length
                ? "次へ"
                : "読み終える"}
          </Button>
        </>
      }
    >
      <div className="dialogue-scene">
        <Art src={placeSrc(place)} className="dialogue-bg" />
        <Art src={heroSrc} className="dialogue-hero" alt="エレオノール" />
      </div>
      {log ? (
        <div className="conversation-log">
          {lines.slice(0, line + 1).map((l, i) => (
            <p key={i}>
              <b>{l.speaker}</b> {l.text}
            </p>
          ))}
        </div>
      ) : (
        <div className="speech">
          <Badge>{current.speaker ?? "記録"}</Badge>
          <p aria-label={current.text}>
            {current.text.slice(0, chars)}
            <span className="cursor" aria-hidden="true">
              ▎
            </span>
          </p>
        </div>
      )}
    </Modal>
  );
}
