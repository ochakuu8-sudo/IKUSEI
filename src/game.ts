// ゲームのルールとデータ。画面(App.tsx)からは、ここが返す値を表示するだけにする。
// 数値の根拠は GAME_DESIGN.md。変更するときは企画書側と必ず揃える。

export type Axis = '貞操' | '品位' | '威厳';
export type PlaceId = 'estate' | 'arnaud' | 'academy' | 'valere' | 'guild';

export const axes: Axis[] = ['貞操', '品位', '威厳'];

/** 場所。マップ上の位置は背景画像に対する割合で持つ（実素材が来ても合う）。 */
export type Place = {
  id: PlaceId;
  name: string;
  short: string;
  tagline: string;
  kind: 'home' | 'work';
  map: { x: number; y: number };
};

export const places: Place[] = [
  { id: 'estate',  name: 'ラティエ邸',       short: '屋敷',   kind: 'home', tagline: '帰る場所。休み、学ぶ。',         map: { x: 14, y: 70 } },
  { id: 'arnaud',  name: 'アルノー商会',     short: '商会',   kind: 'work', tagline: '金の話が早い。実務の仕事。',     map: { x: 26, y: 62 } },
  { id: 'academy', name: '王立学院',         short: '学院',   kind: 'work', tagline: 'まともな道の入口。',             map: { x: 48, y: 26 } },
  { id: 'valere',  name: 'ヴァレール伯爵家', short: '伯爵家', kind: 'work', tagline: 'かつての同格。最も気が重い。',   map: { x: 76, y: 44 } },
  { id: 'guild',   name: '街の組合',         short: '組合',   kind: 'work', tagline: '下世話だが、公平ではある。',     map: { x: 58, y: 76 } },
];

export const workPlaces = places.filter((p) => p.kind === 'work');

/** 依頼人。関係は組織ではなく、この人と結ぶ。 */
export type PersonId = 'vernet' | 'jean' | 'claire' | 'guillaume' | 'count' | 'marc';

export type Person = {
  id: PersonId;
  name: string;
  role: string;
  place: PlaceId;
  note: string;
  /** 関係が段階1/2/3に上がった日に、その人が言うこと。 */
  stageLines: [string, string, string];
};

export const people: Person[] = [
  {
    id: 'vernet', name: 'ヴェルネ', role: '番頭', place: 'arnaud',
    note: '帳簿より正確に人を見る。感情は挟まない。',
    stageLines: [
      '「……名前だけは覚えました。それだけです」',
      '「ラティエ様。次はもう少し早く来られますか」',
      '「旦那様には黙っておきます。貴女のためではなく、帳簿のためです」',
    ],
  },
  {
    id: 'jean', name: 'ジャン・アルノー', role: '若旦那', place: 'arnaud',
    note: '金払いはいい。身分というものに何の敬意も無い。',
    stageLines: [
      '「へえ。貴族様が、本当に来た」',
      '「エレオノールさん、でしたっけ。覚えましたよ」',
      '「今度、店じゃないところで話しませんか」',
    ],
  },
  {
    id: 'claire', name: 'クレール', role: '司書', place: 'academy',
    note: '詮索をしない。ここでの仕事は、まだ彼女を令嬢のまま扱う。',
    stageLines: [
      '「助かりました。また、お願いできますか」',
      '「あなたの字は読みやすい。教授もそう言っていました」',
      '「……ここにいる間は、誰も貴女を詮索しません」',
    ],
  },
  {
    id: 'guillaume', name: 'ギヨーム', role: '家令', place: 'valere',
    note: '慇懃で、丁寧で、こちらを一段下に置く。',
    stageLines: [
      '「使えなくはない、と申し上げておきます」',
      '「ラティエ家の名は、まだ多少の役に立つようで」',
      '「伯爵がお呼びです。断る理由は、もう無いでしょう」',
    ],
  },
  {
    id: 'count', name: 'ヴァレール伯爵', role: '当主', place: 'valere',
    note: 'かつては同格だった。その事実を、両方が覚えている。',
    stageLines: [
      '「久しいな。……ずいぶん、変わった」',
      '「昔は私が頭を下げる側だった。覚えているか」',
      '「金で解決する話は、金で終わらせよう。そうだろう」',
    ],
  },
  {
    id: 'marc', name: 'マルク', role: '組合の顔役', place: 'guild',
    note: '下世話だが、値切らないし嘘もつかない。',
    stageLines: [
      '「上玉が来たって噂は、本当だったな」',
      '「あんた、値切らねえのが偉い。仕事はきっちり回すよ」',
      '「悪い話も来る。聞くだけ、聞くか」',
    ],
  },
];

export function personOf(id: PersonId): Person {
  return people.find((p) => p.id === id) ?? people[0];
}

export function peopleAt(place: PlaceId): Person[] {
  return people.filter((p) => p.place === place);
}

/** 関係の段階。数値ではなく言葉で出す。 */
export function relationStage(value: number): string {
  return ['依頼人', '顔を覚えられた', '名前で呼ばれる', '私的な用も頼まれる'][Math.min(value, 3)];
}
export function placeOf(id: PlaceId): Place {
  return places.find((p) => p.id === id) ?? places[0];
}

export const CHAPTER_DAYS = 14;
export const CHAPTERS = 6;
export const MAX_STAMINA = 100;

/* ---------------- 章末のノルマ ----------------
   額そのものより「正攻法で稼げる額に対する比率」が設計の本体。
   実測（正攻法は1章あたり約1,800G）から逆算して、
   その比率を 166% → 75% へ落としていく。
   前半は経営ゲーム、後半は身売りゲームになる。 */
export const QUOTAS = [1100, 1350, 1600, 1850, 2100, 2400];
export const TOTAL_DEBT = QUOTAS.reduce((a, b) => a + b, 0);

/** 未達分に付く利息。 */
export const LATE_INTEREST = 0.25;

/** 未達のときに受ける仕打ち。返せない見本として扱われる。 */
export const LATE_PENALTY: { axis: Axis; amount: number }[] = [
  { axis: '威厳', amount: 15 },
  { axis: '品位', amount: 10 },
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
export type JobKind = '親交' | '社交' | '実務' | '人前' | '労務' | '裏';

export const jobKinds: JobKind[] = ['親交', '社交', '実務', '人前', '労務', '裏'];

export const kindNote: Record<JobKind, string> = {
  親交: '人と親しくなるための席。まともに扱われているうちしか呼ばれない',
  社交: '家名と作法で立つ仕事',
  実務: '手を動かす仕事。誰にも見られない',
  人前: '人目のある場所に立つ仕事',
  労務: '身体だけで足りる仕事',
  裏: '落ちた者にしか回ってこない仕事',
};

export type Job = {
  id: string;
  title: string;
  kind: JobKind;
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
};

export type GameState = {
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
  /** 直近に仕事を受けた相手（新しい順）。同じ人に通い詰めると買い叩かれる。 */
  recent: (PersonId | 'none')[];
  log: string[];
  ended: boolean;
};

/** 1日の行動結果。結果画面(§10)がそのまま読める形で持つ。 */
export type DayResult = {
  kind: 'job' | 'rest' | 'train' | 'network';
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
};

function makeJob(
  id: string, title: string, kind: JobKind, person: PersonId,
  pay: number, stamina: number,
  needs: Partial<Record<Axis, number>>, costs: JobCost[], description: string,
  extra: { opensBelow?: Partial<Record<Axis, number>>; bond?: number } = {},
): Job {
  return { id, title, kind, person, pay, stamina, needs, costs, description, ...extra };
}

// needs が「まだ紹介してもらえる線」。尊厳が下がるほど上から順に閉じ、
// 最後には底辺の仕事しか残らない。
// costs が空の依頼が「何も差し出さずに済む道」。報酬は低い。
export const jobs: Job[] = [
  // 親交 ── まともに扱われているうちしか呼ばれない。実入りは薄いが、関係が速く進む。
  makeJob('salon', '学院の読書会に招かれる', '親交', 'claire', 120, 16,
    { 品位: 72, 貞操: 65 }, [],
    '仕事ではない。ただ、招かれるうちは、まだ令嬢として扱われている。',
    { bond: 2 }),
  makeJob('tea', '伯爵家の茶会に同席する', '親交', 'count', 155, 20,
    { 品位: 66, 威厳: 68, 貞操: 40 }, [],
    'かつては主催する側だった席に、呼ばれる側として座る。',
    { bond: 2 }),

  // 社交 ── 家名と作法で立つ仕事。
  makeJob('secretary', '伯爵家の臨時秘書', '社交', 'guillaume', 340, 34,
    { 品位: 48, 威厳: 46, 貞操: 20 }, [{ axis: '貞操', amount: 16 }],
    '手紙と来客を捌く。夜まで屋敷に留め置かれる日もある。'),
  makeJob('tutor', '商家の娘の家庭教師', '社交', 'claire', 225, 26,
    { 品位: 62, 貞操: 50 }, [{ axis: '品位', amount: 6 }],
    '教える相手は、かつて挨拶にも来られなかった家の娘。'),
  makeJob('escort', '夜会への同伴', '社交', 'count', 265, 24,
    { 威厳: 34, 貞操: 12 }, [{ axis: '威厳', amount: 12 }, { axis: '貞操', amount: 8 }],
    '伯爵の連れとして立つ。何の連れかは、誰も口に出さない。'),

  // 実務 ── 誰にも見られない仕事。差し出すものは無いが、安い。
  makeJob('copyist', '学院文書の筆耕', '実務', 'claire', 175, 20,
    { 品位: 70, 貞操: 60 }, [],
    '筆写するだけの静かな仕事。誰も彼女の素性を訊かない。'),
  makeJob('ledger', '商会の帳簿整理', '実務', 'vernet', 130, 24,
    { 品位: 40, 貞操: 25 }, [],
    '数字は多いが、日が暮れるまでに終えれば約束の額になる。'),

  // 人前 ── 見られる仕事。品位が落ちるほど、条件が悪くなる。
  makeJob('market', '市場の仕入れ交渉', '人前', 'marc', 245, 28,
    { 品位: 28 }, [{ axis: '威厳', amount: 9 }],
    '往来で声を張って値を争う。見物人は貴族の令嬢を面白がる。'),
  makeJob('banquet', '商家の晩餐で給仕', '人前', 'jean', 215, 30,
    { 品位: 18 }, [{ axis: '品位', amount: 14 }],
    '客の中に、かつて彼女に頭を下げた者が混じっている。'),
  makeJob('auction', '旧家財の競売補佐', '人前', 'marc', 165, 22,
    { 威厳: 14 }, [{ axis: '威厳', amount: 8 }],
    '誰かの家財に値をつける。明日は自分の番かもしれない。'),

  // 労務 ── 何も残っていなくても受けられる、最後の一段。
  makeJob('packing', '商会倉庫の荷造り', '労務', 'marc', 95, 38,
    {}, [{ axis: '品位', amount: 10 }],
    '誰でもできる安全な仕事。荷を担ぐ令嬢を、皆が見ている。'),

  // 裏 ── 落ちて初めて回ってくる。実入りはいいが、戻り道を塞ぐ。
  makeJob('private', '個室での接待', '裏', 'jean', 300, 26,
    {}, [{ axis: '貞操', amount: 18 }],
    'そういう話が来るようになった、ということだった。',
    { opensBelow: { 貞操: 45 } }),
  makeJob('show', '見世物小屋の客寄せ', '裏', 'marc', 205, 30,
    {}, [{ axis: '威厳', amount: 10 }, { axis: '品位', amount: 6 }],
    '「元・貴族の令嬢」と書いた札が、彼女の横に立てられる。',
    { opensBelow: { 威厳: 28 } }),
];

export const initialState: GameState = {
  chapter: 1,
  day: 1,
  carryOver: 0,
  awaitingSettlement: false,
  money: 120,
  debt: TOTAL_DEBT,
  stamina: 82,
  dignityCap: 100,
  axes: { 貞操: 100, 品位: 100, 威厳: 100 },
  relations: { vernet: 0, jean: 0, claire: 0, guillaume: 0, count: 0, marc: 0 },
  recent: [],
  log: ['返済期限まで、あと14日。まだ、どこへでも行ける。'],
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
  relations: { vernet: 1, jean: 0, claire: 0, guillaume: 2, count: 1, marc: 1 },
  recent: ['guillaume', 'vernet'],
  log: ['五日が過ぎた。差し出したものは、もう帳簿には戻らない。'],
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

/** いま受けられるか。上の仕事は尊厳で閉じ、裏の仕事は落ちて初めて開く。 */
export function isOpen(job: Job, state: GameState): boolean {
  return meetsNeeds(job, state) && !notYetFallen(job, state);
}

/** 尊厳が足りずに閉じた軸。跡の表示に使う（まだ現れていない依頼は跡ではない）。 */
export function closedBy(job: Job, state: GameState): Axis[] {
  return axes.filter((axis) => state.axes[axis] < (job.needs[axis] ?? 0));
}

/** 種別ごとに、いま受けられる件数。「何が回ってこなくなったか」を出すのに使う。 */
export function countsByKind(state: GameState): Record<JobKind, number> {
  const out = Object.fromEntries(jobKinds.map((k) => [k, 0])) as Record<JobKind, number>;
  jobs.forEach((job) => { if (isOpen(job, state)) out[job.kind] += 1; });
  return out;
}

/** いま受けられる依頼すべて。仕事メニューはここから作る。 */
export function openJobs(state: GameState): Job[] {
  return jobs.filter((job) => isOpen(job, state));
}

/** その場所で、いま受けられる依頼の数。 */
export function openCountAt(place: PlaceId, state: GameState): number {
  return jobsAt(place).filter((job) => isOpen(job, state)).length;
}

/** 紹介されなくなった依頼。消さずに跡として残す(§5)。 */
export function closedJobsAt(place: PlaceId, state: GameState): Job[] {
  // まだ現れていない依頼は「跡」ではないので除く
  return jobsAt(place).filter((job) => !isOpen(job, state) && !notYetFallen(job, state));
}

/* --- 常設リストの単調さを防ぐ：同じ場所に通い詰めると買い叩かれる --- */

export const RECENT_WINDOW = 3;
const FATIGUE_RATE = [1, 0.82, 0.68, 0.58];

/** 直近 RECENT_WINDOW 日のうち、その場所で働いた回数。 */
export function personFatigue(person: PersonId, state: GameState): number {
  return state.recent.slice(0, RECENT_WINDOW).filter((id) => id === person).length;
}

/** 通い詰めによる相場の下落率（1 = 定価）。 */
export function fatigueRate(person: PersonId, state: GameState): number {
  return FATIGUE_RATE[Math.min(personFatigue(person, state), FATIGUE_RATE.length - 1)];
}

/** その場所の誰かが買い叩いてくる状態か。地図の表示に使う。 */
export function placeDiscount(place: PlaceId, state: GameState): number {
  const rates = peopleAt(place).map((p) => fatigueRate(p.id, state));
  return rates.length ? Math.min(...rates) : 1;
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
    quota, paid, shortfall, interest,
    penalties: shortfall > 0 ? LATE_PENALTY : [],
    debtBefore: state.debt,
    debtAfter,
    nextQuota: finished ? 0 : baseQuota(state.chapter + 1) + shortfall + interest,
    finished,
    cleared: finished && debtAfter <= 0,
  };
}

/** 精算を適用して次章へ。最終章なら ended を立てる。 */
export function applySettlement(state: GameState, s: Settlement): GameState {
  const axes2 = { ...state.axes };
  s.penalties.forEach((p) => { axes2[p.axis] = Math.max(0, axes2[p.axis] - p.amount); });
  axes2.品位 = Math.min(axes2.品位, state.dignityCap);
  return {
    ...state,
    money: state.money - s.paid,
    debt: s.debtAfter,
    axes: axes2,
    carryOver: s.shortfall + s.interest,
    awaitingSettlement: false,
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
    貞操: ['守られている', '応じはじめている', '数えられなくなった', '拒む理由がない'],
    品位: ['令嬢として扱われる', '軽んじられている', '見下されている', '人として扱われない'],
    威厳: ['家名は保たれている', '噂されている', '見世物になっている', '街の晒し者'],
  };
  const [high, mid, low, bottom] = stages[axis];
  if (value >= 76) return high;
  if (value >= 51) return mid;
  if (value >= 26) return low;
  return bottom;
}

export function relationLabel(value: number): string {
  return ['疎遠', '既知', '信頼', '懇意'][value] ?? '懇意';
}

/** その依頼で下がる品位の上限。品位を払う依頼だけ発生する。 */
export function capDropOf(job: Job): number {
  const dignity = job.costs.find((c) => c.axis === '品位');
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

export const NETWORK_COST = 20;
export const NETWORK_STAMINA = 8;
export const REST_RECOVERY = 58;

/* ---------------- イベントシーン ----------------
   依頼を受けたあとに流れる「本番」。遊ぶ場所ではなく観る場所なので、
   選択は出さず、タップで送るだけにする。
   差分は台詞で担当し、絵は art.ts の規約で1枚ずつ差し替える。 */

export type SceneLine = { speaker?: string; text: string };

const HEROINE = 'エレオノール';

const scriptByAxis: Record<Axis, SceneLine[]> = {
  貞操: [
    { speaker: HEROINE, text: '「……先に、お金の話を終わらせてください」' },
    { text: '依頼人は答えなかった。かわりに、扉の鍵が回る音がした。' },
    { speaker: HEROINE, text: '「終わったら、約束の額はきちんと」' },
    { text: 'そう言うのが、いちばん早いと知ってしまった。' },
  ],
  品位: [
    { text: '「おい、そこの。名前は要らん。"女"で通す」' },
    { text: '一度だけ訂正しようとして、やめた。' },
    { text: '訂正したところで、日当が増えるわけではない。' },
    { speaker: HEROINE, text: '「……はい」' },
  ],
  威厳: [
    { text: '「ラティエ家のご令嬢が、うちの店先に立つ。それだけで客が来る」' },
    { text: '通りには、見覚えのある顔がいくつもあった。' },
    { text: '目が合う。相手のほうが、慌てて逸らした。' },
    { text: '明日には、街じゅうが知っている。' },
  ],
};

const plainScript: SceneLine[] = [
  { text: '言われた通りに、言われた分だけ働いた。' },
  { text: '誰も彼女を見なかった。' },
  { text: 'それが、今日いちばんの収穫だった。' },
];

/** 受けた依頼の台本。削る軸で決まる。複数なら軸の順に繋ぐ。 */
export function sceneScript(job: Job): SceneLine[] {
  const person = personOf(job.person);
  const opening: SceneLine = { text: `${placeOf(person.place).name}／${job.title}。` };
  if (job.costs.length === 0) return [opening, ...plainScript];
  const ordered = axes.filter((axis) => job.costs.some((c) => c.axis === axis));
  return [opening, ...ordered.flatMap((axis) => scriptByAxis[axis])];
}

/** 絵を決める主軸。 */
export function primaryAxis(job: Job): Axis | null {
  return axes.find((axis) => job.costs.some((c) => c.axis === axis)) ?? null;
}

/** 関係が新しい段階に入った日の一言。上がっていなければ空。 */
export function stageUpLine(person: PersonId, before: number, after: number): SceneLine[] {
  if (after <= before || after < 1 || after > 3) return [];
  const p = personOf(person);
  return [{ speaker: p.name, text: p.stageLines[after - 1] }];
}
