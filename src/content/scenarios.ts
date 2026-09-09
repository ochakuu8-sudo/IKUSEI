import { debugScenarios } from "./debug";
import type { Scenario } from "../adv/types";

/** 通常開始・旧検証セーブとも同じ本編データを使う。人物・台本の差替えはここへ登録する。 */
export const scenarios: Scenario[] = [...debugScenarios];
