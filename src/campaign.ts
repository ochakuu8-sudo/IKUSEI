import type { DailyState } from "./daily";
import type { Job, PersonId } from "./game";

export type ChapterDefinition = {
  title: string;
  jobIds: string[];
  people: PersonId[];
  alwaysOfferIds?: string[];
  rotatingOfferIds?: string[];
  events: { id: string; title: string; person: PersonId; scenarioId: string; afterDay: number; afterSettlement?: boolean }[];
};

/** 配信済みの章だけ登録する。続編は章データを追加し、既存の保存位置から再開する。 */
export const campaignChapters: Record<number, ChapterDefinition> = {
  1: {
    title: "最初の返済",
    jobIds: ["ch1-ledger", "ch1-library", "ch1-negotiation", "ch1-research", "ch1-vernet-promise", "ch1-claire-promise"],
    people: ["vernet", "claire"],
    alwaysOfferIds: ["ch1-ledger", "ch1-library"],
    rotatingOfferIds: ["ch1-negotiation", "ch1-research"],
    events: [
      { id: "ch1.intro", title: "最初の手紙", person: "vernet", scenarioId: "ch1.intro", afterDay: 0 },
      { id: "ch1.promise", title: "七日目の約束", person: "claire", scenarioId: "ch1.promise", afterDay: 7 },
      { id: "ch1.ending", title: "次の手紙", person: "vernet", scenarioId: "ch1.ending", afterDay: 14, afterSettlement: true },
    ],
  },
};

export const chapterAvailable = (s: DailyState) => !!campaignChapters[s.chapter] && !s.ended;
export const chapterJobIds = (s: DailyState) => campaignChapters[s.chapter]?.jobIds ?? [];
export const isChapterOneRecord = (scenarioId: string) => scenarioId.startsWith("ch1.");

/** 夜の物語は昼の行動枠を使わない。完了フラグはADVの保存と同時に確定する。 */
export function pendingStoryEvent(s: DailyState): Job | undefined {
  if (s.activeSession) return undefined;
  for (const [chapter, definition] of Object.entries(campaignChapters)) {
    const number = Number(chapter);
    for (const event of definition.events) {
      if (s.storyFlags[event.id + ".done"]) continue;
      const due = event.afterSettlement
        ? s.chapterResults.some(r => r.chapter === number)
        : s.chapter === number && (s.day > event.afterDay || s.awaitingSettlement);
      if (!due) continue;
      return { id: event.id, title: event.title, person: event.person, scenarioId: event.scenarioId,
        storyEvent: true, kind: "実務", category: "ordinary", cadence: "once", pay: 0, stamina: 0,
        needs: {}, costs: [], bond: 0, description: "" };
    }
  }
}
