import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BookOpen,
  Map,
  FlaskConical,
  Home,
  Package,
  Calendar,
  Settings,
  Moon,
  Lock,
} from "lucide-react";
import { performAction } from "./engine";
import {
  allocateDelivery,
  brewCapacity as brewCount,
  gatherBrewRange,
  referencePay as estimate,
  canVisit,
  chapterPeople,
  chapterRecipes,
  contractFor,
  dateOf,
  dayOf,
  effectLabels,
  freshChapter,
  getStockTotal,
  levelForXP,
  locationName,
  locations,
  personName,
  planBrew,
  preparation,
  projectLegacy,
  qualityForRecipe,
  questFor,
  questReason,
  quests,
  questStatus,
  questVisible,
  quoteBuy,
  quoteDelivery,
  quoteGather,
  recipeName,
  recipeSource,
  rules,
  visitReason,
} from "./chapter";
import type {
  Allocation,
  ChapterAction,
  ChapterState,
  Need,
  Quest,
} from "./chapterTypes";
import {
  axes,
  axisStage,
  materialIds,
  materialOf,
  type MaterialId,
  type PlaceId,
  type RecipeId,
} from "./game";
import {
  loadChapter,
  OLD_KEYS,
  saveChapter,
  SAVE_KEY,
  UI_KEY,
} from "./saveV13";
import { supportOffers } from "./content/support";
import { offerReason } from "./contracts";
import { Art, Modal } from "./ui/components";
import { Dialogue } from "./ui/Narrative";
import { backgroundSrc, heroSrc, itemSrc, mapSrc } from "./art";
import { fullscreenSupported, useFullscreen } from "./ui/fullscreen";
import "./chapter.css";
type Tab = "home" | "orders" | "map" | "brew" | "inventory" | "journal";
type UI = {
  tab: Tab;
  selected: string[];
  goals: string[];
  targets: { id: string; contractId?: string; requirements: Need[] }[];
  filter: string;
  search: string;
  sort: string;
  person: string;
  place: string;
  recipe: RecipeId;
  quantity: number;
  basket: Partial<Record<MaterialId, number>>;
  allocation: Allocation | null;
  priority: "high" | "low";
  speed: number;
  motion: boolean;
  scroll: Record<string, number>;
};
const freshUI = (): UI => ({
  tab: "home",
  selected: [],
  goals: [],
  targets: [],
  filter: "all",
  search: "",
  sort: "day",
  person: "all",
  place: "hill",
  recipe: "tisane",
  quantity: 1,
  basket: {},
  allocation: null,
  priority: "high",
  speed: 24,
  motion: false,
  scroll: {},
});
function writeUI(ui: UI) {
  try {
    localStorage.setItem(UI_KEY, JSON.stringify(ui));
  } catch {
    /* UI failure never overwrites game assets. */
  }
}
function loadUI(): UI {
  try {
    const v = JSON.parse(localStorage.getItem(UI_KEY) ?? "null"),
      d = freshUI();
    if (!v) return d;
    for (const k of ["selected", "goals"] as const)
      if (Array.isArray(v[k]))
        d[k] = v[k].filter((id: unknown) => quests.some((q) => q.id === id));
    for (const k of ["filter", "search", "sort", "person"] as const)
      if (typeof v[k] === "string") d[k] = v[k];
    if (locations.some((p) => p.id === v.place)) d.place = v.place;
    if (chapterRecipes.some((r) => r.id === v.recipe)) d.recipe = v.recipe;
    if (Number.isSafeInteger(v.quantity) && v.quantity >= 1 && v.quantity <= 99)
      d.quantity = v.quantity;
    for (const m of materialIds)
      if (
        Number.isSafeInteger(v.basket?.[m]) &&
        v.basket[m] >= 0 &&
        v.basket[m] <= 999
      )
        d.basket[m] = v.basket[m];
    if (
      v.allocation &&
      typeof v.allocation === "object" &&
      !Array.isArray(v.allocation)
    )
      d.allocation = v.allocation;
    if (v.priority === "low") d.priority = "low";
    if ([0, 24, 50].includes(v.speed)) d.speed = v.speed;
    d.motion = v.motion === true;
    if (v.scroll && typeof v.scroll === "object")
      for (const [k, n] of Object.entries(v.scroll))
        if (typeof n === "number" && Number.isFinite(n) && n >= 0)
          d.scroll[k] = n;
    if (Array.isArray(v.targets))
      d.targets = v.targets.filter(
        (t: UI["targets"][number]) =>
          t &&
          d.goals.includes(t.id) &&
          Array.isArray(t.requirements) &&
          t.requirements.every(
            (n) =>
              n &&
              chapterRecipes.some((r) => r.id === n.recipeId) &&
              Number.isSafeInteger(n.count) &&
              n.count > 0,
          ),
      );
    return d;
  } catch {
    return freshUI();
  }
}
const gold = (n: number) => `${n.toLocaleString()}G`;
const qty = (v: string, max = 99) =>
  Math.min(max, Math.max(0, Math.floor(Number(v) || 0)));
const stockText = (b: Record<string, number>) =>
  Object.entries(b)
    .filter(([, n]) => n > 0)
    .sort((a, b) => +b[0] - +a[0])
    .map(([q, n]) => `品質${q} ×${n}`)
    .join(" ／ ") || "なし";
function Button({
  children,
  primary = false,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return (
    <button
      {...rest}
      type="button"
      className={`c-button ${primary ? "c-primary" : ""} ${rest.className ?? ""}`}
    >
      {children}
    </button>
  );
}
function Medicine({ id }: { id: RecipeId | MaterialId }) {
  return <Art src={itemSrc(id)} className="c-item" />;
}
type Ctx = {
  s: ChapterState;
  ui: UI;
  patch: (p: Partial<UI>) => void;
  ask: (a: ChapterAction, title: string) => void;
  prepare: (ids: string[]) => void;
};
function Scroll({
  id,
  ui,
  children,
}: {
  id: string;
  ui: UI;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ui.scroll[id] ?? 0;
  }, [id]);
  return (
    <div
      className="c-scroll"
      ref={ref}
      onScroll={(e) => {
        ui.scroll[id] = e.currentTarget.scrollTop;
        writeUI(ui);
      }}
    >
      {children}
    </div>
  );
}
function Requirements({ q }: { q: Quest }) {
  return (
    <span>
      {q.requirements
        .map((n) => `${recipeName(n.recipeId)} ×${n.count}`)
        .join(" ＋ ")}
    </span>
  );
}
function DeliverySummary({
  quote,
}: {
  quote: ReturnType<typeof quoteDelivery>;
}) {
  return (
    <div className="c-quote">
      {quote.lines.map((l) => (
        <div key={l.id}>
          <b>
            {l.quest.title}：{gold(l.pay)}
          </b>
          <p>
            基礎 {gold(l.base)} ＋ 品質加算 {l.qualityBonus.toFixed(2)}G ／
            買い叩き {l.rate / 100}%<br />
            関係評価 {(l.score / 100).toFixed(2)} ／ 本日適用済み{" "}
            {(l.dailyBest / 100).toFixed(2)} ／ 今回 ＋
            {(l.relationGain / 100).toFixed(2)}
            {!l.relationGain ? "（本日分適用済み、または上限）" : ""}
          </p>
        </div>
      ))}
      {quote.warnings.map((w) => (
        <p className="c-warning" key={w}>
          {w}
        </p>
      ))}
      {quote.error && <p className="c-warning">{quote.error}</p>}
    </div>
  );
}
function OrderScreen(c: Ctx) {
  const { s, ui, patch, ask, prepare } = c,
    selected = ui.selected.filter((id) => questFor(s, id)),
    qs = selected.map((id) => questFor(s, id)!);
  const quote = quoteDelivery(
      s,
      selected,
      ui.allocation ?? undefined,
      ui.priority,
    ),
    prep = preparation(s, selected);
  const shown = quests
    .filter((q) => questVisible(s, q))
    .filter(
      (q) =>
        (ui.filter === "all" ||
          (ui.filter === "repeat" && q.mode === "repeat") ||
          (ui.filter === "contract" && q.mode === "contract") ||
          (ui.filter === "active" &&
            contractFor(s, q.id)?.status === "active") ||
          (ui.filter === "ready" && !quoteDelivery(s, [q.id]).error)) &&
        (ui.person === "all" || ui.person === q.personId) &&
        `${q.title}${personName(q.personId)}${q.requirements.map((n) => recipeName(n.recipeId)).join("")}`.includes(
          ui.search,
        ),
    )
    .sort((a, b) =>
      ui.sort === "name"
        ? a.title.localeCompare(b.title, "ja")
        : ui.sort === "pay"
          ? estimate(b) - estimate(a)
          : a.appearsDay - b.appearsDay,
    );
  const choose = (id: string, multi = false) =>
    patch({
      selected: multi
        ? selected.includes(id)
          ? selected.filter((x) => x !== id)
          : [...selected, id]
        : [id],
      allocation: null,
    });
  return (
    <div className="c-orders">
      <aside className="c-order-list">
        <div className="c-filters">
          <input
            aria-label="依頼を検索"
            placeholder="依頼・人物・薬を探す"
            value={ui.search}
            onChange={(e) => patch({ search: e.target.value })}
          />
          <select
            aria-label="依頼の分類"
            value={ui.filter}
            onChange={(e) => patch({ filter: e.target.value })}
          >
            <option value="all">すべて</option>
            <option value="repeat">反復依頼</option>
            <option value="contract">契約</option>
            <option value="active">受諾済み</option>
            <option value="ready">納品可能</option>
          </select>
          <select
            aria-label="依頼人"
            value={ui.person}
            onChange={(e) => patch({ person: e.target.value })}
          >
            <option value="all">すべての相手</option>
            {chapterPeople
              .filter((p) => s.introducedPeople.includes(p.id))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
          <select
            aria-label="並べ替え"
            value={ui.sort}
            onChange={(e) => patch({ sort: e.target.value })}
          >
            <option value="day">出現順</option>
            <option value="name">名前順</option>
            <option value="pay">参考額順</option>
          </select>
        </div>
        <Scroll id="orders-list" {...c}>
          {shown.map((q) => (
            <article
              className={`c-order-card ${selected.includes(q.id) ? "selected" : ""}`}
              key={q.id}
            >
              <input
                type="checkbox"
                aria-label={`${q.title}をまとめ納品に選択`}
                checked={selected.includes(q.id)}
                onChange={() => choose(q.id, true)}
              />
              <button onClick={() => choose(q.id)} className="c-card-link">
                <b>{q.title}</b>
                <span>
                  <Requirements q={q} />
                </span>
                <small>
                  {personName(q.personId)} · {questStatus(s, q)}
                </small>
                <small>
                  {q.mode === "repeat"
                    ? "反復"
                    : `納品 ${q.deliveryWindow![0]}〜${q.deliveryWindow![1]}日`}{" "}
                  ／ 関係{(s.relationPoints[q.personId] / 100).toFixed(2)}
                </small>
                <small>
                  準備{" "}
                  {q.requirements
                    .map(
                      (n) =>
                        `${recipeName(n.recipeId)} ${getStockTotal(s, n.recipeId)}/${n.count}`,
                    )
                    .join(" ＋ ")}
                </small>
                <small>
                  {!quoteDelivery(s, [q.id]).error
                    ? `${gold(quoteDelivery(s, [q.id]).pay)}（在庫の品質で計算）`
                    : `${gold(estimate(q))}（品質40・値下げ前）`}
                </small>
              </button>
            </article>
          ))}
          {!shown.length && <p>この条件の依頼はありません。</p>}
        </Scroll>
      </aside>
      <section className="c-order-detail">
        {!qs.length ? (
          <div className="c-empty">
            <BookOpen size={40} />
            <h2>依頼を選ぶ</h2>
            <p>
              必要な薬を確認して、仕入れと調合へ。
              <br />
              チェックを付けると、まとめて納品できます。
            </p>
          </div>
        ) : (
          <>
            <Scroll id={`order-${selected.join(",")}`} {...c}>
              {qs.map((q) => {
                const reason = questReason(s, q),
                  contract = contractFor(s, q.id);
                return (
                  <article key={q.id} className="c-request">
                    <div className="c-eyebrow">
                      {q.mode === "repeat"
                        ? "反復依頼・受諾不要"
                        : "一度限りの契約"}
                    </div>
                    <h2>{q.title}</h2>
                    <p>
                      {personName(q.personId)} ／ 納品先：
                      {locationName(q.deliveryPlaceId)}
                      <br />
                      関係 {(s.relationPoints[q.personId] / 100).toFixed(2)}
                    </p>
                    <h3>
                      <Requirements q={q} />
                    </h3>
                    <p>{q.description ?? q.normalResultText}</p>
                    {q.acceptWindow && (
                      <p>
                        受付：{dateOf(q.acceptWindow[0])}〜
                        {dateOf(q.acceptWindow[1])}
                        <br />
                        納品：
                        {q.deliveryWindow![0] === q.deliveryWindow![1]
                          ? dateOf(q.deliveryWindow![0])
                          : `${dateOf(q.deliveryWindow![0])}〜${dateOf(q.deliveryWindow![1])}`}
                      </p>
                    )}
                    <p className={reason ? "c-warning" : "c-muted"}>
                      {questStatus(s, q)}
                      {contract?.status === "active"
                        ? " ／ 受諾済みのため納品権は有効（納品期間・在庫・スタミナは必要）"
                        : ""}
                    </p>
                    <details>
                      <summary>報酬・条件・初回の出来事</summary>
                      <p>
                        基礎額{" "}
                        {gold(
                          q.requirements.reduce(
                            (a, n) => a + n.baseUnitPrice * n.count,
                            0,
                          ),
                        )}{" "}
                        ／ 品質100で＋{q.qualityBonusBP / 100}% ／ 納品スタミナ
                        {q.staminaCost}
                        <br />
                        関係評価：{q.relationBasePoints}＋
                        {q.relationQualityBonusPoints}×平均品質/100 ポイント
                        <br />
                        {q.applyMarketFatigue
                          ? "反復販売は同じ相手への回数で買い叩きあり"
                          : "買い叩きなし・前金なし"}
                      </p>
                      {effectLabels(q.onFirstComplete, contract?.events).map(
                        (x, i) => (
                          <p key={i}>{x}</p>
                        ),
                      )}
                      {q.mode === "contract" && (
                        <p>
                          辞退・取消・不履行後の再受諾はできません。追加金銭・3軸ペナルティはありません。
                        </p>
                      )}
                      {effectLabels(q.onAcceptOnce).map((x, i) => (
                        <p key={`a${i}`}>{x}</p>
                      ))}
                    </details>
                    {q.mode === "contract" &&
                      !contract &&
                      !s.declinedQuests.includes(q.id) && (
                        <div className="c-row">
                          <Button
                            primary
                            disabled={!!questReason(s, q, true)}
                            onClick={() =>
                              ask(
                                { type: "quest-accept", quest: q.id },
                                "契約を受諾する",
                              )
                            }
                          >
                            受諾条件を確認
                          </Button>
                          <Button
                            disabled={!!questReason(s, q)}
                            onClick={() =>
                              ask(
                                { type: "quest-decline", quest: q.id },
                                "この依頼を辞退する",
                              )
                            }
                          >
                            辞退する
                          </Button>
                          {questReason(s, q, true) && (
                            <small>{questReason(s, q, true)}</small>
                          )}
                        </div>
                      )}
                    {contract?.status === "active" && (
                      <Button
                        onClick={() =>
                          ask(
                            { type: "quest-cancel", id: contract.id },
                            "契約を取消する",
                          )
                        }
                      >
                        契約を取消
                      </Button>
                    )}
                  </article>
                );
              })}
              <div className="c-row">
                <label>
                  納品する品質
                  <select
                    value={ui.allocation ? "manual" : ui.priority}
                    onChange={(e) =>
                      patch(
                        e.target.value === "manual"
                          ? {
                              allocation: allocateDelivery(
                                s,
                                selected,
                                ui.priority,
                              ),
                            }
                          : {
                              priority: e.target.value as "high" | "low",
                              allocation: null,
                            },
                      )
                    }
                  >
                    <option value="high">高品質から充当</option>
                    <option value="low">低品質から充当</option>
                    <option value="manual">手動で指定</option>
                  </select>
                </label>
                <Button onClick={() => patch({ allocation: null })}>
                  自動選択に戻す
                </Button>
              </div>
              {qs.map((q) => (
                <div key={`quality-${q.id}`} className="c-allocation">
                  <h3>{q.title}</h3>
                  {q.requirements.map((n) => (
                    <div key={n.recipeId}>
                      <b>
                        {recipeName(n.recipeId)}：必要{n.count} ／ 所持
                        {getStockTotal(s, n.recipeId)}
                      </b>
                      {Object.entries(s.stockByQuality[n.recipeId] ?? {})
                        .filter(([, n]) => n > 0)
                        .sort((a, b) => +b[0] - +a[0])
                        .map(([quality, total]) => (
                          <label key={quality}>
                            品質{quality}（所持{total}）
                            <input
                              aria-label={`${q.id} ${n.recipeId} 品質${quality}`}
                              type="number"
                              min="0"
                              max={total}
                              value={
                                quote.allocation[q.id]?.[n.recipeId]?.[
                                  quality
                                ] ?? 0
                              }
                              onChange={(e) => {
                                const a = structuredClone(quote.allocation);
                                a[q.id] ??= {};
                                a[q.id][n.recipeId] ??= {};
                                a[q.id][n.recipeId]![quality] = qty(
                                  e.target.value,
                                  total,
                                );
                                patch({ allocation: a });
                              }}
                            />
                          </label>
                        ))}
                      {!getStockTotal(s, n.recipeId) && (
                        <p className="c-muted">
                          在庫なし。仕入れ・調合で準備できます。
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ))}
              <DeliverySummary quote={quote} />
            </Scroll>
            <footer className="c-footer">
              <span>
                {quote.error ??
                  `報酬 ${gold(quote.pay)} ／ スタミナ ${quote.stamina}`}
              </span>
              <div className="c-row">
                {qs.length === 1 &&
                qs[0].mode === "contract" &&
                !contractFor(s, qs[0].id) ? (
                  <Button
                    primary
                    disabled={!!questReason(s, qs[0], true)}
                    onClick={() =>
                      ask(
                        { type: "quest-accept", quest: qs[0].id },
                        "契約を受諾する",
                      )
                    }
                  >
                    受諾する
                  </Button>
                ) : (
                  <>
                    <Button
                      disabled={qs.some(
                        (q) =>
                          !!questReason(s, q) ||
                          (q.mode === "contract" && !contractFor(s, q.id)),
                      )}
                      onClick={() => prepare(selected)}
                    >
                      {Object.values(prep.materials).some((n) => n! > 0)
                        ? "不足素材を仕入れる"
                        : "調合・準備へ"}
                    </Button>
                    <Button
                      primary
                      disabled={!!quote.error}
                      onClick={() =>
                        ask(
                          {
                            type: "quest-deliver",
                            ids: selected,
                            allocation: quote.allocation,
                          },
                          "品質を確認して納品する",
                        )
                      }
                    >
                      納品する
                    </Button>
                  </>
                )}
              </div>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
function SupplyScreen(c: Ctx) {
  const { s, ui, patch, ask } = c,
    known = locations.filter((p) => s.introducedPlaces.includes(p.id)),
    p = known.find((p) => p.id === ui.place),
    prep = preparation(s, ui.goals),
    gather = quoteGather(s, ui.place),
    buy = quoteBuy(s, ui.place, ui.basket);
  return (
    <div className="c-supply">
      <div className="c-map">
        <Art src={mapSrc()} className="c-map-image" alt="素材入手先の地図" />
        {known
          .filter((p) => p.majorDrops || p.prices)
          .map((p) => (
            <button
              key={p.id}
              className={`c-pin ${p.id === ui.place ? "selected" : ""} ${canVisit(s, p.id) ? "" : "locked"}`}
              style={{ left: `${p.map.x}%`, top: `${p.map.y}%` }}
              onClick={() => patch({ place: p.id, basket: {} })}
            >
              <span>
                {!canVisit(s, p.id) ? "🔒" : p.majorDrops ? "✿" : "◈"}
              </span>
              {p.name}
              <small>{p.majorDrops ? "採集" : "購入"}</small>
            </button>
          ))}
        <div className="c-map-legend">
          ✿ 採集　◈ 購入　🔒 利用条件あり
          <br />
          場所の選択では資源を消費しません
        </div>
      </div>
      <section className="c-place">
        <Scroll id={`place-${ui.place}`} {...c}>
          <h2>{p?.name ?? "場所を選んでください"}</h2>
          {ui.goals.length > 0 && (
            <p className="c-note">
              不足素材：
              {Object.entries(prep.materials)
                .filter(([, n]) => n! > 0)
                .map(([m, n]) => `${materialOf(m as MaterialId).name} ×${n}`)
                .join("、") || "揃いました。調合へ進めます。"}
            </p>
          )}
          {p && (
            <>
              {visitReason(s, p.id) && (
                <p className="c-warning">{visitReason(s, p.id)}</p>
              )}
              {p.majorDrops && (
                <>
                  <p>採集スタミナ {gather.stamina}</p>
                  {gather.major.map((d) => (
                    <p className="c-material-row" key={d.materialId}>
                      <Medicine id={d.materialId} />
                      <span>
                        必ず{materialOf(d.materialId).name} {d.min}〜{d.max}個
                        <br />
                        <small>
                          所持{s.materials[d.materialId]} ／ 各素材を独立抽選
                        </small>
                      </span>
                    </p>
                  ))}
                  {gather.bonus.map((d) => (
                    <p key={d.materialId}>
                      追加：{materialOf(d.materialId).name}
                      {d.count}個、{d.probabilityBP / 100}%
                    </p>
                  ))}
                  <p className="c-muted">
                    追加素材が出ても主要素材は減りません。
                  </p>
                  <h3>素材の用途</h3>
                  {chapterRecipes
                    .filter(
                      (r) =>
                        s.known.includes(r.id) &&
                        Object.keys(r.needs).some((m) =>
                          p.majorDrops!.some((d) => d.materialId === m),
                        ),
                    )
                    .map((r) => (
                      <p key={r.id}>
                        {r.name} ／ 現在{brewCount(s, r.id)}個制作可能
                        <br />
                        <small>
                          主要収量の入手後：
                          {gatherBrewRange(s, p.id, r.id).join("〜")}
                          個（レアを除く）
                        </small>
                      </p>
                    ))}
                </>
              )}
              {p.prices && (
                <>
                  <p>購入はスタミナ・日付を消費しません。</p>
                  {Object.entries(p.prices).map(([id, price]) => (
                    <label className="c-shopping" key={id}>
                      <Medicine id={id as MaterialId} />
                      <span>
                        {materialOf(id as MaterialId).name}
                        <small>
                          {price}G ／ 所持{s.materials[id as MaterialId]}
                        </small>
                      </span>
                      <input
                        aria-label={`${materialOf(id as MaterialId).name}の購入数`}
                        type="number"
                        min="0"
                        max="999"
                        value={ui.basket[id as MaterialId] ?? 0}
                        onChange={(e) =>
                          patch({
                            basket: {
                              ...ui.basket,
                              [id]: qty(e.target.value, 999),
                            },
                          })
                        }
                      />
                    </label>
                  ))}
                  <Button
                    onClick={() => {
                      const basket = { ...ui.basket };
                      for (const m of materialIds)
                        if (p.prices?.[m] !== undefined)
                          basket[m] = Math.max(
                            basket[m] ?? 0,
                            prep.materials[m] ?? 0,
                          );
                      patch({ basket });
                    }}
                  >
                    準備中の不足分をカゴへ
                  </Button>
                  <p>
                    合計 {gold(buy.cost)} ／ 購入後 {gold(buy.moneyAfter)}
                  </p>
                </>
              )}
            </>
          )}
        </Scroll>
        <footer className="c-footer">
          <span>
            {p?.majorDrops ? gather.error : p?.prices ? buy.error : ""}
          </span>
          {p?.majorDrops && (
            <Button
              primary
              disabled={!!gather.error}
              onClick={() =>
                ask({ type: "gather", place: p.id }, `${p.name}で採集する`)
              }
            >
              採集する
            </Button>
          )}
          {p?.prices && (
            <Button
              primary
              disabled={!!buy.error}
              onClick={() =>
                ask(
                  { type: "buy", place: p.id, basket: ui.basket },
                  "素材を購入する",
                )
              }
            >
              購入する
            </Button>
          )}
        </footer>
      </section>
    </div>
  );
}
function BrewingScreen(c: Ctx) {
  const { s, ui, patch, ask } = c,
    r = chapterRecipes.find((r) => r.id === ui.recipe)!,
    xp = s.recipeXP[r.id] ?? 0,
    level = levelForXP(xp),
    plan = planBrew(s, r.id, ui.quantity),
    prep = preparation(s, ui.goals);
  return (
    <div className="c-brewing">
      <aside className="c-recipe-list">
        <Scroll id="recipes" {...c}>
          {chapterRecipes.map((r) => (
            <button
              key={r.id}
              className={`c-recipe ${ui.recipe === r.id ? "selected" : ""}`}
              onClick={() =>
                patch({
                  recipe: r.id,
                  quantity: Math.max(1, Math.min(99, prep.missing[r.id] ?? 1)),
                })
              }
            >
              <Medicine id={r.id} />
              <span>
                <b>{r.name}</b>
                <small>
                  {s.known.includes(r.id)
                    ? `Lv.${levelForXP(s.recipeXP[r.id] ?? 0)} ／ 品質${qualityForRecipe(s, r.id)}`
                    : "未習得"}
                </small>
              </span>
              {!s.known.includes(r.id) && <Lock size={16} />}
            </button>
          ))}
        </Scroll>
      </aside>
      <section className="c-brew-detail">
        <Scroll id={`brew-${r.id}`} {...c}>
          <div className="c-eyebrow">レシピごとに育つ制作経験</div>
          <h2>
            {r.name}{" "}
            <span>
              Lv.{level} ／ 完成品質{qualityForRecipe(s, r.id)}
            </span>
          </h2>
          <p>
            制作経験 {xp}
            {level < 5
              ? ` ／ 次のLvまで${rules.levelThresholds[level] - xp}個 → 品質${rules.qualityByLevel[level]}`
              : " ／ 最高レベル"}
          </p>
          <progress
            value={level < 5 ? xp - rules.levelThresholds[level - 1] : 1}
            max={
              level < 5
                ? rules.levelThresholds[level] -
                  rules.levelThresholds[level - 1]
                : 1
            }
          />
          {!s.known.includes(r.id) ? (
            <p className="c-warning">{recipeSource(r.id)}</p>
          ) : (
            <>
              <h3>1個あたりの素材</h3>
              {Object.entries(r.needs).map(([m, n]) => (
                <p className="c-material-row" key={m}>
                  <Medicine id={m as MaterialId} />
                  {materialOf(m as MaterialId).name} ×{n} ／ 所持
                  {s.materials[m as MaterialId]} ／ 今回必要{n! * ui.quantity}
                </p>
              ))}
              <div className="c-row">
                <label>
                  制作数
                  <input
                    aria-label="制作数"
                    type="number"
                    min="1"
                    max="99"
                    value={ui.quantity}
                    onChange={(e) => patch({ quantity: qty(e.target.value) })}
                  />
                </label>
                <Button
                  onClick={() =>
                    patch({ quantity: Math.max(1, brewCount(s, r.id)) })
                  }
                >
                  作れる数：{brewCount(s, r.id)}
                </Button>
              </div>
              <p>
                消費スタミナ {plan.stamina} ／ 完成予定：
                {stockText(plan.produced)}
                <br />
                制作後の経験 {plan.xp} ／ Lv.{levelForXP(plan.xp)}
              </p>
              <p>現在の在庫：{stockText(s.stockByQuality[r.id] ?? {})}</p>
              <p className="c-muted">
                完成済みの品質は変わりません。1個ずつ、その時点のレベルで品質が決まります。
              </p>
            </>
          )}
          {ui.goals.length > 0 && (
            <>
              <h3>準備中の薬</h3>
              <div className="c-row">
                {Object.entries(prep.needs).map(([id, n]) => (
                  <Button
                    key={id}
                    onClick={() =>
                      patch({
                        recipe: id as RecipeId,
                        quantity: Math.max(
                          1,
                          Math.min(99, prep.missing[id as RecipeId] ?? 1),
                        ),
                      })
                    }
                  >
                    {recipeName(id)} {getStockTotal(s, id as RecipeId)}/{n}
                  </Button>
                ))}
              </div>
              <p>
                明日の注文には薬を作り置きできます。スタミナは翌朝100に戻ります。
              </p>
            </>
          )}
        </Scroll>
        <footer className="c-footer">
          <span>{plan.error ?? `完成予定：${stockText(plan.produced)}`}</span>
          <div className="c-row">
            <Button onClick={() => patch({ tab: "map" })}>仕入れへ</Button>
            <Button
              primary
              disabled={!!plan.error}
              onClick={() =>
                ask(
                  { type: "brew", recipe: r.id, quantity: ui.quantity },
                  `${r.name}を調合する`,
                )
              }
            >
              調合する
            </Button>
          </div>
        </footer>
      </section>
    </div>
  );
}
function Inventory(c: Ctx) {
  return (
    <Scroll id="inventory" {...c}>
      <h2>持ち物と処方の習熟</h2>
      <div className="c-inventory">
        {chapterRecipes
          .filter((r) => c.s.known.includes(r.id) || getStockTotal(c.s, r.id))
          .map((r) => (
            <article className="c-paper" key={r.id}>
              <div className="c-row">
                <Medicine id={r.id} />
                <b>
                  {r.name}：計{getStockTotal(c.s, r.id)}個
                </b>
              </div>
              <p>
                Lv.{levelForXP(c.s.recipeXP[r.id] ?? 0)} ／ XP{" "}
                {c.s.recipeXP[r.id] ?? 0} ／ 次の完成品質
                {qualityForRecipe(c.s, r.id)}
              </p>
              <details>
                <summary>品質別の在庫</summary>
                <p>{stockText(c.s.stockByQuality[r.id] ?? {})}</p>
              </details>
            </article>
          ))}
      </div>
      <h3>素材</h3>
      <div className="c-inventory">
        {materialIds.map((m) => (
          <p className="c-material-row" key={m}>
            <Medicine id={m} />
            {materialOf(m).name} ×{c.s.materials[m]}
          </p>
        ))}
      </div>
    </Scroll>
  );
}
function Journal(c: Ctx) {
  const { s, ask, patch } = c,
    legacy = projectLegacy(s);
  return (
    <Scroll id="journal" {...c}>
      <h2>約束帳・取引の記録</h2>
      <p>
        新しい契約：受諾中{" "}
        {s.acceptedQuestContracts.filter((c) => c.status === "active").length}
        /2件 ／ 掛け仕入れ・旧契約は別枠
      </p>
      {s.acceptedQuestContracts.map((ct) => (
        <article className="c-paper" key={ct.id}>
          <h3>{ct.terms.title}</h3>
          <p>
            {questStatus(s, ct.terms)} ／ 納品
            {dateOf(ct.terms.deliveryWindow![0])}〜
            {dateOf(ct.terms.deliveryWindow![1])}
            <br />
            <Requirements q={ct.terms} />
          </p>
          <Button
            onClick={() =>
              patch({ tab: "orders", selected: [ct.questId], allocation: null })
            }
          >
            依頼を確認
          </Button>
        </article>
      ))}
      <h3>掛け仕入れ</h3>
      {supportOffers
        .filter((o) => o.kind === "credit")
        .map((o) => (
          <article className="c-paper" key={o.id}>
            <h3>{o.title}</h3>
            <p>
              {o.description}
              <br />
              {Object.entries(o.materials)
                .map(([m, n]) => `${materialOf(m as MaterialId).name}×${n}`)
                .join("、")}
              <br />
              支払額 {gold(o.repayment)} ／ 受諾から{o.term}日後まで
            </p>
            <p>{offerReason(legacy, o)}</p>
            <Button
              disabled={!!offerReason(legacy, o)}
              onClick={() =>
                ask(
                  { type: "accept", offer: o.id },
                  "掛け仕入れの条件を確認する",
                )
              }
            >
              掛け仕入れを受ける
            </Button>
          </article>
        ))}
      {s.obligations.length > 0 && <h3>掛け仕入れ・引き継いだ契約</h3>}
      {s.obligations.map((o) => (
        <article className="c-paper" key={o.id}>
          <h3>{o.terms.title}</h3>
          <p>
            {o.status} ／ 期限{dateOf(o.due)} ／ 未精算{gold(o.outstanding)}
            <br />
            受取済み前金 {gold(o.terms.money)} ／ 納品時の固定残額{" "}
            {gold(o.terms.totalPay - o.terms.money)}
          </p>
          <div className="c-row">
            {o.outstanding > 0 && (
              <Button
                disabled={
                  s.money < o.outstanding ||
                  (o.status === "active" && o.terms.kind !== "credit")
                }
                onClick={() => ask({ type: "pay", id: o.id }, "未精算を支払う")}
              >
                支払う
              </Button>
            )}
            {o.status === "active" && (
              <>
                <Button
                  onClick={() =>
                    ask({ type: "cancel", id: o.id }, "約束を解消する")
                  }
                >
                  解消
                </Button>
                {!o.terms.schedule && (
                  <Button
                    disabled={o.extensions >= o.terms.extensionLimit}
                    onClick={() =>
                      ask({ type: "renegotiate", id: o.id }, "期限を延長する")
                    }
                  >
                    延長
                  </Button>
                )}
                {o.terms.options.map((option) => (
                  <Button
                    key={option.id}
                    onClick={() =>
                      ask(
                        { type: "fulfill", id: o.id, option: option.id },
                        "引き継いだ契約に納品する",
                      )
                    }
                  >
                    {option.label}：{recipeName(option.recipe)}×{option.count}
                  </Button>
                ))}
              </>
            )}
          </div>
        </article>
      ))}
      <h3>出来事の記録</h3>
      <p>
        {s.occurredEvents
          .map((id) =>
            id.startsWith("evt-c1-")
              ? `第一章・出来事${id.slice(-2)}${s.playedEvents.includes(id) ? "（閲覧済み）" : "（未読）"}`
              : id,
          )
          .join(" ／ ") || "まだ出来事はありません。"}
      </p>
      <h3>紹介済みの場所</h3>
      {locations
        .filter((p) => s.introducedPlaces.includes(p.id))
        .map((p) => (
          <p key={p.id}>
            {p.name}：{visitReason(s, p.id) ?? "利用可能"}
          </p>
        ))}
      <h3>関係</h3>
      {chapterPeople
        .filter((p) => s.introducedPeople.includes(p.id))
        .map((p) => (
          <p key={p.id}>
            {p.name} {(s.relationPoints[p.id] / 100).toFixed(2)} ／
            本日の最高評価 {((s.dailyRelationBest[p.id] ?? 0) / 100).toFixed(2)}
          </p>
        ))}
      <h3>最近の記録</h3>
      {s.log.map((line, i) => (
        <p key={i}>{line}</p>
      ))}
    </Scroll>
  );
}
function Confirmation({
  s,
  action,
}: {
  s: ChapterState;
  action: ChapterAction;
}) {
  if (action.type === "quest-deliver") {
    const q = quoteDelivery(s, action.ids, action.allocation, action.priority);
    return (
      <>
        {q.lines.map((l) => (
          <p key={l.id}>
            {l.quest.title}
            <br />
            {Object.entries(q.allocation[l.id] ?? {})
              .map(([r, b]) => `${recipeName(r)} ${stockText(b ?? {})}`)
              .join(" ／ ")}
          </p>
        ))}
        <DeliverySummary quote={q} />
        <p>
          受取 {gold(q.pay)} ／ スタミナ消費{q.stamina}
        </p>
        <h3>納品後に残る在庫</h3>
        {Object.keys(q.consumed).map((id) => (
          <p key={id}>
            {recipeName(id)}：{stockText(q.remaining[id as RecipeId] ?? {})}
          </p>
        ))}
        {q.lines
          .filter((l) => !s.questCompletionCounts[l.quest.id])
          .flatMap((l) =>
            effectLabels(
              l.quest.onFirstComplete,
              contractFor(s, l.quest.id)?.events,
            ),
          )
          .map((x, i) => (
            <p key={i}>{x}</p>
          ))}
      </>
    );
  }
  if (action.type === "gather") {
    const p = quoteGather(s, action.place);
    return (
      <>
        <p>
          {locationName(action.place)} ／ スタミナ{p.stamina}
        </p>
        {p.major.map((d) => (
          <p key={d.materialId}>
            必ず{materialOf(d.materialId).name}
            {d.min}〜{d.max}個
          </p>
        ))}
        {p.bonus.map((d) => (
          <p key={d.materialId}>
            追加：{materialOf(d.materialId).name}
            {d.count}個、{d.probabilityBP / 100}%
          </p>
        ))}
        <p className="c-warning">{p.error}</p>
      </>
    );
  }
  if (action.type === "buy") {
    const p = quoteBuy(s, action.place, action.basket);
    return (
      <>
        <p>{locationName(action.place)}</p>
        {Object.entries(action.basket)
          .filter(([, n]) => n! > 0)
          .map(([m, n]) => (
            <p key={m}>
              {materialOf(m as MaterialId).name} ×{n}
            </p>
          ))}
        <p>
          合計 {gold(p.cost)} ／ 購入後 {gold(p.moneyAfter)}
          <br />
          日付・スタミナの消費なし
        </p>
        <p className="c-warning">{p.error}</p>
      </>
    );
  }
  if (action.type === "brew") {
    const p = planBrew(s, action.recipe, action.quantity);
    return (
      <>
        <p>
          {recipeName(action.recipe)}：{stockText(p.produced)}
          <br />
          消費スタミナ {p.stamina} ／ 制作後XP {p.xp}
        </p>
        <p>
          {Object.entries(p.materials)
            .map(([m, n]) => `${materialOf(m as MaterialId).name} ×${n}`)
            .join("、")}
        </p>
        <p className="c-warning">{p.error}</p>
      </>
    );
  }
  if (action.type === "quest-accept") {
    const q = quests.find((q) => q.id === action.quest)!;
    return (
      <>
        <h3>{q.title}</h3>
        <p>
          <Requirements q={q} />
          <br />
          納品：{dateOf(q.deliveryWindow![0])}〜{dateOf(q.deliveryWindow![1])}
          <br />
          納品スタミナ {q.staminaCost} ／ 前金0G
        </p>
        <p>
          基礎額
          {gold(
            q.requirements.reduce((a, n) => a + n.count * n.baseUnitPrice, 0),
          )}
          に品質で最大＋{q.qualityBonusBP / 100}%（買い叩きなし）
        </p>
        {effectLabels(q.onAcceptOnce).map((x, i) => (
          <p key={i}>{x}</p>
        ))}
        <h3>初回納品時の変化</h3>
        {effectLabels(q.onFirstComplete).map((x, i) => (
          <p key={i}>{x}</p>
        ))}
        <p>
          取消・不履行後に再受諾できません。追加の返済・尊厳ペナルティはありません。
        </p>
      </>
    );
  }
  if (action.type === "quest-decline" || action.type === "quest-cancel")
    return (
      <p>
        このプレイでは再受諾できなくなります。追加の返済義務はありません。支給済みの処方と残り材料は保持します。
      </p>
    );
  if (action.type === "end-day")
    return (
      <>
        <p>
          日付を進めます。スタミナは翌朝100へ回復します。薬・素材は持ち越します。
        </p>
        {s.acceptedQuestContracts
          .filter(
            (c) =>
              c.status === "active" && c.terms.deliveryWindow![1] <= dayOf(s),
          )
          .map((c) => (
            <p className="c-warning" key={c.id}>
              {c.terms.title}：今日が最終期限です。終了すると不履行になります。
            </p>
          ))}
        {s.obligations
          .filter((o) => o.status === "active" && o.due <= dayOf(s))
          .map((o) => (
            <p className="c-warning" key={o.id}>
              {o.terms.title}：期限超過。未精算{gold(o.outstanding)}が残ります。
            </p>
          ))}
        {s.day === 14 && <p>日末処理後、章末の精算へ進みます。</p>}
      </>
    );
  if (action.type === "accept") {
    const o = supportOffers.find((o) => o.id === action.offer)!;
    return (
      <p>
        {o.description}
        <br />
        {Object.entries(o.materials)
          .map(([m, n]) => `${materialOf(m as MaterialId).name}×${n}`)
          .join("、")}
        <br />
        支払額{gold(o.repayment)} ／ 期限{dateOf(dayOf(s) + o.term)}
        <br />
        解消・期限超過でも返済義務が残ります。
      </p>
    );
  }
  const o =
    "id" in action ? s.obligations.find((o) => o.id === action.id) : undefined;
  return (
    <p>
      {o?.terms.title}
      <br />
      {action.type === "pay"
        ? `支払額 ${gold(o?.outstanding ?? 0)}`
        : action.type === "cancel"
          ? `解消後も未精算${gold(o?.outstanding ?? 0)}の返還義務が残ります。`
          : action.type === "renegotiate"
            ? `期限を${o?.terms.extensionDays}日延長します。`
            : action.type === "fulfill"
              ? `${o?.terms.options.find((x) => x.id === action.option)?.label} ／ 固定残額${gold((o?.terms.totalPay ?? 0) - (o?.terms.money ?? 0))}。品質加算なし。`
              : "操作を確定します。"}
    </p>
  );
}
export default function ChapterApp() {
  const [loaded] = useState(() => loadChapter(localStorage)),
    [s, setS] = useState<ChapterState | null>(loaded.state),
    [ui, setUI] = useState<UI>(loadUI),
    [started, setStarted] = useState(false),
    [error, setError] = useState(loaded.error ?? ""),
    [saveError, setSaveError] = useState(loaded.error ?? ""),
    [settings, setSettings] = useState(false),
    [reset, setReset] = useState<"new" | "delete" | null>(null),
    [pending, setPending] = useState<{
      action: ChapterAction;
      title: string;
    } | null>(null),
    [result, setResult] = useState<{ title: string; notices: string[] } | null>(
      null,
    );
  const lock = useRef(false),
    stateRef = useRef(s);
  stateRef.current = s;
  const fullscreen = useFullscreen(),
    patch = (p: Partial<UI>) => setUI((u) => ({ ...u, ...p }));
  useEffect(() => {
    writeUI(ui);
    document.documentElement.dataset.motion = ui.motion ? "reduced" : "normal";
  }, [ui]);
  useEffect(() => {
    const probe = document.createElement("div");
    probe.style.cssText =
      "position:fixed;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)";
    document.body.appendChild(probe);
    const fit = () => {
      const css = getComputedStyle(probe),
        n = (x: string) => parseFloat(x) || 0,
        l = n(css.paddingLeft),
        r = n(css.paddingRight),
        t = n(css.paddingTop),
        b = n(css.paddingBottom);
      document.documentElement.style.setProperty(
        "--fit",
        String(
          Math.min((innerWidth - l - r) / 1200, (innerHeight - t - b) / 500),
        ),
      );
      document.documentElement.style.setProperty(
        "--shift-x",
        `${(l - r) / 2}px`,
      );
      document.documentElement.style.setProperty(
        "--shift-y",
        `${(t - b) / 2}px`,
      );
    };
    fit();
    window.addEventListener("resize", fit);
    window.visualViewport?.addEventListener("resize", fit);
    return () => {
      probe.remove();
      window.removeEventListener("resize", fit);
      window.visualViewport?.removeEventListener("resize", fit);
    };
  }, []);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("dialog[open]"))
        patch({ tab: "home" });
    };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);
  function persist(next: ChapterState) {
    stateRef.current = next;
    setS(next);
    try {
      saveChapter(localStorage, next);
      setSaveError("");
      return true;
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "保存に失敗しました");
      return false;
    }
  }
  function execute(action: ChapterAction) {
    if (lock.current || saveError || !stateRef.current) return;
    lock.current = true;
    setPending(null);
    const out = performAction(stateRef.current, action);
    if (out.error) setError(out.error);
    else {
      persist(out.state);
      if (action.type !== "mark-seen" && action.type !== "read-event")
        setResult({ title: out.title, notices: out.notices });
      if (action.type === "buy") patch({ basket: {} });
    }
    window.setTimeout(() => {
      lock.current = false;
    }, 200);
  }
  function ask(action: ChapterAction, title: string) {
    if (!s || saveError || lock.current) return;
    setPending({
      action: {
        ...structuredClone(action),
        expectedRevision: stateRef.current!.revision,
      },
      title,
    });
  }
  function begin() {
    const next = freshChapter();
    setUI(freshUI());
    setError("");
    setSaveError("");
    persist(next);
    setStarted(true);
    setReset(null);
  }
  const navigate = (tab: Tab) => {
    if (s && tab === "orders") {
      const ids = quests
        .filter((q) => questVisible(s, q) && !s.seenQuests.includes(q.id))
        .map((q) => q.id);
      if (ids.length && !saveError) execute({ type: "mark-seen", ids });
    }
    patch({ tab });
  };
  const prepare = (ids: string[]) => {
    if (!s) return;
    const p = preparation(s, ids),
      recipe = Object.keys(p.missing).find(
        (id) => p.missing[id as RecipeId]! > 0,
      ) as RecipeId | undefined;
    patch({
      goals: ids,
      targets: ids.map((id) => ({
        id,
        contractId: contractFor(s, id)?.id,
        requirements: structuredClone(questFor(s, id)!.requirements),
      })),
      recipe: recipe ?? ui.recipe,
      quantity: Math.max(1, Math.min(99, p.missing[recipe ?? ui.recipe] ?? 1)),
      tab: Object.values(p.materials).some((n) => n! > 0) ? "map" : "brew",
    });
  };
  const ctx = s ? { s, ui, patch, ask, prepare } : null,
    prep = s ? preparation(s, ui.goals) : null,
    due = s ? rules.quotas[s.chapter - 1] + s.carryOver : 0,
    event = s?.eventQueue[0];
  return (
    <>
      <div
        className={`chapter-app ${!started ? "c-title" : ui.tab === "home" ? "c-home" : ""}`}
        style={{
          backgroundImage: `url(${backgroundSrc(!started ? "title" : ui.tab === "map" ? "map" : ui.tab === "brew" ? "brew" : "home")})`,
        }}
      >
        {!started ? (
          <>
            <Art src={heroSrc} className="c-title-hero" alt="エレオノール" />
            <div className="c-title-panel">
              <div className="c-eyebrow">IKUSEI · CHAPTER ONE</div>
              <h1>没落令嬢の返済録</h1>
              <p>
                薬を作り、約束を果たす。
                <br />
                その出来栄えと選択が、次の扉を開く。
              </p>
              <Button primary disabled={!s} onClick={() => setStarted(true)}>
                続きから
              </Button>
              <Button
                onClick={() => (s || saveError ? setReset("new") : begin())}
              >
                はじめから
              </Button>
              <Button onClick={() => setSettings(true)}>設定</Button>
              <small>
                第一章・検証用コンテンツ
                <br />
                全端末で縦横比固定・横持ちを想定
              </small>
              {saveError && <p className="c-warning">{saveError}</p>}
            </div>
          </>
        ) : s && ctx ? (
          <>
            <header className="c-hud">
              <button onClick={() => navigate("journal")}>
                第{s.chapter}章 <b>{s.day}日目</b>
                <small>返済まであと{15 - s.day}日</small>
              </button>
              <span>
                スタミナ <b>{s.stamina}/100</b>
              </span>
              <span>
                所持金 <b>{gold(s.money)}</b>
              </span>
              <span>
                返済 {gold(due)}
                <small>不足{gold(Math.max(0, due - s.money))}</small>
              </span>
              <span className="c-debt">
                残債 <b>{gold(s.debt)}</b>
              </span>
              <Button aria-label="設定" onClick={() => setSettings(true)}>
                <Settings size={20} />
              </Button>
            </header>
            <div className="c-body">
              <aside className="c-portrait">
                <Art
                  src={heroSrc}
                  className="c-hero"
                  alt="エレオノール・ラティエ"
                />
                <div className="c-axes">
                  {axes.map((a) => (
                    <div key={a}>
                      <span>
                        {a} <small>{axisStage(a, s.axes[a])}</small>
                        <b>{s.axes[a]}</b>
                      </span>
                      <progress value={s.axes[a]} max="100" />
                    </div>
                  ))}
                  <small>品位上限 {s.dignityCap}/100</small>
                </div>
              </aside>
              <nav className="c-nav">
                {(
                  [
                    { tab: "home", label: "自室", Icon: Home },
                    { tab: "orders", label: "依頼", Icon: BookOpen },
                    { tab: "map", label: "仕入れ", Icon: Map },
                    { tab: "brew", label: "調合", Icon: FlaskConical },
                    { tab: "inventory", label: "持ち物", Icon: Package },
                    { tab: "journal", label: "約束帳", Icon: Calendar },
                  ] as const
                ).map(({ tab, label, Icon }) => (
                  <button
                    key={tab}
                    className={ui.tab === tab ? "selected" : ""}
                    onClick={() => navigate(tab)}
                  >
                    <Icon size={22} />
                    {label}
                  </button>
                ))}
                <button
                  onClick={() => ask({ type: "end-day" }, "一日を終える")}
                  disabled={s.ended || s.awaitingSettlement}
                >
                  <Moon size={22} />
                  一日終了
                </button>
              </nav>
              <main className="c-main">
                {ui.goals.length > 0 &&
                  !["home", "inventory", "journal"].includes(ui.tab) && (
                    <div className="c-preparation">
                      <span>
                        準備：
                        {Object.entries(prep!.needs)
                          .map(
                            ([id, n]) =>
                              `${recipeName(id)} ${getStockTotal(s, id as RecipeId)}/${n}`,
                          )
                          .join(" ＋ ")}
                      </span>
                      <Button
                        onClick={() =>
                          patch({ tab: "orders", selected: ui.goals })
                        }
                      >
                        依頼へ戻る
                      </Button>
                      {ui.tab === "map" && (
                        <Button onClick={() => patch({ tab: "brew" })}>
                          調合へ
                        </Button>
                      )}
                      <button
                        aria-label="準備を解除"
                        onClick={() => patch({ goals: [], targets: [] })}
                      >
                        ×
                      </button>
                    </div>
                  )}
                {s.awaitingSettlement ? (
                  <section className="c-screen">
                    <Scroll id="settlement" {...ctx}>
                      <div className="c-eyebrow">
                        CHAPTER {s.chapter} · SETTLEMENT
                      </div>
                      <h2>章末の精算</h2>
                      <p>
                        所持金 {gold(s.money)} ／ 返済額 {gold(due)}
                        <br />
                        今回返済 {gold(Math.min(s.money, due))} ／ 不足{" "}
                        {gold(Math.max(0, due - s.money))}
                        <br />
                        利息{" "}
                        {gold(Math.ceil(Math.max(0, due - s.money) * 0.25))}
                      </p>
                      {s.money < due && (
                        <p className="c-warning">
                          不足額に利息25%を加えて次章へ繰越。威厳−15・品位−10。
                        </p>
                      )}
                      <h3>育った処方</h3>
                      {chapterRecipes
                        .filter((r) => (s.recipeXP[r.id] ?? 0) > 0)
                        .map((r) => (
                          <p key={r.id}>
                            {r.name} Lv.{levelForXP(s.recipeXP[r.id] ?? 0)} ／
                            制作{s.recipeXP[r.id]}個
                          </p>
                        ))}
                      <h3>紹介された場所</h3>
                      <p>
                        {s.introducedPlaces
                          .filter(
                            (id) =>
                              !locations.find((p) => p.id === id)
                                ?.introducedAtStart && id !== "estate",
                          )
                          .map(locationName)
                          .join("、") || "なし"}
                      </p>
                      <p>
                        貞操{s.axes.貞操} ／ 品位{s.axes.品位}（上限
                        {s.dignityCap}）／ 威厳{s.axes.威厳}
                      </p>
                      {s.obligations
                        .filter((o) => o.outstanding > 0)
                        .map((o) => (
                          <p key={o.id}>
                            {o.terms.title} {gold(o.outstanding)}{" "}
                            <Button
                              disabled={
                                s.money < o.outstanding ||
                                (o.status === "active" &&
                                  o.terms.kind !== "credit")
                              }
                              onClick={() =>
                                ask({ type: "pay", id: o.id }, "未精算を支払う")
                              }
                            >
                              支払う
                            </Button>
                          </p>
                        ))}
                    </Scroll>
                    <footer className="c-footer">
                      <Button
                        primary
                        onClick={() =>
                          execute({
                            type: "settle",
                            expectedRevision: s.revision,
                          })
                        }
                      >
                        返済を確定する
                      </Button>
                    </footer>
                  </section>
                ) : s.ended ? (
                  <div className="c-empty">
                    <h1>
                      {s.debt === 0 ? "すべての返済を終えた" : "育成の記録"}
                    </h1>
                    <p>
                      残債 {gold(s.debt)} ／ 所持金 {gold(s.money)}
                    </p>
                    <p>全6章を終えました。専用物語は第一章の検証用です。</p>
                    <Button onClick={() => setStarted(false)}>
                      タイトルへ
                    </Button>
                  </div>
                ) : ui.tab === "home" ? (
                  <div className="c-home-content">
                    <div className="c-eyebrow">エレオノール・ラティエ</div>
                    <h2>今日は、何をしましょうか。</h2>
                    {s.chapter > 1 && (
                      <p className="c-note">
                        第2〜6章の専用物語は未設定です。反復依頼と返済は続けられます。
                      </p>
                    )}
                    <Button primary onClick={() => navigate("orders")}>
                      <BookOpen />
                      依頼 <small>約束と出来栄えを確かめる</small>
                    </Button>
                    <Button onClick={() => navigate("map")}>
                      <Map />
                      仕入れ <small>地図から素材の入手先へ</small>
                    </Button>
                    <Button onClick={() => navigate("brew")}>
                      <FlaskConical />
                      調合 <small>処方を重ね、品質を育てる</small>
                    </Button>
                    <div className="c-row">
                      <Button
                        onClick={() => ask({ type: "end-day" }, "一日を終える")}
                      >
                        一日を終える
                      </Button>
                      <Button onClick={() => navigate("journal")}>
                        約束帳
                      </Button>
                    </div>
                  </div>
                ) : ui.tab === "orders" ? (
                  <OrderScreen {...ctx} />
                ) : ui.tab === "map" ? (
                  <SupplyScreen {...ctx} />
                ) : ui.tab === "brew" ? (
                  <BrewingScreen {...ctx} />
                ) : ui.tab === "inventory" ? (
                  <Inventory {...ctx} />
                ) : (
                  <Journal {...ctx} />
                )}
              </main>
            </div>
          </>
        ) : null}
      </div>
      {pending && s && (
        <Modal
          title={pending.title}
          onClose={() => setPending(null)}
          footer={
            <>
              <Button onClick={() => setPending(null)}>戻る</Button>
              <Button
                primary
                disabled={!!saveError}
                onClick={() => execute(pending.action)}
              >
                確定する
              </Button>
            </>
          }
        >
          <div className="c-modal-content">
            <Confirmation s={s} action={pending.action} />
          </div>
        </Modal>
      )}
      {result && !event && !pending && (
        <Modal
          title={result.title}
          onClose={() => setResult(null)}
          footer={
            <Button primary onClick={() => setResult(null)}>
              確認
            </Button>
          }
        >
          <div className="c-modal-content">
            {result.notices.map((n, i) => (
              <p key={i}>{n}</p>
            ))}
          </div>
        </Modal>
      )}
      {started && event && !saveError && (
        <Dialogue
          key={event.id}
          title={event.title}
          lines={event.lines.map((text) => ({ text }))}
          place={
            (event.place !== "backmarket"
              ? event.place
              : "backstreet") as PlaceId
          }
          speed={ui.speed}
          image={event.imageId ?? undefined}
          onDone={() => execute({ type: "read-event", id: event.id })}
        />
      )}
      {settings && (
        <Modal title="設定" onClose={() => setSettings(false)}>
          <div className="c-modal-content">
            <label>
              文字送り
              <select
                value={ui.speed}
                onChange={(e) => patch({ speed: Number(e.target.value) })}
              >
                <option value="0">即時表示</option>
                <option value="24">標準</option>
                <option value="50">ゆっくり</option>
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={ui.motion}
                onChange={(e) => patch({ motion: e.target.checked })}
              />
              動きを抑える
            </label>
            {fullscreenSupported() && (
              <Button onClick={fullscreen.toggle}>
                {fullscreen.active ? "全画面を解除" : "全画面で遊ぶ"}
              </Button>
            )}
            <p>
              依頼→仕入れ→調合→品質を選んで納品。日付は「一日を終える」で進みます。
            </p>
            <div className="c-row">
              <Button
                onClick={() => {
                  setSettings(false);
                  setStarted(false);
                }}
              >
                タイトルへ
              </Button>
              <Button
                onClick={() => {
                  setSettings(false);
                  setReset("delete");
                }}
              >
                セーブを削除
              </Button>
            </div>
          </div>
        </Modal>
      )}
      {reset && (
        <Modal
          title={reset === "new" ? "新しく始めますか" : "セーブを削除しますか"}
          onClose={() => setReset(null)}
          footer={
            <>
              <Button onClick={() => setReset(null)}>戻る</Button>
              <Button
                primary
                onClick={() => {
                  if (reset === "new") begin();
                  else {
                    try {
                      for (const key of [
                        SAVE_KEY,
                        UI_KEY,
                        ...OLD_KEYS,
                        "ikusei-ui-v1",
                      ])
                        localStorage.removeItem(key);
                      setS(null);
                      stateRef.current = null;
                      setStarted(false);
                      setUI(freshUI());
                      setSaveError("");
                      setError("");
                      setReset(null);
                    } catch {
                      setError("保存領域を削除できませんでした");
                    }
                  }
                }}
              >
                実行する
              </Button>
            </>
          }
        >
          <p>
            現在のプレイを続きから再開できなくなります。移行時の旧保存バックアップは保持します。
          </p>
        </Modal>
      )}
      {error && (
        <Modal
          title="操作を確認してください"
          onClose={() => setError("")}
          footer={<Button onClick={() => setError("")}>閉じる</Button>}
        >
          <p>{error}</p>
        </Modal>
      )}
      {saveError && s && !error && (
        <Modal
          title="保存を再試行してください"
          onClose={() => {}}
          footer={
            <Button primary onClick={() => persist(stateRef.current!)}>
              同じ結果を再保存
            </Button>
          }
        >
          <p>{saveError}</p>
          <p>
            操作結果は画面内に保持しています。抽選・制作・報酬をやり直さず、同じ状態を保存します。
          </p>
        </Modal>
      )}
    </>
  );
}
