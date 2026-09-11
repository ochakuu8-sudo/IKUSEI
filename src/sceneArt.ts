import type { PlaceId } from "./game";

/** 一枚絵を登録する。image は public/art/ 内の相対パス。既定は全面 cover、字幕は下端。 */
export type SceneArtwork = {
  image?: string;
  background?: PlaceId;
  /** @deprecated 旧データ互換用。ノベルでは立ち絵を描画しない。 */
  portrait?: string;
  anchor?: "left" | "center" | "right";
  fit?: "contain" | "cover";
  focus?: string;
  /** @deprecated 字幕は下端へ固定。 */
  subtitle?: "bottom" | "top";
};

/** SceneEntry.image は発注名。ここへの登録で初めて通常再生・回想に採用する。 */
export const sceneArtwork: Record<string, SceneArtwork> = { "chapter.home": { background: "estate" } };
