import { useEffect } from "react";
import { specialOffers } from "../content/support";
import { absoluteDay, dateLabel, offerKey, offerReason } from "../contracts";
import { planDelivery, type DeliverySelection } from "../delivery";
import type { Action } from "../engine";
import {
  isOpen,
  jobKinds,
  jobs,
  payWithRelation,
  personOf,
  personOpen,
  recipeOf,
  type GameState,
  type Job,
  type PersonId,
  type RecipeId,
} from "../game";
import { previewAction } from "../presentation";
import { actionQuote, visibleJobs, workReason } from "../workflow";
import type { Obligation, SupportOffer } from "../supportTypes";
import type { UIState } from "../uiState";
import {
  Art,
  Badge,
  Button,
  Empty,
  Heading,
  Item,
  money,
  Preview,
  Tabs,
} from "./components";
import { personSrc } from "../art";
import { ActionDock } from "./ActionDock";
import { Preparation } from "./Preparation";
import { OfferDetails } from "./OfferDetails";
export { OfferDetails } from "./OfferDetails";

type Row = {
  key: string;
  title: string;
  person: PersonId;
  category: string;
  job?: Job;
  offer?: SupportOffer;
  promise?: Obligation;
};
export function Orders({
  s,
  ui,
  patch,
  confirm,
  prepareAction,
  journal,
  back,
}: {
  s: GameState;
  ui: UIState;
  patch: (p: Partial<UIState>) => void;
  confirm: (a: Action, title: string) => void;
  prepareAction: (a: Action, title: string) => void;
  journal: () => void;
  back: () => void;
}) {
  const today = absoluteDay(s),
    selection = ui.selection;
  useEffect(() => {
    const seenJobs = [
      ...new Set([
        ...ui.seenJobs,
        ...jobs.filter((j) => isOpen(j, s)).map((j) => j.id),
      ]),
    ];
    if (seenJobs.length !== ui.seenJobs.length) patch({ seenJobs });
  }, [s, ui.seenJobs]);
  const rows: Row[] = [
    ...visibleJobs(s, ui.seenJobs).map((job) => ({
      key: job.id,
      title: job.title,
      person: job.person,
      category: job.category === "ordinary" ? "normal" : "personal",
      job,
    })),
    ...specialOffers
      .filter(
        (o) =>
          o.schedule!.appears <= today &&
          personOpen(personOf(o.person), s) &&
          !s.offerStates[offerKey(s, o.id, true)],
      )
      .map((offer) => ({
        key: `offer:${offer.id}`,
        title: offer.title,
        person: offer.person,
        category: "special",
        offer,
      })),
    ...s.obligations
      .filter((o) => o.status === "active" && o.terms.kind === "advance")
      .map((promise) => ({
        key: `promise:${promise.id}`,
        title: promise.terms.title,
        person: promise.terms.person,
        category: "special",
        offer: promise.terms,
        promise,
      })),
  ];
  const dueOption = (r: Row) =>
    r.promise?.terms.options.find((o) => o.days === 1);
  const ownSelection = (r: Row): DeliverySelection | undefined =>
    r.job?.category === "ordinary"
      ? { ordinary: [r.job.id], promises: [] }
      : r.promise && dueOption(r)
        ? {
            ordinary: [],
            promises: [{ id: r.promise.id, option: dueOption(r)!.id }],
          }
        : undefined;
  const isSelected = (r: Row) =>
    r.job
      ? selection.ordinary.includes(r.job.id)
      : !!r.promise && selection.promises.some((p) => p.id === r.promise!.id);
  const add = (r: Row): DeliverySelection => {
    const own = ownSelection(r)!;
    return {
      ordinary: [...new Set([...selection.ordinary, ...own.ordinary])],
      promises: [
        ...selection.promises.filter(
          (p) => !own.promises.some((q) => q.id === p.id),
        ),
        ...own.promises,
      ],
    };
  };
  const remove = (r: Row): DeliverySelection => ({
    ordinary: selection.ordinary.filter((id) => id !== r.job?.id),
    promises: selection.promises.filter((p) => p.id !== r.promise?.id),
  });
  const rowAction = (r: Row): Action | undefined =>
    r.job
      ? r.job.category === "ordinary"
        ? { type: "deliver", ...ownSelection(r)! }
        : { type: "job", id: r.job.id }
      : r.promise
        ? ownSelection(r)
          ? { type: "deliver", ...ownSelection(r)! }
          : undefined
        : { type: "accept", offer: r.offer!.id };
  const reason = (r: Row) =>
    r.job
      ? (workReason(r.job, s) ?? previewAction(s, rowAction(r)!).error)
      : r.promise
        ? r.promise.terms.schedule && r.promise.due !== today
          ? `${dateLabel(r.promise.due)}に納品`
          : rowAction(r)
            ? previewAction(s, rowAction(r)!).error
            : "約束帳で納品方法を選んでください"
        : offerReason(s, r.offer!);
  const personRows = rows.filter(
    (r) => !ui.personFilter || r.person === ui.personFilter,
  );
  const filtered = personRows
    .filter(
      (r) =>
        (ui.orderTab === "all" ||
          ui.orderTab === "batch" ||
          r.category === ui.orderTab) &&
        (ui.workKind === "all" || r.job?.kind === ui.workKind),
    )
    .filter((r) =>
      ui.filter === "ready"
        ? !reason(r)
        : ui.filter === "need"
          ? !!reason(r)
          : true,
    )
    .sort((a, b) =>
      ui.sort === "pay"
        ? (b.job ? payWithRelation(b.job, s) : b.offer!.totalPay) -
          (a.job ? payWithRelation(a.job, s) : a.offer!.totalPay)
        : a.title.localeCompare(b.title, "ja"),
    );
  const row = rows.find((r) => r.key === ui.orderId);
  const batch = ui.orderId === "batch" || ui.orderTab === "batch";
  const detail = !!row || batch;
  const count = selection.ordinary.length + selection.promises.length;
  let plan: ReturnType<typeof planDelivery> | undefined;
  try {
    if (count) plan = planDelivery(s, selection);
  } catch {}
  const close = () =>
    patch({
      orderId: null,
      ...(ui.orderTab === "batch" ? { orderTab: "all" } : {}),
    });
  const open = (id: string) =>
    patch({
      orderId: id,
      ...(ui.orderTab === "batch" ? { orderTab: "all" } : {}),
    });
  let action: Action | undefined;
  if (batch && count) action = { type: "deliver", ...selection };
  else if (row)
    action =
      row.job?.category === "ordinary" || row.promise
        ? ownSelection(row)
          ? { type: "deliver", ...add(row) }
          : undefined
        : rowAction(row);
  const detailTitle = batch ? "まとめ納品" : row?.title;
  return (
    <div className={`work-screen ${detail ? "has-detail" : ""}`}>
      <Heading
        eyebrow="TODAY'S WORK"
        extra={
          count > 0 ? (
            <Button onClick={() => open("batch")}>納品する薬 {count}件</Button>
          ) : undefined
        }
      >
        仕事をする
      </Heading>
      <p className="intro">
        選ぶ・準備するだけなら0日。薬の納品や人物の仕事を実行すると1日進みます。
      </p>
      <Tabs
        value={ui.orderTab === "batch" ? "all" : ui.orderTab}
        onChange={(orderTab) => patch({ orderTab, orderId: null })}
        options={[
          ["all", `すべて ${personRows.length}`],
          [
            "normal",
            `薬の納品 ${personRows.filter((r) => r.category === "normal").length}`,
          ],
          [
            "personal",
            `人物の依頼 ${personRows.filter((r) => r.category === "personal").length}`,
          ],
          [
            "special",
            `特別依頼 ${personRows.filter((r) => r.category === "special").length}`,
          ],
        ]}
      />
      <p className="work-kind-counts" aria-label="種別ごとの件数">
        {jobKinds.map((k) => (
          <span key={k}>
            {k} {personRows.filter((r) => r.job?.kind === k).length}
          </span>
        ))}
      </p>
      <div className="work-filters">
        {ui.personFilter && (
          <Button onClick={() => patch({ personFilter: null, orderId: null })}>
            {personOf(ui.personFilter as PersonId).name}のみ ×
          </Button>
        )}
        <label>
          種別
          <select
            value={ui.workKind}
            onChange={(e) => patch({ workKind: e.target.value, orderId: null })}
          >
            <option value="all">すべて</option>
            {jobKinds.map((k) => (
              <option key={k} value={k}>
                {k} {personRows.filter((r) => r.job?.kind === k).length}
              </option>
            ))}
          </select>
        </label>
        <label>
          状態
          <select
            value={ui.filter}
            onChange={(e) => patch({ filter: e.target.value, orderId: null })}
          >
            <option value="all">すべて</option>
            <option value="ready">実行可能</option>
            <option value="need">準備・条件待ち</option>
          </select>
        </label>
        <label>
          順番
          <select
            value={ui.sort}
            onChange={(e) => patch({ sort: e.target.value })}
          >
            <option value="name">名前</option>
            <option value="pay">報酬</option>
          </select>
        </label>
      </div>
      <div className="work-layout">
        <section className="work-list" aria-label="仕事の一覧">
          {filtered.map((r) => {
            const why = reason(r),
              chosen = isSelected(r),
              own = ownSelection(r);
            const eligible =
              own &&
              (!r.promise?.terms.schedule || r.promise.due === today) &&
              (!r.job || isOpen(r.job, s));
            const candidateError = eligible
              ? previewAction(s, { type: "deliver", ...add(r) }).error
              : undefined;
            return (
              <article
                className={`work-row ${r.job && workReason(r.job, s) ? "unavailable" : ""} ${chosen ? "selected" : ""}`}
                key={r.key}
              >
                {own && (
                  <label className="work-check">
                    <input
                      type="checkbox"
                      aria-label={`${r.title}を納品に選ぶ`}
                      checked={chosen}
                      disabled={!chosen && (!eligible || !!candidateError)}
                      onChange={() =>
                        patch({ selection: chosen ? remove(r) : add(r) })
                      }
                    />
                  </label>
                )}
                <button
                  className="work-choice"
                  aria-pressed={row?.key === r.key}
                  onClick={() => open(r.key)}
                >
                  {r.job?.recipe ? (
                    <Item id={r.job.recipe} />
                  ) : (
                    <Art src={personSrc(r.person)} className="crest" />
                  )}
                  <span>
                    <b>{r.title}</b>
                    <small>
                      {personOf(r.person).name} ／ {r.job?.kind ?? "特別依頼"}
                    </small>
                    <small className={why ? "muted" : "text-ready"}>
                      {why ??
                        (r.job
                          ? `${money(payWithRelation(r.job, s))}・実行1日`
                          : r.promise
                            ? "本日納品できます"
                            : "前金を受け取って受諾・0日")}
                    </small>
                    {candidateError && !chosen && !why && (
                      <small className="muted">
                        選択分との合計：{candidateError}
                      </small>
                    )}
                  </span>
                </button>
              </article>
            );
          })}
          {!filtered.length && <Empty>この条件の仕事はありません。</Empty>}
        </section>
        {detail && (
          <section
            className="work-detail"
            aria-label="仕事の詳細"
            key={ui.orderId ?? "batch"}
          >
            <div className="work-detail-body">
              <h2>{detailTitle}</h2>
              <small className="detail-date">
                {dateLabel(today)}・閲覧は0日
              </small>
              {batch ? (
                <>
                  {plan?.lines.map((l) => (
                    <div className="item-row" key={l.id}>
                      <Item id={l.recipe} />
                      <span>
                        <b>{l.title}</b>
                        <small>
                          {recipeOf(l.recipe).name}×{l.count} ／ {money(l.pay)}
                        </small>
                      </span>
                      <Button
                        aria-label={`${l.title}を選択から外す`}
                        onClick={() =>
                          patch({
                            selection: {
                              ordinary: selection.ordinary.filter(
                                (id) => id !== l.id,
                              ),
                              promises: selection.promises.filter(
                                (p) => p.id !== l.id,
                              ),
                            },
                          })
                        }
                      >
                        外す
                      </Button>
                    </div>
                  ))}
                  {!count && (
                    <Empty>納品する依頼を一覧から選んでください。</Empty>
                  )}
                  {Object.entries(plan?.stock ?? {}).map(([id, n]) => (
                    <Preparation
                      key={id}
                      state={s}
                      recipe={id as RecipeId}
                      required={n!}
                      confirm={prepareAction}
                    />
                  ))}
                </>
              ) : row?.job ? (
                <>
                  <p>
                    {personOf(row.person).name} ／ {row.job.kind} ／{" "}
                    {row.job.cadence === "repeat"
                      ? "常設"
                      : row.job.cadence === "once"
                        ? "一度限り"
                        : "各章1回"}
                  </p>
                  <div className="stats">
                    <div>
                      <small>受取額</small>
                      <b>{money(payWithRelation(row.job, s))}</b>
                    </div>
                    <div>
                      <small>体力</small>
                      <b>−{row.job.stamina}</b>
                    </div>
                    <div>
                      <small>実行</small>
                      <b>1日</b>
                    </div>
                  </div>
                  <div className="cost-line">
                    {row.job.costs.length ? (
                      row.job.costs.map((c) => (
                        <span key={c.axis}>
                          {c.axis} −{c.amount}
                        </span>
                      ))
                    ) : (
                      <span>3軸の代償なし</span>
                    )}
                  </div>
                  {workReason(row.job, s) && (
                    <p className="error">{workReason(row.job, s)}</p>
                  )}
                  {row.job.recipe && !workReason(row.job, s) && (
                    <Preparation
                      state={s}
                      recipe={row.job.recipe}
                      required={row.job.count ?? 1}
                      confirm={prepareAction}
                    />
                  )}
                  {!row.job.recipe && rowAction(row) && !reason(row) && (
                    <Preview state={s} action={rowAction(row)!} />
                  )}
                  <details>
                    <summary>依頼の内容・紹介条件</summary>
                    <p>{row.job.description}</p>
                    <p>
                      {Object.entries(row.job.needs)
                        .map(([a, n]) => `${a}${n}以上`)
                        .join(" ／ ") || "基本条件なし"}
                    </p>
                    {row.job.opensBelow && (
                      <p>
                        {Object.entries(row.job.opensBelow)
                          .map(([a, n]) => `${a}${n}以下`)
                          .join(" ／ ")}
                      </p>
                    )}
                  </details>
                </>
              ) : row?.offer ? (
                <>
                  <p>{personOf(row.person).name}から</p>
                  <OfferDetails offer={row.offer} />
                  <p>{row.offer.description}</p>
                  {row.promise ? (
                    <>
                      <Badge tone={row.promise.due === today ? "warn" : ""}>
                        {row.promise.due === today
                          ? "本日納品"
                          : `${dateLabel(row.promise.due)}に納品`}
                      </Badge>
                      {row.offer.options.map((o) => (
                        <Preparation
                          key={o.id}
                          state={s}
                          recipe={o.recipe}
                          required={o.count}
                          confirm={prepareAction}
                        />
                      ))}
                      <Button onClick={journal}>
                        解消・支払いなどの約束管理
                      </Button>
                    </>
                  ) : (
                    <p>受諾は0日。前金を受け取り、指定日当日に納品します。</p>
                  )}
                  {reason(row) && <p className="muted">{reason(row)}</p>}
                </>
              ) : null}
            </div>
            <ActionDock
              state={s}
              action={action}
              confirm={confirm}
              back={close}
              title={detailTitle}
              label={
                action?.type === "deliver"
                  ? `${Math.max(count, 1) + (row && ownSelection(row) && !isSelected(row) && count > 0 ? 1 : 0)}件を納品する・1日`
                  : undefined
              }
            />
          </section>
        )}
      </div>
      {!detail && count > 0 && (
        <ActionDock
          state={s}
          action={{ type: "deliver", ...selection }}
          confirm={confirm}
          back={back}
          label={`${count}件を納品する・1日`}
          title="まとめ納品"
        >
          <Button onClick={() => open("batch")}>納品の持ち物を見る</Button>
        </ActionDock>
      )}
    </div>
  );
}
