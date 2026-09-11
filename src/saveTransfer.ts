import { parseDaily, validReplay } from "./saveV14";
import { sessionError } from "./adv/engine";
import type { DailyState } from "./daily";
import type { ReplayRecord } from "./adv/types";

export const MAX_SAVE_FILE_BYTES = 16 * 1024 * 1024;
export type SaveTransfer = { format: "ikusei-save"; version: 1; createdAt: string; state: DailyState; archive: ReplayRecord[] };

export function exportSave(state: DailyState, archive: ReplayRecord[], now = new Date().toISOString()): string {
  return JSON.stringify({ format: "ikusei-save", version: 1, createdAt: now, state, archive } satisfies SaveTransfer);
}
/** 外部ファイルは検証が済むまで既存の保存に触れない。HTMLやスクリプトとして扱わない。 */
export function importSave(text: string): SaveTransfer {
  if (new TextEncoder().encode(text).length > MAX_SAVE_FILE_BYTES) throw new Error("保存ファイルが大きすぎます（上限16MB）。");
  let raw;
  try { raw = JSON.parse(text); } catch { throw new Error("保存ファイルを読めませんでした。"); }
  if (!raw || raw.format !== "ikusei-save" || raw.version !== 1 || typeof raw.createdAt !== "string" || !raw.state || !Array.isArray(raw.archive) || !raw.archive.every(validReplay))
    throw new Error("対応するIKUSEIの保存ファイルではありません。");
  const state = parseDaily(JSON.stringify(raw.state));
  if (!state) throw new Error("進行の記録が壊れているため、読み込めません。");
  // parseDaily's forgiving legacy defaults are not suitable for silently changing an imported position.
  for (const key of ["chapter", "day", "money", "debt", "carryOver", "stamina", "revision", "awaitingSettlement", "ended"] as const)
    if (state[key] !== raw.state[key]) throw new Error("進行の数値が不正です。");
  if (state.activeSession && sessionError(state.activeSession)) throw new Error("途中の物語を再開できない保存です。");
  const outcome = state.activeSession?.outcome;
  if (outcome && (![outcome.pay, outcome.listPrice, outcome.staminaDelta, outcome.fatigueRate].every(Number.isFinite) || !["job", "rest", "settle", "story"].includes(outcome.kind)))
    throw new Error("結果の記録が不正です。");
  return { format: "ikusei-save", version: 1, createdAt: raw.createdAt, state, archive: raw.archive };
}
