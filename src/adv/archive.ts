import { validReplay } from "../saveV14";
import type { ReplayRecord } from "./types";
export const ADV_ARCHIVE_KEY = "ikusei-adv-archive-v1";
export function loadArchive(store: Storage): ReplayRecord[] {
  try {
    const raw: unknown = JSON.parse(store.getItem(ADV_ARCHIVE_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter(validReplay) : [];
  } catch { return []; }
}
export function syncArchive(store: Storage, records: ReplayRecord[]): ReplayRecord[] {
  const old = loadArchive(store);
  const merged = [...old, ...records.filter(r => !old.some(o => o.id === r.id))];
  if (merged.length !== old.length) store.setItem(ADV_ARCHIVE_KEY, JSON.stringify(merged));
  return merged;
}
