import type { Axis, GameState, MaterialId, RecipeId } from "./game";

export type Condition =
  | { kind: "questCompleted" | "recipeKnown" | "eventOccurred"; id: string }
  | { kind: "axisMin" | "axisMax"; axis: Axis; value: number };
export type Effect =
  | {
      kind:
        | "learnRecipe"
        | "introducePerson"
        | "introducePlace"
        | "enqueueEvent";
      id: string;
    }
  | { kind: "grantMaterials"; items: Partial<Record<MaterialId, number>> }
  | { kind: "axisDelta"; axis: Axis; amount: number }
  | { kind: "dignityCapDelta"; amount: number };
export type Need = {
  recipeId: RecipeId;
  count: number;
  baseUnitPrice: number;
  minQuality: number;
};
export type Quest = {
  id: string;
  contentVersion: number;
  title: string;
  description?: string;
  personId: string;
  deliveryPlaceId: string;
  mode: "repeat" | "contract";
  appearsDay: number;
  acceptWindow: [number, number] | null;
  deliveryWindow: [number, number] | null;
  requirements: Need[];
  introductionConditions: Condition[];
  staminaCost: number;
  qualityBonusBP: number;
  relationBasePoints: number;
  relationQualityBonusPoints: number;
  applyMarketFatigue: boolean;
  advanceMoney: number;
  cancelPolicy: string | null;
  onAcceptOnce: Effect[];
  onFirstComplete: Effect[];
  onEveryComplete: Effect[];
  normalResultText: string;
};
export type EventDefinition = {
  id: string;
  contentVersion: number;
  title: string;
  placeId: string;
  lines: string[];
  imageId: string | null;
  effects: Effect[];
};
export type ChapterEvent = {
  id: string;
  contentVersion: number;
  title: string;
  place: string;
  lines: string[];
  imageId: string | null;
  changes: string[];
};
export type QuestContract = {
  id: string;
  questId: string;
  acceptedDay: number;
  status: "active" | "fulfilled" | "cancelled" | "defaulted";
  terms: Quest;
  events: EventDefinition[];
};
export type Location = {
  id: string;
  name: string;
  kind: string;
  map: { x: number; y: number };
  introducedAtStart: boolean;
  accessConditions: Condition[];
  staminaCost?: number;
  majorDrops?: { materialId: MaterialId; min: number; max: number }[];
  bonusDrops?: {
    materialId: MaterialId;
    probabilityBP: number;
    count: number;
  }[];
  prices?: Partial<Record<MaterialId, number>>;
};
export type Stock = Partial<Record<RecipeId, Record<string, number>>>;
export type Allocation = Record<
  string,
  Partial<Record<RecipeId, Record<string, number>>>
>;
export type ChapterState = Omit<
  GameState,
  "saveVersion" | "stock" | "relations" | "today" | "recent" | "eventQueue"
> & {
  saveVersion: 13;
  runId: string;
  revision: number;
  contentVersion: string;
  recipeXP: Partial<Record<RecipeId, number>>;
  stockByQuality: Stock;
  relationPoints: Record<string, number>;
  dailyRelationBest: Record<string, number>;
  rngState: number;
  questCompletionCounts: Record<string, number>;
  acceptedQuestContracts: QuestContract[];
  declinedQuests: string[];
  initialGrantKeys: string[];
  occurredEvents: string[];
  introducedPeople: string[];
  introducedPlaces: string[];
  seenQuests: string[];
  eventQueue: ChapterEvent[];
  today: {
    worked: string[];
    relationGranted: string[];
    publicWork: boolean;
    deliveries: string[];
    earned: number;
  };
  recent: (string | string[])[];
};
export type ChapterAction = (
  | { type: "gather"; place: string }
  | { type: "buy"; place: string; basket: Partial<Record<MaterialId, number>> }
  | { type: "brew"; recipe: RecipeId; quantity?: number }
  | { type: "quest-accept" | "quest-decline"; quest: string }
  | { type: "quest-cancel"; id: string }
  | {
      type: "quest-deliver";
      ids: string[];
      allocation?: Allocation;
      priority?: "high" | "low";
    }
  | { type: "read-event"; id: string }
  | { type: "mark-seen"; ids: string[] }
  | { type: "end-day" | "settle" }
  | { type: "accept" | "decline"; offer: string }
  | { type: "pay" | "cancel" | "renegotiate"; id: string }
  | { type: "fulfill"; id: string; option: string }
) & { expectedRevision?: number };
export type ChapterOutcome = {
  state: ChapterState;
  error?: string;
  notices: string[];
  title: string;
};
