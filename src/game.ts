// ゲームのルールとデータ。画面(App.tsx)からは、ここが返す値を表示するだけにする。
// 数値の根拠は GAME_DESIGN.md。変更するときは企画書側と必ず揃える。

export type Skill = '礼法' | '学識' | '商才';
export type Axis = '貞操' | '品位' | '威厳';
export type PlaceId = 'estate' | 'arnaud' | 'academy' | 'valere' | 'guild';

export const skills: Skill[] = ['礼法', '学識', '商才'];
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
export const MAX_STAMINA = 100;

/** その依頼を受けると必ず削られるもの。選ばせない。 */
export type JobCost = { axis: Axis; amount: number };

export type Job = {
  id: string;
  title: string;
  person: PersonId;
  skill: Skill;
  required: number;
  pay: number;
  stamina: number;
  description: string;
  /** 品位がこの値を下回ると紹介されなくなる（§5「軽い依頼が母集団から消える」）。 */
  dignityFloor: number;
  /** 空なら「何も差し出さずに済む仕事」。 */
  costs: JobCost[];
};

export type GameState = {
  day: number;
  money: number;
  debt: number;
  stamina: number;
  /** 品位の上限。§1-4「現在値は戻る。ただし上限は下がったまま戻らない」。 */
  dignityCap: number;
  skills: Record<Skill, number>;
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
  id: string, title: string, person: PersonId, skill: Skill,
  required: number, pay: number, stamina: number, dignityFloor: number,
  costs: JobCost[], description: string,
): Job {
  return { id, title, person, skill, required, pay, stamina, dignityFloor, costs, description };
}

// dignityFloor が高い依頼ほど「軽い/まともな」依頼で、品位が落ちると先に消える。
// costs が空の依頼が「何も差し出さずに済む道」。報酬は低い。
export const jobs: Job[] = [
  makeJob('copyist', '学院文書の筆耕', 'claire', '学識', 1, 175, 20, 62,
    [], '筆写するだけの静かな仕事。誰も彼女の素性を訊かない。'),
  makeJob('ledger', '商会の帳簿整理', 'vernet', '学識', 1, 130, 24, 40,
    [], '数字は多いが、日が暮れるまでに終えれば約束の額になる。'),
  makeJob('tutor', '商家の娘の家庭教師', 'claire', '学識', 2, 225, 26, 70,
    [{ axis: '品位', amount: 6 }], '教える相手は、かつて挨拶にも来られなかった家の娘。'),
  makeJob('auction', '旧家財の競売補佐', 'marc', '商才', 0, 165, 22, 28,
    [{ axis: '威厳', amount: 8 }], '誰かの家財に値をつける。明日は自分の番かもしれない。'),
  makeJob('market', '市場の仕入れ交渉', 'marc', '商才', 2, 245, 28, 34,
    [{ axis: '威厳', amount: 9 }], '往来で声を張って値を争う。見物人は貴族の令嬢を面白がる。'),
  makeJob('packing', '商会倉庫の荷造り', 'marc', '商才', 0, 95, 38, 0,
    [{ axis: '品位', amount: 10 }], '誰でもできる安全な仕事。荷を担ぐ令嬢を、皆が見ている。'),
  makeJob('banquet', '商家の晩餐で給仕', 'jean', '礼法', 1, 215, 30, 20,
    [{ axis: '品位', amount: 14 }], '客の中に、かつて彼女に頭を下げた者が混じっている。'),
  makeJob('escort', '夜会への同伴', 'count', '礼法', 1, 265, 24, 12,
    [{ axis: '威厳', amount: 12 }, { axis: '貞操', amount: 8 }],
    '伯爵の連れとして立つ。何の連れかは、誰も口に出さない。'),
  makeJob('secretary', '伯爵家の臨時秘書', 'guillaume', '礼法', 3, 340, 34, 55,
    [{ axis: '貞操', amount: 16 }], '手紙と来客を捌く。夜まで屋敷に留め置かれる日もある。'),
];

export const initialState: GameState = {
  day: 1,
  money: 120,
  debt: 1800,
  stamina: 82,
  dignityCap: 100,
  skills: { 礼法: 1, 学識: 1, 商才: 0 },
  axes: { 貞操: 100, 品位: 100, 威厳: 100 },
  relations: { vernet: 0, jean: 0, claire: 0, guillaume: 0, count: 0, marc: 0 },
  recent: [],
  log: ['返済期限まで、あと14日。まだ、どこへでも行ける。'],
  ended: false,
};

/** 中盤の疑似再現（§13 MVP の初期状態B）。冒頭は何も失っていないため、企画の売りが出ない。 */
export const midGameState: GameState = {
  ...initialState,
  day: 6,
  money: 540,
  stamina: 44,
  dignityCap: 74,
  skills: { 礼法: 2, 学識: 2, 商才: 1 },
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

/** まだ紹介してもらえるか。品位が落ちると、軽い依頼から順に閉じる(§5)。 */
export function isOpen(job: Job, state: GameState): boolean {
  return state.axes.品位 >= job.dignityFloor;
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
  return jobsAt(place).filter((job) => !isOpen(job, state));
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

/** 人脈が深いほど求められる技能が下がる。 */
export function requiredSkillFor(job: Job, state: GameState): number {
  return Math.max(0, job.required - Math.floor(state.relations[job.person] / 2));
}

/** 技能が足りているか。足りない依頼は受けられない（肩代わりする手段は無い）。 */
export function hasSkillFor(job: Job, state: GameState): boolean {
  return state.skills[job.skill] >= requiredSkillFor(job, state);
}

/** 技能の不足分。表示用。 */
export function skillShortage(job: Job, state: GameState): number {
  return Math.max(0, requiredSkillFor(job, state) - state.skills[job.skill]);
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

export const TRAIN_COST = 70;
export const TRAIN_STAMINA = 12;
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
