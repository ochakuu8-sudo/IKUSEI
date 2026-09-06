/**
 * 記号（しるし）。数字と説明文のかわりに置く小さな図形。
 *
 * ── なぜ数字を減らすのか ──
 * 1200×500 の一面に「関係0.00」「制作経験0／次のLvまで3個」「168G（品質40・値下げ前）」
 * のような内部の値を並べると、読む画面になって選ぶ画面でなくなる。
 * 一覧に要るのは「どれを選ぶか」の判断材料だけなので、段階のあるものは
 * 輪・星・丸の数に落とし、正確な値は依頼状の折りたたみと台帳に残す。
 *
 * `src/marks.tsx` の紋（三軸・体力・関係）と同じ方針で、線画アイコンを使わず
 * 塗りのシルエットにし、色は持たず `currentColor` を継ぐ。
 */

/** 関係の段階（0〜3）を輪の数で。段階の上限は3。 */
export function Rings({
  stage,
  max = 3,
  label,
}: {
  stage: number;
  max?: number;
  label?: string;
}) {
  return (
    <svg
      className="sym sym-rings"
      viewBox={`0 0 ${max * 13 - 3} 12`}
      role="img"
      aria-label={label ?? `関係 ${stage}／${max}`}
      focusable="false"
    >
      {Array.from({ length: max }, (_, i) => (
        <circle
          key={i}
          cx={5 + i * 13}
          cy="6"
          r="4.4"
          fill={i < stage ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.5"
          opacity={i < stage ? 1 : 0.4}
        />
      ))}
    </svg>
  );
}

/** 処方の熟練（Lv.1〜5）を星の数で。数値のLvと制作経験は依頼状・台帳に残す。 */
export function Stars({
  level,
  max = 5,
  label,
}: {
  level: number;
  max?: number;
  label?: string;
}) {
  const star =
    "M6 .8 7.6 4.3 11.3 4.8 8.6 7.4 9.3 11 6 9.3 2.7 11l.7-3.6L.7 4.8 4.4 4.3Z";
  return (
    <svg
      className="sym sym-stars"
      viewBox={`0 0 ${max * 13 - 1} 12`}
      role="img"
      aria-label={label ?? `熟練 ${level}／${max}`}
      focusable="false"
    >
      {Array.from({ length: max }, (_, i) => (
        <path
          key={i}
          d={star}
          transform={`translate(${i * 13} 0)`}
          fill="currentColor"
          opacity={i < level ? 1 : 0.22}
        />
      ))}
    </svg>
  );
}

/** 納品に必要な個数のうち、いま手元にあるぶんを丸で。 */
export function Pips({
  have,
  need,
  label,
}: {
  have: number;
  need: number;
  label?: string;
}) {
  const shown = Math.min(need, 8);
  return (
    <svg
      className="sym sym-pips"
      viewBox={`0 0 ${shown * 12 - 2} 10`}
      role="img"
      aria-label={label ?? `${have}／${need}個`}
      focusable="false"
    >
      {Array.from({ length: shown }, (_, i) => (
        <circle
          key={i}
          cx={5 + i * 12}
          cy="5"
          r="4.2"
          fill={i < have ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.4"
          opacity={i < have ? 1 : 0.32}
        />
      ))}
    </svg>
  );
}

/** 品質の数値を言葉に。数値そのものは依頼状の折りたたみと持ち物で見られる。 */
export const qualityWord = (q: number) =>
  q >= 75
    ? "極上"
    : q >= 65
      ? "上等"
      : q >= 55
        ? "良い"
        : q >= 45
          ? "並"
          : "粗い";

/** 一覧で「開かずに選べる」ようにするための状態の札。 */
export function StateTag({
  kind,
  children,
}: {
  kind: "ready" | "brew" | "short" | "shut";
  children: React.ReactNode;
}) {
  return <span className={`sym-tag sym-${kind}`}>{children}</span>;
}
