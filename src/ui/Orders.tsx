import { ArrowRight, Bookmark, Check, Package, ScrollText } from "lucide-react";
import { specialOffers } from "../content/support";
import { absoluteDay, dateLabel, offerKey, offerReason } from "../contracts";
import { planDelivery } from "../delivery";
import type { Action } from "../engine";
import {
  axes,
  isOpen,
  jobs,
  payWithRelation,
  personOf,
  recipeOf,
  type GameState,
  type RecipeId,
} from "../game";
import { previewAction } from "../presentation";
import { rewardLabel } from "../rewards";
import type { SupportOffer } from "../supportTypes";
import type { UIState } from "../uiState";
import { Badge, Button, Empty, Heading, Item, money, Tabs } from "./components";
export function OfferDetails({ offer }: { offer: SupportOffer }) {
  return (
    <>
      <div className="stats">
        <div>
          <small>受付期間</small>
          <b>
            {offer.schedule
              ? `${offer.schedule.appears}〜${offer.schedule.closes}日目`
              : `${offer.opens}〜${offer.closes}日`}
          </b>
        </div>
        <div>
          <small>{offer.schedule ? "指定日当日のみ" : "支払期限"}</small>
          <b>
            {offer.schedule
              ? dateLabel(offer.schedule.delivery)
              : `相談から${offer.term}日`}
          </b>
        </div>
        <div>
          <small>前金 / 残額</small>
          <b>
            {money(offer.money)} / {money(offer.totalPay - offer.money)}
          </b>
        </div>
      </div>
      {offer.options.map((o) => (
        <div className="item-row" key={o.id}>
          <Item id={o.recipe} />
          <div>
            <b>
              {recipeOf(o.recipe).name} × {o.count}
            </b>
            <small>
              {o.days}日・体力 {o.stamina}
            </small>
          </div>
        </div>
      ))}
      <div className="reward-list">
        {offer.rewards?.map((r, i) => (
          <span key={i}>✧ {rewardLabel(r)}</span>
        ))}
      </div>
    </>
  );
}
export function Orders({
  s,
  ui,
  patch,
  confirm,
  prepare,
  journal,
}: {
  s: GameState;
  ui: UIState;
  patch: (p: Partial<UIState>) => void;
  confirm: (a: Action, title: string) => void;
  prepare: (id: RecipeId, n: number) => void;
  journal: () => void;
}) {
  const today = absoluteDay(s),
    selection = ui.selection;
  const count = selection.ordinary.length + selection.promises.length;
  let plan: ReturnType<typeof planDelivery> | undefined;
  let error = "";
  if (count)
    try {
      plan = planDelivery(s, selection);
      error = plan.error ?? "";
    } catch (e) {
      error = String((e as Error).message);
    }
  const toggle = (id: string) =>
    patch({
      selection: {
        ...selection,
        ordinary: selection.ordinary.includes(id)
          ? selection.ordinary.filter((x) => x !== id)
          : [...selection.ordinary, id],
      },
    });
  const promise = (id: string, option: string) =>
    patch({
      selection: {
        ...selection,
        promises: selection.promises.some(
          (p) => p.id === id && p.option === option,
        )
          ? selection.promises.filter((p) => p.id !== id)
          : [...selection.promises.filter((p) => p.id !== id), { id, option }],
      },
    });
  const deliverable = (id: string) =>
    !previewAction(s, { type: "deliver", ordinary: [id], promises: [] }).error;
  const ordinary = jobs
    .filter((j) => j.category === "ordinary" && isOpen(j, s))
    .filter((j) =>
      ui.filter === "ready"
        ? deliverable(j.id)
        : ui.filter === "need"
          ? !deliverable(j.id)
          : true,
    )
    .sort((a, b) =>
      ui.sort === "pay"
        ? payWithRelation(b, s) - payWithRelation(a, s)
        : recipeOf(a.recipe!).name.localeCompare(
            recipeOf(b.recipe!).name,
            "ja",
          ),
    );
  return (
    <>
      <Heading eyebrow="ORDER LETTERS" extra={<Badge>{count}件を選択</Badge>}>
        薬の依頼書
      </Heading>
      <Tabs
        value={ui.orderTab}
        onChange={(orderTab) => patch({ orderTab })}
        options={[
          ["normal", "通常依頼"],
          ["special", "特別依頼"],
          ["batch", `まとめ納品 (${count})`],
        ]}
      />
      {ui.orderTab === "normal" && (
        <>
          <p className="intro">
            薬と依頼書があれば、いつでも。選択は契約にならず、何度でも納められます。
          </p>
          <div className="filters">
            <label>
              表示
              <select
                value={ui.filter}
                onChange={(e) => patch({ filter: e.target.value })}
              >
                <option value="all">すべて</option>
                <option value="ready">納品可能</option>
                <option value="need">準備が必要</option>
              </select>
            </label>
            <label>
              並び順
              <select
                value={ui.sort}
                onChange={(e) => patch({ sort: e.target.value })}
              >
                <option value="name">薬の名前</option>
                <option value="pay">受取額の高い順</option>
              </select>
            </label>
          </div>
          <div className="order-grid">
            {ordinary.map((j) => {
              const selected = selection.ordinary.includes(j.id),
                stockReady = (s.stock[j.recipe!] ?? 0) >= j.count!,
                ready = deliverable(j.id);
              return (
                <article
                  className={`paper order-card ${selected ? "selected" : ""}`}
                  key={j.id}
                >
                  <div className="card-top">
                    <small>{personOf(j.person).name}</small>
                    <Badge tone={ready ? "ready" : "warn"}>
                      {ready
                        ? "納品可能"
                        : stockReady
                          ? "体力不足"
                          : "準備が必要"}
                    </Badge>
                  </div>
                  <div className="item-row">
                    <Item id={j.recipe!} large />
                    <div>
                      <h2>{recipeOf(j.recipe!).name}</h2>
                      <p>{j.title}</p>
                    </div>
                  </div>
                  <div className="stats">
                    <div>
                      <small>必要 / 在庫</small>
                      <b>
                        {j.count} / {s.stock[j.recipe!] ?? 0}
                      </b>
                    </div>
                    <div>
                      <small>受取額</small>
                      <b>{money(payWithRelation(j, s))}</b>
                    </div>
                    <div>
                      <small>体力</small>
                      <b>−{j.stamina}</b>
                    </div>
                  </div>
                  <div className="cost-line">
                    {axes.map((axis) => (
                      <span key={axis}>
                        {axis} −
                        {j.costs
                          .filter((c) => c.axis === axis)
                          .reduce((n, c) => n + c.amount, 0)}
                      </span>
                    ))}
                  </div>
                  <div className="card-actions">
                    <Button
                      primary={selected}
                      aria-pressed={selected}
                      onClick={() => toggle(j.id)}
                    >
                      {selected ? <Check size={16} /> : <Package size={16} />}{" "}
                      {selected ? "選択中" : "納品に選ぶ"}
                    </Button>
                    <Button
                      aria-label={`${j.title}を準備メモ${ui.memo.includes(j.id) ? "から外す" : "に登録"}`}
                      aria-pressed={ui.memo.includes(j.id)}
                      onClick={() =>
                        patch({
                          memo: ui.memo.includes(j.id)
                            ? ui.memo.filter((id) => id !== j.id)
                            : [...ui.memo, j.id],
                        })
                      }
                    >
                      <Bookmark size={17} />
                      {ui.memo.includes(j.id) ? "メモ済み" : "メモ"}
                    </Button>
                  </div>
                  {!stockReady && (
                    <Button
                      className="text-button"
                      onClick={() => {
                        patch({ memo: [...new Set([...ui.memo, j.id])] });
                        prepare(j.recipe!, j.count!);
                      }}
                    >
                      不足分を準備する <ArrowRight size={16} />
                    </Button>
                  )}
                </article>
              );
            })}
          </div>
          {!ordinary.length && (
            <Empty>
              この条件の依頼書はありません。表示条件を変えるか、人物との関係や処方を確認してください。
            </Empty>
          )}
        </>
      )}
      {ui.orderTab === "special" && (
        <>
          <p className="intro">
            受付中に前金を受け取り、指定日当日に納品。新しい人や場所への紹介につながります。
          </p>
          <div className="order-grid">
            {specialOffers
              .filter(
                (o) =>
                  o.schedule!.appears <= today &&
                  o.schedule!.closes >= today &&
                  !s.offerStates[offerKey(s, o.id, true)],
              )
              .map((o) => (
                <article className="paper special-card" key={o.id}>
                  <span className="wax-seal">
                    <ScrollText size={21} />
                  </span>
                  <small>{personOf(o.person).name}から</small>
                  <h2>{o.title}</h2>
                  <OfferDetails offer={o} />
                  <p className="muted">受諾は0日。指定日の延長はできません。</p>
                  {offerReason(s, o) && (
                    <p className="error">{offerReason(s, o)}</p>
                  )}
                  <Button
                    primary
                    disabled={!!offerReason(s, o)}
                    onClick={() =>
                      confirm(
                        { type: "accept", offer: o.id },
                        "前金を受け取って約束する",
                      )
                    }
                  >
                    条件を確認して受諾
                  </Button>
                </article>
              ))}
            {s.obligations
              .filter((o) => o.status === "active" && o.terms.schedule)
              .map((o) => {
                const ready = o.terms.options.some(
                  (c) => (s.stock[c.recipe] ?? 0) >= c.count,
                );
                return (
                  <article className="paper special-card" key={o.id}>
                    <Badge
                      tone={o.due === today ? "warn" : ready ? "ready" : ""}
                    >
                      {o.due === today
                        ? "本日納品"
                        : ready
                          ? "準備済み"
                          : "準備中"}
                    </Badge>
                    <h2>{o.terms.title}</h2>
                    <OfferDetails offer={o.terms} />
                    <Button
                      onClick={
                        o.due === today
                          ? () => patch({ orderTab: "batch" })
                          : journal
                      }
                    >
                      {o.due === today ? "まとめ納品へ" : "約束帳で確認"}
                    </Button>
                  </article>
                );
              })}
          </div>
          {!specialOffers.some(
            (o) =>
              o.schedule!.appears <= today &&
              o.schedule!.closes >= today &&
              !s.offerStates[offerKey(s, o.id, true)],
          ) &&
            !s.obligations.some(
              (o) => o.status === "active" && o.terms.schedule,
            ) && <Empty>現在、受付中・準備中の特別依頼はありません。</Empty>}
        </>
      )}
      {ui.orderTab === "batch" && (
        <>
          <p className="intro">
            相手や場所を問わず、選んだ依頼を1回の出発・1日で納めます。
          </p>
          <div className="split">
            <section>
              <h2>今日納める約束</h2>
              {s.obligations
                .filter(
                  (o) =>
                    o.status === "active" &&
                    o.terms.kind === "advance" &&
                    (o.terms.schedule ? o.due === today : o.due >= today),
                )
                .flatMap((o) =>
                  o.terms.options
                    .filter((c) => c.days === 1)
                    .map((c) => (
                      <article
                        className="paper compact"
                        key={`${o.id}:${c.id}`}
                      >
                        <h3>{o.terms.title}</h3>
                        <p>
                          {recipeOf(c.recipe).name} × {c.count} ／ 残額{" "}
                          {money(o.terms.totalPay - o.terms.money)}
                        </p>
                        <Button
                          aria-pressed={selection.promises.some(
                            (p) => p.id === o.id && p.option === c.id,
                          )}
                          onClick={() => promise(o.id, c.id)}
                        >
                          {selection.promises.some(
                            (p) => p.id === o.id && p.option === c.id,
                          )
                            ? "選択中・外す"
                            : "納品に選ぶ"}
                        </Button>
                      </article>
                    )),
                )}
              <h2>選択した依頼</h2>
              {plan?.lines.map((l) => (
                <div className="paper item-row" key={l.id}>
                  <Item id={l.recipe} />
                  <div>
                    <b>{l.title}</b>
                    <small>
                      {recipeOf(l.recipe).name} × {l.count} ／ {money(l.pay)}
                    </small>
                  </div>
                  <Button
                    aria-label={`${l.title}を選択から外す`}
                    onClick={() =>
                      l.option ? promise(l.id, l.option) : toggle(l.id)
                    }
                  >
                    外す
                  </Button>
                </div>
              ))}
              {!count && <Empty>通常依頼や本日の約束を選んでください。</Empty>}
            </section>
            <aside className="paper">
              <h2>納品の持ち物</h2>
              {Object.entries(plan?.stock ?? {}).map(([id, n]) => (
                <div className="material-need" key={id}>
                  <Item id={id as RecipeId} />
                  <div>
                    <b>
                      {recipeOf(id as RecipeId).name} × {n}
                    </b>
                    <small>
                      在庫 {s.stock[id as RecipeId] ?? 0} ／ 不足{" "}
                      {Math.max(0, n! - (s.stock[id as RecipeId] ?? 0))}
                    </small>
                  </div>
                  {(s.stock[id as RecipeId] ?? 0) < n! && (
                    <Button onClick={() => prepare(id as RecipeId, n!)}>
                      準備
                    </Button>
                  )}
                </div>
              ))}
              <p>
                選択中でも在庫は拘束されません。調合・仕入れから戻って続けられます。
              </p>
              <p>
                通常依頼は各依頼書1件分まで。関係の進行は同じ相手につき1回です。
              </p>
            </aside>
          </div>
        </>
      )}
      {(ui.orderTab !== "special" || count > 0) && (
        <div className="action-bar">
          <div>
            <small>{count}件・出発1回 / 1日</small>
            <strong>
              {money(plan?.pay ?? 0)} <span>体力 −{plan?.stamina ?? 0}</span>
            </strong>
            {error && (
              <span className="error" role="status">
                {error}
              </span>
            )}
          </div>
          <Button
            primary
            disabled={!count || !!error}
            onClick={() =>
              confirm({ type: "deliver", ...selection }, "まとめ納品の出発確認")
            }
          >
            出発内容を確認
          </Button>
        </div>
      )}
    </>
  );
}
