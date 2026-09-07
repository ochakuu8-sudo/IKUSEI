import type { SceneLine } from "../game";

export const READ_SCENES_KEY = "ikusei-read-scenes-v1";
export function loadReadScenes(storage: Pick<Storage, "getItem">): string[] {
  try {
    const value = JSON.parse(storage.getItem(READ_SCENES_KEY) ?? "[]");
    return Array.isArray(value)
      ? value.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}
export function recordReadScene(
  storage: Pick<Storage, "getItem" | "setItem">,
  id?: string,
) {
  if (!id) return;
  try {
    storage.setItem(
      READ_SCENES_KEY,
      JSON.stringify([...new Set([...loadReadScenes(storage), id])]),
    );
  } catch {
    /* Missing read metadata safely makes a scene unread on the next visit. */
  }
}
export function sceneRange(
  lines: SceneLine[],
  index: number,
  initialId?: string,
) {
  let id = initialId,
    start = 0;
  for (let i = 0; i <= index; i++)
    if (lines[i]?.sceneId && lines[i].sceneId !== id) {
      id = lines[i].sceneId;
      start = i;
    }
  let end = index + 1;
  while (
    end < lines.length &&
    (!lines[end].sceneId || lines[end].sceneId === id)
  )
    end++;
  return { id, start, end };
}
