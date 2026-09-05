import { CHAPTERS, CHAPTER_DAYS, materialIds, people, recipes, personOpen, type GameState } from './game';
import type { Requirement, SupportOffer, Obligation } from './supportTypes';
import { supportOffers } from './content/support';
import { rewardValid } from './rewards';
export const MAX_OBLIGATIONS = 2;
export const absoluteDay = (s: GameState) => (s.chapter - 1) * CHAPTER_DAYS + s.day;
export const offerKey = (s: GameState, id: string, fixed = !!supportOffers.find(o => o.id === id)?.schedule) => fixed ? `special:${id}` : `${s.chapter}:${id}`;
export const outstandingTotal = (s: GameState) => s.obligations.reduce((sum, o) => sum + o.outstanding, 0);
export const dateLabel = (day: number) => `第${Math.floor((day - 1) / CHAPTER_DAYS) + 1}章${(day - 1) % CHAPTER_DAYS + 1}日`;
export function meetsRequirement(s: GameState, r: Requirement) {
  if (r.kind === 'relation') return s.relations[r.person] >= r.level;
  if (r.kind === 'capability') return s.capabilities.includes(r.id);
  return s.obligations.filter(o => o.status === 'fulfilled').length >= r.count;
}
export function suspended(s: GameState, person: SupportOffer['person']) {
  return s.obligations.some(o => o.terms.person === person && o.outstanding > 0 && o.status !== 'active');
}
export function offerReason(s: GameState, offer: SupportOffer): string | null {
  if (s.ended || s.awaitingSettlement) return '本日の行動は終了しています';
  if (!personOpen(people.find(p => p.id === offer.person)!, s)) return 'この人物にはまだ会えません';
  if (s.offerStates[offerKey(s, offer.id, !!offer.schedule)]) return offer.schedule ? 'この特別依頼は確認済みです' : '今章は確認済みです';
  const day = offer.schedule ? absoluteDay(s) : s.day;
  if (day < (offer.schedule?.appears ?? offer.opens)) return 'まだ受付期間ではありません';
  if (day > (offer.schedule?.closes ?? offer.closes)) return '提示期限が過ぎています';
  if (!offer.requirements.every(r => meetsRequirement(s, r))) return '履行実績や関係の条件が足りません';
  if (suspended(s, offer.person)) return 'この相手への未精算を支払うと、支援が再開します';
  if (s.obligations.filter(o => o.status === 'active' && !!o.terms.schedule === !!offer.schedule).length >= MAX_OBLIGATIONS) return '同時に引き受けられる約束は2件です';
  if ((offer.schedule?.delivery ?? absoluteDay(s) + offer.term) > CHAPTERS * CHAPTER_DAYS) return '最終期限を超える約束は引き受けられません';
  return null;
}
export function expireObligations(s: GameState, completedDay: number): string[] {
  const messages: string[] = [];
  s.obligations.forEach(o => {
    if (o.status === 'active' && o.due <= completedDay) {
      o.status = 'defaulted';
      s.history.push({ day: completedDay, kind: 'defaulted', target: o.id });
      messages.push(`「${o.terms.title}」が期限切れ。未精算${o.outstanding}G。`);
    }
  });
  return messages;
}
export function grantCapabilities(s: GameState, ids: string[]) {
  const added = ids.filter(id => !s.capabilities.includes(id));
  s.capabilities = [...new Set([...s.capabilities, ...ids])];
  return added;
}
export function dueSoon(s: GameState): Obligation | undefined {
  return s.obligations.filter(o => o.status === 'active').sort((a, b) => a.due - b.due)[0];
}

/** 仮データを差し替えた時も、参照先と経済条件を検証する。 */
export function validateOffers(offers: SupportOffer[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const integer = (n: number, min = 0) => Number.isSafeInteger(n) && n >= min;
  for (const o of offers) {
    if (!o.id || ids.has(o.id)) errors.push(`重複または空の支援ID: ${o.id}`);
    ids.add(o.id);
    if (!people.some(p => p.id === o.person)) errors.push(`不明な支援元: ${o.id}`);
    if ((!o.schedule && (!integer(o.opens, 1) || !integer(o.closes, o.opens) || o.closes > CHAPTER_DAYS)) || !integer(o.term, 1)
      || !integer(o.acceptDays) || o.acceptDays > 1 || !integer(o.money) || !integer(o.totalPay)
      || !integer(o.repayment, 1) || !integer(o.extensionDays, 1) || !integer(o.extensionLimit)) errors.push(`不正な条件: ${o.id}`);
    if (o.kind === 'advance' && (o.totalPay < o.money || o.repayment !== o.money || !o.options.length)) errors.push(`不正な前金: ${o.id}`);
    if (o.kind === 'credit' && (o.money !== 0 || o.totalPay !== 0 || o.options.length !== 0)) errors.push(`不正な掛け仕入れ: ${o.id}`);
    Object.entries(o.materials).forEach(([id, n]) => {
      if (!materialIds.includes(id as typeof materialIds[number]) || !integer(n, 1)) errors.push(`不正な素材: ${o.id}/${id}`);
    });
    if (o.schedule && (!integer(o.schedule.appears, 1) || !integer(o.schedule.closes, o.schedule.appears)
      || !integer(o.schedule.delivery, o.schedule.closes + 1) || o.schedule.delivery > CHAPTERS * CHAPTER_DAYS
      || o.acceptDays !== 0 || o.extensionLimit !== 0 || o.kind !== 'advance' || o.options.some(c => c.days !== 1))) errors.push(`不正な固定日程: ${o.id}`);
    if (o.rewards && !o.rewards.every(rewardValid)) errors.push(`不正な達成報酬: ${o.id}`);
    const choices = new Set<string>();
    o.options.forEach(c => {
      if (choices.has(c.id) || !recipes.some(r => r.id === c.recipe) || !integer(c.count, 1) || !integer(c.days, 1) || !integer(c.stamina)) errors.push(`不正な選択肢: ${o.id}/${c.id}`);
      if (c.costs?.some(c => !['貞操', '品位', '威厳'].includes(c.axis) || !integer(c.amount))) errors.push(`不正な代償: ${o.id}`);
      choices.add(c.id);
    });
    o.requirements.forEach(r => {
      if (r.kind === 'relation' && (!people.some(p => p.id === r.person) || !integer(r.level) || r.level > 3)) errors.push(`不正な関係条件: ${o.id}`);
      if (r.kind === 'fulfilled' && !integer(r.count)) errors.push(`不正な履行条件: ${o.id}`);
      if (r.kind === 'capability' && !offers.some(p => [...p.unlocks, ...p.options.flatMap(c => c.unlocks), ...(p.rewards ?? []).filter(r => r.kind === 'capability').map(r => 'id' in r ? r.id : '')].includes(r.id))) errors.push(`取得できない解禁条件: ${o.id}`);
    });
  }
  return errors;
}
