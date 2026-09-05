import { ArrowLeft, MapPin } from "lucide-react";
import { useState } from "react";
import { mapSrc, personSrc, placeSrc } from "../art";
import { storyEvents } from "../content/events";
import { supportOffers } from "../content/support";
import { offerReason } from "../contracts";
import type { Action } from "../engine";
import {
  isOpen,
  jobs,
  materialOf,
  peopleAt,
  personalJobsAt,
  personOf,
  placeOpen,
  places,
  relationStage,
  type GameState,
  type MaterialId,
  type PlaceId,
} from "../game";
import { previewAction, preparationMaterials } from "../presentation";
import type { UIState } from "../uiState";
import {
  Art,
  Badge,
  Button,
  Empty,
  Heading,
  Item,
  money,
  Quantity,
  Tabs,
} from "./components";
export function World({
  s,
  visit,
}: {
  s: GameState;
  visit: (id: PlaceId) => void;
}) {
  const [mode, setMode] = useState("list");
  const visible = places.filter((p) => placeOpen(p, s));
  return (
    <>
      <Heading eyebrow="A TOWN OF POSSIBILITIES">街の地図</Heading>
      <p className="intro">
        行き先を見るだけでは日数を使いません。人に会い、薬房の外へ。
      </p>
      <Tabs
        value={mode}
        onChange={setMode}
        options={[
          ["list", "行き先一覧"],
          ["map", "地図表示"],
        ]}
      />
      <div className={`world-layout ${mode === "map" ? "map-mode" : ""}`}>
        <div className="world-map">
          <Art
            src={mapSrc()}
            className="map-art"
            alt="街と周辺のイラスト地図"
          />
          {visible.map((p) => (
            <button
              className="map-pin"
              style={{ left: `${p.map.x}%`, top: `${p.map.y}%` }}
              key={p.id}
              onClick={() => visit(p.id)}
            >
              <MapPin size={16} />
              {p.short}
            </button>
          ))}
        </div>
        <div className="destination-list">
          {visible.map((p) => {
            const fresh =
              s.newPlaces.includes(p.id) ||
              s.newPeople.some((id) => personOf(id).place === p.id) ||
              s.newEvents.some(
                (id) => storyEvents.find((e) => e.id === id)?.place === p.id,
              );
            return (
              <button
                className="destination paper"
                key={p.id}
                onClick={() => visit(p.id)}
              >
                <Art src={placeSrc(p.id)} className="destination-art" />
                <div>
                  <span className="card-top">
                    <b>{p.name}</b>
                    {fresh && <Badge tone="ready">新着</Badge>}
                  </span>
                  <small>{p.tagline}</small>
                  <span className="destination-meta">
                    {p.gathers
                      ? Object.entries(p.gathers)
                          .map(
                            ([id, n]) =>
                              `${materialOf(id as MaterialId).name} ×${n}`,
                          )
                          .join("・")
                      : p.sells
                        ? `購入：${p.sells.map((id) => materialOf(id).name).join("・")}`
                        : `人物 ${peopleAt(p.id, s).length}人`}
                  </span>
                  <small>
                    利用できる頼まれごと {personalJobsAt(p.id, s).length}件
                  </small>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
export function Place({
  s,
  id,
  ui,
  patch,
  confirm,
  back,
  returnBrew,
}: {
  s: GameState;
  id: PlaceId;
  ui: UIState;
  patch: (p: Partial<UIState>) => void;
  confirm: (a: Action, title: string) => void;
  back: () => void;
  returnBrew: () => void;
}) {
  const p = places.find((p) => p.id === id)!;
  const persons = peopleAt(id, s),
    [person, setPerson] = useState(persons[0]?.id),
    [tab, setTab] = useState("jobs");
  if (!placeOpen(p, s)) return <Empty>この場所はまだ訪問できません。</Empty>;
  const selected = persons.find((p) => p.id === person) ?? persons[0];
  const basket = Object.fromEntries(
    Object.entries(ui.basket).filter(([id]) =>
      p.sells?.includes(id as MaterialId),
    ),
  );
  const shortages = preparationMaterials(s, ui.selection, ui.memo);
  const purchase = previewAction(s, { type: "buy", place: id, basket });
  return (
    <>
      <Heading
        eyebrow="A PLACE TO VISIT"
        extra={
          <Button onClick={back}>
            <ArrowLeft size={16} />
            地図
          </Button>
        }
      >
        {p.name}
      </Heading>
      <div className="place-banner">
        <Art src={placeSrc(id)} alt={p.name} />
        <p>{p.tagline}</p>
      </div>
      <Button className="text-button" onClick={returnBrew}>
        調合の準備に戻る
      </Button>
      {p.gathers ? (
        <section className="paper">
          <h2>ここで採れる素材</h2>
          <div className="inventory-grid">
            {Object.entries(p.gathers).map(([id, n]) => (
              <div className="item-row" key={id}>
                <Item id={id as MaterialId} large />
                <div>
                  <b>
                    {materialOf(id as MaterialId).name} ×{n}
                  </b>
                  <small>所持 {s.materials[id as MaterialId]}</small>
                </div>
              </div>
            ))}
          </div>
          <p>採集は1日・体力 {p.gatherStamina}を使います。</p>
          <Button
            primary
            disabled={!!previewAction(s, { type: "gather", place: id }).error}
            onClick={() =>
              confirm({ type: "gather", place: id }, `${p.name}で採集する`)
            }
          >
            採集内容を確認
          </Button>
          {previewAction(s, { type: "gather", place: id }).error && (
            <p className="error">
              {previewAction(s, { type: "gather", place: id }).error}
            </p>
          )}
        </section>
      ) : (
        <>
          {persons.length > 0 && (
            <>
              <div className="person-tabs">
                {persons.map((p) => (
                  <button
                    className={selected?.id === p.id ? "selected" : ""}
                    key={p.id}
                    onClick={() => setPerson(p.id)}
                  >
                    <Art src={personSrc(p.id)} className="crest" />
                    <span>{p.name}</span>
                  </button>
                ))}
              </div>
              {selected && (
                <section className="paper">
                  <div className="person-heading">
                    <Art src={personSrc(selected.id)} className="crest large" />
                    <div>
                      <small>RELATIONSHIP</small>
                      <h2>{selected.name}</h2>
                      <Badge>
                        {relationStage(s.relations[selected.id])} ·{" "}
                        {s.relations[selected.id]} / 3
                      </Badge>
                    </div>
                    <Button
                      disabled={
                        !!previewAction(s, {
                          type: "network",
                          person: selected.id,
                        }).error
                      }
                      onClick={() =>
                        confirm(
                          { type: "network", person: selected.id },
                          `${selected.name}を訪問する`,
                        )
                      }
                    >
                      親交を深める
                    </Button>
                  </div>
                  <p className="muted">
                    訪問：1日・20G・体力8。人物の情報を見るだけなら消費なし。
                  </p>
                  <Tabs
                    value={tab}
                    onChange={setTab}
                    options={[
                      ["jobs", "頼まれごと"],
                      ["support", "仕入れ相談"],
                    ]}
                  />
                  {tab === "jobs" ? (
                    <div className="order-grid">
                      {jobs
                        .filter(
                          (j) =>
                            j.category === "personal" &&
                            j.person === selected.id,
                        )
                        .map((j) => {
                          const preview = previewAction(s, {
                            type: "job",
                            id: j.id,
                          });
                          return (
                            <article className="paper nested" key={j.id}>
                              <div className="card-top">
                                <h3>{j.title}</h3>
                                <Badge>
                                  {j.cadence === "repeat"
                                    ? "常設"
                                    : j.cadence === "once"
                                      ? "一度限り"
                                      : "各章1回"}
                                </Badge>
                              </div>
                              <p>{j.description}</p>
                              <div className="cost-line">
                                <span>1日</span>
                                <span>体力 −{j.stamina}</span>
                                {j.costs.map((c, i) => (
                                  <span key={i}>
                                    {c.axis} −{c.amount}
                                  </span>
                                ))}
                              </div>
                              <details>
                                <summary>紹介条件</summary>
                                <p>
                                  {Object.entries(j.needs)
                                    .map(([a, n]) => `${a} ${n}以上`)
                                    .join(" ／ ") || "基本条件なし"}
                                </p>
                                {j.opensBelow && (
                                  <p>
                                    {Object.entries(j.opensBelow)
                                      .map(([a, n]) => `${a} ${n}以下`)
                                      .join(" ／ ")}
                                  </p>
                                )}
                              </details>
                              {preview.error ? (
                                <p className="error">
                                  {isOpen(j, s)
                                    ? preview.error
                                    : "紹介条件または実行回数の条件を満たしていません"}
                                </p>
                              ) : (
                                <p>
                                  報酬 <b>{money(preview.money)}</b>
                                </p>
                              )}
                              <Button
                                disabled={!!preview.error}
                                onClick={() =>
                                  confirm({ type: "job", id: j.id }, j.title)
                                }
                              >
                                条件を確認して実行
                              </Button>
                            </article>
                          );
                        })}
                    </div>
                  ) : (
                    <div className="order-grid">
                      {supportOffers
                        .filter(
                          (o) =>
                            o.kind === "credit" && o.person === selected.id,
                        )
                        .map((o) => (
                          <article className="paper nested" key={o.id}>
                            <h3>{o.title}</h3>
                            <p>{o.description}</p>
                            <p>
                              受取：
                              {Object.entries(o.materials)
                                .map(
                                  ([id, n]) =>
                                    `${materialOf(id as MaterialId).name} ×${n}`,
                                )
                                .join(" ／ ")}
                            </p>
                            <p>
                              返済 {money(o.repayment)} ／ 期限 受諾から{o.term}
                              日 ／ 受諾に{o.acceptDays}日
                            </p>
                            {offerReason(s, o) && (
                              <p className="error">{offerReason(s, o)}</p>
                            )}
                            <Button
                              disabled={!!offerReason(s, o)}
                              onClick={() =>
                                confirm(
                                  { type: "accept", offer: o.id },
                                  o.title,
                                )
                              }
                            >
                              仕入れ条件を確認
                            </Button>
                          </article>
                        ))}
                      {!supportOffers.some(
                        (o) => o.kind === "credit" && o.person === selected.id,
                      ) && (
                        <Empty>この人物からの仕入れ相談はありません。</Empty>
                      )}
                    </div>
                  )}
                </section>
              )}
            </>
          )}
          {p.sells && (
            <section className="paper supply">
              <h2>素材の仕入れ</h2>
              <p>品物を選び、まとめて1日で仕入れます。</p>
              <Button
                disabled={!p.sells.some((id) => (shortages[id] ?? 0) > 0)}
                onClick={() =>
                  patch({
                    basket: {
                      ...ui.basket,
                      ...Object.fromEntries(
                        p.sells!.map((id) => [
                          id,
                          Math.max(ui.basket[id] ?? 0, shortages[id] ?? 0),
                        ]),
                      ),
                    },
                  })
                }
              >
                準備メモの不足分を追加
              </Button>
              {p.sells.map((id) => (
                <div className="material-need" key={id}>
                  <Item id={id} />
                  <div>
                    <b>{materialOf(id).name}</b>
                    <small>
                      単価 {money(materialOf(id).buy ?? 0)} ／ 所持{" "}
                      {s.materials[id]}
                    </small>
                  </div>
                  <Quantity
                    label={`${materialOf(id).name}の購入数`}
                    value={ui.basket[id] ?? 0}
                    onChange={(n) =>
                      patch({ basket: { ...ui.basket, [id]: n } })
                    }
                    max={999}
                  />
                </div>
              ))}
              <div className="action-bar local">
                <div>
                  <strong>
                    合計{" "}
                    {money(
                      p.sells.reduce(
                        (sum, id) =>
                          sum +
                          (materialOf(id).buy ?? 0) * (ui.basket[id] ?? 0),
                        0,
                      ),
                    )}
                  </strong>
                  <small>1日消費</small>
                  {purchase.error && (
                    <small className="error">{purchase.error}</small>
                  )}
                </div>
                <Button
                  primary
                  disabled={!!purchase.error}
                  onClick={() =>
                    confirm(
                      { type: "buy", place: id, basket },
                      "素材をまとめて仕入れる",
                    )
                  }
                >
                  購入内容を確認
                </Button>
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}
