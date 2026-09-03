// 絵の置き場所と差し替え規約。
// このゲームの本体は絵なので、UI側は「どの絵を出すか」を必ずここ経由で決める。
//
// 実素材は public/art/ 以下に置く。まだ無いものは placeholder に落ちる
// （<img onError> で拾う）ので、描けたぶんから1枚ずつ差し込める。
//
//   public/art/bg/<id>.png            背景        16:9 推奨 (1920x1080)
//   public/art/portrait/<stage>.png   立ち絵      縦長・背景透過 (1024x1536)
//   public/art/scene/<jobId>.png      イベントCG  16:9 (1920x1080)
//   public/art/scene/<jobId>-<axis>.png  軸ごとの差分（あれば優先）

import type { Axis, Job } from './game';

const BASE = import.meta.env.BASE_URL;

/** 素材が未実装のあいだ表示する仮画像。 */
export const PLACEHOLDER = `${BASE}lady-at-ledger.png`;

/** 立ち絵の段階。3軸の最も低いものが、見た目の段階を決める。 */
export type PortraitStage = 'intact' | 'worn' | 'fallen' | 'ruined';

export function portraitStage(axes: Record<Axis, number>): PortraitStage {
  const lowest = Math.min(axes.貞操, axes.品位, axes.威厳);
  if (lowest >= 76) return 'intact';
  if (lowest >= 51) return 'worn';
  if (lowest >= 26) return 'fallen';
  return 'ruined';
}

export function portraitSrc(stage: PortraitStage): string {
  return `${BASE}art/portrait/${stage}.png`;
}

export function backgroundSrc(id: string): string {
  return `${BASE}art/bg/${id}.png`;
}

/** イベントCG。軸ごとの差分があればそれを、無ければ依頼共通の絵を指す。 */
export function sceneSrc(job: Job, axis: Axis | null): string {
  return axis
    ? `${BASE}art/scene/${job.id}-${axis}.png`
    : `${BASE}art/scene/${job.id}.png`;
}

/** 差分が無いときに1段階だけ戻すための控え。 */
export function sceneFallbackSrc(job: Job): string {
  return `${BASE}art/scene/${job.id}.png`;
}
