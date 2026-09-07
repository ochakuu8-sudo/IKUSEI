import type { PlaceId } from "./game";

/** 採用済みの素材だけ登録する。image / portrait は public/art/ 内の相対パス。 */
export type SceneArtwork = {
  image?: string;
  background?: PlaceId;
  portrait?: string;
  anchor?: "left" | "center" | "right";
  fit?: "contain" | "cover";
  focus?: string;
  subtitle?: "bottom" | "top";
};

/** SceneEntry.image は発注名。ここへの登録で初めて通常再生・回想に採用する。 */
export const sceneArtwork: Record<string, SceneArtwork> = {};
