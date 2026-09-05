import {
  axes,
  jobs,
  people,
  personOf,
  places,
  recipes,
  materialIds,
  CHAPTER_DAYS,
  CHAPTERS,
  MAX_STAMINA,
  recipesTaughtBy,
  canBrew,
  brewOnce,
  placeOpen,
  materialOf,
  relationStage,
  sceneScript,
  stageUpLine,
  settlementOf,
  applySettlement,
  type GameState,
  type DayResult,
  type PersonId,
  type PlaceId,
  type RecipeId,
  type MaterialId,
  type SceneLine,
} from "./game";
import {
  absoluteDay,
  expireObligations,
  grantCapabilities,
  offerKey,
  offerReason,
  validateOffers,
} from "./contracts";
import { supportOffers, capabilityLabels } from "./content/support";
import { planDelivery, type DeliverySelection } from "./delivery";
import { applyRewards } from "./rewards";
import { storyEvents } from "./content/events";
import type { SupportOffer } from "./supportTypes";

export type Action =
  | ({ type: "deliver" } & DeliverySelection)
  | { type: "read-event"; id: string }
  | { type: "visit"; place: PlaceId }
  | { type: "job"; id: string }
  | { type: "rest" }
  | { type: "end-day" }
  | { type: "network"; person: PersonId }
  | { type: "gather"; place: PlaceId }
  | { type: "buy"; place: PlaceId; basket: Partial<Record<MaterialId, number>> }
  | { type: "brew"; recipe: RecipeId; quantity?: number }
  | { type: "settle" }
  | { type: "accept" | "decline"; offer: string }
  | { type: "fulfill"; id: string; option: string }
  | { type: "pay" | "cancel" | "renegotiate"; id: string };
export type ActionOutcome = {
  state: GameState;
  result?: DayResult;
  scene?: SceneLine[];
  /** 場面の背景に使う場所。画面側で推測させない。 */
  scenePlace?: PlaceId;
  error?: string;
};
const fail = (message: string): never => {
  throw new Error(message);
};

/** 唯一の行動入口。失敗時は入力状態を変えない。UI・テスト・simで共用する。 */
export function performAction(
  before: GameState,
  action: Action,
  offers: SupportOffer[] = supportOffers,
): ActionOutcome {
  try {
    if (action.type === "read-event") {
      if (before.eventQueue[0]?.id !== action.id)
        fail("未再生イベントが見つかりません");
      const next = structuredClone(before);
      next.eventQueue.shift();
      next.playedEvents.push(action.id);
      next.history.push({
        day: absoluteDay(before),
        kind: "read-event",
        target: action.id,
      });
      return { state: next };
    }
    if (
      action.type === "rest" ||
      action.type === "network" ||
      (action.type === "job" &&
        jobs.find((j) => j.id === action.id)?.category !== "ordinary")
    )
      fail("この行動は廃止されました。依頼・収集・調合から選んでください");
    if (before.ended) fail("この育成は終了しています");
    if (
      before.awaitingSettlement &&
      action.type !== "settle" &&
      action.type !== "pay"
    )
      fail("章末の精算を先に終えてください");
    const s = structuredClone(before);
    let title = "",
      narrative = "",
      days = 0,
      worked: PersonId | "none" | PersonId[] = "none",
      publicWork = false;
    let scene: ActionOutcome["scene"];
    let scenePlace: PlaceId | undefined;
    let delivered: DayResult["delivered"];
    let deliveries: DayResult["deliveries"];
    let relationUp: DayResult["relationUp"];
    let kind: DayResult["kind"] = "support";
    const notices: string[] = [];
    const ensureDays = (n: number) => {
      if (s.awaitingSettlement || n > CHAPTER_DAYS - s.day + 1)
        fail("今章の残り日数が足りません");
    };
    const unlock = (ids: string[]) => {
      grantCapabilities(s, ids).forEach((id) =>
        notices.push(`解禁：${capabilityLabels[id] ?? id}`),
      );
    };
    const advanceRelation = (
      id: PersonId,
      amount: number,
      teaches?: RecipeId,
    ) => {
      const old = s.relations[id];
      s.relations[id] = Math.min(3, old + amount);
      const learned = recipesTaughtBy(id, old, s.relations[id], s.known);
      s.known = [
        ...new Set([...s.known, ...learned, ...(teaches ? [teaches] : [])]),
      ];
      if (s.relations[id] > old)
        relationUp = {
          name: people.find((p) => p.id === id)!.name,
          stage: relationStage(s.relations[id]),
        };
    };
    if (action.type === "visit") {
      const p = places.find((p) => p.id === action.place);
      if (!p || !placeOpen(p, s)) fail("この場所へはまだ行けません");
      s.newPlaces = s.newPlaces.filter((id) => id !== action.place);
      s.newPeople = s.newPeople.filter(
        (id) => people.find((p) => p.id === id)?.place !== action.place,
      );
      s.newEvents = s.newEvents.filter(
        (id) => storyEvents.find((e) => e.id === id)?.place !== action.place,
      );
      return { state: s };
    }
    if (action.type === "settle") {
      if (!s.awaitingSettlement) fail("まだ章末ではありません");
      const next = applySettlement(s, settlementOf(s));
      if (next.ended) {
        expireObligations(next, CHAPTERS * CHAPTER_DAYS);
      }
      return { state: next };
    }
    if (action.type === "brew") {
      const recipe = recipes.find((r) => r.id === action.recipe);
      const quantity = action.quantity ?? 1;
      if (
        !Number.isSafeInteger(quantity) ||
        quantity < 1 ||
        !recipe ||
        !canBrew(recipe, s) ||
        s.stamina < recipe.stamina * quantity ||
        Object.entries(recipe.needs).some(
          ([id, n]) => s.materials[id as MaterialId] < n! * quantity,
        )
      )
        fail("指定数の処方・素材・スタミナを確認してください");
      let next = s;
      for (let i = 0; i < quantity; i++) next = brewOnce(next, action.recipe);
      return { state: next };
    }
    if (action.type === "end-day") {
      days = 1;
      kind = "end-day";
      title = "一日を終える";
      narrative = "今日の帳面を閉じた。";
      s.axes.品位 = Math.min(s.dignityCap, s.axes.品位 + 6);
      if (!s.today.publicWork) s.axes.威厳 = Math.min(100, s.axes.威厳 + 2);
      s.recent = [
        s.today.deliveries.length
          ? [...s.today.deliveries].sort()
          : ("none" as const),
        ...s.recent,
      ].slice(0, 6);
      notices.push(...expireObligations(s, absoluteDay(s)));
      s.history.push({
        day: absoluteDay(s),
        kind: "end-day",
        target: String(absoluteDay(s)),
      });
      s.today = {
        worked: [],
        relationGranted: [],
        publicWork: false,
        deliveries: [],
      };
      if (s.day === CHAPTER_DAYS) s.awaitingSettlement = true;
      else {
        s.day += 1;
        s.stamina = MAX_STAMINA;
      }
    } else if (
      action.type === "deliver" ||
      (action.type === "job" &&
        jobs.find((j) => j.id === action.id)?.category === "ordinary")
    ) {
      const selection =
        action.type === "deliver"
          ? action
          : { ordinary: [action.id], promises: [] };
      const plan = planDelivery(before, selection);
      if (plan.error) fail(plan.error);
      kind = "job";
      title = "納品";
      s.money += plan.pay;
      s.stamina -= plan.stamina;
      for (const [id, count] of Object.entries(plan.stock))
        s.stock[id as RecipeId] = (s.stock[id as RecipeId] ?? 0) - count!;
      plan.costs.forEach((c) => {
        s.axes[c.axis] = Math.max(0, s.axes[c.axis] - c.amount);
      });
      s.dignityCap = Math.max(0, s.dignityCap - plan.cap);
      publicWork = plan.costs.some((c) => c.axis === "威厳" && c.amount > 0);
      worked = [...new Set(plan.lines.map((l) => l.person))].sort();
      // 通常依頼による関係は相手ごとに1回。各報酬額は既に出発時点で確定済み。
      [...new Set(plan.lines.filter((l) => !l.option).map((l) => l.person))]
        .sort()
        .forEach((id) => {
          if (!s.today.relationGranted.includes(id)) {
            advanceRelation(id, 1);
            s.today.relationGranted.push(id);
            // 表では買えない素材が、関係の段階で届くようになる。1日1回だけ。
            for (const gift of personOf(id).supplies ?? [])
              if (s.relations[id] >= gift.stage) {
                s.materials[gift.material] += gift.amount;
                notices.push(
                  `${personOf(id).name}から${materialOf(gift.material).name}×${gift.amount}`,
                );
              }
          }
        });
      for (const line of plan.lines) {
        if (line.option) {
          const o = s.obligations.find((o) => o.id === line.id)!;
          o.status = "fulfilled";
          o.outstanding = 0;
          unlock([
            ...o.terms.unlocks,
            ...o.terms.options.find((c) => c.id === line.option)!.unlocks,
          ]);
          if (!o.terms.schedule) advanceRelation(o.terms.person, 1);
          notices.push(
            ...applyRewards(s, o.id, o.terms.rewards ?? [], advanceRelation),
          );
        }
        s.history.push({
          day: absoluteDay(before),
          kind: line.option ? "fulfill" : "job",
          target: line.id,
          ...(line.option ? { choice: line.option } : {}),
        });
      }
      for (const id of worked as PersonId[]) {
        const person = people.find((p) => p.id === id)!;
        s.known = [
          ...new Set([
            ...s.known,
            ...(person.teaches ?? [])
              .filter((t) => s.relations[id] >= t.stage)
              .map((t) => t.recipe),
          ]),
        ];
      }
      s.today.deliveries = [
        ...s.today.deliveries,
        ...plan.lines.map((l) => l.person),
      ].sort();
      const raised = (worked as PersonId[]).filter(
        (id) => s.relations[id] > before.relations[id],
      );
      // 納品は必ず場面を挟む。ここが「観る場所」で、遊ぶ場所ではない。
      scene = [
        ...plan.lines.flatMap((l) =>
          sceneScript({
            title: l.title,
            person: l.person,
            recipe: l.recipe,
            costs: l.costs,
          }),
        ),
        ...raised.flatMap((id) =>
          stageUpLine(id, before.relations[id], s.relations[id]),
        ),
      ];
      scenePlace = personOf(plan.lines[0].person).place;
      deliveries = plan.lines.map((l) => ({
        title: l.title,
        recipe: l.recipe,
        count: l.count,
        pay: l.pay,
      }));
      narrative = `${plan.lines.length}件を1回の出発で納め、${plan.pay}Gを受け取った。`;
    } else if (action.type === "gather") {
      const p = places.find((p) => p.id === action.place);
      if (
        !p ||
        !p.gathers ||
        !placeOpen(p, s) ||
        s.stamina < (p.gatherStamina ?? 20)
      )
        fail("ここでは今、採集できません");
      kind = "gather";
      title = `${p!.name}で採る`;
      narrative = "素材を摘んで帰った。";
      s.stamina -= p!.gatherStamina ?? 20;
      materialIds.forEach((id) => {
        s.materials[id] += p!.gathers?.[id] ?? 0;
      });
    } else if (action.type === "buy") {
      const p = places.find((p) => p.id === action.place);
      const entries = Object.entries(action.basket) as [MaterialId, number][];
      if (
        !p ||
        !placeOpen(p, s) ||
        !entries.some(([, n]) => n > 0) ||
        entries.some(
          ([id, n]) =>
            !p.sells?.includes(id) || !Number.isSafeInteger(n) || n < 0,
        )
      )
        fail("仕入れの内容を確認してください");
      const cost = entries.reduce(
        (sum, [id, n]) => sum + (materialOf(id).buy ?? 0) * n,
        0,
      );
      if (cost > s.money) fail("仕入れ資金が足りません");
      kind = "buy";
      title = "素材を仕入れる";
      narrative = `${cost}Gで素材を買い付けた。`;
      s.money -= cost;
      entries.forEach(([id, n]) => {
        s.materials[id] += n;
      });
    } else if (action.type === "accept" || action.type === "decline") {
      if (validateOffers(offers).length) fail("支援データの定義が不正です");
      const offer = offers.find((o) => o.id === action.offer);
      if (!offer) fail("この支援は見つかりません");
      const reason = offerReason(s, offer!);
      if (reason) fail(reason);
      const key = offerKey(s, offer!.id, !!offer!.schedule);
      title = offer!.title;
      if (action.type === "decline") {
        s.offerStates[key] = "declined";
        narrative = offer!.schedule
          ? "この特別依頼を辞退した。代償はない。"
          : "今回は引き受けない。代償はなく、次章には再び検討できる。";
      } else {
        ensureDays(0);
        s.offerStates[key] = "accepted";
        s.money += offer!.money;
        materialIds.forEach((id) => {
          s.materials[id] += offer!.materials[id] ?? 0;
        });
        s.obligations.push({
          id: key,
          offerId: offer!.id,
          acceptedDay: absoluteDay(s),
          due: offer!.schedule?.delivery ?? absoluteDay(s) + offer!.term,
          status: "active",
          outstanding: offer!.repayment,
          extensions: 0,
          terms: structuredClone(offer!),
        });
        narrative = `支援を受け取った。期限と未精算${offer!.repayment}Gを約束帳に記した。`;
        scene = [
          { text: title },
          { text: "支援の条件を読み、期限を確かめて受け取った。" },
          { text: narrative },
        ];
        scenePlace = personOf(offer!.person).place;
      }
      s.history.push({
        day: absoluteDay(before),
        kind: action.type,
        target: key,
      });
    } else {
      const actionId = "id" in action ? action.id : "";
      const obligation = s.obligations.find((o) => o.id === actionId);
      if (!obligation) fail("約束が見つかりません");
      const o = obligation!;
      title = o.terms.title;
      if (action.type === "pay") {
        if (o.outstanding <= 0 || s.money < o.outstanding)
          fail("未精算額を支払う資金が足りません");
        if (o.status === "active" && o.terms.kind !== "credit")
          fail("予約注文は納品するか、先に解消してください");
        const amount = o.outstanding;
        s.money -= amount;
        o.outstanding = 0;
        if (o.status === "active") {
          o.status = "fulfilled";
          unlock(o.terms.unlocks);
        }
        narrative = `${amount}Gを支払った。日数は進まない。`;
      } else if (action.type === "cancel") {
        if (o.status !== "active") fail("有効な約束だけ解消できます");
        o.status = "cancelled";
        narrative = `約束を解消した。未精算${o.outstanding}Gの返還義務が残る。支払いまで同じ相手の支援は停止する。`;
      } else if (action.type === "renegotiate") {
        if (
          o.terms.schedule ||
          o.status !== "active" ||
          o.extensions >= o.terms.extensionLimit
        )
          fail("この約束はこれ以上延長できません");
        if (o.due + o.terms.extensionDays > CHAPTERS * CHAPTER_DAYS)
          fail("最終期限を超えて延長できません");
        o.extensions += 1;
        o.due += o.terms.extensionDays;
        narrative = `相談し、期限を${o.terms.extensionDays}日延ばした。`;
      } else if (action.type === "fulfill") {
        const option = o.terms.options.find((c) => c.id === action.option);
        if (o.status !== "active" || !option) fail("この納品方法は選べません");
        const c = option!;
        return performAction(
          before,
          {
            type: "deliver",
            ordinary: [],
            promises: [{ id: o.id, option: c.id }],
          },
          offers,
        );
      }
      s.history.push({
        day: absoluteDay(before),
        kind: action.type,
        target: o.id,
      });
    }
    if (action.type !== "end-day") {
      const workers = Array.isArray(worked)
        ? worked
        : worked === "none"
          ? []
          : [worked];
      s.today.worked = [...new Set([...s.today.worked, ...workers])].sort();
      s.today.publicWork ||= publicWork;
      s.axes.品位 = Math.min(s.axes.品位, s.dignityCap);
    }
    const newlyOpen = offers.filter(
      (o) =>
        o.requirements.every(
          (r) => r.kind !== "relation" || before.relations[r.person] < r.level,
        ) &&
        offerReason(before, o) !== null &&
        offerReason(s, o) === null,
    );
    newlyOpen.forEach((o) => {
      if (!notices.some((n) => n.includes(o.title)))
        notices.push(`相談できる支援：${o.title}`);
    });
    s.log = [...notices, narrative, ...s.log].slice(0, 8);
    const result: DayResult = {
      kind,
      title,
      narrative,
      days,
      notices,
      basePay: s.money - before.money,
      relationBonus: 0,
      paidTerms: [],
      moneyDelta: s.money - before.money,
      staminaDelta: s.stamina - before.stamina,
      axisDrops: axes
        .filter((a) => s.axes[a] < before.axes[a])
        .map((axis) => ({ axis, amount: before.axes[axis] - s.axes[axis] })),
      axisGains: axes
        .filter((a) => s.axes[a] > before.axes[a])
        .map((axis) => ({ axis, amount: s.axes[axis] - before.axes[axis] })),
      dignityCapDrop: before.dignityCap - s.dignityCap,
      materialDeltas: materialIds
        .filter((id) => s.materials[id] !== before.materials[id])
        .map((id) => ({ id, amount: s.materials[id] - before.materials[id] })),
      learned: s.known.filter((id) => !before.known.includes(id)),
      delivered,
      deliveries,
      relationUp,
    };
    return { state: s, result, scene, scenePlace };
  } catch (e) {
    return {
      state: before,
      error: e instanceof Error ? e.message : "行動できませんでした",
    };
  }
}
