import { evaluateCondition } from "../adv/conditions";
import { growthOf, rankOf } from "../adv/growth";
import { dignityRank } from "../dignity";
import { personOf } from "../game";
import type { Condition, Effects, Snapshot } from "../adv/types";
import { GameGlyph as Glyph } from "./GameGlyph";

/** Same evaluator as the engine; only the presentation of its result is compact. */
export function ChoiceCondition({condition,state}:{condition?:Condition;state:Snapshot}) {
  const result=evaluateCondition(condition,state);
  if(!condition)return null;
  if(result.error)return <span className="a-condition-error">{result.text}：{result.error}</span>;
  if(condition.kind==='all'||condition.kind==='any')return <span className={`a-condition-group ${result.ok?'is-met':'is-unmet'}`} aria-label={result.text}><small>{condition.kind==='all'?'すべて':'いずれか'}</small><span>{condition.items.map((item,i)=><span className="a-condition-part" key={i}>{i>0&&<em>{condition.kind==='all'?'＋':'／'}</em>}<ChoiceCondition condition={item} state={state}/></span>)}</span></span>;
  if(condition.kind==='flag')return <span className="a-condition" title={result.text}><Glyph name="ledger"/>出来事 {result.ok?'達成':'未達'}</span>;
  if(condition.kind!=='range')return null;
  const value=condition.value;
  const current=value.kind==='skill'?rankOf(value.id,state.growthXP[value.id]):value.kind==='axis'?dignityRank(state.axes[value.id]):state.relations[value.personId];
  const label=value.kind==='skill'?growthOf(value.id)!.label:value.kind==='axis'?value.id:personOf(value.personId).name;
  const name=value.kind==='relation'?'bond':value.id;
  const bound=condition.min!==undefined&&condition.max!==undefined?`${condition.min}–${condition.max}`:condition.min!==undefined?`≥${condition.min}`:`≤${condition.max}`;
  return <span className={`a-condition ${result.ok?'is-met':'is-unmet'}`} aria-label={result.text} title={result.text}><Glyph name={name}/><span>{label}</span><b>{bound}</b><small>現在 {current}</small></span>;
}
export function ChoiceEffects({effects}:{effects?:Effects}) {
  if(!effects)return null;
  const {bonusMoney,growthXP,axisDelta,relationDelta}=effects;
  return <span className="a-choice-effects">
    {!!bonusMoney&&<span title={`追加報酬 ${bonusMoney}G`}><Glyph name="coin" label="追加報酬"/>+{bonusMoney}</span>}
    {Object.entries(growthXP??{}).map(([id,v])=><span key={id} title={`${growthOf(id)?.label}の経験 +${v}`}><Glyph name={id} label={`${growthOf(id)?.label}の経験`}/>+{v}</span>)}
    {Object.entries(axisDelta??{}).map(([axis,v])=><span key={axis} title={`${axis} ${v>=0?'+':''}${v}${v>0?'（同ランク内）':''}`}><Glyph name={axis} label={axis}/>{v>=0?'+':''}{v}</span>)}
    {Object.entries(relationDelta??{}).map(([id,v])=><span key={id} title={`${personOf(id as never).name}との関係 ${v>=0?'+':''}${v}`}><Glyph name="bond" label="関係"/>{personOf(id as never).name} {v>=0?'+':''}{v}</span>)}
  </span>;
}
