import { useState } from 'react';
import { personOf, materialOf, recipeOf, type GameState } from './game';
import { supportOffers, capabilityLabels } from './content/support';
import { absoluteDay, dateLabel, offerKey, offerReason, outstandingTotal } from './contracts';
import { performAction, type Action } from './engine';

export function SupportPanel({ game, onAction, onBack, allocation = false, focusOffer, focusObligation }: {
  game: GameState; onAction: (action: Action) => void; onBack: () => void; allocation?: boolean;
  focusOffer?: string; focusObligation?: string;
}) {
  const [tab, setTab] = useState<'offers' | 'promises'>(allocation || focusObligation ? 'promises' : 'offers');
  const [page, setPage] = useState(() => focusObligation
    ? Math.max(0, [...game.obligations].sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active') || b.acceptedDay - a.acceptedDay).findIndex(o => o.id === focusObligation))
    : Math.max(0, supportOffers.findIndex(o => o.id === focusOffer)));
  const [confirm, setConfirm] = useState<Action | null>(null);
  const offers = supportOffers;
  const promises = [...game.obligations].sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active') || b.acceptedDay - a.acceptedDay);
  const count = tab === 'offers' ? offers.length : promises.length;
  const index = Math.min(page, Math.max(0, count - 1));
  const offer = tab === 'offers' ? offers[index] : undefined;
  const promise = tab === 'promises' ? promises[index] : undefined;
  const terms = offer ?? promise?.terms;
  const reason = offer ? offerReason(game, offer) : null;
  const button = (label: string, action: Action, dangerous = false) => {
    const error = performAction(game, action).error;
    return <div className="support-action" key={label}>
      <button className="btn sm" disabled={!!error} onClick={() => dangerous ? setConfirm(action) : onAction(action)}>{label}</button>
      {error && <small>{error}</small>}
    </div>;
  };
  return <section className="support-panel">
    <div className="topbar">
      <button className="btn ghost sm" onClick={onBack}>{allocation ? '返済の確認へ' : '仕事一覧へ'}</button>
      <h2>支援と約束</h2><span className="topbar-sub">未精算 {outstandingTotal(game)}G</span>
    </div>
    <div className="support-nav">
      <button className={`btn sm ${tab === 'offers' ? '' : 'outline'}`} disabled={allocation} onClick={() => { setTab('offers'); setPage(0); setConfirm(null); }}>届いた支援</button>
      <button className={`btn sm ${tab === 'promises' ? '' : 'outline'}`} onClick={() => { setTab('promises'); setPage(0); setConfirm(null); }}>約束帳 ({promises.length})</button>
      <span>{game.capabilities.map(id => capabilityLabels[id] ?? id).join('・') || '履行すると新しい手段が開く'}</span>
    </div>
    {allocation && <p className="support-allocation">今日は行動終了。先に未精算を支払うか、手元の資金を章末返済に充てるか選べます。</p>}
    {terms ? <article className="support-sheet">
      <header><small>{personOf(terms.person).name} ／ {terms.kind === 'advance' ? '予約注文' : '掛け仕入れ'}</small><h3>{terms.title}</h3></header>
      <div className="support-columns">
        <div>
          <p className="support-description">{terms.description}</p>
          <dl>
            <dt>受け取るもの</dt><dd>{terms.money > 0 ? `${terms.money}Gの前金` : Object.entries(terms.materials).map(([id, n]) => `${materialOf(id as Parameters<typeof materialOf>[0]).name}×${n}`).join('・')}</dd>
            <dt>{promise ? '履行期限' : '期限'}</dt><dd>{promise ? dateLabel(promise.due) : `受諾日から${terms.term}日後 ／ 提示は今章${terms.closes}日まで`}</dd>
            <dt>受諾に使う日数</dt><dd>{terms.acceptDays}日</dd>
            <dt>{terms.kind === 'advance' ? '納品後の残額' : '支払う代金'}</dt><dd>{terms.kind === 'advance' ? terms.totalPay - terms.money : terms.repayment}G{terms.kind === 'advance' ? `（総報酬${terms.totalPay}G）` : ' ／ 支払いは0日'}</dd>
          </dl>
          <p className="support-note">{terms.kind === 'advance' ? '納品で前金の返還義務がなくなります。' : ''}解消・不履行でも未精算は残り、支払いまで同じ相手の新規支援は停止。3軸への追加罰はありません。</p>
          <p className="support-note">再交渉：1日で{terms.extensionDays}日延長、最大{terms.extensionLimit}回。履行で解禁：{terms.unlocks.map(id => capabilityLabels[id] ?? id).join('・') || '実績を記録'}。</p>
        </div>
        <div>
          {terms.options.map(c => <div className="support-option" key={c.id}>
            <b>{c.label}</b><p>{recipeOf(c.recipe).name}×{c.count}（在庫{game.stock[c.recipe] ?? 0}）／ {c.days}日・体力{c.stamina}</p>
            {promise?.status === 'active' && button('この方法で納品', { type: 'fulfill', id: promise.id, option: c.id }, true)}
          </div>)}
          {offer && <>
            <p className="support-notice">{game.offerStates[offerKey(game, offer.id)] === 'declined' ? '今章は辞退しました' : reason ?? '条件を確認して引き受けられます'}</p>
            {button('条件に同意して受け取る', { type: 'accept', offer: offer.id }, true)}
            {button('今章は辞退する', { type: 'decline', offer: offer.id }, true)}
          </>}
          {promise && <>
            <p className="support-notice">{{ active: '履行待ち', fulfilled: '履行済み', cancelled: '解消済み', defaulted: '不履行' }[promise.status]} ／ 未精算{promise.outstanding}G{promise.status === 'active' ? ` ／ あと${Math.max(0, promise.due - absoluteDay(game) + 1)}日` : ''}</p>
            {promise.outstanding > 0 && (promise.terms.kind === 'credit' || promise.status !== 'active') && button(`${promise.outstanding}Gを支払う`, { type: 'pay', id: promise.id }, true)}
            {promise.status === 'active' && !allocation && <div className="support-management">
              {button('1日使って期限を延ばす', { type: 'renegotiate', id: promise.id }, true)}
              {button('約束を解消する', { type: 'cancel', id: promise.id }, true)}
            </div>}
          </>}
        </div>
      </div>
    </article> : <div className="support-empty">引き受けた約束はまだありません。</div>}
    <footer className="support-pages">
      <button className="btn outline sm" disabled={index <= 0} onClick={() => { setPage(index - 1); setConfirm(null); }}>前の書類</button>
      <span>{count ? index + 1 : 0} / {count}</span>
      <button className="btn outline sm" disabled={index >= count - 1} onClick={() => { setPage(index + 1); setConfirm(null); }}>次の書類</button>
    </footer>
    {confirm && <div className="support-confirm" role="dialog" aria-modal="true" aria-label="約束の確認">
      <div><h3>この条件で進めますか</h3>
        <p>{performAction(game, confirm).result?.narrative ?? performAction(game, confirm).error}</p>
        <p>使用日数：{performAction(game, confirm).result?.days ?? 0}日</p>
        <div><button className="btn outline" onClick={() => setConfirm(null)}>戻る</button><button className="btn" onClick={() => { const a = confirm; setConfirm(null); onAction(a); }}>確定する</button></div>
      </div>
    </div>}
  </section>;
}
