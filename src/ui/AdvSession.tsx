import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { DailyState } from "../daily";
import { personOf } from "../game";
import { evaluateCondition } from "../adv/conditions";
import { sceneKey, sessionError, type Command } from "../adv/engine";
import type { ActiveSession } from "../adv/types";
import { Dialogue, type ReadingSettings } from "./scene";
import { Modal, Art, GameButton as Button } from "./shell";
import { ChoiceCondition, ChoiceEffects } from "./ChoiceDetails";
import { GameGlyph } from "./GameGlyph";
import { prepareVisual, visualFor, type SceneVisual } from "./sceneVisuals";
import { Check, LockKeyhole } from "lucide-react";
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
  return <div className="adv-scenery" data-anchor={art?.anchor} aria-hidden="true" style={{"--scene-fit":art?.image?art.fit:"cover","--scene-focus":art?.image?art.focus:"center"} as CSSProperties}>{art && <><Art src={art.image ?? art.background} className="adv-background" />{!art.image && <Art src={art.portrait} className={"scenario-portrait scenario-anchor-"+art.anchor} />}</>}</div>;
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
  const [explanation, setExplanation] = useState("");
  const nodeRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setView("choices"); setExplanation(""); }, [session.nodeId]);
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
  const previous=session.transcript.at(-1);
  return <Modal variant="scenario" title="対応を選ぶ" onClose={() => setView("choices")}>
    <div className={`adv-stage a-novel-choices ${settings.strongText?"scenario-strong":""}`} style={{ "--choice-font": `${settings.textSize}px` } as CSSProperties} ref={nodeRef} tabIndex={-1} data-view={view}>
      <ChoiceScenery session={session} />
      <nav className="a-novel-tools" aria-label="選択中の会話操作"><Button onClick={() => setView(view === "log" ? "choices" : "log")}><GameGlyph name="book"/>会話ログ</Button><Button onClick={() => setView(view === "settings" ? "choices" : "settings")}><GameGlyph name="gear"/>設定</Button><Button onClick={onTitle} disabled={!!error}>保存してタイトルへ</Button></nav>
      {error && <div className="a-novel-error" role="alert">{error}<Button onClick={retry}>保存を再試行</Button></div>}
      {view==='choices' ? <>
        <section className="a-replies" aria-label="選択肢"><h2>{node.prompt}</h2><div className="adv-options">{node.choices.map(choice => {
          const condition=evaluateCondition(choice.condition, session.working);
          return <Button key={choice.id} data-choice={choice.id} aria-disabled={!condition.ok || !!error} title={choice.hint}
            onKeyDown={e => { if (e.repeat && (e.key === "Enter" || e.key === " ")) e.preventDefault(); }}
            onClick={e => {if(e.detail>1)return;if(!condition.ok){setExplanation(condition.text+(condition.children?'：'+condition.children.filter(c=>!c.ok).map(c=>c.text).join(' ／ '):''));return}if(!error)send({type:"choose",...stamp,nodeId:node.id,choiceId:choice.id})}}>
              <span className="a-reply-main"><GameGlyph name="arrow"/><strong>{choice.text}</strong><span className="a-reply-state">{condition.ok?<Check aria-hidden="true"/>:<LockKeyhole aria-hidden="true"/>}<span className="c-sr-only">{condition.ok?'選択可能':'条件未達'}</span></span></span>
              <span className="a-reply-meta"><ChoiceCondition condition={choice.condition} state={session.working}/><ChoiceEffects effects={choice.effects}/></span>
              {choice.hint&&<span className="c-sr-only">{choice.hint}</span>}
          </Button>;
        })}</div></section>
        <section className="a-choice-message" aria-label="選択直前の会話"><span className="a-novel-speaker">{previous?.speaker??"あなたの返事"}</span><p>{previous?.text??node.prompt}</p>{explanation&&<small className="a-choice-explanation" role="status">{explanation}</small>}</section>
      </> : <section className="a-novel-reading"><header><h2>{view==='log'?'今回の会話ログ':'読書設定'}</h2><Button onClick={() => setView("choices")}>選択に戻る</Button></header><div className="a-reading-scroll">{view==='log'?session.transcript.map((l,i)=><p key={i}>{l.speaker&&<b>{l.speaker}：</b>}{l.text}</p>):<GameSettings value={settings} onChange={onSettingsChange}/>}</div></section>}
    </div>
  </Modal>;
}
