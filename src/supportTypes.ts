import type { MaterialId, PersonId, PlaceId, RecipeId, JobCost } from "./game";

export type CompletionReward =
  | { kind: "relation"; person: PersonId; amount: number }
  | { kind: "person"; id: PersonId }
  | { kind: "place"; id: PlaceId }
  | { kind: "event" | "capability"; id: string }
  | { kind: "recipe"; id: RecipeId };
export type StoryEvent = {
  id: string;
  title: string;
  place: PlaceId;
  lines: string[];
};

export type Requirement =
  | { kind: "relation"; person: PersonId; level: number }
  | { kind: "capability"; id: string }
  | { kind: "fulfilled"; count: number };
export type DeliveryOption = {
  id: string;
  label: string;
  recipe: RecipeId;
  count: number;
  days: number;
  stamina: number;
  unlocks: string[];
  costs?: JobCost[];
};
export type SupportOffer = {
  id: string;
  title: string;
  person: PersonId;
  kind: "advance" | "credit";
  description: string;
  opens: number;
  closes: number;
  term: number;
  acceptDays: number;
  money: number;
  materials: Partial<Record<MaterialId, number>>;
  totalPay: number;
  repayment: number;
  options: DeliveryOption[];
  requirements: Requirement[];
  unlocks: string[];
  extensionDays: number;
  extensionLimit: number;
  /** 存在する契約だけが通算日の指定日制。旧契約は従来どおり。 */
  schedule?: { appears: number; closes: number; delivery: number };
  rewards?: CompletionReward[];
};
export type Obligation = {
  id: string;
  offerId: string;
  acceptedDay: number;
  due: number;
  status: "active" | "fulfilled" | "cancelled" | "defaulted";
  outstanding: number;
  extensions: number;
  terms: SupportOffer;
};
export type SupportState = {
  saveVersion: 10;
  today: {
    worked: PersonId[];
    relationGranted: PersonId[];
    publicWork: boolean;
  };
  obligations: Obligation[];
  offerStates: Record<string, "accepted" | "declined">;
  capabilities: string[];
  unlockedPeople: PersonId[];
  unlockedPlaces: PlaceId[];
  newPeople: PersonId[];
  newPlaces: PlaceId[];
  newEvents: string[];
  eventQueue: StoryEvent[];
  playedEvents: string[];
  rewardedObligations: string[];
  personalRuns: Record<string, number>;
  history: { day: number; kind: string; target: string; choice?: string }[];
};
export const emptySupportState = (): SupportState => ({
  saveVersion: 10,
  today: { worked: [], relationGranted: [], publicWork: false },
  obligations: [],
  offerStates: {},
  capabilities: [],
  history: [],
  unlockedPeople: [],
  unlockedPlaces: [],
  newPeople: [],
  newPlaces: [],
  newEvents: [],
  eventQueue: [],
  playedEvents: [],
  rewardedObligations: [],
  personalRuns: {},
});
