import type { MaterialId, PersonId, RecipeId } from './game';

export type Requirement =
  | { kind: 'relation'; person: PersonId; level: number }
  | { kind: 'capability'; id: string }
  | { kind: 'fulfilled'; count: number };
export type DeliveryOption = {
  id: string; label: string; recipe: RecipeId; count: number;
  days: number; stamina: number; unlocks: string[];
};
export type SupportOffer = {
  id: string; title: string; person: PersonId;
  kind: 'advance' | 'credit'; description: string;
  opens: number; closes: number; term: number; acceptDays: number;
  money: number; materials: Partial<Record<MaterialId, number>>;
  totalPay: number; repayment: number; options: DeliveryOption[];
  requirements: Requirement[]; unlocks: string[];
  extensionDays: number; extensionLimit: number;
};
export type Obligation = {
  id: string; offerId: string; acceptedDay: number; due: number;
  status: 'active' | 'fulfilled' | 'cancelled' | 'defaulted';
  outstanding: number; extensions: number;
  terms: SupportOffer;
};
export type SupportState = {
  saveVersion: 8;
  obligations: Obligation[];
  offerStates: Record<string, 'accepted' | 'declined'>;
  capabilities: string[];
  history: { day: number; kind: string; target: string; choice?: string }[];
};
export const emptySupportState = (): SupportState => ({
  saveVersion: 8, obligations: [], offerStates: {}, capabilities: [], history: [],
});
