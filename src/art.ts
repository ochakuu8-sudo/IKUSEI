import type {
  Axis,
  Job,
  MaterialId,
  PersonId,
  PlaceId,
  RecipeId,
} from "./game";
// CSS variables containing relative url() resolve against the stylesheet in assets/.
// Anchor public art to the document so both DOM images and CSS work in nested embeds.
const base = new URL(import.meta.env.BASE_URL, document.baseURI).href;
export const artAssetSrc = (path: string) => `${base}art/${path}`;
/** CSS materials share the same subpath-safe asset resolver as scene art. */
export const manorMaterialStyle = {
  "--paper-noble": `url("${artAssetSrc("ui/stylized/paper-noble-v3.webp")}")`,
  "--paper-academy": `url("${artAssetSrc("ui/stylized/paper-academy-v3.webp")}")`,
  "--paper-commerce": `url("${artAssetSrc("ui/stylized/paper-commerce-v3.webp")}")`,
  "--manor-wax": `url("${artAssetSrc("ui/stylized/wax-seal-v2.webp")}")`,
  "--manor-book": `url("${artAssetSrc("ui/stylized/ledger-book-v2.webp")}")`,
  "--manor-leather": `url("${artAssetSrc("ui/stylized/desk-leather-v2.webp")}")`,
};
export const heroSrc = `${base}art/ui/reform/hero.png`;
export const PLACEHOLDER = `${base}hero-key-visual.webp`;
export const backgroundSrc = (id: string) =>
  `${base}art/backgrounds/${["title", "home", "ending", "settlement"].includes(id) ? "estate" : id}.webp`;
export const placeSrc = (id: PlaceId) => backgroundSrc(id);
export const mapSrc = () => backgroundSrc("map");
export const itemSrc = (id: RecipeId | MaterialId) =>
  `${base}art/items/${id}.svg`;
export const personSrc = (id: PersonId) => `${base}art/crests/${id}.svg`;
export type PortraitStage = "intact" | "worn" | "fallen" | "ruined";
export function portraitStage(_axes: Record<Axis, number>): PortraitStage {
  return "intact";
}
export const portraitSrc = (_stage: PortraitStage) => heroSrc;
export const sceneSrc = (_job: Job, _axis: Axis | null) =>
  backgroundSrc("estate");
export const sceneFallbackSrc = (_job: Job) => backgroundSrc("estate");
