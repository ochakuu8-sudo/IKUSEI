import { useState } from "react";
import { BookOpen, Compass, Heart, MessagesSquare, Shield, Sparkles } from "lucide-react";
import { axes } from "../game";
import { dignityRank } from "../dignity";
import { growthDefinitions, rankOf } from "../adv/growth";
import type { Snapshot } from "../adv/types";
import { Mark } from "../marks";

const growthIcons = [MessagesSquare, BookOpen, Shield, Sparkles];
export function GrowthPanel({ state, compact = false }: { state: Snapshot; compact?: boolean }) {
  const [selected, setSelected] = useState(0);
  return <div className={`adv-growth ${compact ? "adv-growth-compact" : ""}`} aria-label="成長の記録">
    <div className="growth-cards">{growthDefinitions.map((d, i) => {
      const xp = state.growthXP[d.id], rank = rankOf(d.id, xp);
      const floor = d.thresholds[rank], next = d.thresholds[rank + 1];
      const progress = next === undefined ? 100 : (xp - floor) / (next - floor) * 100;
      const Icon = growthIcons[i % growthIcons.length];
      const content = <><span className="growth-name"><Icon aria-hidden="true" /><b>{d.label}</b></span>
        <span className="growth-rank"><b>{rank}</b> 段階</span>
        {!compact && <><span className="growth-pips" aria-hidden="true">{d.thresholds.slice(1).map((_, n) => <i key={n} data-filled={n < rank} />)}</span>
          <span className="growth-progress" role="progressbar" aria-label={`${d.label}の経験`} aria-valuemin={floor} aria-valuemax={next ?? xp} aria-valuenow={xp}><i style={{ width: `${progress}%` }} /></span>
          <span className="growth-xp">経験 {xp}<span>{next === undefined ? "最高段階" : `次の段階まで ${next - xp}`}</span></span></>}
      </>;
      return compact ? <div key={d.id} className="growth-card">{content}</div> : <button key={d.id} type="button" className="growth-card" aria-pressed={selected === i} onClick={() => setSelected(i)}>{content}</button>;
    })}</div>
    {!compact && <div className="growth-description" aria-live="polite"><Compass aria-hidden="true" /><div><b>{growthDefinitions[selected].description}</b><span>{growthDefinitions[selected].hint}</span></div></div>}
  </div>;
}

export const dignityDescriptions = {
  貞操: { title: "性との向き合い方", text: "低下するほど、主人公は性に奔放になります。" },
  品位: { title: "人としての扱い", text: "低下するほど、人として尊重されなくなります。" },
  威厳: { title: "貴族としての名声", text: "低下するほど、貴族としての名声が失われます。" },
};
export function DignityPanel({ state }: { state: Snapshot }) {
  return <div className="dignity-panel"><div className="dignity-cards">{axes.map(axis => {
    const value = state.axes[axis], rank = dignityRank(value);
    return <article className="dignity-card" key={axis} data-axis={axis}>
      <Mark name={axis} decorative /><h3>{axis}</h3><p>{dignityDescriptions[axis].title}</p>
      <div className="dignity-rank">ランク <b>{rank}</b><span>数値 {value}</span></div>
      <div className="dignity-steps" aria-hidden="true">{[1, 2, 3, 4, 5].map(n => <i key={n} data-filled={n <= rank} />)}</div>
      <p className="dignity-meaning">{dignityDescriptions[axis].text}</p>
      <dl><div><dt>現在の帯</dt><dd>{rank ? `${(rank - 1) * 20 + 1}〜${rank * 20}` : "0"}</dd></div>
        <div><dt>{rank ? "次の低下" : "回復"}</dt><dd>{rank ? `${(rank - 1) * 20}以下` : "回復不可"}</dd></div></dl>
    </article>;
  })}</div><p className="dignity-rule"><Heart aria-hidden="true" />下がったランクには戻れません。数値の回復は、現在の帯の中だけです。</p></div>;
}
