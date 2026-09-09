import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { DailyState } from "../daily";
import { axes, personOf } from "../game";
import { dignityLabel, dignityRank } from "../dignity";
import { evaluateCondition, type Evaluation } from "../adv/conditions";
import { growthOf } from "../adv/growth";
import { sceneKey, sessionError, type Command } from "../adv/engine";
import type { Effects, ActiveSession } from "../adv/types";
import { Dialogue, type ReadingSettings } from "./scene";
import { Modal, Art, GameButton as Button } from "./shell";
import { GrowthPanel } from "./CharacterPanels";
import { prepareVisual, visualFor, type SceneVisual } from "./sceneVisuals";
import { Check, LockKeyhole, Feather } from "lucide-react";
import { DayRecord, GameSettings } from "./ReformScreens";
import "./adv.css";

function ChoiceScenery({ session }: { session: ActiveSession }) {
  const [art, setArt] = useState<SceneVisual | null>(null);
  useEffect(() => {
    let alive = true, id: string | undefined, cue: string | undefined;
    for (const row of session.transcript) {
      if (row.sceneId !== id) { id = row.sceneId; cue = undefined; }
      if (row.visual) cue = row.visual;
    }
    const visual = visualFor(id, personOf(session.job.person).place, cue);
    setArt(visual);
    void prepareVisual(visual).then(value => { if (alive) setArt(value); });
    return () => { alive = false; };
  }, [session.id, session.nodeId]);
  return <div className="adv-scenery" aria-hidden="true">{art && <><Art src={art.image ?? art.background} className="adv-background" />{!art.image && <Art src={art.portrait} className="adv-portrait" />}</>}</div>;
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
    ...Object.entries(e.axisDelta ?? {}).map(([id, n]) => id + "数値 " + (n >= 0 ? "+" : "") + n + (n > 0 ? "（同ランク内）" : "")),
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
      footer={<><small role={error ? "alert" : undefined}>{error || "成長と選択の結果を保存しました"}</small>{error && <Button onClick={retry}>保存を再試行</Button>}<Button disabled={!!error} onClick={() => send({ type: "acknowledge", ...stamp })}>翌日へ</Button></>}>
      <DayRecord before={session.entrySnapshot} after={state} result={session.outcome} />
    </Modal>;
  if (issue || !node)
    return <Modal title="依頼を再開できません" onClose={onTitle}>
      <p>{issue}</p><p>保存した依頼の定義に不整合があります。元の保存をバックアップし、受諾前へ戻せます。</p>
      <Button onClick={() => { if (window.confirm("この依頼を受ける前の状態へ戻しますか？")) send({ type: "restore", ...stamp }); }}>受諾前へ戻す</Button>
      {error && <p role="alert">{error}<Button onClick={retry}>保存を再試行</Button></p>}
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
    {error && <Modal title="保存できませんでした" onClose={() => {}}><p role="alert">{error}</p><Button onClick={retry}>保存を再試行</Button></Modal>}
  </>;
  if (node.kind !== "choice") return null;
  return <Modal variant="scenario" title="対応を選ぶ" onClose={() => setView("choices")}>
    <div className="adv-stage" style={{ "--choice-font": `${Math.max(23, settings.textSize)}px` } as CSSProperties} ref={nodeRef} tabIndex={-1}>
      <ChoiceScenery session={session} />
      <header><div><small>{session.job.title}</small><h2>{view === "choices" ? node.prompt : view === "log" ? "今回の会話ログ" : "読書設定"}</h2></div>
        <nav><Button onClick={() => setView(view === "log" ? "choices" : "log")}>会話ログ</Button><Button onClick={() => setView(view === "settings" ? "choices" : "settings")}>設定</Button><Button onClick={onTitle} disabled={!!error}>保存してタイトルへ</Button></nav>
      </header>
      {error && <div role="alert">{error}<Button onClick={retry}>保存を再試行</Button></div>}
      <div className="adv-content">
        <aside className="adv-context"><div className="adv-context-title"><Feather aria-hidden="true" />いまのあなた</div><GrowthPanel state={session.working} compact /><div className="adv-axis-summary">{axes.map(axis => <span key={axis} title={dignityLabel(session.working.axes[axis])}>{axis}<b>{dignityRank(session.working.axes[axis])}<small>ランク</small></b></span>)}</div></aside>
        <section className={`adv-choice-paper ${view !== "choices" ? "adv-reading-panel" : ""}`}><div className="adv-choice-caption"><span>{view === "choices" ? "あなたの返事" : view === "log" ? "交わした言葉" : "読み心地を整える"}</span>{view === "choices" && <small>{node.choices.length}つの対応 · 一覧をスクロールして確認</small>}</div><div className="adv-options" aria-label={view === "choices" ? "選択肢" : view}>
          {view === "choices" ? node.choices.map(choice => {
            const condition = evaluateCondition(choice.condition, session.working);
            return <Button key={choice.id} data-choice={choice.id} aria-disabled={!condition.ok || !!error}
              onKeyDown={e => { if (e.repeat && (e.key === "Enter" || e.key === " ")) e.preventDefault(); }}
              onClick={e => e.detail <= 1 && condition.ok && !error && send({ type: "choose", ...stamp, nodeId: node.id, choiceId: choice.id })}>
              <span className="adv-choice-title"><span className="adv-choice-state">{condition.ok ? <Check aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}<span className="c-sr-only">{condition.ok ? "選択可能：" : "条件未達："}</span></span><strong>{choice.text}</strong></span>
              <ConditionView value={condition} />
              {effectText(choice.effects) && <small>選択した場合：{effectText(choice.effects)}</small>}
              {choice.hint && <small className="adv-choice-hint">{choice.hint}</small>}
            </Button>;
          }) : view === "log" ? <><Button onClick={() => setView("choices")}>選択に戻る</Button>{session.transcript.map((l, i) => <p key={i}>{l.speaker && <b>{l.speaker}：</b>}{l.text}</p>)}</>
            : <><Button onClick={() => setView("choices")}>選択に戻る</Button><GameSettings value={settings} onChange={onSettingsChange} /></>}
        </div></section>
      </div>
    </div>
  </Modal>;
}
