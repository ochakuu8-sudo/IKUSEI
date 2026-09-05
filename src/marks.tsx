import type { Axis } from './game';

/**
 * 三軸と体力・関係の「印」。
 *
 * ── なぜアイコンではなく印なのか ──
 * lucide のような線画アイコンはアプリのUIの記号で、並べると画面が情報の一覧に見える。
 * このゲームの画面は依頼状（紙）なので、紙に押される紋章＝塗りのシルエットにする。
 * 小さく置いても潰れず、拡大すれば透かしとしてそのまま使える。
 *
 * 色は付けない。`fill: currentColor` なので、置いた場所の文字色（軸色）を継ぐ。
 */

export type MarkName = Axis | '体力' | '関係';

type Glyph = { d: string; evenOdd?: true; label: string };

const GLYPHS: Record<MarkName, Glyph> = {
  // 百合 ── 純潔の紋。花弁が閉じたまま帯で縛られている。
  貞操: {
    label: '貞操',
    d: 'M12 1.9c2.2 2.9 2.6 6.8 1.5 10.9h-3C9.4 8.7 9.8 4.8 12 1.9Z'
      + 'M11.4 12.8C7.6 12.1 4.6 9.1 4.6 6.3c0-.9.7-1.3 1.5-.9 2.4 1.2 4.6 4 5.3 7.4Z'
      + 'M12.6 12.8c3.8-.7 6.8-3.7 6.8-6.5 0-.9-.7-1.3-1.5-.9-2.4 1.2-4.6 4-5.3 7.4Z'
      + 'M7 12.8h10v2.4H7Z'
      + 'M9.6 15.7h4.8c.4 3.3 1.4 4.9 2.6 6.2H7c1.2-1.3 2.2-2.9 2.6-6.2Z',
  },
  // 小冠 ── 人前に出られる身分の印。三つの尖りに珠。
  品位: {
    label: '品位',
    d: 'M4.7 16.6 4 7.5l4.1 3.9L12 5.2l3.9 6.2L20 7.5l-.7 9.1Z'
      + 'M4.4 17.6h15.2v2.6H4.4Z'
      + 'M4 4.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 1 0 0-3Z'
      + 'M20 4.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 1 0 0-3Z'
      + 'M12 2.1a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 1 0 0-3.4Z',
  },
  // 盾に横帯 ── 名前で立てる格。帯は抜き（fill-rule で穴にする）。
  威厳: {
    label: '威厳',
    evenOdd: true,
    d: 'M12 2.1 20.4 4.9v6.8c0 4.9-3.4 8.6-8.4 10.3-5-1.7-8.4-5.4-8.4-10.3V4.9Z'
      + 'M3.6 10.1h16.8v3.1H3.6Z',
  },
  // 砂時計 ── 一日は一度しか使えない。
  体力: {
    label: '体力',
    d: 'M6.4 2.4h11.2v1.9H6.4Z'
      + 'M6.4 19.7h11.2v1.9H6.4Z'
      + 'M8.1 4.9h7.8c0 4.5-2.7 6.3-2.7 7.1s2.7 2.6 2.7 7.1H8.1c0-4.5 2.7-6.3 2.7-7.1S8.1 9.4 8.1 4.9Z',
  },
  // 結び ── 人と結んだぶんだけ重なる二つの輪。
  関係: {
    label: '関係',
    evenOdd: true,
    d: 'M4 12a4.7 4.7 0 1 0 9.4 0 4.7 4.7 0 1 0-9.4 0Z'
      + 'M5.7 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0Z'
      + 'M10.6 12a4.7 4.7 0 1 0 9.4 0 4.7 4.7 0 1 0-9.4 0Z'
      + 'M12.3 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0Z',
  },
};

export function Mark({ name, className = '', label, decorative = false }:
  { name: MarkName; className?: string; label?: string; decorative?: boolean }) {
  const g = GLYPHS[name];
  return (
    <svg className={`mark mark-${name} ${className}`} viewBox="0 0 24 24"
      role={decorative ? undefined : 'img'} aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : (label ?? g.label)} focusable="false">
      <path d={g.d} fillRule={g.evenOdd ? 'evenodd' : 'nonzero'} />
    </svg>
  );
}
