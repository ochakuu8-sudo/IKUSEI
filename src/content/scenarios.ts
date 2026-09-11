import { debugScenarios } from "./debug";
import { chapterOneScenarios, chapterOneEnding } from "./chapterOne";
import type { Scenario } from "../adv/types";
import type { DailyState } from "../daily";

/** 旧IDは受諾済みセッションの互換用。通常の提示範囲はcampaign.tsで定める。 */
export const scenarios: Scenario[] = [...debugScenarios, ...chapterOneScenarios];
const builders: Record<string, (state: DailyState) => Scenario> = { "ch1.ending": chapterOneEnding };
export function resolveScenario(id: string, state: DailyState): Scenario | undefined {
  const authored = builders[id]?.(state) ?? scenarios.find(s => s.id === id);
  return authored && structuredClone(authored);
}
