/**
 * ノベルパートの目録。**ゲーム内の場面を、ここが唯一の名簿として持つ。**
 *
 * ── なぜ目録を先に作るのか ──
 * 場面はこれまで `sceneScript` がその場で組み立てるだけで、**識別子も一覧も無かった**。
 * そのため「何場面あるのか」「どのCGが要るのか」「どのルートに何が属するのか」を
 * 数える方法が存在せず、発注も進捗も勘になっていた。
 *
 * この名簿は3つを同時に受け持つ。
 *   1. 回想（プレイヤーが見たものを読み返す場所。§14「引き継ぐ：回想」）
 *   2. CGの発注単位（`image` がそのままファイル名になる。ART_MANIFEST.md）
 *   3. 分岐の管理表（`route` が §8 のどの結末に属すかを示す）
 *
 * **まだ書いていない場面も載せる。** 未実装を伏せると、目録が進捗表として使えない。
 */
import {
  axes,
  jobs,
  people,
  personOf,
  placeOf,
  relationStage,
  sceneScript,
  type Axis,
  type Job,
  type PersonId,
  type PlaceId,
  type SceneLine,
} from "./game";

/** 場面が属する筋。§8「最も低い軸が、結末の方向を決める」に合わせる。 */
export type Route = Axis | "清廉" | "共通";
export type SceneKind = "依頼" | "関係" | "結末";

export type SceneEntry = {
  id: string;
  kind: SceneKind;
  title: string;
  route: Route;
  /** 一覧に出す短い添え書き。未解禁のときは「何をすれば出るか」になる。 */
  hint: string;
  place: PlaceId;
  person?: PersonId;
  /** 台本。まだ書いていない場面は空で、回想からは再生できない。 */
  lines: SceneLine[];
  /** 期待するCGのファイル名（`public/art/scene/` の下）。発注の単位。 */
  image: string;
  /**
   * §14「回想の解禁は非対称にする」。堕ちた側・破滅側はクリア後に全解禁し、
   * 清廉側は自力到達を要求する。ここは方針だけ持ち、解禁の実装は結末の実装と同時に入れる。
   */
  freeAfterClear: boolean;
};

/** その依頼が属する筋。主に削る軸で決める（代償が無ければ清廉）。 */
export const routeOfJob = (job: Job): Route =>
  axes.find((a) => job.costs.some((c) => c.axis === a && c.amount > 0)) ??
  "清廉";

const jobHint = (job: Job) =>
  job.costs.length
    ? `${personOf(job.person).name}の依頼を受ける（${job.costs
        .map((c) => `${c.axis}−${c.amount}`)
        .join("・")}）`
    : `${personOf(job.person).name}の依頼を受ける`;

/** 依頼の場面。24件それぞれが1つの場面であり、1枚のCGの発注単位。 */
const jobScenes: SceneEntry[] = jobs.map((job) => ({
  id: `job:${job.id}`,
  kind: "依頼",
  title: job.title,
  route: routeOfJob(job),
  hint: jobHint(job),
  place: personOf(job.person).place,
  person: job.person,
  lines: sceneScript({
    title: job.title,
    person: job.person,
    costs: job.costs,
    recipe: job.recipe,
  }),
  image: `${job.id}.png`,
  freeAfterClear: routeOfJob(job) !== "清廉",
}));

/** 関係の段階が上がった日の一言。人物ごとに3段階ぶん。 */
const bondScenes: SceneEntry[] = people.flatMap((p) =>
  p.stageLines.map((line, i) => ({
    id: `bond:${p.id}:${i + 1}`,
    kind: "関係" as const,
    title: `${p.name}・${relationStage(i + 1)}`,
    route: "共通" as Route,
    hint: `${p.name}との関係を${i + 1}段階まで進める`,
    place: p.place,
    person: p.id,
    lines: [
      { text: `${placeOf(p.place).name}。` },
      { speaker: p.name, text: line },
    ],
    image: `bond-${p.id}-${i + 1}.png`,
    freeAfterClear: false,
  })),
);

/**
 * 結末8種（GAME_DESIGN §8）。**最も低い軸 × 完済／未完済。**
 * 本文はまだ無い。目録に載せておくことで、回想がそのまま制作の進捗表になる。
 */
const endingRows: {
  id: string;
  route: Route;
  paid: boolean;
  title: string;
  hint: string;
}[] = [
  {
    id: "clear-intact",
    route: "清廉",
    paid: true,
    title: "何も差し出さずに返しきった",
    hint: "完済し、三軸のどれも大きく削らずに終える（最難関）",
  },
  {
    id: "clear-貞操",
    route: "貞操",
    paid: true,
    title: "家は残った。もうその屋敷で夜を過ごせない",
    hint: "完済し、貞操を最も低くして終える",
  },
  {
    id: "clear-品位",
    route: "品位",
    paid: true,
    title: "家は残った。そこに戻る形をしていない",
    hint: "完済し、品位を最も低くして終える",
  },
  {
    id: "clear-威厳",
    route: "威厳",
    paid: true,
    title: "家は残った。歩けるのは門の中だけ",
    hint: "完済し、威厳を最も低くして終える",
  },
  {
    id: "fail-intact",
    route: "清廉",
    paid: false,
    title: "彼女は残った",
    hint: "払うことを拒み続け、家を手放して終える",
  },
  {
    id: "fail-貞操",
    route: "貞操",
    paid: false,
    title: "何も守れず、何も返せなかった（貞操）",
    hint: "未完済のまま、貞操を最も低くして終える",
  },
  {
    id: "fail-品位",
    route: "品位",
    paid: false,
    title: "何も守れず、何も返せなかった（品位）",
    hint: "未完済のまま、品位を最も低くして終える",
  },
  {
    id: "fail-威厳",
    route: "威厳",
    paid: false,
    title: "破滅。街に居場所が無い",
    hint: "未完済のまま、威厳を最も低くして終える",
  },
];

const endingScenes: SceneEntry[] = endingRows.map((e) => ({
  id: `end:${e.id}`,
  kind: "結末",
  title: e.title,
  route: e.route,
  hint: e.hint,
  place: "estate",
  lines: [],
  image: `ending-${e.id}.png`,
  /* 堕ちた側・破滅側はクリア後に解禁。清廉側は自力到達を要求する（§14）。 */
  freeAfterClear: e.route !== "清廉" || !e.paid,
}));

export const sceneCatalog: SceneEntry[] = [
  ...jobScenes,
  ...bondScenes,
  ...endingScenes,
];

export const sceneOf = (id: string) => sceneCatalog.find((s) => s.id === id);

export const routes: Route[] = ["共通", "清廉", "貞操", "品位", "威厳"];

/** 目録の集計。制作の進捗と、プレイヤーの回収率の両方をこれで出す。 */
export function catalogCounts(seen: string[]) {
  const has = new Set(seen);
  const rows = sceneCatalog.map((s) => ({
    entry: s,
    seen: has.has(s.id),
    written: s.lines.length > 0,
  }));
  return {
    rows,
    seen: rows.filter((r) => r.seen).length,
    total: rows.length,
    written: rows.filter((r) => r.written).length,
  };
}
