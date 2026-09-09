import { debugScenarios } from "./debug";
import type { Scenario } from "../adv/types";

/** Add/revise story data here; the progression engine does not branch on story IDs. */
export const scenarios: Scenario[] = [...debugScenarios];
