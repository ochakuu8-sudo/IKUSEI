import { useState } from 'react';
import { axes, jobs, isOpen, personOf, recipeOf, payWithRelation, capDropOf, type GameState, type RecipeId } from './game';
import { specialOffers } from './content/support';
import { absoluteDay, dateLabel, offerReason } from './contracts';
import { rewardLabel } from './rewards';
import { planDelivery, type DeliverySelection } from './delivery';
import type { Action } from './engine';

export function MedicinePanel({ game, onBack, onJournal, onOffer, onAction }: {
  game: GameState; onBack: () => void; onJournal: () => void; onOffer: (id: string) => void; onAction: (a: Action) => void;
}) {
  const [tab, setTab] = useState<'ordinary' | 'special' | 'batch'>('ordinary');
  const [selection, setSelection] = useState<DeliverySelection>({ ordinary: [], promises: [] });
  const [confirm, setConfirm] = useState(false);
  let plan: ReturnType<typeof planDelivery> | undefined, error = '';
  try { plan = planDelivery(game, selection); error = plan.error ?? ''; } catch (e) { error = (e as Error).message; }
  const count = selection.ordinary.length + selection.promises.length;
  const choose = (id: string, option?: string) => setSelection(s => option
    ? { ...s, promises: s.promises.some(p => p.id === id && p.option === option) ? s.promises.filter(p => p.id !== id) : [...s.promises.filter(p => p.id !== id), { id, option }] }
    : { ...s, ordinary: s.ordinary.includes(id) ? s.ordinary.filter(x => x !== id) : [...s.ordinary, id] });
  const readyPromises = game.obligations.filter(o => o.status === 'active' && o.terms.kind === 'advance'
    && (o.terms.schedule ? o.due === absoluteDay(game) : o.due >= absoluteDay(game)));
  const totals = plan && <div className="delivery-totals">
    <p>{Object.entries(plan.stock).map(([id, n]) => `${recipeOf(id as RecipeId).name} ${game.stock[id as RecipeId] ?? 0}/${n}`).join(' ／ ')}</p>
    <p>体力 −{plan.stamina} ／ {plan.costs.map(c => `${c.axis} −${c.amount}`).join(' ／ ')} ／ 品位上限 −{plan.cap}</p>
    <p>受取合計 <b>{plan.pay}G</b>（特別依頼は残額のみ）／ 使用日数 <b>1日</b></p>
  </div>;
  return <section className="medicine-panel">
    <div className="topbar"><button className="btn ghost sm" onClick={onBack}>戻る</button><h2>薬の依頼書</h2><button className="btn outline sm" onClick={onJournal}>約束帳</button></div>
    <nav className="medicine-tabs">
      {([['ordinary', '通常依頼'], ['special', '特別依頼'], ['batch', `まとめ納品 (${count})`]] as const).map(([id, label]) => <button key={id} className={`btn sm ${tab === id ? '' : 'outline'}`} onClick={() => setTab(id)}>{label}</button>)}
    </nav>
    <div className="medicine-scroll">
      {tab === 'ordinary' && <><p className="medicine-help">依頼書は何度でも利用できます。選択は今回の出発用です。閉じても義務は発生しません。</p>
        <div className="medicine-grid">{jobs.filter(j => j.category === 'ordinary' && isOpen(j, game)).map(j => <button key={j.id} className="medicine-card" aria-pressed={selection.ordinary.includes(j.id)} onClick={() => choose(j.id)}>
          <small>{personOf(j.person).name} ／ 通常依頼</small><h3>{j.title}</h3>
          <p>{recipeOf(j.recipe!).name}×{j.count ?? 1} ／ 在庫 {game.stock[j.recipe!] ?? 0}</p>
          <p>報酬 {payWithRelation(j, game)}G ／ 体力 −{j.stamina}</p>
          <p>{axes.map(a => `${a} −${j.costs.filter(c => c.axis === a).reduce((n, c) => n + c.amount, 0)}`).join(' ／ ')} ／ 品位上限 −{capDropOf(j)}</p>
          <small>紹介条件：{axes.filter(a => j.needs[a] !== undefined).map(a => `${a}${j.needs[a]}以上`).join('・') || 'なし'}　{selection.ordinary.includes(j.id) ? '✓ 選択中' : '今回納める品に追加'}</small>
        </button>)}</div></>}
      {tab === 'special' && <><p className="medicine-help">受付中に前金で引き受け、指定日当日に納品します。同時に2件まで。指定日前の納品・期限延長はできません。</p>
        <div className="medicine-grid">{specialOffers.filter(o => absoluteDay(game) >= o.schedule!.appears && absoluteDay(game) <= o.schedule!.closes).map(o => <button className="medicine-card" key={o.id} onClick={() => onOffer(o.id)}>
          <small>{personOf(o.person).name}</small><h3>{o.title}</h3>
          <p>受付：{dateLabel(o.schedule!.appears)}〜{dateLabel(o.schedule!.closes)}</p><p>指定納品日：{dateLabel(o.schedule!.delivery)} 当日のみ</p>
          <p>前金 {o.money}G ／ 納品残額 {o.totalPay - o.money}G</p>
          <p>{o.options.map(c => `${recipeOf(c.recipe).name}×${c.count}`).join(' ／ ')}</p>
          <p>{o.rewards?.map(rewardLabel).join(' ／ ')}</p><small>{offerReason(game, o) ?? '条件を確認して受諾する'}</small>
        </button>)}</div>
        {!specialOffers.some(o => absoluteDay(game) >= o.schedule!.appears && absoluteDay(game) <= o.schedule!.closes) && <p>受付期間中の特別依頼はありません。</p>}
        {game.obligations.filter(o => o.status === 'active' && o.terms.schedule).map(o => <article className="medicine-card" key={o.id}><h3>{o.terms.title}</h3><p>{dateLabel(o.due)} 当日指定 ／ {absoluteDay(game) < o.due ? o.terms.options.some(c => (game.stock[c.recipe] ?? 0) >= c.count) ? '準備済み・指定日を待つ' : '準備中' : '今日が納品日'}</p><button className="btn sm" onClick={() => setTab('batch')}>まとめ納品を確認</button></article>)}
      </>}
      {tab === 'batch' && <><h3>今回の納品</h3>{totals}
        {plan?.lines.map(l => <p key={l.id}>{l.title}：{recipeOf(l.recipe).name}×{l.count} ／ {l.pay}G <button className="btn ghost xs" onClick={() => choose(l.id, l.option)}>外す</button></p>)}
        {!count && <p>通常依頼か、下の納品できる約束を選んでください。</p>}
        <h3>今日まとめて納められる約束</h3>
        {readyPromises.flatMap(o => o.terms.options.filter(c => c.days === 1).map(c => <button key={`${o.id}:${c.id}`} className="medicine-card" aria-pressed={selection.promises.some(p => p.id === o.id && p.option === c.id)} onClick={() => choose(o.id, c.id)}>
          <h3>{o.terms.title}</h3><p>{c.label}：{recipeOf(c.recipe).name}×{c.count} ／ 在庫 {game.stock[c.recipe] ?? 0}</p><p>残額 {o.terms.totalPay - o.terms.money}G ／ 体力 −{c.stamina}</p><small>{selection.promises.some(p => p.id === o.id && p.option === c.id) ? '✓ 選択中' : '追加する'}</small>
        </button>))}
        {!readyPromises.length && <p>ありません。指定日前の依頼は約束帳で確認できます。</p>}
        <p>2日かかる旧契約は約束帳から個別に履行できます。</p>
      </>}
    </div>
    <footer className="delivery-footer"><span>{count}件 ／ {plan?.pay ?? 0}G ／ 体力 −{plan?.stamina ?? 0}<small>{error || '1日で全件を納品'}</small></span><button className="btn sm" disabled={!!error} onClick={() => { setTab('batch'); setConfirm(true); }}>出発内容を確認</button></footer>
    {confirm && <div className="support-confirm" role="dialog" aria-modal="true" aria-label="まとめ納品の確認"><div><h3>{count}件をまとめて納品</h3>{totals}<p>この出発で1日が終わります。今日が指定日の依頼を確認してください。</p><div><button className="btn outline" onClick={() => setConfirm(false)}>戻る</button><button className="btn" disabled={!!error} onClick={() => { setConfirm(false); onAction({ type: 'deliver', ...selection }); }}>1日使って納品する</button></div></div></div>}
  </section>;
}
