import { initialState, materialIds, axes, people, recipes, CHAPTERS, CHAPTER_DAYS, type GameState } from './game';
import { emptySupportState } from './supportTypes';
export const SAVE_KEY = 'ikusei-prototype-save-v8';
export const LEGACY_SAVE_KEY = 'ikusei-prototype-save-v7';

/** v7は履歴や契約を捏造せず移行する。破損データはゲーム状態として使わない。 */
export function parseSave(raw: string | null): GameState | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    const number = (n: unknown, max = Number.MAX_SAFE_INTEGER) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 && n <= max;
    if (!v || typeof v !== 'object' || !number(v.chapter, CHAPTERS) || v.chapter < 1 || !number(v.day, CHAPTER_DAYS) || v.day < 1) return null;
    if (!['money', 'debt', 'carryOver'].every(k => number(v[k])) || !number(v.stamina, 100) || !number(v.dignityCap, 100)) return null;
    if (!axes.every(a => number(v.axes?.[a], 100)) || !people.every(p => number(v.relations?.[p.id], 3))
      || !materialIds.every(id => number(v.materials?.[id]))) return null;
    const recipeIds = recipes.map(r => r.id);
    if (!v.stock || Object.entries(v.stock).some(([id, n]) => !recipeIds.includes(id as typeof recipeIds[number]) || !number(n))) return null;
    if (!Array.isArray(v.known) || !v.known.every((id: never) => recipeIds.includes(id))
      || !Array.isArray(v.log) || !v.log.every((x: unknown) => typeof x === 'string')
      || !Array.isArray(v.recent) || !v.recent.every((id: string) => id === 'none' || people.some(p => p.id === id))
      || typeof v.ended !== 'boolean' || typeof v.awaitingSettlement !== 'boolean') return null;
    if (v.saveVersion !== undefined && v.saveVersion !== 8) return null;
    if (v.saveVersion === 8) {
      if (!Array.isArray(v.obligations) || !Array.isArray(v.capabilities) || !v.capabilities.every((x: unknown) => typeof x === 'string')
        || !Array.isArray(v.history) || !v.offerStates || typeof v.offerStates !== 'object') return null;
      if (Object.values(v.offerStates).some(x => x !== 'accepted' && x !== 'declined')) return null;
      const ids = new Set<string>();
      for (const o of v.obligations) {
        if (!o || typeof o.id !== 'string' || ids.has(o.id) || typeof o.offerId !== 'string'
          || !number(o.acceptedDay) || !number(o.due, CHAPTERS * CHAPTER_DAYS) || o.due < o.acceptedDay
          || !number(o.outstanding) || !number(o.extensions)
          || !['active', 'fulfilled', 'cancelled', 'defaulted'].includes(o.status)) return null;
        ids.add(o.id);
        const t = o.terms;
        if (!t || typeof t.title !== 'string' || !people.some(p => p.id === t.person) || !['advance', 'credit'].includes(t.kind)
          || !number(t.totalPay) || !number(t.money) || t.totalPay < t.money || !number(t.repayment)
          || !number(t.extensionDays) || !number(t.extensionLimit) || !Array.isArray(t.options)
          || !Array.isArray(t.unlocks) || !t.unlocks.every((x: unknown) => typeof x === 'string')) return null;
        for (const c of t.options) {
          if (!c || typeof c.id !== 'string' || typeof c.label !== 'string' || !recipeIds.includes(c.recipe)
            || !number(c.count) || c.count < 1 || !number(c.days) || c.days < 1 || !number(c.stamina)
            || !Array.isArray(c.unlocks) || !c.unlocks.every((x: unknown) => typeof x === 'string')) return null;
        }
      }
      if (v.history.some((h: { day: number; kind: string; target: string; choice?: string }) => !h || !number(h.day)
        || typeof h.kind !== 'string' || typeof h.target !== 'string' || (h.choice !== undefined && typeof h.choice !== 'string'))) return null;
    }
    return { ...structuredClone(initialState), ...v, ...(v.saveVersion === 8 ? {} : emptySupportState()) };
  } catch { return null; }
}
