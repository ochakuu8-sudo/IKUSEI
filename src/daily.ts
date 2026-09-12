/**
 * 1日 = 1行動の本体（GAME_DESIGN.md §3〜§6）。
 *
 * ── なぜ作り直したか ──
 * v13は「採集→仕入れ→調合→納品」の生産ラインを1日に収めるため、スタミナ制で
 * 1日に2〜4回行動できる形にしていた。**選択の重さは1日にできる回数に反比例する**ので、
 * 決定が「重い1回」から「軽い3回」へ薄まり、企画書の中心（毎日どれを差し出すか）が消えていた。
 * ここでは生産ラインを捨て、企画書の形に戻す。
 *
 * - 毎日3件が提示される。母集団は現在の三軸で決まる（`needs` / `opensBelow`）
 * - 加えて「今日は受けない」。何も払わず、体力が戻り、1日だけを失う（§6）
 * - 依頼ごとの代償は固定。受注時に選ばせない（上乗せは廃止済み）
 * - 体力は日をまたいで持ち越し、休んだ日にだけ戻る。足りない資源は日数のほう（§1-5）
 *
 * 依頼・人物・台本のデータは `game.ts` をそのまま使う。ここが持つのは状態遷移だけ。
 */
import {
  axes,
  axisStage,
  materialOf,
  CHAPTER_DAYS,
  CHAPTERS,
  DAILY_UPKEEP,
  jobs,
  LATE_INTEREST,
  LATE_PENALTY,
  MAX_STAMINA,
  people,
  personOf,
  recipeOf,
  QUOTAS,
  RECENT_WINDOW,
  relationStage,
  sceneScript,
  stageUpLine,
  type Axis,
  type Job,
  type PersonId,
  type SceneLine,
} from "./game";

import { changeDignity, dignityRank } from "./dignity";
import { initialGrowth } from "./adv/growth";
import { evaluateCondition } from "./adv/conditions";
import type { ActiveSession, ReplayRecord, Quote } from "./adv/types";
import { campaignChapters, chapterAvailable, chapterJobIds, pendingStoryEvent } from "./campaign";
export const SAVE_VERSION = 16;
/** 休んだ翌朝の回復。尊厳は同ランク内のみ。威厳はその日に削っていなければ。 */
export const DAILY_DIGNITY_RECOVERY = 6;
export const DAILY_PRESTIGE_RECOVERY = 2;
const FATIGUE_RATE = [1, 0.82, 0.68, 0.58];
/** 一日の提示上限。現在の体験版は基礎2件＋日替わり/約束の1件。 */
export const OFFERS_PER_DAY = 3;

export type ChapterResult = { chapter: number; quota: number; paid: number; shortfall: number; interest: number };
export type DailyState = {
  /** 精算は一度だけ。続編待機中にも返済明細を保持する。 */
  chapterResults: ChapterResult[];
  growthXP: Record<string, number>;
  storyFlags: Record<string, boolean>;
  capabilities: string[];
  /** 旧セーブ互換用。依頼・シナリオの振り分けには使用しない。 */
  debugMode: boolean;
  recordings: ReplayRecord[];
  activeSession?: ActiveSession;
  saveVersion: number;
  runId: string;
  chapter: number;
  day: number;
  /** 前章の未達分（利息込み）。今章のノルマに上乗せされる。 */
  carryOver: number;
  awaitingSettlement: boolean;
  ended: boolean;
  money: number;
  debt: number;
  /** 日をまたいで持ち越す。休んだ日にだけ満タンに戻る。 */
  stamina: number;
  axes: Record<Axis, number>;
  relations: Record<PersonId, number>;
  unlocked: PersonId[];
  /** 直近に受けた相手（新しい順）。同じ人に通い詰めると買い叩かれる。 */
  recent: (PersonId | "none")[];
  /** 一度でも提示された依頼。閉じたあとも跡として残す（§5）。 */
  seen: string[];
  doneOnce: string[];
  doneChapter: string[];
  log: string[];
  revision: number;
};

export type AxisMove = {
  axis: Axis;
  amount: number;
  before: number;
  after: number;
};

/** その日の屋敷の維持費。払えた額と、払えずに借金へ回った額を分けて持つ。 */
export type UpkeepCharge = { due: number; paid: number; unpaid: number };

/** 1日の結果。結果画面がそのまま読める形で持つ（§10）。 */
export type DayOutcome = {
  growthGains?: { id: string; before: number; after: number }[];
  bonusMoney?: number;
  /** 章末精算の日には無い。1日を使った行動にだけ付く。 */
  upkeep?: UpkeepCharge;
  choiceAxisMoves?: AxisMove[];
  kind: "job" | "rest" | "settle" | "story";
  title: string;
  person?: PersonId;
  scene: SceneLine[];
  /** この行動で見た場面のid（`src/scenes.ts` の目録に対応）。回想に記録する。 */
  sceneIds: string[];
  listPrice: number;
  pay: number;
  fatigueRate: number;
  drops: AxisMove[];
  gains: AxisMove[];
  staminaDelta: number;
  relationUp?: { name: string; stage: string };
  /** この行動のせいで、もう紹介されなくなった依頼（§5「跡を残す」）。 */
  closedNow: { title: string; axis: Axis }[];
  notices: string[];
};

export type DailyAction =
  | { type: "take"; job: string }
  | { type: "rest" }
  | { type: "settle" };

export type DailyResult = {
  state: DailyState;
  outcome?: DayOutcome;
  error?: string;
};

/* ================= 依頼が開いているか ================= */

const meetsNeeds = (job: Job, s: DailyState) =>
  axes.every((a) => dignityRank(s.axes[a]) >= (job.needs[a] ?? 0));

/** まだ落ちきっておらず、回ってこない依頼か（裏の仕事）。 */
const notYetFallen = (job: Job, s: DailyState) =>
  !!job.opensBelow &&
  axes.some((a) => {
    const line = job.opensBelow?.[a];
    return line !== undefined && dignityRank(s.axes[a]) > line;
  });

const personReady = (job: Job, s: DailyState) =>
  !personOf(job.person).requiresUnlock || s.unlocked.includes(job.person);

/** 回数の制限。調剤と雑務は何度でも、それ以外は章に1回か1プレイに1回。 */
export function cadenceReason(job: Job, s: DailyState): string | null {
  if (job.cadence === "once" && s.doneOnce.includes(job.id))
    return "この依頼は一度きり";
  if (job.cadence === "chapter" && s.doneChapter.includes(job.id))
    return "今章は済んでいる";
  return null;
}

/** いま紹介されるか。上の仕事は尊厳で閉じ、裏の仕事は落ちて初めて開く。 */
export function isOpen(job: Job, s: DailyState): boolean {
  return (
    s.day >= (job.availableFromDay ?? 1) && s.day <= (job.availableUntilDay ?? CHAPTER_DAYS) &&
    (!job.requiresCapability || s.capabilities.includes(job.requiresCapability)) &&
    (job.requiresStoryFlags ?? []).every(id => s.storyFlags[id] === true) &&
    (job.forbidsStoryFlags ?? []).every(id => s.storyFlags[id] !== true) &&
    evaluateCondition(job.entryCondition, s).ok &&
    personReady(job, s) &&
    meetsNeeds(job, s) &&
    !notYetFallen(job, s) &&
    !cadenceReason(job, s)
  );
}

/** 尊厳が足りずに閉じた軸。跡の表示に使う。 */
export function closedBy(job: Job, s: DailyState): Axis[] {
  return axes.filter((a) => dignityRank(s.axes[a]) < (job.needs[a] ?? 0));
}

/**
 * 一度は提示されたのに、**尊厳が足りずに**紹介されなくなった依頼。消さずに残す（§5）。
 * 章に1回・1プレイに1回の依頼は、済んだだけで失われてはいないので跡に混ぜない。
 */
export function tracesOf(s: DailyState) {
  return jobs
    .filter(
      (j) => chapterJobIds(s).includes(j.id) && s.seen.includes(j.id) && !isOpen(j, s) && !cadenceReason(j, s),
    )
    .map((j) => ({
      job: j,
      reason:
        closedBy(j, s)
          .map((a) => `${a}が足りない`)
          .join("・") || "いまは回ってこない",
    }));
}

/* ================= 今日の3件 ================= */

/** 文字列から作る決定的な乱数。読み込み直しても同じ3件が出る。 */
function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 100000) / 100000;
  };
}

/** 公開した章の依頼だけ提示。受付・尊厳などの条件を満たす候補から選ぶ。 */
export function offersOf(s: DailyState): Job[] {
  if (!chapterAvailable(s) || s.awaitingSettlement || pendingStoryEvent(s)) return [];
  const definition = campaignChapters[s.chapter];
  const pool = jobs.filter((j) => definition.jobIds.includes(j.id) && isOpen(j, s));
  if (definition.alwaysOfferIds) {
    const fixed = definition.alwaysOfferIds.flatMap(id => pool.filter(j => j.id === id));
    const rotation = definition.rotatingOfferIds ?? [];
    const promised = pool.find(j => !definition.alwaysOfferIds!.includes(j.id) && !rotation.includes(j.id));
    const rotating = pool.find(j => j.id === rotation[(s.day - 1) % Math.max(1, rotation.length)]);
    return [...fixed, ...((promised ?? rotating) ? [promised ?? rotating!] : [])].slice(0, OFFERS_PER_DAY);
  }
  const rand = seeded(`${s.runId}:${s.chapter}:${s.day}`);
  const shuffled = pool
    .map((job) => ({ job, k: rand() }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.job);
  /* 同じ相手ばかりの日にならないよう、先に相手を散らしてから足りない分を足す。 */
  const picked: Job[] = [];
  // Explicitly scheduled follow-ups precede ordinary random offers.
  for (const job of [...shuffled].filter(j => (j.offerPriority ?? 0) > 0).sort((a, b) => (b.offerPriority ?? 0) - (a.offerPriority ?? 0)))
    if (picked.length < OFFERS_PER_DAY) picked.push(job);
  for (const job of shuffled)
    if (
      picked.length < OFFERS_PER_DAY &&
      !picked.includes(job) &&
      !picked.some((p) => p.person === job.person)
    )
      picked.push(job);
  for (const job of shuffled)
    if (picked.length < OFFERS_PER_DAY && !picked.includes(job))
      picked.push(job);
  return picked;
}

/**
 * 調剤の依頼だけは、旧設計で「素材を買って調合してから納める」前提の数字だった。
 * 生産ラインを畳んだので、その素材費と調合の体力を依頼そのものに畳み込む。
 * 数値を作り直したのではなく、旧レシピのデータから機械的に導いている
 * （買えない素材＝竜涎は自分で都合をつけるものとして0円で数える）。
 */
export function materialCostOf(job: Job): number {
  if (!job.recipe) return 0;
  const recipe = recipeOf(job.recipe);
  const per = Object.entries(recipe.needs).reduce(
    (sum, [m, n]) => sum + (materialOf(m as never).buy ?? 0) * (n ?? 0),
    0,
  );
  return per * (job.count ?? 1);
}
/** 実際に要る体力。調剤は調合のぶんを足す。 */
export function staminaOf(job: Job): number {
  return (
    job.stamina +
    (job.recipe ? recipeOf(job.recipe).stamina * (job.count ?? 1) : 0)
  );
}

export const fatigueCount = (person: PersonId, s: DailyState) =>
  s.recent.slice(0, RECENT_WINDOW).filter((x) => x === person).length;
export const fatigueRateOf = (person: PersonId, s: DailyState) =>
  FATIGUE_RATE[Math.min(fatigueCount(person, s), FATIGUE_RATE.length - 1)];
export const listPriceOf = (job: Job, s: DailyState) =>
  job.pay + s.relations[job.person] * 25;
/** 手取り。調剤は素材を自腹で買うので、そのぶん利幅が薄い。 */
export const payOf = (job: Job, s: DailyState) =>
  Math.max(
    0,
    Math.round(listPriceOf(job, s) * fatigueRateOf(job.person, s)) -
      materialCostOf(job),
  );

export const hasStaminaFor = (job: Job, s: DailyState) =>
  s.stamina >= staminaOf(job);

/** 受けられない理由。無ければ null。 */
export function takeReason(job: Job, s: DailyState): string | null {
  if (s.activeSession) return "進行中の依頼を終えてください";
  if (!chapterAvailable(s)) return "この先の章は、まだ公開されていません";
  if (pendingStoryEvent(s)) return "届いた手紙を読んでください";
  if (!chapterJobIds(s).includes(job.id)) return "この章には収録されていない依頼です";
  if (s.ended || s.awaitingSettlement) return "今日はもう動けません";
  if (!isOpen(job, s))
    return (
      cadenceReason(job, s) ||
      closedBy(job, s)
        .map((a) => `${a}が足りない`)
        .join("・") ||
      (notYetFallen(job, s) ? "まだ回ってこない" : "紹介されていない相手")
    );
  if (!hasStaminaFor(job, s))
    return `体力が${staminaOf(job) - s.stamina}足りない`;
  return null;
}

export const quotaOf = (s: DailyState) =>
  QUOTAS[Math.min(s.chapter, QUOTAS.length) - 1] + s.carryOver;

/* ================= 状態遷移 ================= */

export function freshDaily(runId = `run-${Date.now()}`): DailyState {
  return {
    chapterResults: [],
    growthXP: initialGrowth(),
    storyFlags: {},
    capabilities: [],
    debugMode: false,
    recordings: [],
    saveVersion: SAVE_VERSION,
    runId,
    chapter: 1,
    day: 1,
    carryOver: 0,
    awaitingSettlement: false,
    ended: false,
    money: 120,
    debt: QUOTAS.reduce((a, b) => a + b, 0),
    stamina: MAX_STAMINA,
    axes: { 貞操: 100, 品位: 100, 威厳: 100 },
    relations: Object.fromEntries(people.map((p) => [p.id, 0])) as Record<
      PersonId,
      number
    >,
    unlocked: [],
    recent: [],
    seen: [],
    doneOnce: [],
    doneChapter: [],
    log: [],
    revision: 0,
  };
}

/** 翌朝の回復。品位・威厳は同ランク内だけ戻る。威厳を削った日は威厳回復なし。 */
function recover(s: DailyState, lostPrestige: boolean): AxisMove[] {
  const moves: AxisMove[] = [];
  const dignity = changeDignity(s.axes.品位, DAILY_DIGNITY_RECOVERY);
  if (dignity > s.axes.品位) {
    moves.push({
      axis: "品位",
      amount: dignity - s.axes.品位,
      before: s.axes.品位,
      after: dignity,
    });
    s.axes.品位 = dignity;
  }
  if (!lostPrestige) {
    const prestige = changeDignity(s.axes.威厳, DAILY_PRESTIGE_RECOVERY);
    if (prestige > s.axes.威厳) {
      moves.push({
        axis: "威厳",
        amount: prestige - s.axes.威厳,
        before: s.axes.威厳,
        after: prestige,
      });
      s.axes.威厳 = prestige;
    }
  }
  return moves;
}

/** 払えなかったときだけ知らせる。払えた額は結果画面が明細で見せる。 */
function upkeepNotices(upkeep: UpkeepCharge): string[] {
  return upkeep.unpaid
    ? [`維持費が${upkeep.unpaid.toLocaleString()}G足りず、借金に積まれた`]
    : [];
}

/**
 * 一日ぶんの維持費。その日の稼ぎで払い、足りない分は借金へ積む。
 * 尊厳には触れない。未払いの扱いを尊厳へ繋ぐかは、代償のある依頼と併せて別に決める。
 */
function chargeUpkeep(s: DailyState): UpkeepCharge {
  const due = DAILY_UPKEEP;
  const paid = Math.min(s.money, due);
  const unpaid = due - paid;
  s.money -= paid;
  if (unpaid) s.debt = Math.min(9_999_999, s.debt + unpaid);
  return { due, paid, unpaid };
}

/** 日を1つ進める。14日目を終えたら章末精算を待つ。 */
function advance(s: DailyState) {
  if (s.day >= CHAPTER_DAYS) s.awaitingSettlement = true;
  else s.day++;
}

export function dailyAction(
  state: DailyState,
  action: DailyAction,
): DailyResult {
  const s: DailyState = structuredClone(state);
  if (s.activeSession) return { state, error: "進行中の依頼を終えてください" };
  if (!chapterAvailable(s)) return { state, error: "この先の章は、まだ公開されていません" };
  if (pendingStoryEvent(s)) return { state, error: "届いた手紙を読んでください" };
  const openBefore = jobs.filter((j) => isOpen(j, state));

  if (action.type === "settle") {
    if (!s.awaitingSettlement)
      return { state, error: "まだ章末ではありません" };
    const quota = quotaOf(s);
    const paid = Math.min(s.money, quota);
    const shortfall = quota - paid;
    const interest = shortfall > 0 ? Math.ceil(shortfall * LATE_INTEREST) : 0;
    const drops: AxisMove[] = [];
    s.money -= paid;
    s.debt = Math.max(0, s.debt - paid) + interest;
    s.carryOver = shortfall + interest;
    s.chapterResults = [...s.chapterResults.filter(r => r.chapter !== state.chapter), { chapter: state.chapter, quota, paid, shortfall, interest }];
    if (shortfall > 0)
      for (const p of LATE_PENALTY) {
        const before = s.axes[p.axis];
        s.axes[p.axis] = Math.max(0, before - p.amount);
        drops.push({
          axis: p.axis,
          amount: p.amount,
          before,
          after: s.axes[p.axis],
        });
      }
    s.awaitingSettlement = false;
    const finished = s.chapter >= CHAPTERS;
    if (finished) s.ended = true;
    else {
      s.chapter++;
      s.day = 1;
      s.stamina = MAX_STAMINA;
      s.doneChapter = [];
    }
    s.log = [
      shortfall > 0
        ? `第${state.chapter}章 章末。${paid.toLocaleString()}Gを納めたが、${shortfall.toLocaleString()}G足りなかった。`
        : `第${state.chapter}章 章末。${paid.toLocaleString()}Gを納めた。`,
      ...s.log,
    ].slice(0, 12);
    s.revision++;
    return {
      state: s,
      outcome: {
        kind: "settle",
        title: `第${state.chapter}章 章末`,
        scene: [],
        sceneIds: [],
        listPrice: quota,
        pay: -paid,
        fatigueRate: 1,
        drops,
        gains: [],
        staminaDelta: 0,
        closedNow: closedSince(openBefore, s),
        notices: [
          `返済 ${paid.toLocaleString()}G`,
          shortfall > 0
            ? `不足 ${shortfall.toLocaleString()}G ／ 利息 ${interest.toLocaleString()}G`
            : "今章のぶんは納めた",
        ],
      },
    };
  }

  if (s.ended || s.awaitingSettlement)
    return { state, error: "今日はもう動けません" };

  if (action.type === "rest") {
    const staminaBefore = s.stamina;
    s.stamina = MAX_STAMINA;
    s.recent = ["none" as const, ...s.recent].slice(0, RECENT_WINDOW);
    const gains = recover(s, false);
    const upkeep = chargeUpkeep(s);
    advance(s);
    s.log = [
      `${state.day}日目。今日は何も受けなかった（維持費 ${upkeep.due.toLocaleString()}G）。`,
      ...s.log,
    ].slice(0, 12);
    s.revision++;
    return {
      state: s,
      outcome: {
        kind: "rest",
        title: "今日は受けない",
        scene: [],
        sceneIds: [],
        listPrice: 0,
        pay: 0,
        fatigueRate: 1,
        drops: [],
        gains,
        staminaDelta: s.stamina - staminaBefore,
        closedNow: closedSince(openBefore, s),
        upkeep,
        notices: [
          "1日を使った。体力は戻った。",
          ...upkeepNotices(upkeep),
        ],
      },
    };
  }

  const job = jobs.find((j) => j.id === action.job);
  if (!job) return { state, error: "依頼が見つかりません" };
  const reason = takeReason(job, s);
  if (reason) return { state, error: reason };

  return settleJob(s, job);
}

/** Internal finalization primitive. The ADV engine owns eligibility and exactly-once execution. */
export function settleJob(state: DailyState, job: Job, quote?: Quote, lostPrestige = false): DailyResult {
  const s = structuredClone(state);
  delete s.activeSession;
  const openBefore = jobs.filter(j => isOpen(j, state));
  const notices: string[] = [];

  const listPrice = quote?.listPrice ?? listPriceOf(job, s);
  const rate = quote?.fatigueRate ?? fatigueRateOf(job.person, s);
  const pay = quote?.pay ?? payOf(job, s);
  const drops: AxisMove[] = [];
  for (const c of job.costs) {
    const before = s.axes[c.axis];
    s.axes[c.axis] = Math.max(0, before - c.amount);
    drops.push({
      axis: c.axis,
      amount: c.amount,
      before,
      after: s.axes[c.axis],
    });
  }
  s.money += pay;
  s.stamina -= staminaOf(job);

  const before = s.relations[job.person];
  s.relations[job.person] = Math.min(3, before + (job.bond ?? 1));
  const relationUp =
    s.relations[job.person] > before && s.relations[job.person] <= 3
      ? {
          name: personOf(job.person).name,
          stage: relationStage(s.relations[job.person]),
        }
      : undefined;

  /* 薬の納品をきっかけに薬師を紹介される。生産ラインは無くても筋は同じ。 */
  if (job.kind === "調剤" && !s.unlocked.includes("herbalist")) {
    s.unlocked.push("herbalist");
    notices.push("紹介：紹介された薬師");
  }
  if (job.cadence === "once") s.doneOnce.push(job.id);
  if (job.cadence === "chapter") s.doneChapter.push(job.id);
  s.recent = [job.person, ...s.recent].slice(0, RECENT_WINDOW);

  const scene: SceneLine[] = [
    ...sceneScript({
      title: job.title,
      person: job.person,
      costs: job.costs,
      /* 品の格で場面が変わる。生産ラインは無くても、納める物の格は残っている。 */
      recipe: job.recipe,
    }).map((line) => ({ ...line, sceneId: `job:${job.id}` })),
    ...stageUpLine(job.person, before, s.relations[job.person]).map((line) => ({
      ...line,
      sceneId: `bond:${job.person}:${s.relations[job.person]}`,
    })),
  ];
  /* 見た場面を目録のidで控える。回想と、CGの発注の突き合わせに使う。 */
  const sceneIds = [`job:${job.id}`];
  if (relationUp)
    sceneIds.push(`bond:${job.person}:${s.relations[job.person]}`);
  const gains = recover(
    s,
    lostPrestige || job.costs.some((c) => c.axis === "威厳"),
  );
  const upkeep = chargeUpkeep(s);
  notices.push(...upkeepNotices(upkeep));
  advance(s);
  s.log = [
    `${state.day}日目。${job.title}（${pay.toLocaleString()}G）。`,
    ...s.log,
  ].slice(0, 12);
  s.revision++;
  return {
    state: s,
    outcome: {
      kind: "job",
      title: job.title,
      person: job.person,
      scene,
      sceneIds,
      listPrice,
      pay,
      fatigueRate: rate,
      drops,
      gains,
      staminaDelta: -staminaOf(job),
      relationUp,
      closedNow: closedSince(openBefore, s),
      upkeep,
      notices,
    },
  };
}

/** この依頼を受けると閉じてしまう依頼。受ける前に見せる（§5「隠さない」）。 */
export function closingPreview(job: Job, s: DailyState) {
  const after = structuredClone(s);
  for (const c of job.costs)
    after.axes[c.axis] = Math.max(0, after.axes[c.axis] - c.amount);
  return jobs
    .filter((j) => chapterJobIds(s).includes(j.id) && j.id !== job.id && isOpen(j, s) && !isOpen(j, after))
    .map((j) => j.title);
}

/** その行動のせいで閉じた依頼。取り返しのつかなさを、その場で見せる（§5）。 */
export function closedSince(openBefore: Job[], after: DailyState) {
  return openBefore
    .filter((j) => chapterJobIds(after).includes(j.id) && !isOpen(j, after) && !cadenceReason(j, after))
    .map((j) => ({ title: j.title, axis: closedBy(j, after)[0] }))
    .filter((x): x is { title: string; axis: Axis } => !!x.axis);
}

/** 提示された依頼に跡を残すための記録。画面を開いたときに呼ぶ。 */
export function markSeen(s: DailyState, ids: string[]): DailyState {
  const add = ids.filter((id) => !s.seen.includes(id));
  return add.length ? { ...s, seen: [...s.seen, ...add] } : s;
}

/** 三軸の状態を言葉で。自室と結果画面が並べて教える。 */
export const stageWord = (axis: Axis, value: number) => axisStage(axis, value);
