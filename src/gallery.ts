/**
 * 回想の記録。**プレイの保存とは別に持つ。**
 *
 * §14「引き継ぐ：解禁済みの依頼、人物の既知情報、**回想**／引き継がない：3軸、所持金、残債」。
 * 周回前提なので、はじめからやり直しても見た場面は消えない。保存を消す操作でも消さない
 * （消したいときは設定から明示的に消す）。
 */
import { sceneOf } from "./scenes";

export const GALLERY_KEY = "ikusei-prototype-gallery-v1";

export function loadGallery(store: Storage): string[] {
  try {
    const raw = JSON.parse(store.getItem(GALLERY_KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    /* 目録に無いidは捨てる。場面を作り直しても回想が壊れないように。 */
    return [...new Set(raw.filter((x) => typeof x === "string" && sceneOf(x)))];
  } catch {
    return [];
  }
}

/** 見た場面を足す。追加が無ければ元の配列をそのまま返す（無駄な保存をしない）。 */
export function recordScenes(store: Storage, seen: string[], ids: string[]) {
  const add = [...new Set(ids)].filter(
    (id) => sceneOf(id) && !seen.includes(id),
  );
  if (!add.length) return seen;
  const next = [...seen, ...add];
  try {
    store.setItem(GALLERY_KEY, JSON.stringify(next));
  } catch {
    /* 回想の保存に失敗してもゲームは止めない。 */
  }
  return next;
}

export function clearGallery(store: Storage) {
  store.removeItem(GALLERY_KEY);
}
