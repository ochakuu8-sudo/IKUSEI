import { useEffect, useRef, useState } from "react";
import type { DailyState } from "../daily";
import { personOf } from "../game";
import { evaluateCondition, type Evaluation } from "../adv/conditions";
import { growthDefinitions, growthLabel, growthOf } from "../adv/growth";
import { sceneKey, sessionError, type Command } from "../adv/engine";
import type { Effects, Snapshot } from "../adv/types";
import { Dialogue, type ReadingSettings } from "./scene";
import { Modal } from "./shell";
import { DayRecord, GameSettings } from "./ReformScreens";
import "./adv.css";

export function GrowthPanel({ state }: { state: Snapshot }) {
  return <div className="adv-growth" aria-label="成長の記録">
    {growthDefinitions.map(d => <article key={d.id}>
      <b>{growthLabel(d.id, state.growthXP[d.id])}</b>
      <p>{d.description}</p><small>{d.hint}</small>
    </article>)}
  </div>;
}
function ConditionView({ value }: { value: Evaluation }) {
  return <div className={value.ok ? "adv-met" : "adv-unmet"}>
    <span>{value.text}</span>
    {value.error && <span role="alert">{value.error}</span>}
    {value.children?.map((v, i) => <ConditionView key={i} value={v} />)}
  </div>;
}
function effectText(e?: Effects): string {
  if (!e) return "";
  return [
    e.bonusMoney ? "追加報酬 " + e.bonusMoney + "G" : "",
    ...Object.entries(e.growthXP ?? {}).map(([id, n]) => growthOf(id)!.label + "経験 +" + n),
    ...Object.entries(e.axisDelta ?? {}).map(([id, n]) => id + " " + (n >= 0 ? "+" : "") + n),
    e.dignityCapDrop ? "品位上限 −" + e.dignityCapDrop : "",
    ...Object.entries(e.relationDelta ?? {}).map(([id, n]) => personOf(id as never).name + "との関係 " + (n >= 0 ? "+" : "") + n),
  ].filter(Boolean).join(" ／ ");
}
export function AdvSession({ state, send, error, retry, onTitle, settings, onSettingsChange }: {
  state: DailyState;
  send: (command: Command) => void;
  error: string;
  retry: () => void;
  onTitle: () => void;
  settings: ReadingSettings;
  onSettingsChange: (patch: Partial<ReadingSettings>) => void;
}) {
  const session = state.activeSession!;
  const node = session.scenario.nodes?.[session.nodeId];
  const [view, setView] = useState<"choices" | "log" | "settings">("choices");
  const nodeRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setView("choices"); }, [session.nodeId]);
  useEffect(() => { nodeRef.current?.focus(); }, [session.nodeId, view]);
  const stamp = { sessionId: session.id, revision: session.revision };
  const issue = sessionError(session);
  if (session.phase === "result" && session.outcome)
    return <Modal variant="result" title="本日の記録" onClose={() => !error && send({ type: "acknowledge", ...stamp })}
      footer={<><small role={error ? "alert" : undefined}>{error || "成長と選択の結果を保存しました"}</small>{error && <button onClick={retry}>保存を再試行</button>}<button disabled={!!error} onClick={() => send({ type: "acknowledge", ...stamp })}>翌日へ</button></>}>
      <DayRecord before={session.entrySnapshot} after={state} result={session.outcome} />
    </Modal>;
  if (issue || !node)
    return <Modal title="依頼を再開できません" onClose={onTitle}>
      <p>{issue}</p><p>保存した依頼の定義に不整合があります。元の保存をバックアップし、受諾前へ戻せます。</p>
      <button onClick={() => { if (window.confirm("この依頼を受ける前の状態へ戻しますか？")) send({ type: "restore", ...stamp }); }}>受諾前へ戻す</button>
      {error && <p role="alert">{error}<button onClick={retry}>保存を再試行</button></p>}
    </Modal>;
  if (node.kind === "text") return <>
    <Dialogue key={session.id + ":" + node.id} title={session.job.title}
      lines={node.lines.map(l => ({ ...l, sceneId: l.sceneId ?? sceneKey(session) }))}
      place={personOf(session.job.person).place} {...settings}
      sceneId={sceneKey(session)} initialCursor={session.cursor}
      onCursor={cursor => send({ type: "cursor", ...stamp, nodeId: node.id, cursor })}
      paused={!!error} onExit={onTitle}
      onSettingsChange={onSettingsChange}
      onDone={() => send({ type: "advance", ...stamp, nodeId: node.id })} />
    {error && <Modal title="保存できませんでした" onClose={() => {}}><p role="alert">{error}</p><button onClick={retry}>保存を再試行</button></Modal>}
  </>;
  if (node.kind !== "choice") return null;
  return <Modal variant="scenario" title="対応を選ぶ" onClose={() => setView("choices")}>
    <div className="adv-stage" style={{ fontSize: settings.textSize }} ref={nodeRef} tabIndex={-1}>
      <header><div><small>{session.job.title}</small><h2>{view === "choices" ? node.prompt : view === "log" ? "今回の会話ログ" : "読書設定"}</h2></div>
        <nav><button onClick={() => setView(view === "log" ? "choices" : "log")}>会話ログ</button><button onClick={() => setView(view === "settings" ? "choices" : "settings")}>設定</button><button onClick={onTitle} disabled={!!error}>保存してタイトルへ</button></nav>
      </header>
      {error && <div role="alert">{error}<button onClick={retry}>保存を再試行</button></div>}
      <div className="adv-content">
        <aside><GrowthPanel state={session.working} /><p>貞操 {session.working.axes.貞操} ／ 品位 {session.working.axes.品位} ／ 威厳 {session.working.axes.威厳}</p></aside>
        <section className="adv-options" aria-label={view === "choices" ? "選択肢" : view}>
          {view === "choices" ? node.choices.map(choice => {
            const condition = evaluateCondition(choice.condition, session.working);
            return <button key={choice.id} data-choice={choice.id} aria-disabled={!condition.ok || !!error}
              onKeyDown={e => { if (e.repeat && (e.key === "Enter" || e.key === " ")) e.preventDefault(); }}
              onClick={e => e.detail <= 1 && condition.ok && !error && send({ type: "choose", ...stamp, nodeId: node.id, choiceId: choice.id })}>
              <strong>{condition.ok ? "選択可能" : "条件未達"}：{choice.text}</strong>
              <ConditionView value={condition} />
              {effectText(choice.effects) && <small>選択した場合：{effectText(choice.effects)}</small>}
              {choice.hint && <small>{choice.hint}</small>}
            </button>;
          }) : view === "log" ? <><button onClick={() => setView("choices")}>選択に戻る</button>{session.transcript.map((l, i) => <p key={i}>{l.speaker && <b>{l.speaker}：</b>}{l.text}</p>)}</>
            : <><button onClick={() => setView("choices")}>選択に戻る</button><GameSettings value={settings} onChange={onSettingsChange} /></>}
        </section>
      </div>
    </div>
  </Modal>;
}
