/** Provisional tuning is data, independent from the story and engine. */
export const growthDefinitions = [
  { id: "negotiation", label: "交渉", description: "利害を調整し、取り決めを作る力", thresholds: [0, 2, 5, 9], hint: "仲介や条件調整の役割で育つ" },
  { id: "knowledge", label: "知見", description: "世間の仕組みを知り、事情を理解する力", thresholds: [0, 2, 5, 9], hint: "調査や文書の確認で育つ" },
  { id: "courage", label: "胆力", description: "圧力や緊張の中でも行動を貫く強さ", thresholds: [0, 2, 5, 9], hint: "難しい対応や責任ある役割で育つ" },
  { id: "charm", label: "魅力", description: "人の関心を引き、関わりたいと思わせる力", thresholds: [0, 2, 5, 9], hint: "接客や人前に立つ役割で育つ" },
];
export const growthOf = (id: string) => growthDefinitions.find(d => d.id === id);
export function initialGrowth(): Record<string, number> {
  return Object.fromEntries(growthDefinitions.map(d => [d.id, 0]));
}
export function rankOf(id: string, xp: number): number {
  const d = growthOf(id);
  if (!d || !Number.isInteger(xp) || xp < 0 || xp > d.thresholds.at(-1)!) throw new Error("不正な成長値: " + id);
  return d.thresholds.filter(n => xp >= n).length - 1;
}
export function growthLabel(id: string, xp: number) {
  const d = growthOf(id);
  if (!d) return "未登録の成長項目";
  const rank = rankOf(id, xp);
  return d.label + " " + rank + "段階（" + xp + " / " + (d.thresholds[rank + 1] ?? xp) + "経験" + (rank === d.thresholds.length - 1 ? "・上限" : "") + "）";
}
