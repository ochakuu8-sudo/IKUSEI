import { artAssetSrc, backgroundSrc, heroSrc, placeSrc } from "../art";
import type { PlaceId, SceneLine } from "../game";
import { sceneArtwork, type SceneArtwork } from "../sceneArt";

export type SceneVisual = {
  place: PlaceId;
  background: string;
  portrait: string;
  image?: string;
  anchor: "left" | "center" | "right";
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
    portrait: art.portrait ? artAssetSrc(art.portrait) : heroSrc,
    image: art.image ? artAssetSrc(art.image) : undefined,
    anchor: art.anchor ?? "left",
    fit: art.fit ?? "contain",
    focus: art.focus ?? "50% 50%",
    subtitle: art.subtitle ?? "bottom",
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

/** 壊れたCGは背景＋立ち絵へ戻す。読み込みを終えてから画面を切り替える。 */
export async function prepareVisual(visual: SceneVisual): Promise<SceneVisual> {
  const [cg, bg, portrait] = await Promise.all([
    visual.image ? loadImage(visual.image) : false,
    loadImage(visual.background),
    loadImage(visual.portrait),
  ]);
  const background = bg ? visual.background : backgroundSrc("study-v1");
  const portraitSrc = portrait ? visual.portrait : heroSrc;
  if (!bg || !portrait)
    await Promise.all([loadImage(background), loadImage(portraitSrc)]);
  return {
    ...visual,
    background,
    portrait: portraitSrc,
    image: cg ? visual.image : undefined,
  };
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
