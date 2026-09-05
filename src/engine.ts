import {
  axes, jobs, people, places, recipes, materialIds, CHAPTER_DAYS, CHAPTERS,
  MAX_STAMINA, NETWORK_COST, NETWORK_STAMINA, REST_RECOVERY,
  isOpen, personOpen, personalRunKey, hasStaminaFor, hasStockFor, payWithRelation, capDropOf,
  recipesTaughtBy, canBrew, brewOnce, placeOpen, materialOf,
  relationStage, sceneScript, stageUpLine, settlementOf, applySettlement,
  type GameState, type DayResult, type PersonId, type PlaceId, type RecipeId, type MaterialId,
} from './game';
import { absoluteDay, expireObligations, grantCapabilities, offerKey, offerReason, validateOffers } from './contracts';
import { supportOffers, capabilityLabels } from './content/support';
import { planDelivery, type DeliverySelection } from './delivery';
import { applyRewards } from './rewards';
import { storyEvents } from './content/events';
import type { SupportOffer } from './supportTypes';

export type Action =
  | ({ type: 'deliver' } & DeliverySelection)
  | { type: 'read-event'; id: string }
  | { type: 'visit'; place: PlaceId }
  | { type: 'job'; id: string } | { type: 'rest' }
  | { type: 'network'; person: PersonId } | { type: 'gather'; place: PlaceId }
  | { type: 'buy'; place: PlaceId; basket: Partial<Record<MaterialId, number>> }
  | { type: 'brew'; recipe: RecipeId; quantity?: number } | { type: 'settle' }
  | { type: 'accept' | 'decline'; offer: string }
  | { type: 'fulfill'; id: string; option: string }
  | { type: 'pay' | 'cancel' | 'renegotiate'; id: string };
export type ActionOutcome = {
  state: GameState; result?: DayResult;
  scene?: ReturnType<typeof sceneScript>;
  error?: string;
};
const fail = (message: string): never => { throw new Error(message); };

/** 唯一の行動入口。失敗時は入力状態を変えない。UI・テスト・simで共用する。 */
export function performAction(before: GameState, action: Action, offers: SupportOffer[] = supportOffers): ActionOutcome {
  try {
    if (action.type === 'read-event') {
      if (before.eventQueue[0]?.id !== action.id) fail('未再生イベントが見つかりません');
      const next = structuredClone(before);
      next.eventQueue.shift(); next.playedEvents.push(action.id);
      next.history.push({ day: absoluteDay(before), kind: 'read-event', target: action.id });
      return { state: next };
    }
    if (before.ended) fail('この育成は終了しています');
    if (before.awaitingSettlement && action.type !== 'settle' && action.type !== 'pay') fail('章末の精算を先に終えてください');
    const s = structuredClone(before);
    let title = '', narrative = '', days = 0, worked: PersonId | 'none' | PersonId[] = 'none', publicWork = false;
    let scene: ActionOutcome['scene'];
    let delivered: DayResult['delivered'];
    let deliveries: DayResult['deliveries'];
    let relationUp: DayResult['relationUp'];
    let kind: DayResult['kind'] = 'support';
    const notices: string[] = [];
    const ensureDays = (n: number) => {
      if (s.awaitingSettlement || n > CHAPTER_DAYS - s.day + 1) fail('今章の残り日数が足りません');
    };
    const unlock = (ids: string[]) => {
      grantCapabilities(s, ids).forEach(id => notices.push(`解禁：${capabilityLabels[id] ?? id}`));
    };
    const advanceRelation = (id: PersonId, amount: number, teaches?: RecipeId) => {
      const old = s.relations[id];
      s.relations[id] = Math.min(3, old + amount);
      const learned = recipesTaughtBy(id, old, s.relations[id], s.known);
      s.known = [...new Set([...s.known, ...learned, ...(teaches ? [teaches] : [])])];
      if (s.relations[id] > old) relationUp = { name: people.find(p => p.id === id)!.name, stage: relationStage(s.relations[id]) };
    };
    if (action.type === 'visit') {
      const p = places.find(p => p.id === action.place);
      if (!p || !placeOpen(p, s)) fail('この場所へはまだ行けません');
      s.newPlaces = s.newPlaces.filter(id => id !== action.place);
      s.newPeople = s.newPeople.filter(id => people.find(p => p.id === id)?.place !== action.place);
      s.newEvents = s.newEvents.filter(id => storyEvents.find(e => e.id === id)?.place !== action.place);
      return { state: s };
    }
    if (action.type === 'settle') {
      if (!s.awaitingSettlement) fail('まだ章末ではありません');
      const next = applySettlement(s, settlementOf(s));
      if (next.ended) {
        expireObligations(next, CHAPTERS * CHAPTER_DAYS);
      }
      return { state: next };
    }
    if (action.type === 'brew') {
      const recipe = recipes.find(r => r.id === action.recipe);
      const quantity = action.quantity ?? 1;
      if (!Number.isSafeInteger(quantity) || quantity < 1 || !recipe || !canBrew(recipe, s)
        || s.stamina < recipe.stamina * quantity
        || Object.entries(recipe.needs).some(([id, n]) => s.materials[id as MaterialId] < n! * quantity)) fail('指定数の処方・素材・体力を確認してください');
      let next = s;
      for (let i = 0; i < quantity; i++) next = brewOnce(next, action.recipe);
      return { state: next };
    }
    if (action.type === 'deliver' || (action.type === 'job' && jobs.find(j => j.id === action.id)?.category === 'ordinary')) {
      const selection = action.type === 'deliver' ? action : { ordinary: [action.id], promises: [] };
      const plan = planDelivery(before, selection);
      if (plan.error) fail(plan.error);
      days = 1; kind = 'job'; title = 'まとめ納品';
      s.money += plan.pay; s.stamina -= plan.stamina;
      for (const [id, count] of Object.entries(plan.stock)) s.stock[id as RecipeId] = (s.stock[id as RecipeId] ?? 0) - count!;
      plan.costs.forEach(c => { s.axes[c.axis] = Math.max(0, s.axes[c.axis] - c.amount); });
      s.dignityCap = Math.max(0, s.dignityCap - plan.cap);
      publicWork = plan.costs.some(c => c.axis === '威厳' && c.amount > 0);
      worked = [...new Set(plan.lines.map(l => l.person))].sort();
      // 通常依頼による関係は相手ごとに1回。各報酬額は既に出発時点で確定済み。
      [...new Set(plan.lines.filter(l => !l.option).map(l => l.person))].sort().forEach(id => advanceRelation(id, 1));
      for (const line of plan.lines) {
        if (line.option) {
          const o = s.obligations.find(o => o.id === line.id)!;
          o.status = 'fulfilled'; o.outstanding = 0;
          unlock([...o.terms.unlocks, ...o.terms.options.find(c => c.id === line.option)!.unlocks]);
          if (!o.terms.schedule) advanceRelation(o.terms.person, 1);
          notices.push(...applyRewards(s, o.id, o.terms.rewards ?? [], advanceRelation));
        }
        s.history.push({ day: absoluteDay(before), kind: line.option ? 'fulfill' : 'job', target: line.id, ...(line.option ? { choice: line.option } : {}) });
      }
      deliveries = plan.lines.map(l => ({ title: l.title, recipe: l.recipe, count: l.count, pay: l.pay }));
      narrative = `${plan.lines.length}件を1回の出発で納め、${plan.pay}Gを受け取った。`;
    } else if (action.type === 'job') {
      const j = jobs.find(j => j.id === action.id);
      if (!j || !isOpen(j, s) || !hasStaminaFor(j, s) || !hasStockFor(j, s)) fail('この仕事は今は受けられません');
      const job = j!;
      days = 1; kind = 'job'; title = job.title; worked = job.person;
      s.money += payWithRelation(job, s); s.stamina -= job.stamina;
      job.costs.forEach(c => { s.axes[c.axis] = Math.max(0, s.axes[c.axis] - c.amount); });
      s.dignityCap = Math.max(0, s.dignityCap - capDropOf(job));
      publicWork = job.costs.some(c => c.axis === '威厳');
      if (job.recipe) {
        s.stock[job.recipe] = (s.stock[job.recipe] ?? 0) - (job.count ?? 1);
        delivered = { recipe: job.recipe, count: job.count ?? 1 };
      }
      advanceRelation(job.person, job.bond ?? 1, job.teaches);
      narrative = `${title}。${s.money - before.money}Gを得た。`;
      scene = [...sceneScript(job), ...stageUpLine(job.person, before.relations[job.person], s.relations[job.person])];
      if (before.history.some(h => h.kind === 'job' && h.target === job.id)) scene.push({ text: '同じ依頼書を、もう一度受け取った。前とは違う約束が、今の帳簿には残っている。' });
      if (job.costs.some(c => before.axes[c.axis] < 51)) scene.push({ text: '以前と同じ条件でも、今の立場から選ぶ意味は違っていた。' });
      s.personalRuns[personalRunKey(job, before)] = (s.personalRuns[personalRunKey(job, before)] ?? 0) + 1;
      s.history.push({ day: absoluteDay(before), kind: 'job', target: job.id });
    } else if (action.type === 'rest') {
      days = 1; kind = 'rest'; title = '休養'; narrative = '屋敷で休み、身なりを整えた。';
      s.stamina = Math.min(MAX_STAMINA, s.stamina + REST_RECOVERY);
      s.axes.品位 = Math.min(s.dignityCap, s.axes.品位 + 6);
    } else if (action.type === 'network') {
      const person = people.find(p => p.id === action.person);
      if (!person || !personOpen(person, s) || s.relations[action.person] >= 3 || s.money < NETWORK_COST || s.stamina < NETWORK_STAMINA) fail('訪問の条件が足りません');
      days = 1; kind = 'network'; title = `${person!.name}に会う`; narrative = '顔を出し、仕事の話をした。';
      s.money -= NETWORK_COST; s.stamina -= NETWORK_STAMINA;
      advanceRelation(action.person, 1);
    } else if (action.type === 'gather') {
      const p = places.find(p => p.id === action.place);
      if (!p || !p.gathers || !placeOpen(p, s) || s.stamina < (p.gatherStamina ?? 20)) fail('ここでは今、採集できません');
      days = 1; kind = 'gather'; title = `${p!.name}で採る`; narrative = '素材を摘んで帰った。';
      s.stamina -= p!.gatherStamina ?? 20;
      materialIds.forEach(id => { s.materials[id] += p!.gathers?.[id] ?? 0; });
    } else if (action.type === 'buy') {
      const p = places.find(p => p.id === action.place);
      const entries = Object.entries(action.basket) as [MaterialId, number][];
      if (!p || !placeOpen(p, s) || !entries.some(([, n]) => n > 0)
        || entries.some(([id, n]) => !p.sells?.includes(id) || !Number.isSafeInteger(n) || n < 0)) fail('仕入れの内容を確認してください');
      const cost = entries.reduce((sum, [id, n]) => sum + (materialOf(id).buy ?? 0) * n, 0);
      if (cost > s.money) fail('仕入れ資金が足りません');
      days = 1; kind = 'buy'; title = '素材を仕入れる'; narrative = `${cost}Gで素材を買い付けた。`;
      s.money -= cost; entries.forEach(([id, n]) => { s.materials[id] += n; });
    } else if (action.type === 'accept' || action.type === 'decline') {
      if (validateOffers(offers).length) fail('支援データの定義が不正です');
      const offer = offers.find(o => o.id === action.offer);
      if (!offer) fail('この支援は見つかりません');
      const reason = offerReason(s, offer!);
      if (reason) fail(reason);
      const key = offerKey(s, offer!.id, !!offer!.schedule);
      title = offer!.title;
      if (action.type === 'decline') {
        s.offerStates[key] = 'declined'; narrative = offer!.schedule ? 'この特別依頼を辞退した。代償はない。' : '今回は引き受けない。代償はなく、次章には再び検討できる。';
      } else {
        days = offer!.acceptDays; ensureDays(days);
        s.offerStates[key] = 'accepted';
        s.money += offer!.money;
        materialIds.forEach(id => { s.materials[id] += offer!.materials[id] ?? 0; });
        s.obligations.push({ id: key, offerId: offer!.id, acceptedDay: absoluteDay(s), due: offer!.schedule?.delivery ?? absoluteDay(s) + offer!.term,
          status: 'active', outstanding: offer!.repayment, extensions: 0, terms: structuredClone(offer!) });
        narrative = `支援を受け取った。期限と未精算${offer!.repayment}Gを約束帳に記した。`;
        scene = [{ text: title }, { text: '支援の条件を読み、期限を確かめて受け取った。' }, { text: narrative }];
      }
      s.history.push({ day: absoluteDay(before), kind: action.type, target: key });
    } else {
      const actionId = 'id' in action ? action.id : '';
      const obligation = s.obligations.find(o => o.id === actionId);
      if (!obligation) fail('約束が見つかりません');
      const o = obligation!;
      title = o.terms.title;
      if (action.type === 'pay') {
        if (o.outstanding <= 0 || s.money < o.outstanding) fail('未精算額を支払う資金が足りません');
        if (o.status === 'active' && o.terms.kind !== 'credit') fail('予約注文は納品するか、先に解消してください');
        const amount = o.outstanding; s.money -= amount; o.outstanding = 0;
        if (o.status === 'active') { o.status = 'fulfilled'; unlock(o.terms.unlocks); }
        narrative = `${amount}Gを支払った。日数は進まない。`;
      } else if (action.type === 'cancel') {
        if (o.status !== 'active') fail('有効な約束だけ解消できます');
        o.status = 'cancelled'; narrative = `約束を解消した。未精算${o.outstanding}Gの返還義務が残る。支払いまで同じ相手の支援は停止する。`;
      } else if (action.type === 'renegotiate') {
        if (o.terms.schedule || o.status !== 'active' || o.extensions >= o.terms.extensionLimit) fail('この約束はこれ以上延長できません');
        if (o.due + o.terms.extensionDays > CHAPTERS * CHAPTER_DAYS) fail('最終期限を超えて延長できません');
        days = 1; o.extensions += 1; o.due += o.terms.extensionDays;
        narrative = `1日を使って相談し、期限を${o.terms.extensionDays}日延ばした。`;
      } else if (action.type === 'fulfill') {
        const option = o.terms.options.find(c => c.id === action.option);
        if (o.status !== 'active' || !option) fail('この納品方法は選べません');
        const c = option!;
        // 1日契約は個別ボタンからも同じまとめ納品処理に合流する。
        if (c.days === 1) return performAction(before, { type: 'deliver', ordinary: [], promises: [{ id: o.id, option: c.id }] }, offers);
        if (o.terms.schedule) fail('特別依頼は指定日当日のみ納品できます');
        if ((s.stock[c.recipe] ?? 0) < c.count || s.stamina < c.stamina) fail('納品する品か体力が足りません');
        if (absoluteDay(s) + c.days - 1 > o.due) fail('この方法では期限に間に合いません');
        days = c.days; worked = o.terms.person;
        s.stock[c.recipe] = (s.stock[c.recipe] ?? 0) - c.count;
        s.stamina -= c.stamina; s.money += o.terms.totalPay - o.terms.money;
        o.status = 'fulfilled'; o.outstanding = 0;
        unlock([...o.terms.unlocks, ...c.unlocks]);
        advanceRelation(o.terms.person, 1);
        delivered = { recipe: c.recipe, count: c.count };
        narrative = `${c.label}。残額${o.terms.totalPay - o.terms.money}Gを受け取った。`;
        scene = [{ text: title }, { text: `${c.label}。選んだ方法で約束を果たした。` }, { text: narrative }, ...notices.map(text => ({ text }))];
      }
      s.history.push({ day: absoluteDay(before), kind: action.type, target: o.id, ...('option' in action ? { choice: action.option } : {}) });
    }
    if (days) ensureDays(days);
    for (let i = 0; i < days; i++) {
      const day = absoluteDay(s);
      if (!publicWork) s.axes.威厳 = Math.min(100, s.axes.威厳 + 2);
      s.axes.品位 = Math.min(s.axes.品位, s.dignityCap);
      s.recent = [worked, ...s.recent].slice(0, 6);
      notices.push(...expireObligations(s, day));
      if (s.day === CHAPTER_DAYS) s.awaitingSettlement = true;
      else s.day += 1;
    }
    const newlyOpen = offers.filter(o => o.requirements.every(r => r.kind !== 'relation' || before.relations[r.person] < r.level)
      && offerReason(before, o) !== null && offerReason(s, o) === null);
    newlyOpen.forEach(o => { if (!notices.some(n => n.includes(o.title))) notices.push(`相談できる支援：${o.title}`); });
    s.log = [...notices, narrative, ...s.log].slice(0, 8);
    const result: DayResult = {
      kind, title, narrative, days, notices, basePay: s.money - before.money,
      relationBonus: 0, paidTerms: [], moneyDelta: s.money - before.money,
      staminaDelta: s.stamina - before.stamina,
      axisDrops: axes.filter(a => s.axes[a] < before.axes[a]).map(axis => ({ axis, amount: before.axes[axis] - s.axes[axis] })),
      axisGains: axes.filter(a => s.axes[a] > before.axes[a]).map(axis => ({ axis, amount: s.axes[axis] - before.axes[axis] })),
      dignityCapDrop: before.dignityCap - s.dignityCap,
      materialDeltas: materialIds.filter(id => s.materials[id] !== before.materials[id]).map(id => ({ id, amount: s.materials[id] - before.materials[id] })),
      learned: s.known.filter(id => !before.known.includes(id)), delivered, deliveries, relationUp,
    };
    return { state: s, result, scene };
  } catch (e) {
    return { state: before, error: e instanceof Error ? e.message : '行動できませんでした' };
  }
}
