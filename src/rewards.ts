import { people, places, recipes, type GameState } from './game';
import { storyEvents } from './content/events';
import { capabilityLabels } from './content/support';
import type { CompletionReward } from './supportTypes';

export function rewardValid(r: CompletionReward): boolean {
  if (!r || typeof r !== 'object') return false;
  switch (r.kind) {
    case 'relation': return people.some(p => p.id === r.person) && Number.isSafeInteger(r.amount) && r.amount > 0;
    case 'person': return people.some(p => p.id === r.id);
    case 'place': return places.some(p => p.id === r.id);
    case 'recipe': return recipes.some(p => p.id === r.id);
    case 'event': return storyEvents.some(e => e.id === r.id);
    case 'capability': return typeof r.id === 'string' && r.id.length > 0;
    default: return false;
  }
}
export function rewardLabel(r: CompletionReward): string {
  switch (r.kind) {
    case 'relation': return `${people.find(p => p.id === r.person)?.name}との関係＋${r.amount}`;
    case 'person': return `人物：${people.find(p => p.id === r.id)?.name}`;
    case 'place': return `場所：${places.find(p => p.id === r.id)?.name}`;
    case 'recipe': return `処方：${recipes.find(p => p.id === r.id)?.name}`;
    case 'event': return `出来事：${storyEvents.find(e => e.id === r.id)?.title}`;
    case 'capability': return `新たな手段：${capabilityLabels[r.id] ?? '追加の手段'}`;
  }
}
/** 呼び出し元のクローンにだけ適用。履行IDとイベントIDの両方で重複を防ぐ。 */
export function applyRewards(s: GameState, obligationId: string, rewards: CompletionReward[], relation: (id: typeof people[number]['id'], amount: number) => void): string[] {
  if (s.rewardedObligations.includes(obligationId)) return [];
  if (!rewards.every(rewardValid)) throw new Error('達成報酬の定義が不正です');
  const notices: string[] = [];
  for (const r of rewards) {
    if (r.kind === 'relation') relation(r.person, r.amount);
    if (r.kind === 'person' && !s.unlockedPeople.includes(r.id)) { s.unlockedPeople.push(r.id); s.newPeople.push(r.id); }
    if (r.kind === 'place' && !s.unlockedPlaces.includes(r.id)) { s.unlockedPlaces.push(r.id); s.newPlaces.push(r.id); }
    if (r.kind === 'recipe' && !s.known.includes(r.id)) s.known.push(r.id);
    if (r.kind === 'capability' && !s.capabilities.includes(r.id)) s.capabilities.push(r.id);
    if (r.kind === 'event' && !s.playedEvents.includes(r.id) && !s.eventQueue.some(e => e.id === r.id)) {
      s.eventQueue.push(structuredClone(storyEvents.find(e => e.id === r.id)!));
      s.newEvents.push(r.id);
    }
    notices.push(`達成報酬：${rewardLabel(r)}`);
  }
  s.rewardedObligations.push(obligationId);
  return notices;
}
