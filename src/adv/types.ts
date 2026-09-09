import type { Axis, Job, PersonId, SceneLine } from "../game";
import type { DailyState, DayOutcome } from "../daily";

export type ValueRef =
  | { kind: "skill"; id: string }
  | { kind: "axis"; id: Axis }
  | { kind: "relation"; personId: PersonId };
export type Condition =
  | { kind: "range"; value: ValueRef; min?: number; max?: number }
  | { kind: "all" | "any"; items: Condition[] }
  | { kind: "flag"; id: string; equals: boolean };
export type Effects = {
  bonusMoney?: number;
  growthXP?: Record<string, number>;
  axisDelta?: Partial<Record<Axis, number>>;
  dignityCapDrop?: number;
  relationDelta?: Partial<Record<PersonId, number>>;
  storyFlags?: Record<string, boolean>;
  grantCapabilities?: string[];
};
export type Choice = {
  id: string;
  text: string;
  condition?: Condition;
  hint?: string;
  effects?: Effects;
  next: string;
};
export type AdvNode =
  | { id: string; kind: "text"; lines: SceneLine[]; next: string }
  | { id: string; kind: "choice"; prompt: string; choices: Choice[] }
  | { id: string; kind: "end"; effects?: Effects };
export type Scenario = {
  id: string;
  version: number;
  entry: string;
  nodes: Record<string, AdvNode>;
};
export type Snapshot = Omit<DailyState, "activeSession">;
export type Quote = {
  pay: number;
  listPrice: number;
  fatigueRate: number;
};
export type TranscriptRow = SceneLine & { sceneId: string };
export type ReplayRecord = {
  id: string;
  title: string;
  person: PersonId;
  scenarioId: string;
  version: number;
  lines: TranscriptRow[];
  choices: { nodeId: string; choiceId: string; text: string }[];
};
export type ActiveSession = {
  id: string;
  revision: number;
  job: Job;
  scenario: Scenario;
  entrySnapshot: Snapshot;
  working: Snapshot;
  quote: Quote;
  nodeId: string;
  cursor: { line: number; offset: number; chars: number };
  phase: "playing" | "result";
  choices: ReplayRecord["choices"];
  transcript: TranscriptRow[];
  visited: string[];
  lostPrestige: boolean;
  outcome?: DayOutcome;
};
