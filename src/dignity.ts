/** All three dignity axes share six irreversible ranks. Points stay within 0..100. */
export function dignityRank(value: number): number {
  if (!Number.isFinite(value)) throw new Error("尊厳の数値が不正です");
  return value < 1 ? 0 : Math.min(5, Math.ceil(value / 20));
}

/** Recovery can fill the current band, but can never restore a lost rank. */
export function changeDignity(value: number, delta: number): number {
  if (!Number.isFinite(delta)) throw new Error("尊厳の変化量が不正です");
  const rank = dignityRank(value);
  return Math.max(0, Math.min(delta > 0 ? rank * 20 : 100, value + delta));
}

export function dignityLabel(value: number): string {
  return `ランク${dignityRank(value)}（数値${value}）`;
}
