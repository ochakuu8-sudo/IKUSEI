import type { Job } from "../game";
import type { Scenario, Effects, Condition, AdvNode } from "../adv/types";
import { growthDefinitions } from "../adv/growth";

const range = (kind: "skill" | "axis", id: string, min?: number, max?: number): Condition =>
  ({ kind: "range", value: { kind, id } as never, ...(min === undefined ? {} : { min }), ...(max === undefined ? {} : { max }) });
const text = (id: string, body: string, next = "end"): AdvNode =>
  ({ id, kind: "text", lines: [{ speaker: "案内人", text: body }], next });
const end: AdvNode = { id: "end", kind: "end" };
const training: Scenario = {
  id: "debug.training", version: 1, entry: "intro",
  nodes: {
    intro: text("intro", "検証用の共同作業です。今日はどの役割を担当しますか。選んだ経験は、次の依頼で使えます。", "role"),
    role: { id: "role", kind: "choice", prompt: "今日の担当を選ぶ", choices: growthDefinitions.map(d => ({
      id: d.id, text: ({ negotiation: "取り決めの調整を手伝う", knowledge: "資料を調べる", courage: "難しい説明役を引き受ける", charm: "来客を案内する" } as Record<string, string>)[d.id],
      hint: d.hint, effects: { growthXP: { [d.id]: 2 } }, next: "done",
    })) },
    done: text("done", "担当した仕事を終えました。得た経験は依頼の終了時に記録されます。"),
    end,
  },
};
const challengeNodes: Record<string, AdvNode> = {
  intro: text("intro", "今の経験に応じて、違う役割を任せられます。必要条件はいつでも確認できます。通常の仕事だけで終えても構いません。", "role"),
  role: {
    id: "role", kind: "choice", prompt: "どの役割を引き受ける？",
    choices: [
      { id: "normal", text: "通常の仕事だけを終える", next: "normal" },
      ...growthDefinitions.map(d => ({
        id: d.id,
        text: ({ negotiation: "代理の交渉役を引き受ける", knowledge: "資料の背景を詳しく調べる", courage: "難しい提案を皆の前で伝える", charm: "来客との交流役を務める" } as Record<string, string>)[d.id],
        condition: range("skill", d.id, 1), hint: d.hint,
        effects: { bonusMoney: 30, storyFlags: { ["route." + d.id]: true } },
        next: d.id,
      })),
    ],
  },
  normal: text("normal", "通常の作業を終えました。新しい依頼への約束はしていません。"),
  end,
};
for (const d of growthDefinitions) challengeNodes[d.id] = text(d.id,
  d.id === "knowledge"
    ? "調べた結果、古い資料と新しい資料では前提が違うと分かりました。後日、整理の続きを頼まれます。"
    : d.label + "を使って、通常とは違う役割を担いました。この決定を受けて、後日あなただけの依頼が届きます。");
const challenge: Scenario = { id: "debug.challenge", version: 1, entry: "intro", nodes: challengeNodes };
const axesScenario: Scenario = {
  id: "debug.axes", version: 1, entry: "intro",
  nodes: {
    intro: text("intro", "状態変化と、変化直後の条件を確認する場面です。値は検証用です。", "change"),
    change: { id: "change", kind: "choice", prompt: "今回起こす変化を選ぶ", choices: [
      { id: "none", text: "今の状態のまま進む", next: "check" },
      ...(["貞操", "品位", "威厳"] as const).map(axis => ({
        id: ({ 貞操: "chastity", 品位: "dignity", 威厳: "prestige" })[axis],
        text: axis + "が変わる出来事を経験する",
        effects: { axisDelta: { [axis]: -40 }, ...(axis === "品位" ? { dignityCapDrop: 10 } : {}) } as Effects,
        next: "check",
      })),
      { id: "bond", text: "依頼主との約束を果たす", effects: { relationDelta: { marc: 1 } }, next: "check" },
      { id: "recover", text: "状態を立て直す機会を得る", effects: { axisDelta: { 貞操: 20, 品位: 20, 威厳: 20 } }, next: "check" },
    ] },
    check: { id: "check", kind: "choice", prompt: "変化後の条件を確認する", choices: [
      { id: "normal", text: "通常の報告をして終える", next: "end" },
      { id: "high", text: "家名を添えて挨拶する", condition: range("axis", "威厳", 76), next: "high" },
      { id: "low", text: "変化した立場で協力を申し出る", condition: range("axis", "威厳", undefined, 30), next: "low" },
      { id: "band", text: "今の評判について相談する", condition: range("axis", "威厳", 31, 75), next: "band" },
      { id: "all", text: "経験と信頼をもとに話を任せてもらう", condition: { kind: "all", items: [range("skill", "negotiation", 1), { kind: "range", value: { kind: "relation", personId: "marc" }, min: 1 }] }, next: "all" },
      { id: "any", text: "経験か家名を頼りに紹介を求める", condition: { kind: "any", items: [range("skill", "charm", 1), range("axis", "威厳", 76)] }, effects: { grantCapabilities: ["garden-orders"] }, next: "any" },
      { id: "chastityBand", text: "現在の自身の変化を振り返る", condition: range("axis", "貞操", undefined, 60), next: "band" },
      { id: "dignityBand", text: "今の扱いについて伝える", condition: range("axis", "品位", undefined, 60), next: "band" },
    ] },
    high: text("high", "家名が通用する状態での応対を記録しました。"),
    low: text("low", "名声を失った状態での応対を記録しました。経験は失われていません。"),
    band: text("band", "現在の状態に応じた応対を記録しました。"),
    all: text("all", "両方の条件が揃ったため、この役割を引き受けられました。"),
    any: text("any", "どちらか一方の条件を満たし、紹介を得ました。"),
    end,
  },
};
export const debugScenarios: Scenario[] = [training, challenge, axesScenario, ...growthDefinitions.map(d => ({
  id: "debug.followup." + d.id, version: 1, entry: "intro",
  nodes: {
    intro: text("intro", "先日の" + d.label + "を使った決定を受けて届いた依頼です。主人公の現在の名声だけで過去の約束は消えません。", "role"),
    role: { id: "role", kind: "choice" as const, prompt: "続きの仕事を選ぶ", choices: [
      { id: "finish", text: "約束した作業を完了する", effects: { growthXP: { [d.id]: 3 }, storyFlags: { ["completed." + d.id]: true } }, next: "done" },
      { id: "decline", text: "今回は続きを引き受けず、連絡だけ済ませる", next: "end" },
    ] },
    done: text("done", "先日の選択から続いた仕事を終えました。新たな経験が残ります。"),
    end,
  },
}))];
const job = (id: string, title: string, scenarioId: string, person: Job["person"], extra: Partial<Job> = {}): Job => ({
  id, title, scenarioId, person, kind: "実務", category: "ordinary", cadence: "repeat",
  pay: 80, stamina: 10, needs: {}, costs: [], debugOnly: true, description: "検証用の仮依頼。人物・本文・報酬は後から差し替えられます。",
  ...extra,
});
export const debugJobs: Job[] = [
  job("debug-training", "共同作業で経験を積む", training.id, "vernet", { offerPriority: 90, growthHint: "選んだ役割の経験 +2（交渉・知見・胆力・魅力）" }),
  job("debug-challenge", "経験を使って役割を選ぶ", challenge.id, "claire", { offerPriority: 80, growthHint: "各成長1段階で専用の役割。選択すると続きの依頼が届く" }),
  job("debug-axes", "状態と複合条件を確かめる", axesScenario.id, "marc", { growthHint: "尊厳・関係の変化、以上・以下・範囲・かつ・またはを確認" }),
  ...growthDefinitions.map(d => job("debug-followup-" + d.id, d.label + "を使った仕事の続き", "debug.followup." + d.id, "vernet", {
    offerPriority: 100, growthHint: "完了する役割： " + d.label + "経験 +3",
    requiresStoryFlags: ["route." + d.id], forbidsStoryFlags: ["completed." + d.id],
  })),
];
