import { artAssetSrc, backgroundSrc, placeSrc } from "../art";
import type { PlaceId, SceneLine } from "../game";
import { sceneArtwork, type SceneArtwork } from "../sceneArt";

export type SceneVisual = {
  place: PlaceId;
  background: string;
  image?: string;
  fit: "contain" | "cover";
  focus: string;
  subtitle: "bottom" | "top";
};

export function visualFor(
  sceneId: string | undefined,
  place: PlaceId,
  cue?: string,
): SceneVisual {
  const art: SceneArtwork = {
    ...sceneArtwork[sceneId ?? ""],
    ...sceneArtwork[cue ?? ""],
  };
  return {
    place: art.background ?? place,
    background: placeSrc(art.background ?? place),
    image: art.image ? artAssetSrc(art.image) : undefined,
    fit: art.fit ?? "cover",
    focus: art.focus ?? "50% 50%",
    subtitle: "bottom",
  };
}

const images = new Map<string, Promise<boolean>>();
function loadImage(src: string): Promise<boolean> {
  const cached = images.get(src);
  if (cached) return cached;
  const task = new Promise<boolean>((resolve) => {
    const img = new Image();
    const finish = (ok: boolean) => {
      clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      resolve(ok);
    };
    const timer = window.setTimeout(() => finish(false), 4500);
    img.onload = () => {
      void img.decode().then(
        () => finish(true),
        () => finish(img.naturalWidth > 0),
      );
    };
    img.onerror = () => finish(false);
    img.src = src;
  });
  images.set(src, task);
  return task;
}

/** 一枚絵を全面表示。未登録・読込失敗時は背景一枚で代替する。 */
export async function prepareVisual(visual: SceneVisual): Promise<SceneVisual> {
  const cg = visual.image ? await loadImage(visual.image) : false;
  if (cg) return visual;
  const bg = await loadImage(visual.background);
  const background = bg ? visual.background : backgroundSrc("study-v1");
  if (!bg) await loadImage(background);
  return { ...visual, background, image: undefined };
}

export function preloadScene(
  lines: SceneLine[],
  place: PlaceId,
  sceneId?: string,
) {
  const unique = new Map<string, SceneVisual>();
  let id = sceneId,
    cue: string | undefined;
  for (const line of lines) {
    if (line.sceneId && line.sceneId !== id) {
      id = line.sceneId;
      cue = undefined;
    }
    if (line.visual) cue = line.visual;
    const visual = visualFor(id, place, cue);
    unique.set(JSON.stringify(visual), visual);
  }
  return Promise.all([...unique.values()].map(prepareVisual));
}
