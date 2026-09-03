// ゲームのルールとデータ。画面(App.tsx)からは、ここが返す値を表示するだけにする。
// 数値の根拠は GAME_DESIGN.md。変更するときは企画書側と必ず揃える。

export type Skill = '礼法' | '学識' | '商才';
export type Axis = '貞操' | '品位' | '威厳';
export type Client = 'アルノー商会' | '王立学院' | 'ヴァレール伯爵家' | '街の組合';

export const skills: Skill[] = ['礼法', '学識', '商才'];
export const axes: Axis[] = ['貞操', '品位', '威厳'];
export const clients: Client[] = ['アルノー商会', '王立学院', 'ヴァレール伯爵家', '街の組合'];

export const CHAPTER_DAYS = 14;
export const MAX_STAMINA = 100;

export type Concession = {
  axis: Axis;
  title: string;
  detail: string;
  bonus: number;
  cost: number;
};

export type Job = {
  id: string;
  title: string;
  client: Client;
  skill: Skill;
  required: number;
  pay: number;
  stamina: number;
  description: string;
  /** 品位がこの値を下回ると紹介されなくなる（§5「軽い依頼が母集団から消える」）。 */
  dignityFloor: number;
  concessions: Concession[];
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
  relations: Record<Client, number>;
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
};

const terms: Record<Axis, [string, string]> = {
  貞操: ['個人的な要求も受ける', '仕事の後、依頼人の私室まで付き添う。'],
  品位: ['扱いへの異議を捨てる', '役目も呼び方も、相手の決めたものを受け入れる。'],
  威厳: ['人目のある条件を呑む', '没落した家名ごと、客寄せとして使わせる。'],
};

function makeJob(
  id: string, title: string, client: Client, skill: Skill,
  required: number, pay: number, stamina: number, dignityFloor: number, description: string,
): Job {
  return {
    id, title, client, skill, required, pay, stamina, dignityFloor, description,
    concessions: axes.map((axis, index) => ({
      axis,
      title: terms[axis][0],
      detail: terms[axis][1],
      bonus: 105 + required * 25 + index * 20,
      cost: 9 + required + index,
    })),
  };
}

// dignityFloor が高い依頼ほど「軽い/まともな」依頼で、品位が落ちると先に消える。
export const jobs: Job[] = [
  makeJob('tutor', '商家の娘の家庭教師', '王立学院', '学識', 2, 210, 26, 70, '静かな仕事だが、学院の推薦に応える知識が必要だ。'),
  makeJob('copyist', '学院文書の筆耕', '王立学院', '学識', 2, 175, 20, 62, '報酬は控えめだが、継続雇用につながる。'),
  makeJob('secretary', '伯爵家の臨時秘書', 'ヴァレール伯爵家', '礼法', 3, 300, 34, 55, '社交界の手紙と来客を一日で捌く高額依頼。'),
  makeJob('ledger', '商会の帳簿整理', 'アルノー商会', '学識', 1, 130, 24, 40, '数字は多いが、日が暮れるまでに終えれば約束の額になる。'),
  makeJob('market', '市場の仕入れ交渉', '街の組合', '商才', 2, 220, 28, 34, '相場を読み、複数の店を回って条件をまとめる。'),
  makeJob('auction', '旧家財の競売補佐', '街の組合', '商才', 1, 160, 22, 28, '品物の来歴を語り、少しでも高く売る。'),
  makeJob('banquet', '商家の晩餐で給仕', 'アルノー商会', '礼法', 2, 190, 30, 20, '客は作法に厳しい。かつての身分を面白がる者もいる。'),
  makeJob('escort', '夜会への同伴', 'ヴァレール伯爵家', '礼法', 2, 240, 24, 12, '昔の知人と顔を合わせる可能性がある。'),
  makeJob('packing', '商会倉庫の荷造り', '街の組合', '商才', 0, 95, 38, 0, '誰でもできる安全な仕事。ただしひどく疲れる。'),
];

export const initialState: GameState = {
  day: 1,
  money: 120,
  debt: 1800,
  stamina: 82,
  dignityCap: 100,
  skills: { 礼法: 1, 学識: 1, 商才: 0 },
  axes: { 貞操: 100, 品位: 100, 威厳: 100 },
  relations: { アルノー商会: 0, 王立学院: 0, ヴァレール伯爵家: 0, 街の組合: 0 },
  log: ['返済期限まで、あと14日。机には三通の依頼状が届いている。'],
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
  relations: { アルノー商会: 1, 王立学院: 0, ヴァレール伯爵家: 2, 街の組合: 1 },
  log: ['五日が過ぎた。差し出したものは、もう帳簿には戻らない。'],
};

/** 日で決まる並び替え。同じ日は必ず同じ顔ぶれになる(セーブと再訪で揺れない)。 */
function seededOrder(count: number, seed: number): number[] {
  const order = Array.from({ length: count }, (_, index) => index);
  let state = (seed * 9301 + 49297) % 233280;
  for (let i = count - 1; i > 0; i -= 1) {
    state = (state * 9301 + 49297) % 233280;
    const j = state % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/** その日に紹介される3件。品位が落ちるほど「軽い依頼」が母集団から消える(§5)。 */
export function offersForDay(day: number, dignity: number): Job[] {
  const pool = jobs.filter((job) => dignity >= job.dignityFloor);
  if (pool.length <= 3) return pool;
  return seededOrder(pool.length, day).slice(0, 3).map((index) => pool[index]);
}

/** 紹介されなくなった依頼。消さずに跡として残す(§5)。 */
export function retiredJobs(dignity: number): Job[] {
  return jobs.filter((job) => dignity < job.dignityFloor);
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
  return Math.max(0, job.required - Math.floor(state.relations[job.client] / 2));
}

/** 技能の不足分。この数だけ上乗せを受け入れないと依頼を受けられない。 */
export function shortageFor(job: Job, state: GameState): number {
  return Math.max(0, requiredSkillFor(job, state) - state.skills[job.skill]);
}

export function payWithRelation(job: Job, state: GameState): number {
  return job.pay + state.relations[job.client] * 25;
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

/** 受けた依頼と、払った軸から台本を組む。払った軸が複数なら重い順に繋ぐ。 */
export function sceneScript(job: Job, paidAxes: Axis[]): SceneLine[] {
  const opening: SceneLine = { text: `${job.client}／${job.title}。` };
  if (paidAxes.length === 0) return [opening, ...plainScript];
  const ordered = axes.filter((axis) => paidAxes.includes(axis));
  return [opening, ...ordered.flatMap((axis) => scriptByAxis[axis])];
}

/** 台本のうち、絵を決める主軸。 */
export function primaryAxis(paidAxes: Axis[]): Axis | null {
  return axes.find((axis) => paidAxes.includes(axis)) ?? null;
}
