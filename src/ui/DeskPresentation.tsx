import { axes, CHAPTER_DAYS, personOf, type Job } from "../game";
import { closingPreview, fatigueRateOf, materialCostOf, listPriceOf, payOf, quotaOf, staminaOf, takeReason, type DailyState } from "../daily";
import { dignityRank } from "../dignity";
import { growthDefinitions, growthOf, rankOf } from "../adv/growth";
import { artAssetSrc, personSrc } from "../art";
import { GameGlyph as Glyph } from "./GameGlyph";

const n = (value:number) => value.toLocaleString();
export function BondMarks({stage, name}: {stage:number;name:string}) {
  return <span className="a-bonds" title={`${name}との関係 ${stage} / 3`} aria-label={`${name}との関係 ${stage} / 3`}>{[1,2,3].map(i=><Glyph key={i} name="bond" className={i<=stage ? "lit":""} />)}</span>;
}
export function DeskHeader({s,onJournal,onGallery,onSettings}: {s:DailyState;onJournal:()=>void;onGallery:()=>void;onSettings:()=>void}) {
  const due=quotaOf(s), remaining=Math.max(0,due-s.money);
  return <header className="a-hud">
    <button className="a-calendar" onClick={onJournal} aria-label={`${s.day}日目 第${s.chapter}章`}><Glyph name="calendar"/><span><small>第{s.chapter}章</small><b>{s.day}<em>日目</em></b></span></button>
    <div className="a-stamina" title={`体力 ${s.stamina} / 100`}><Glyph name="energy"/><div><small>体力</small><b>{s.stamina}</b><span className="a-meter"><i style={{width:s.stamina+'%'}}/></span></div></div>
    <button className="a-goal" onClick={onJournal} aria-label="返済の予定を台帳で確認"><Glyph name="ledger"/><span><small>{remaining ? "返済残":"必要額を確保"}</small><b>{n(remaining)}</b><span className="a-meter"><i style={{width:Math.min(100,s.money/Math.max(1,due)*100)+'%'}}/></span></span><span className="a-deadline"><Glyph name="hourglass"/><b>{Math.max(0,CHAPTER_DAYS-s.day+1)}</b><em>日</em></span></button>
    <div className="a-wallet" title={`所持金 ${n(s.money)} G`}><Glyph name="coin"/><span><small>所持金</small><b>{n(s.money)}</b></span></div>
    <nav className="a-menu" aria-label="手帳と設定"><button className="c-book" onClick={onJournal}><Glyph name="ledger"/>台帳</button><button onClick={onGallery}><Glyph name="gallery"/>回想</button><button onClick={onSettings}><Glyph name="gear"/>設定</button></nav>
  </header>;
}
export function StatusRibbon({s,onDignity,onGrowth}: {s:DailyState;onDignity:()=>void;onGrowth:()=>void}) {
  return <div className="a-status-ribbon" aria-label="主人公のパラメータ"><section className="a-dignity"><span className="a-band-label">尊厳</span>{axes.map(axis=>{const value=s.axes[axis],rank=dignityRank(value);return <button key={axis} className="a-axis" data-axis={axis} onClick={onDignity} aria-label={`${axis}のランクと回復について`} title={`${axis}：ランク${rank}、数値${value}`}>
    <span className="a-axis-title"><Glyph name={axis}/><span>{axis}</span><b>{rank}</b><span className="c-sr-only">ランク{rank}</span></span><span className="a-rank-marks" aria-hidden="true">{[1,2,3,4,5].map(i=><i key={i} className={i<=rank?'lit':''}/>)}</span><span className="a-axis-value"><span className="a-meter" role="progressbar" aria-label={axis} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}><i style={{width:value+'%'}}/></span><span>{value}</span></span>
  </button>})}</section><section className="a-growth"><span className="a-band-label">成長</span>{growthDefinitions.map(d=>{const xp=s.growthXP[d.id],rank=rankOf(d.id,xp),max=d.thresholds.at(-1)!,next=d.thresholds[rank+1];return <button key={d.id} className={`a-growth-item ${next===undefined?'is-max':''}`} data-growth={d.id} onClick={onGrowth} aria-label={`${d.label}の成長について`} title={`${d.label} ${rank}段階、経験 ${xp} / ${max}${next===undefined?'、最高段階':`、次まで ${next-xp}`} `}>
    <span className="a-growth-top"><span className="a-medallion"><Glyph name={d.id}/></span><span className="a-growth-name">{d.label}<b>{rank}</b><span className="a-growth-marks" aria-hidden="true">{d.thresholds.slice(1).map((_,i)=><i key={i} className={i<rank?'lit':''}/>)}</span></span></span><span className="a-growth-progress"><span className="a-meter" role="progressbar" aria-label={`${d.label}の経験`} aria-valuenow={xp} aria-valuemin={0} aria-valuemax={max}><i style={{width:xp/max*100+'%'}}/>{d.thresholds.slice(1,-1).map(t=><em key={t} style={{left:t/max*100+'%'}}/>)}</span><small>{xp}/{max}</small></span>
  </button>})}</section></div>;
}
export function EnvelopePaper() {
  return <img className="a-envelope-paper" src={artAssetSrc("ui/correspondence/envelope.webp")} alt="" draggable={false}/>;
}
function JobCosts({job,s,detail=false}:{job:Job;s:DailyState;detail?:boolean}) {
  return <span className="a-job-costs">{job.costs.map(c=>{const after=Math.max(0,s.axes[c.axis]-c.amount),beforeRank=dignityRank(s.axes[c.axis]),afterRank=dignityRank(after);return <span key={c.axis} title={`${c.axis} ${s.axes[c.axis]} → ${after}${beforeRank!==afterRank?`、ランク${beforeRank} → ${afterRank}`:''}`}><Glyph name={c.axis} label={c.axis}/><b>−{c.amount}</b>{detail&&<small>{s.axes[c.axis]} → {after}{beforeRank!==afterRank&&<em>ランク {beforeRank} → {afterRank}</em>}</small>}</span>})}</span>;
}
function GrowthRewards({job}:{job:Job}) {
  return <>{Object.entries(job.growthRewards??{}).map(([id,xp])=><span className="a-growth-reward" key={id} title={`${growthOf(id)?.label??id}の経験 +${xp}`}><Glyph name={id} label={growthOf(id)?.label??id}/>+{xp}</span>)}</>;
}
export function EnvelopeOffer({job,s,onOpen}:{job:Job;s:DailyState;onOpen:()=>void}) {
  const reason=takeReason(job,s),closed=closingPreview(job,s).length,discounted=fatigueRateOf(job.person,s)<1;
  return <article className={`a-offer ${reason?'is-unavailable':''}`} data-job={job.id}>
    <button type="button" className="a-envelope" onClick={onOpen} aria-label={`${job.title}の依頼状を読む。${personOf(job.person).name}、関係${s.relations[job.person]}／3。報酬${n(payOf(job,s))}G、体力${staminaOf(job)}消費。${job.costs.map(c=>`${c.axis}−${c.amount}`).join("、")}。${closed?`紹介停止${closed}件。`:""}${reason??''}`}>
      <span className="a-envelope-face"><EnvelopePaper/><span className="a-sender">{personOf(job.person).name}</span></span>
      <span className="a-offer-copy"><span className="a-offer-title" role="heading" aria-level={3}>{job.title}</span>
        <span className="a-offer-terms"><span className="a-pay" title={`報酬 ${n(payOf(job,s))} G${discounted?'（通い詰めの値引き適用）':''}`}><Glyph name="coin" label="報酬"/><b>{n(payOf(job,s))}</b>{discounted&&<small>▼</small>}</span><span className="a-energy" title={`体力 ${staminaOf(job)}消費`}><Glyph name="energy" label="体力"/>−{staminaOf(job)}</span><BondMarks name={personOf(job.person).name} stage={s.relations[job.person]}/>
          <JobCosts job={job} s={s}/><GrowthRewards job={job}/>{job.growthHint&&!job.growthRewards&&<span className="a-growth-reward" title="物語中の選択で変化する経験や関係があります"><Glyph name="growth" label="成長や関係の変化"/></span>}{reason&&<span className="a-offer-warning"><Glyph name="lock"/>{reason.startsWith('体力')?'体力不足':'受諾不可'}</span>}{closed>0&&<span className="a-offer-warning" title="依頼の詳細で紹介停止する依頼を確認できます">紹介停止 {closed}</span>}
        </span>
      </span><Glyph name="arrow" className="a-row-arrow"/>
    </button>
  </article>;
}
export function OpenLetter({job,s,onAccept,onBack,signing=false}:{job:Job;s:DailyState;onAccept:()=>void;onBack:()=>void;signing?:boolean}) {
  const reason=takeReason(job,s),closing=closingPreview(job,s),rate=fatigueRateOf(job.person,s);
  return <section className={`a-open-letter ${signing?'c-ritual-sign':''}`} data-paper-state={signing?'signing':'reading'} aria-label={`${job.title}の依頼状`}>
    <div className="a-letter-copy"><div className="a-letter-address">エレオノール様</div><h2 className="c-letter-heading" tabIndex={-1}>{job.title}</h2><p>{job.description}</p><div className="a-signature"><img src={personSrc(job.person)} alt=""/><span>{personOf(job.person).name}<BondMarks name={personOf(job.person).name} stage={s.relations[job.person]}/></span></div>
      {signing&&<span className="a-signed">Éléonore <Glyph name="rose"/></span>}
    </div><div className="a-letter-side"><div className="a-letter-facts"><span className="a-pay"><Glyph name="coin" label="報酬"/><b>{n(payOf(job,s))}</b><small>G</small></span>{rate<1&&<small>定価 {n(listPriceOf(job,s))}Gから{Math.round((1-rate)*100)}%引き</small>}{materialCostOf(job)>0&&<small>素材費 {materialCostOf(job)}G 差引済</small>}<span className="a-energy"><Glyph name="energy" label="体力"/>−{staminaOf(job)}<small>{s.stamina} → {Math.max(0,s.stamina-staminaOf(job))}</small></span><JobCosts job={job} s={s} detail/><GrowthRewards job={job}/>{closing.length>0&&<details className="a-closing"><summary>紹介停止 {closing.length}件</summary><p>{closing.join('、')}</p></details>}</div>
      <footer><button type="button" className="a-accept" disabled={!!reason||signing} onClick={onAccept}>この依頼を受ける<Glyph name="arrow"/></button>{reason&&<small className="a-blocked-reason">{reason}</small>}<button type="button" className="a-back" disabled={signing} onClick={onBack}>手紙一覧へ</button></footer></div>
  </section>;
}
export function DeskRest({s,onAccept,onBack}:{s:DailyState;onAccept:()=>void;onBack:()=>void}) {
  return <section className="a-open-letter a-rest-letter"><div className="a-letter-copy"><Glyph name="moon"/><h2 className="c-letter-heading" tabIndex={-1}>今日は受けない</h2><p>手紙を置いて、身体を休める。</p></div><div className="a-letter-side"><div className="a-letter-facts"><span className="a-energy"><Glyph name="energy" label="体力"/>{s.stamina} → 100</span><span><Glyph name="calendar"/> 1日</span></div><footer><button className="a-accept" onClick={onAccept}>今日は休む<Glyph name="moon"/></button><button className="a-back" onClick={onBack}>手紙一覧へ</button></footer></div></section>;
}

