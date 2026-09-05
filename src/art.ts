import type {
  Axis,
  Job,
  MaterialId,
  PersonId,
  PlaceId,
  RecipeId,
} from "./game";
const base = import.meta.env.BASE_URL;
export const heroSrc = `${base}art/hero.png`;
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
