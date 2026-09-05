// ゲームのルールとデータ。画面(App.tsx)からは、ここが返す値を表示するだけにする。
// 数値の根拠は GAME_DESIGN.md。変更するときは企画書側と必ず揃える。

import type { SupportState } from "./supportTypes";
import { emptySupportState } from "./supportTypes";
export type Axis = "貞操" | "品位" | "威厳";
export type PlaceId =
  | "estate"
  | "arnaud"
  | "academy"
  | "valere"
  | "guild"
  | "hill"
  | "wood"
  | "backstreet"
  | "garden";

export const axes: Axis[] = ["貞操", "品位", "威厳"];

/* ================= 調剤 ── 素材とレシピ =================
   主軸。SYSTEM_PLAN.md §2。
   - レシピは金では買えない。人間関係と依頼の報酬でしか手に入らない
   - 素材は「買う（金）／採る（体力）／人から貰う（関係・尊厳）」の3経路
   - 調合は体力と素材を使う。日は消費しない
   面白さは品数ではなく分岐にあるので、素材は6種に抑える。 */

export type MaterialId =
  | "rose"
  | "wax"
  | "poppy"
  | "wormwood"
  | "ambergris"
  | "silversand";

export type Material = {
  id: MaterialId;
  name: string;
  /** 商会での値。買えないものは持たない。 */
  buy?: number;
  note: string;
};

export const materials: Material[] = [
  {
    id: "rose",
    name: "野薔薇",
    buy: 12,
    note: "丘に群れて咲く。摘むのに許可は要らない。",
  },
  {
    id: "wax",
    name: "蜜蝋",
    buy: 18,
    note: "採れる場所は無い。商会で買うしかない。",
  },
  // 分岐の要。眠り薬にも媚薬にもなる。手持ちは一つしかないので、両方は作れない。
  {
    id: "poppy",
    name: "乾燥ケシ",
    buy: 26,
    note: "眠らせるためにも、眠らせないためにも使える。",
  },
  {
    id: "wormwood",
    name: "苦艾",
    buy: 14,
    note: "どこにでも生える。だから安い。",
  },
  {
    id: "ambergris",
    name: "竜涎",
    note: "表では売っていない。裏通りか、マルクの厚意でしか手に入らない。",
  },
  {
    id: "silversand",
    name: "銀砂",
    buy: 60,
    note: "上等な品にしか使わない。値も上等。",
  },
];

export const materialIds = materials.map((m) => m.id);
export function materialOf(id: MaterialId): Material {
  return materials.find((m) => m.id === id) ?? materials[0];
}

/** 品の格。低い格を作ると街での立場が落ち、上の注文が閉じる(§3-2)。 */
export type Grade = "上" | "中" | "下";
export const grades: Grade[] = ["上", "中", "下"];

export type RecipeId =
  | "tisane"
  | "balm"
  | "perfume"
  | "sleeper"
  | "tonic"
  | "philtre"
  | "abortive";

export type Recipe = {
  id: RecipeId;
  name: string;
  grade: Grade;
  needs: Partial<Record<MaterialId, number>>;
  /** 調合に要る体力。丁寧な仕事ほど高い ── 下の品は雑に作れるので安い。 */
  stamina: number;
  note: string;
};

// 上の格ほど体力を食う。「堕ちるほうが速い」を調合の手間にも通す(§6 AとBの関係)。
export const recipes: Recipe[] = [
  {
    id: "tisane",
    name: "薬湯",
    grade: "上",
    needs: { rose: 2, wormwood: 1 },
    stamina: 16,
    note: "母が客に出していたもの。作り方は身体が覚えている。",
  },
  {
    id: "balm",
    name: "傷薬",
    grade: "中",
    needs: { wax: 1, wormwood: 2 },
    stamina: 18,
    note: "効く。それだけの薬。",
  },
  {
    id: "perfume",
    name: "香油",
    grade: "上",
    needs: { rose: 3, wax: 2 },
    stamina: 26,
    note: "香りで身分が分かる、と教わった。",
  },
  {
    id: "sleeper",
    name: "眠り薬",
    grade: "中",
    needs: { poppy: 2, wormwood: 1 },
    stamina: 20,
    note: "眠れない人がいる。それだけの話だと、まだ思える。",
  },
  {
    id: "tonic",
    name: "気付け薬",
    grade: "上",
    needs: { silversand: 1, rose: 2 },
    stamina: 30,
    note: "倒れた貴婦人に嗅がせるもの。銀砂が要る。",
  },
  {
    id: "philtre",
    name: "媚薬",
    grade: "下",
    needs: { poppy: 3, ambergris: 1 },
    stamina: 12,
    note: "誰に使うのかは訊かない。訊けば、作れなくなる。",
  },
  {
    id: "abortive",
    name: "堕胎薬",
    grade: "下",
    needs: { wormwood: 3, poppy: 1 },
    stamina: 12,
    note: "要る人がいる限り、無くならない薬。",
  },
];

export function recipeOf(id: RecipeId): Recipe {
  return recipes.find((r) => r.id === id) ?? recipes[0];
}

/** 最初から知っている処方。母から受け継いだぶんだけ。 */
export const INITIAL_RECIPES: RecipeId[] = ["tisane"];

/** 覚えた処方の出どころ。レシピ帳は「どこで覚えたか」の記録になる(§2-1)。 */
export const RECIPE_SOURCE: Record<RecipeId, string> = {
  tisane: "母から。まだ屋敷に人がいた頃",
  balm: "ヴェルネとの薬の取引から",
  perfume: "クレールとの薬の取引から",
  sleeper: "クレールが、書庫の頁を開いたまま席を外した",
  tonic: "ギヨームが、伯爵家の薬棚を開けてみせた",
  philtre: "マルクが「聞くだけ聞くか」と言った日",
  abortive: "マルクが、もう隠さなくなってから",
};

/** 場所。マップ上の位置は背景画像に対する割合で持つ（実素材が来ても合う）。 */
export type Place = {
  id: PlaceId;
  name: string;
  short: string;
  tagline: string;
  kind: "home" | "work" | "gather";
  map: { x: number; y: number };
  /** 採集地で採れるもの。1回の採集で丸ごと手に入る。 */
  requiresUnlock?: boolean;
  gathers?: Partial<Record<MaterialId, number>>;
  /** 採集に要る体力。 */
  gatherStamina?: number;
  /** ここで買える素材。 */
  sells?: MaterialId[];
  /** これ以下まで落ちて、初めて行ける場所。 */
  opensBelow?: Partial<Record<Axis, number>>;
};

export const places: Place[] = [
  {
    id: "garden",
    name: "紹介された薬草園",
    short: "薬草園",
    kind: "gather",
    requiresUnlock: true,
    tagline: "特別依頼で開いた採集地。",
    map: { x: 88, y: 76 },
    gathers: { rose: 5, silversand: 1 },
    gatherStamina: 24,
  },
  {
    id: "estate",
    name: "ラティエ邸",
    short: "屋敷",
    kind: "home",
    tagline: "帰る場所。休み、学ぶ。",
    map: { x: 14, y: 70 },
  },
  {
    id: "arnaud",
    name: "アルノー商会",
    short: "商会",
    kind: "work",
    tagline: "金の話が早い。素材も買える。",
    map: { x: 26, y: 62 },
    sells: ["rose", "wax", "poppy", "wormwood", "silversand"],
  },
  {
    id: "academy",
    name: "王立学院",
    short: "学院",
    kind: "work",
    tagline: "まともな道の入口。",
    map: { x: 48, y: 26 },
  },
  {
    id: "valere",
    name: "ヴァレール伯爵家",
    short: "伯爵家",
    kind: "work",
    tagline: "かつての同格。最も気が重い。",
    map: { x: 76, y: 44 },
  },
  {
    id: "guild",
    name: "街の組合",
    short: "組合",
    kind: "work",
    tagline: "下世話だが、公平ではある。",
    map: { x: 58, y: 76 },
  },

  // 採集地。金の代わりに体力を払って素材を採る場所。
  {
    id: "hill",
    name: "修道院の丘",
    short: "丘",
    kind: "gather",
    tagline: "薔薇と苦艾。誰も咎めない。",
    map: { x: 34, y: 14 },
    gathers: { rose: 4, wormwood: 3 },
    gatherStamina: 22,
  },
  {
    id: "wood",
    name: "王領の森",
    short: "森",
    kind: "gather",
    tagline: "ケシが生える。入るのは、本当は許されていない。",
    map: { x: 66, y: 16 },
    gathers: { poppy: 4, wormwood: 2 },
    gatherStamina: 30,
  },
  // 堕ちて初めて開く場所(§6-B)。竜涎はここか、マルクの厚意でしか手に入らない。
  {
    id: "backstreet",
    name: "裏通り",
    short: "裏通り",
    kind: "gather",
    tagline: "売る物も、買う物も、名前が無い。",
    map: { x: 44, y: 88 },
    gathers: { ambergris: 2, poppy: 2 },
    gatherStamina: 18,
    opensBelow: { 威厳: 30 },
  },
];

/** その場所へ行けるか。採集地は堕ちて開くものがある。 */
export function placeOpen(place: Place, state: GameState): boolean {
  if (place.requiresUnlock && !state.unlockedPlaces.includes(place.id))
    return false;
  if (!place.opensBelow) return true;
  return axes.some((axis) => {
    const line = place.opensBelow?.[axis];
    return line !== undefined && state.axes[axis] <= line;
  });
}

/** 依頼人。関係は組織ではなく、この人と結ぶ。 */
export type PersonId =
  | "vernet"
  | "jean"
  | "claire"
  | "guillaume"
  | "count"
  | "marc"
  | "herbalist";

export type Person = {
  id: PersonId;
  name: string;
  role: string;
  place: PlaceId;
  note: string;
  /** 関係が段階1/2/3に上がった日に、その人が言うこと。 */
  requiresUnlock?: boolean;
  stageLines: [string, string, string];
  /** この段階に達した日に教わる処方。レシピは金では買えない(§2-1)。 */
  teaches?: { stage: number; recipe: RecipeId }[];
  /** この段階に達すると、通常納品の日に一度だけ分けてもらえる素材。
      表で買えない品を「堕ちて開く道」と「育てて開く道」の両方に繋ぐ(§6-B)。 */
  supplies?: { stage: number; material: MaterialId; amount: number }[];
};

export const people: Person[] = [
  {
    id: "herbalist",
    name: "紹介された薬師",
    role: "協力者（仮）",
    place: "academy",
    requiresUnlock: true,
    note: "薬の納品をきっかけに紹介された相手。",
    stageLines: [
      "顔を覚えた。",
      "相談できるようになった。",
      "信頼が深まった。",
    ],
    teaches: [{ stage: 1, recipe: "balm" }],
  },
  {
    id: "vernet",
    name: "ヴェルネ",
    role: "番頭",
    place: "arnaud",
    note: "帳簿より正確に人を見る。感情は挟まない。",
    stageLines: [
      "「……名前だけは覚えました。それだけです」",
      "「ラティエ様。次はもう少し早く来られますか」",
      "「旦那様には黙っておきます。貴女のためではなく、帳簿のためです」",
    ],
    teaches: [{ stage: 1, recipe: "balm" }],
  },
  {
    id: "jean",
    name: "ジャン・アルノー",
    role: "若旦那",
    place: "arnaud",
    note: "金払いはいい。身分というものに何の敬意も無い。",
    stageLines: [
      "「へえ。貴族様が、本当に来た」",
      "「エレオノールさん、でしたっけ。覚えましたよ」",
      "「今度、店じゃないところで話しませんか」",
    ],
  },
  {
    id: "claire",
    name: "クレール",
    role: "司書",
    place: "academy",
    note: "詮索をしない。ここでの仕事は、まだ彼女を令嬢のまま扱う。",
    stageLines: [
      "「助かりました。また、お願いできますか」",
      "「あなたの字は読みやすい。教授もそう言っていました」",
      "「……ここにいる間は、誰も貴女を詮索しません」",
    ],
    teaches: [
      { stage: 1, recipe: "sleeper" },
      { stage: 2, recipe: "perfume" },
    ],
  },
  {
    id: "guillaume",
    name: "ギヨーム",
    role: "家令",
    place: "valere",
    note: "慇懃で、丁寧で、こちらを一段下に置く。",
    stageLines: [
      "「使えなくはない、と申し上げておきます」",
      "「ラティエ家の名は、まだ多少の役に立つようで」",
      "「伯爵がお呼びです。断る理由は、もう無いでしょう」",
    ],
    teaches: [{ stage: 2, recipe: "tonic" }],
  },
  {
    id: "count",
    name: "ヴァレール伯爵",
    role: "当主",
    place: "valere",
    note: "かつては同格だった。その事実を、両方が覚えている。",
    stageLines: [
      "「久しいな。……ずいぶん、変わった」",
      "「昔は私が頭を下げる側だった。覚えているか」",
      "「金で解決する話は、金で終わらせよう。そうだろう」",
    ],
  },
  {
    id: "marc",
    name: "マルク",
    role: "組合の顔役",
    place: "guild",
    note: "下世話だが、値切らないし嘘もつかない。",
    stageLines: [
      "「上玉が来たって噂は、本当だったな」",
      "「あんた、値切らねえのが偉い。仕事はきっちり回すよ」",
      "「悪い話も来る。聞くだけ、聞くか」",
    ],
    teaches: [
      { stage: 2, recipe: "philtre" },
      { stage: 3, recipe: "abortive" },
    ],
    supplies: [{ stage: 2, material: "ambergris", amount: 1 }],
  },
];

export function personOf(id: PersonId): Person {
  return people.find((p) => p.id === id) ?? people[0];
}

export function personOpen(person: Person, state: GameState): boolean {
  return (
    (!person.requiresUnlock || state.unlockedPeople.includes(person.id)) &&
    placeOpen(placeOf(person.place), state)
  );
}
export function peopleAt(place: PlaceId, state: GameState): Person[] {
  return people.filter((p) => p.place === place && personOpen(p, state));
}

/** 関係の段階。数値ではなく言葉で出す。 */
export function relationStage(value: number): string {
  return ["依頼人", "顔を覚えられた", "名前で呼ばれる", "私的な用も頼まれる"][
    Math.min(value, 3)
  ];
}
export function placeOf(id: PlaceId): Place {
  return places.find((p) => p.id === id) ?? places[0];
}

export const CHAPTER_DAYS = 14;
export const CHAPTERS = 6;
export const MAX_STAMINA = 100;

/* ---------------- 章末のノルマ ----------------
   額そのものより「正攻法で稼げる額に対する達成率」が設計の本体。
   達成率 ＝ 尊厳を1点も払わずに稼げる額 ÷ ノルマ。
   これを 162% → 75% へ落としていく。前半は調剤ゲーム、後半は身売りゲームになる。

   調剤ラインを入れたあとの実測（段階E）:
     正攻法の稼ぎ  1701 / 2064 / 2164 / 2033 / 2068 / 2068  計 12,098G
     達成率        162% / 133% / 111% /  97% /  84% /  75%

   スタミナ制（v10）で1日に何度でも納品できるようになって以降、この比率は
   崩れている。買い叩きを納品回数で数えるようにした現在の実測（npm run sim）:
     正攻法の稼ぎ  7671 / 8300 / 8388 / 8300 / 8388 / 8300  計 49,347G
     達成率        730% / 535% / 430% / 395% / 342% / 302%
   ノルマは仮データのまま据え置いてある。人物・依頼・処方が仮のうちに引き直しても
   意味が無いので、コンテンツが入った時点で必ず測り直してここを引き直すこと。 */
export const QUOTAS = [1050, 1550, 1950, 2100, 2450, 2750];
export const TOTAL_DEBT = QUOTAS.reduce((a, b) => a + b, 0);

/** 未達分に付く利息。 */
export const LATE_INTEREST = 0.25;

/** 未達のときに受ける仕打ち。返せない見本として扱われる。 */
export const LATE_PENALTY: { axis: Axis; amount: number }[] = [
  { axis: "威厳", amount: 15 },
  { axis: "品位", amount: 10 },
];

export function baseQuota(chapter: number): number {
  return QUOTAS[chapter - 1] ?? QUOTAS[QUOTAS.length - 1];
}

/** 今章に納める額。前章の未達分は利息ごと乗る。 */
export function quotaOf(state: GameState): number {
  return baseQuota(state.chapter) + state.carryOver;
}

/** その依頼を受けると必ず削られるもの。選ばせない。 */
export type JobCost = { axis: Axis; amount: number };

/** 依頼の種別。尊厳の状態で、受けられる「種類」そのものが入れ替わる。 */
export type JobKind =
  | "調剤"
  | "親交"
  | "社交"
  | "実務"
  | "人前"
  | "労務"
  | "裏";

export type Job = {
  id: string;
  title: string;
  kind: JobKind;
  category: "ordinary" | "personal";
  cadence: "repeat" | "once" | "chapter";
  requiresCapability?: string;
  person: PersonId;
  pay: number;
  stamina: number;
  description: string;
  /** これを下回ると紹介されなくなる尊厳の下限。軸ごとに持つ。 */
  needs: Partial<Record<Axis, number>>;
  /** これ以下まで落ちて、初めて回ってくる依頼。 */
  opensBelow?: Partial<Record<Axis, number>>;
  /** 関係の進み方。親交の席は普通の仕事より速い。 */
  bond?: number;
  /** 空なら「何も差し出さずに済む仕事」。 */
  costs: JobCost[];
  /** 調剤の注文。この品を count だけ納める。 */
  recipe?: RecipeId;
  count?: number;
  /** 納めると処方を教わる依頼。レシピは金では買えない(§2-1)。 */
  teaches?: RecipeId;
};

export type GameState = SupportState & {
  chapter: number;
  day: number;
  /** 前章の未達分（利息込み）。今章のノルマに上乗せされる。 */
  carryOver: number;
  /** 14日目の行動を終えて、章末精算を待っている状態。 */
  awaitingSettlement: boolean;
  money: number;
  debt: number;
  stamina: number;
  /** 品位の上限。§1-4「現在値は戻る。ただし上限は下がったまま戻らない」。 */
  dignityCap: number;
  axes: Record<Axis, number>;
  relations: Record<PersonId, number>;
  /** 手持ちの素材。 */
  materials: Record<MaterialId, number>;
  /** 調合済みの品の在庫。納品するとここから減る。 */
  stock: Partial<Record<RecipeId, number>>;
  /** 覚えた処方。レシピ帳。 */
  known: RecipeId[];
  /** 直近に仕事を受けた相手（新しい順）。同じ人に通い詰めると買い叩かれる。 */
  recent: (PersonId | "none" | PersonId[])[];
  log: string[];
  ended: boolean;
};

/** 1日の行動結果。結果画面(§10)がそのまま読める形で持つ。 */
export type DayResult = {
  kind: "end-day" | "job" | "rest" | "network" | "gather" | "buy" | "support";
  days?: number;
  notices?: string[];
  title: string;
  narrative: string;
  basePay: number;
  relationBonus: number;
  paidTerms: { axis: Axis; title: string; bonus: number; cost: number }[];
  moneyDelta: number;
  staminaDelta: number;
  axisDrops: { axis: Axis; amount: number }[];
  axisGains: { axis: Axis; amount: number }[];
  dignityCapDrop: number;
  /** 関係が新しい段階に入ったとき。 */
  relationUp?: { name: string; stage: string };
  /** 素材の増減。採集・購入・納品で動く。 */
  materialDeltas?: { id: MaterialId; amount: number }[];
  /** 納めた品。 */
  delivered?: { recipe: RecipeId; count: number };
  deliveries?: {
    title: string;
    recipe: RecipeId;
    count: number;
    pay: number;
  }[];
  /** その日に覚えた処方。 */
  learned?: RecipeId[];
};

function makeJob(
  id: string,
  title: string,
  kind: JobKind,
  person: PersonId,
  pay: number,
  stamina: number,
  needs: Partial<Record<Axis, number>>,
  costs: JobCost[],
  description: string,
  extra: {
    opensBelow?: Partial<Record<Axis, number>>;
    bond?: number;
    recipe?: RecipeId;
    count?: number;
    teaches?: RecipeId;
  } = {},
): Job {
  return {
    id,
    title,
    kind,
    person,
    pay,
    stamina,
    needs,
    costs,
    description,
    category: extra.recipe ? "ordinary" : "personal",
    cadence:
      extra.recipe || ["ledger", "packing"].includes(id)
        ? "repeat"
        : id === "copyist"
          ? "once"
          : "chapter",
    ...extra,
  };
}

// needs が「まだ紹介してもらえる線」。尊厳が下がるほど上から順に閉じ、
// 最後には底辺の仕事しか残らない。
// costs が空の依頼が「何も差し出さずに済む道」。報酬は低い。
export const jobs: Job[] = [
  makeJob(
    "ord-vernet-tisane",
    "商会へ薬湯を届ける",
    "調剤",
    "vernet",
    330,
    12,
    {},
    [],
    "取引の入口となる薬の注文。",
    { recipe: "tisane", count: 2 },
  ),
  makeJob(
    "ord-marc-tisane",
    "組合へ薬湯を届ける",
    "調剤",
    "marc",
    330,
    12,
    {},
    [],
    "仕事を終えた人たちのための薬湯。",
    { recipe: "tisane", count: 2 },
  ),
  makeJob(
    "ord-herbalist-tisane",
    "紹介された薬師へ薬湯を届ける",
    "調剤",
    "herbalist",
    330,
    12,
    {},
    [],
    "紹介された相手からの薬の注文。",
    { recipe: "tisane", count: 2 },
  ),
  {
    ...makeJob(
      "ord-garden",
      "薬草園へ傷薬を届ける",
      "調剤",
      "vernet",
      390,
      12,
      {},
      [],
      "紹介状で開いた売り先。",
      { recipe: "balm", count: 2 },
    ),
    requiresCapability: "garden-orders",
  },
  // 調剤 ── 主軸。素材を集めて調合し、納める。日はかかるが身体は削らない。
  // 下の格（媚薬・堕胎薬）だけが威厳を削り、それが上の注文を閉じる(§3-2)。
  makeJob(
    "ord-balm",
    "傷薬をまとめて納める",
    "調剤",
    "vernet",
    360,
    12,
    { 品位: 22 },
    [],
    "荷役が絶えず怪我をする。効けばいい、と番頭は言った。",
    { recipe: "balm", count: 2 },
  ),
  makeJob(
    "ord-tisane",
    "学院へ薬湯を届ける",
    "調剤",
    "claire",
    330,
    12,
    { 品位: 45 },
    [],
    "徹夜の続く季節。教授たちが飲むものが要る。",
    { recipe: "tisane", count: 2 },
  ),
  makeJob(
    "ord-sleeper",
    "眠り薬を納める",
    "調剤",
    "claire",
    430,
    12,
    { 品位: 35 },
    [],
    "眠れない人がいる。それだけの話だと、まだ思える。",
    { recipe: "sleeper", count: 2 },
  ),
  makeJob(
    "ord-perfume",
    "伯爵家へ香油を用立てる",
    "調剤",
    "guillaume",
    340,
    14,
    { 品位: 55, 威厳: 48 },
    [],
    "家令は香りで値踏みをする。ラティエ家の名で通る、最後の品。",
    { recipe: "perfume", count: 1 },
  ),
  makeJob(
    "ord-tonic",
    "気付け薬を届ける",
    "調剤",
    "count",
    400,
    14,
    { 品位: 58, 威厳: 58 },
    [],
    "夜会で倒れる貴婦人のために。銀砂が要る、高い薬。",
    { recipe: "tonic", count: 1 },
  ),
  makeJob(
    "ord-philtre",
    "「例のもの」を用意する",
    "調剤",
    "marc",
    520,
    10,
    {},
    [{ axis: "威厳", amount: 10 }],
    "誰に使うのかは訊かない。訊けば、作れなくなる。",
    { recipe: "philtre", count: 1 },
  ),
  makeJob(
    "ord-abortive",
    "名の無い薬を頼まれる",
    "調剤",
    "jean",
    430,
    10,
    {},
    [
      { axis: "威厳", amount: 6 },
      { axis: "品位", amount: 6 },
    ],
    "若旦那は名前を出さなかった。誰のためかは、察しがついた。",
    { recipe: "abortive", count: 1 },
  ),

  // 親交 ── まともに扱われているうちしか呼ばれない。実入りは薄いが、関係が速く進む。
  makeJob(
    "salon",
    "学院の読書会に招かれる",
    "親交",
    "claire",
    120,
    16,
    { 品位: 72, 貞操: 65 },
    [],
    "仕事ではない。ただ、招かれるうちは、まだ令嬢として扱われている。",
    { bond: 2 },
  ),
  makeJob(
    "tea",
    "伯爵家の茶会に同席する",
    "親交",
    "count",
    155,
    20,
    { 品位: 66, 威厳: 68, 貞操: 40 },
    [],
    "かつては主催する側だった席に、呼ばれる側として座る。",
    { bond: 2 },
  ),

  // 社交 ── 家名と作法で立つ仕事。
  makeJob(
    "secretary",
    "伯爵家の臨時秘書",
    "社交",
    "guillaume",
    340,
    34,
    { 品位: 48, 威厳: 46, 貞操: 20 },
    [{ axis: "貞操", amount: 16 }],
    "手紙と来客を捌く。夜まで屋敷に留め置かれる日もある。",
  ),
  makeJob(
    "tutor",
    "商家の娘の家庭教師",
    "社交",
    "claire",
    225,
    26,
    { 品位: 62, 貞操: 50 },
    [{ axis: "品位", amount: 6 }],
    "教える相手は、かつて挨拶にも来られなかった家の娘。",
  ),
  makeJob(
    "escort",
    "夜会への同伴",
    "社交",
    "count",
    265,
    24,
    { 威厳: 34, 貞操: 12 },
    [
      { axis: "威厳", amount: 12 },
      { axis: "貞操", amount: 8 },
    ],
    "伯爵の連れとして立つ。何の連れかは、誰も口に出さない。",
  ),

  // 実務 ── 誰にも見られない仕事。差し出すものは無いが、安い。
  makeJob(
    "copyist",
    "学院文書の筆耕",
    "実務",
    "claire",
    120,
    20,
    { 品位: 70, 貞操: 60 },
    [],
    "筆写するだけの静かな仕事。写している束は、古い処方集だった。",
    { teaches: "perfume" },
  ),
  makeJob(
    "ledger",
    "商会の帳簿整理",
    "実務",
    "vernet",
    90,
    24,
    { 品位: 40, 貞操: 25 },
    [],
    "数字は多いが、日が暮れるまでに終えれば約束の額になる。",
  ),

  // 人前 ── 見られる仕事。品位が落ちるほど、条件が悪くなる。
  makeJob(
    "market",
    "市場の仕入れ交渉",
    "人前",
    "marc",
    245,
    28,
    { 品位: 28 },
    [{ axis: "威厳", amount: 9 }],
    "往来で声を張って値を争う。見物人は貴族の令嬢を面白がる。",
  ),
  makeJob(
    "banquet",
    "商家の晩餐で給仕",
    "人前",
    "jean",
    215,
    30,
    { 品位: 18 },
    [{ axis: "品位", amount: 14 }],
    "客の中に、かつて彼女に頭を下げた者が混じっている。",
  ),
  makeJob(
    "auction",
    "旧家財の競売補佐",
    "人前",
    "marc",
    165,
    22,
    { 威厳: 14 },
    [{ axis: "威厳", amount: 8 }],
    "誰かの家財に値をつける。明日は自分の番かもしれない。",
  ),

  // 労務 ── 何も残っていなくても受けられる、最後の一段。
  makeJob(
    "packing",
    "商会倉庫の荷造り",
    "労務",
    "marc",
    95,
    38,
    {},
    [{ axis: "品位", amount: 10 }],
    "誰でもできる安全な仕事。荷を担ぐ令嬢を、皆が見ている。",
  ),

  // 裏 ── 落ちて初めて回ってくる。実入りはいいが、戻り道を塞ぐ。
  makeJob(
    "private",
    "個室での接待",
    "裏",
    "jean",
    300,
    26,
    {},
    [{ axis: "貞操", amount: 18 }],
    "そういう話が来るようになった、ということだった。",
    { opensBelow: { 貞操: 45 } },
  ),
  makeJob(
    "show",
    "見世物小屋の客寄せ",
    "裏",
    "marc",
    205,
    30,
    {},
    [
      { axis: "威厳", amount: 10 },
      { axis: "品位", amount: 6 },
    ],
    "「元・貴族の令嬢」と書いた札が、彼女の横に立てられる。",
    { opensBelow: { 威厳: 28 } },
  ),
];

export const initialState: GameState = {
  ...emptySupportState(),
  chapter: 1,
  day: 1,
  carryOver: 0,
  awaitingSettlement: false,
  money: 120,
  debt: TOTAL_DEBT,
  stamina: 100,
  dignityCap: 100,
  axes: { 貞操: 100, 品位: 100, 威厳: 100 },
  relations: {
    herbalist: 0,
    vernet: 0,
    jean: 0,
    claire: 0,
    guillaume: 0,
    count: 0,
    marc: 0,
  },
  materials: {
    rose: 0,
    wax: 0,
    poppy: 0,
    wormwood: 0,
    ambergris: 0,
    silversand: 0,
  },
  stock: {},
  known: [...INITIAL_RECIPES],
  recent: [],
  log: ["返済期限まで、あと14日。まだ、どこへでも行ける。"],
  ended: false,
};

/** 中盤の疑似再現（§13 MVP の初期状態B）。冒頭は何も失っていないため、企画の売りが出ない。 */
export const midGameState: GameState = {
  ...initialState,
  chapter: 3,
  day: 6,
  money: 540,
  stamina: 44,
  dignityCap: 74,
  axes: { 貞操: 62, 品位: 51, 威厳: 47 },
  relations: {
    herbalist: 0,
    vernet: 1,
    jean: 0,
    claire: 1,
    guillaume: 2,
    count: 1,
    marc: 1,
  },
  materials: {
    rose: 3,
    wax: 1,
    poppy: 2,
    wormwood: 2,
    ambergris: 0,
    silversand: 0,
  },
  stock: { tisane: 1 },
  known: ["tisane", "balm", "sleeper", "tonic"],
  recent: ["guillaume", "vernet"],
  log: ["五日が過ぎた。差し出したものは、もう帳簿には戻らない。"],
};

/** その場所にある依頼。常設なので、開いているものはいつでも受けられる。 */
export function jobsAt(place: PlaceId): Job[] {
  return jobs.filter((job) => personOf(job.person).place === place);
}

/** その人物が抱えている依頼。 */
export function jobsBy(person: PersonId): Job[] {
  return jobs.filter((job) => job.person === person);
}

/** 尊厳が足りていて紹介してもらえるか。 */
function meetsNeeds(job: Job, state: GameState): boolean {
  return axes.every((axis) => state.axes[axis] >= (job.needs[axis] ?? 0));
}

/** まだ落ちきっておらず、回ってこない依頼か。 */
export function notYetFallen(job: Job, state: GameState): boolean {
  if (!job.opensBelow) return false;
  return axes.some((axis) => {
    const line = job.opensBelow?.[axis];
    return line !== undefined && state.axes[axis] > line;
  });
}

/** 処方を知らない注文は、そもそも回ってこない（尊厳で閉じたのとは別）。 */
export function unknownRecipe(job: Job, state: GameState): boolean {
  return job.recipe !== undefined && !state.known.includes(job.recipe);
}

/** いま受けられるか。上の仕事は尊厳で閉じ、裏の仕事は落ちて初めて開く。 */
export function isOpen(job: Job, state: GameState): boolean {
  return (
    personOpen(personOf(job.person), state) &&
    !personalLimitReason(job, state) &&
    (!job.requiresCapability ||
      state.capabilities.includes(job.requiresCapability)) &&
    meetsNeeds(job, state) &&
    !notYetFallen(job, state) &&
    !unknownRecipe(job, state)
  );
}

export const personalRunKey = (job: Job, s: GameState) =>
  job.cadence === "chapter"
    ? `chapter:${s.chapter}:${job.id}`
    : `once:${job.id}`;
export function personalLimitReason(job: Job, s: GameState): string | null {
  if (
    job.category !== "personal" ||
    job.cadence === "repeat" ||
    !s.personalRuns[personalRunKey(job, s)]
  )
    return null;
  return job.cadence === "once" ? "実行済み（1プレイに1回）" : "今章は実行済み";
}
export const personalJobsAt = (place: PlaceId, s: GameState) =>
  jobsAt(place).filter((j) => j.category === "personal" && isOpen(j, s));

/** 尊厳が足りずに閉じた軸。跡の表示に使う（まだ現れていない依頼は跡ではない）。 */
export function closedBy(job: Job, state: GameState): Axis[] {
  return axes.filter((axis) => state.axes[axis] < (job.needs[axis] ?? 0));
}

/* ================= 調剤のルール =================
   SYSTEM_PLAN.md §2。素材は買う／採る／貰う、調合は体力と素材、納品が1日。 */

/** その処方をいま調合できるか。素材と体力の両方が要る。 */
export function canBrew(recipe: Recipe, state: GameState): boolean {
  if (!state.known.includes(recipe.id)) return false;
  if (state.stamina < recipe.stamina) return false;
  return materialIds.every(
    (id) => state.materials[id] >= (recipe.needs[id] ?? 0),
  );
}

/** 1回調合する。日は消費しない ── 減るのは体力と素材。 */
export function brewOnce(state: GameState, id: RecipeId): GameState {
  const recipe = recipeOf(id);
  const nextMaterials = { ...state.materials };
  materialIds.forEach((m) => {
    nextMaterials[m] -= recipe.needs[m] ?? 0;
  });
  return {
    ...state,
    stamina: state.stamina - recipe.stamina,
    materials: nextMaterials,
    stock: { ...state.stock, [id]: (state.stock[id] ?? 0) + 1 },
  };
}

/** 納品に足りる在庫があるか。 */
export function hasStockFor(job: Job, state: GameState): boolean {
  if (!job.recipe) return true;
  return (state.stock[job.recipe] ?? 0) >= (job.count ?? 1);
}

/** 行ける採集地。堕ちて開く場所がある(§6-B)。 */
export function gatherPlaces(state: GameState): Place[] {
  return places.filter((p) => p.kind === "gather" && placeOpen(p, state));
}

/** 関係が新しい段階に入って教わる処方。まだ知らないものだけ返す。 */
export function recipesTaughtBy(
  person: PersonId,
  before: number,
  after: number,
  known: RecipeId[],
): RecipeId[] {
  const p = personOf(person);
  return (p.teaches ?? [])
    .filter(
      (t) => t.stage > before && t.stage <= after && !known.includes(t.recipe),
    )
    .map((t) => t.recipe);
}

/* --- 常設リストの単調さを防ぐ：同じ場所に通い詰めると買い叩かれる --- */

export const RECENT_WINDOW = 3;
const FATIGUE_RATE = [1, 0.82, 0.68, 0.58];

/** 直近 RECENT_WINDOW 日と本日ぶんを合わせた、その人への納品回数。
    同日の反復を許した以上、日単位で数えると買い叩きが一度も効かない。 */
export function personFatigue(person: PersonId, state: GameState): number {
  const past = state.recent.slice(0, RECENT_WINDOW).reduce(
    (n, entry) =>
      n +
      (Array.isArray(entry)
        ? entry.filter((id) => id === person).length
        : entry === person
          ? 1
          : 0),
    0,
  );
  return past + state.today.deliveries.filter((id) => id === person).length;
}

/** 通い詰めによる相場の下落率（1 = 定価）。 */
export function fatigueRate(person: PersonId, state: GameState): number {
  return FATIGUE_RATE[
    Math.min(personFatigue(person, state), FATIGUE_RATE.length - 1)
  ];
}

/* ---------------- 章末精算 ---------------- */

export type Settlement = {
  chapter: number;
  quota: number;
  paid: number;
  shortfall: number;
  interest: number;
  penalties: { axis: Axis; amount: number }[];
  debtBefore: number;
  debtAfter: number;
  nextQuota: number;
  finished: boolean;
  cleared: boolean;
};

/** 精算の内訳を計算する。状態は変えない（画面に見せてから適用する）。 */
export function settlementOf(state: GameState): Settlement {
  const quota = quotaOf(state);
  const paid = Math.min(state.money, quota);
  const shortfall = quota - paid;
  const interest = shortfall > 0 ? Math.ceil(shortfall * LATE_INTEREST) : 0;
  const debtAfter = Math.max(0, state.debt - paid + interest);
  const finished = state.chapter >= CHAPTERS;
  return {
    chapter: state.chapter,
    quota,
    paid,
    shortfall,
    interest,
    penalties: shortfall > 0 ? LATE_PENALTY : [],
    debtBefore: state.debt,
    debtAfter,
    nextQuota: finished
      ? 0
      : baseQuota(state.chapter + 1) + shortfall + interest,
    finished,
    cleared: finished && debtAfter <= 0,
  };
}

/** 精算を適用して次章へ。最終章なら ended を立てる。 */
export function applySettlement(state: GameState, s: Settlement): GameState {
  const axes2 = { ...state.axes };
  s.penalties.forEach((p) => {
    axes2[p.axis] = Math.max(0, axes2[p.axis] - p.amount);
  });
  axes2.品位 = Math.min(axes2.品位, state.dignityCap);
  return {
    ...state,
    money: state.money - s.paid,
    debt: s.debtAfter,
    axes: axes2,
    carryOver: s.shortfall + s.interest,
    awaitingSettlement: false,
    today: { worked: [], relationGranted: [], publicWork: false, deliveries: [] },
    chapter: s.finished ? state.chapter : state.chapter + 1,
    day: s.finished ? state.day : 1,
    stamina: s.finished ? state.stamina : MAX_STAMINA,
    ended: s.finished,
    log: [
      s.shortfall > 0
        ? `第${s.chapter}章 章末。${s.paid.toLocaleString()}Gを納めたが、${s.shortfall.toLocaleString()}G足りなかった。`
        : `第${s.chapter}章 章末。${s.paid.toLocaleString()}Gを納めた。`,
      ...state.log,
    ].slice(0, 8),
  };
}

export function axisStage(axis: Axis, value: number): string {
  const stages: Record<Axis, [string, string, string, string]> = {
    貞操: [
      "守られている",
      "応じはじめている",
      "数えられなくなった",
      "拒む理由がない",
    ],
    品位: [
      "令嬢として扱われる",
      "軽んじられている",
      "見下されている",
      "人として扱われない",
    ],
    威厳: [
      "家名は保たれている",
      "噂されている",
      "見世物になっている",
      "街の晒し者",
    ],
  };
  const [high, mid, low, bottom] = stages[axis];
  if (value >= 76) return high;
  if (value >= 51) return mid;
  if (value >= 26) return low;
  return bottom;
}

/** その依頼で下がる品位の上限。品位を払う依頼だけ発生する。 */
export function capDropOf(job: Job): number {
  const dignity = job.costs.find((c) => c.axis === "品位");
  return dignity ? Math.ceil(dignity.amount / 2) : 0;
}

/** 定価＋人脈。相場の下落はまだ掛けない。 */
export function listPrice(job: Job, state: GameState): number {
  return job.pay + state.relations[job.person] * 25;
}

/** 実際に提示される額。通い詰めていると下がる。 */
export function payWithRelation(job: Job, state: GameState): number {
  return Math.round(listPrice(job, state) * fatigueRate(job.person, state));
}

/** スタミナが足りない依頼は選べない(§1-5)。 */
export function hasStaminaFor(job: Job, state: GameState): boolean {
  return state.stamina >= job.stamina;
}

/* ---------------- イベントシーン ----------------
   依頼を受けたあとに流れる「本番」。遊ぶ場所ではなく観る場所なので、
   選択は出さず、タップで送るだけにする。
   差分は台詞で担当し、絵は art.ts の規約で1枚ずつ差し替える。 */

export type SceneLine = { speaker?: string; text: string };

const HEROINE = "エレオノール";

const scriptByAxis: Record<Axis, SceneLine[]> = {
  貞操: [
    { speaker: HEROINE, text: "「……先に、お金の話を終わらせてください」" },
    { text: "依頼人は答えなかった。かわりに、扉の鍵が回る音がした。" },
    { speaker: HEROINE, text: "「終わったら、約束の額はきちんと」" },
    { text: "そう言うのが、いちばん早いと知ってしまった。" },
  ],
  品位: [
    { text: '「おい、そこの。名前は要らん。"女"で通す」' },
    { text: "一度だけ訂正しようとして、やめた。" },
    { text: "訂正したところで、日当が増えるわけではない。" },
    { speaker: HEROINE, text: "「……はい」" },
  ],
  威厳: [
    { text: "「ラティエ家のご令嬢が、うちの店先に立つ。それだけで客が来る」" },
    { text: "通りには、見覚えのある顔がいくつもあった。" },
    { text: "目が合う。相手のほうが、慌てて逸らした。" },
    { text: "明日には、街じゅうが知っている。" },
  ],
};

/** 薬を納める日。格ごとに、渡した相手の顔が違う。 */
const brewScript: Record<Grade, SceneLine[]> = {
  上: [
    { text: "包みを解かないまま、相手は代金を数えた。" },
    { text: "「ラティエ家の手のものなら、間違いはないでしょう」" },
    { speaker: HEROINE, text: "「……ありがとうございます」" },
    { text: "名前がまだ効いている。それが、いつまでかは分からない。" },
  ],
  中: [
    { text: "中身を確かめてから、相手は頷いた。" },
    { text: "「効けばいい。誰が作ったかは、こっちには関係ない」" },
    { text: "関係ない、と言われたことに、少しだけ救われた。" },
  ],
  下: [
    { text: "相手は包みを開けず、そのまま懐に入れた。" },
    { text: "「何に使うか、訊かないのがいい」" },
    { speaker: HEROINE, text: "「……訊きません」" },
    { text: "作れる、と知られた。もう、知らなかったことにはできない。" },
  ],
};

const plainScript: SceneLine[] = [
  { text: "言われた通りに、言われた分だけ働いた。" },
  { text: "誰も彼女を見なかった。" },
  { text: "それが、今日いちばんの収穫だった。" },
];

/** 台本を組む単位。通常依頼も特別依頼の納品も、同じ形にして渡す。 */
export type SceneSubject = {
  title: string;
  person: PersonId;
  recipe?: RecipeId;
  costs: JobCost[];
};

/** 納品1件ぶんの台本。品の格が場面を決め、差し出したものがあれば
    そのぶんを最後に重ねる。まとめ納品は engine が全件を順に繋ぐ。 */
export function sceneScript(subject: SceneSubject): SceneLine[] {
  const opening: SceneLine = {
    text: `${placeOf(personOf(subject.person).place).name}／${subject.title}。`,
  };
  const paid = axes.find((axis) =>
    subject.costs.some((c) => c.axis === axis && c.amount > 0),
  );
  const body = subject.recipe
    ? brewScript[recipeOf(subject.recipe).grade]
    : plainScript;
  return paid
    ? [opening, ...body, ...scriptByAxis[paid]]
    : [opening, ...body];
}

/** 関係が新しい段階に入った日の一言。上がっていなければ空。 */
export function stageUpLine(
  person: PersonId,
  before: number,
  after: number,
): SceneLine[] {
  if (after <= before || after < 1 || after > 3) return [];
  const p = personOf(person);
  return [{ speaker: p.name, text: p.stageLines[after - 1] }];
}
