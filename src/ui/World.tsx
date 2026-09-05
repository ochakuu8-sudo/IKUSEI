import { mapSrc, personSrc } from "../art";
import { supportOffers } from "../content/support";
import { offerReason } from "../contracts";
import type { Action } from "../engine";
import {
  materialOf,
  people,
  personOf,
  personOpen,
  personalJobsAt,
  placeOf,
  placeOpen,
  places,
  relationStage,
  type GameState,
  type MaterialId,
  type PersonId,
  type PlaceId,
} from "../game";
import { preparationMaterials, previewAction } from "../presentation";
import { quoteSummary } from "../workflow";
import type { UIState } from "../uiState";
import {
  Art,
  Badge,
  Button,
  Empty,
  Heading,
  Item,
  Quantity,
  money,
  Preview,
} from "./components";
import { ActionDock } from "./ActionDock";
export function World({
  s,
  ui,
  confirm,
  shop,
  viewPerson,
  personJobs,
  back,
}: {
  s: GameState;
  ui: UIState;
  confirm: (a: Action, title: string) => void;
  shop: (id: PlaceId) => void;
  viewPerson: (id: PersonId | null) => void;
  personJobs: (id: PersonId) => void;
  back: () => void;
}) {
  const persons = people.filter((p) => personOpen(p, s));
  const selected = persons.find((p) => p.id === ui.person);
  const points = [
    ...persons.map((p) => ({
      id: `person:${p.id}`,
      name: p.name,
      person: p,
      place: placeOf(p.place),
    })),
    ...places
      .filter(
        (p) => p.kind !== "home" && placeOpen(p, s) && (p.gathers || p.sells),
      )
      .map((p) => ({
        id: `place:${p.id}`,
        name: p.short,
        person: undefined,
        place: p,
      })),
  ];
  return (
    <div className={`outing-screen ${selected ? "has-person" : ""}`}>
      <Heading eyebrow="OUTING">出かける</Heading>
      <p className="intro">
        会う相手・採る場所・買い物先を選びます。選ぶだけなら0日です。
      </p>
      <div className="outing-layout">
        <section className="outing-map" aria-label="外出先">
          <Art src={mapSrc()} className="outing-map-art" alt="街と周辺の地図" />
          <div className="outing-targets">
            {points.map((target, i) => {
              const p = target.place,
                actor = target.person;
              const peers = points
                .slice(0, i)
                .filter((t) => t.place.id === p.id).length;
              const gather: Action = { type: "gather", place: p.id };
              const why = p.gathers
                ? previewAction(s, gather).error
                : undefined;
              return (
                <button
                  className={`outing-target ${actor && selected?.id === actor.id ? "selected" : ""}`}
                  style={{
                    left: `${Math.min(88, p.map.x + peers * 9)}%`,
                    top: `${Math.max(7, p.map.y - peers * 13)}%`,
                  }}
                  key={target.id}
                  onClick={() =>
                    actor
                      ? viewPerson(actor.id)
                      : p.sells
                        ? shop(p.id)
                        : confirm(gather, `${p.name}で採集する`)
                  }
                >
                  {actor ? (
                    <Art src={personSrc(actor.id)} className="crest" />
                  ) : (
                    <Item
                      id={
                        p.sells?.[0] ??
                        (Object.keys(p.gathers!)[0] as MaterialId)
                      }
                    />
                  )}
                  <span>
                    <b>{target.name}</b>
                    <small>
                      {actor
                        ? `${p.short} ／ 依頼 ${personalJobsAt(p.id, s).filter((j) => j.person === actor.id).length}件`
                        : p.sells
                          ? "買う品物を選ぶ・0日"
                          : `採る・${quoteSummary(s, gather)}`}
                    </small>
                    {(actor
                      ? s.newPeople.includes(actor.id)
                      : s.newPlaces.includes(p.id)) && (
                      <Badge tone="ready">新着</Badge>
                    )}
                    {why && <small className="muted">{why}</small>}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
        {selected && (
          <section
            className="person-detail work-detail"
            aria-label="人物の用件"
          >
            <div className="work-detail-body">
              <div className="person-heading">
                <Art src={personSrc(selected.id)} className="crest large" />
                <div>
                  <h2>{selected.name}</h2>
                  <Badge>{relationStage(s.relations[selected.id])}</Badge>
                </div>
              </div>
              <p>
                {selected.role} ／ {placeOf(selected.place).name}
              </p>
              <Button primary onClick={() => personJobs(selected.id)}>
                この人の依頼を見る・0日
              </Button>
              <h3>親交を深める</h3>
              <Preview
                state={s}
                action={{ type: "network", person: selected.id }}
              />
              {supportOffers
                .filter((o) => o.kind === "credit" && o.person === selected.id)
                .map((o) => (
                  <details key={o.id}>
                    <summary>{o.title}</summary>
                    <p>{o.description}</p>
                    <p>
                      {Object.entries(o.materials)
                        .map(
                          ([id, n]) =>
                            `${materialOf(id as MaterialId).name}×${n}`,
                        )
                        .join("・")}
                    </p>
                    <p>
                      返済 {money(o.repayment)} ／ 受諾から{o.term}日以内
                    </p>
                    <Button
                      disabled={!!offerReason(s, o)}
                      onClick={() =>
                        confirm({ type: "accept", offer: o.id }, o.title)
                      }
                    >
                      仕入れ条件を確認・受諾{o.acceptDays}日
                    </Button>
                    {offerReason(s, o) && (
                      <small className="error">{offerReason(s, o)}</small>
                    )}
                  </details>
                ))}
            </div>
            <ActionDock
              state={s}
              action={{ type: "network", person: selected.id }}
              confirm={confirm}
              back={() => viewPerson(null)}
              title={`${selected.name}と交流する`}
            />
          </section>
        )}
      </div>
    </div>
  );
}
export function Place({
  s,
  id,
  ui,
  patch,
  confirm,
  back,
}: {
  s: GameState;
  id: PlaceId;
  ui: UIState;
  patch: (p: Partial<UIState>) => void;
  confirm: (a: Action, title: string) => void;
  back: () => void;
}) {
  const p = placeOf(id);
  if (!placeOpen(p, s) || !p.sells)
    return <Empty>この買い物先は利用できません。</Empty>;
  const basket = Object.fromEntries(
    Object.entries(ui.basket).filter(([id]) =>
      p.sells!.includes(id as MaterialId),
    ),
  );
  const shortages = preparationMaterials(s, ui.selection, ui.memo);
  const purchase: Action = { type: "buy", place: id, basket };
  return (
    <div className="shop-screen">
      <Heading eyebrow="SHOP">{p.name}で買い物</Heading>
      <p className="intro">
        数量を選んでまとめて購入します。確定するまで0日です。
      </p>
      <section className="paper supply">
        {p.sells.some((id) => (shortages[id] ?? 0) > 0) && (
          <Button
            onClick={() =>
              patch({
                basket: {
                  ...basket,
                  ...Object.fromEntries(
                    p.sells!.map((id) => [
                      id,
                      Math.max(basket[id] ?? 0, shortages[id] ?? 0),
                    ]),
                  ),
                },
              })
            }
          >
            準備中の不足分を追加
          </Button>
        )}
        {p.sells.map((id) => (
          <div className="material-need" key={id}>
            <Item id={id} />
            <div>
              <b>{materialOf(id).name}</b>
              <small>
                単価 {money(materialOf(id).buy ?? 0)} ／ 所持{s.materials[id]}
              </small>
            </div>
            <Quantity
              label={`${materialOf(id).name}の購入数`}
              value={ui.basket[id] ?? 0}
              max={999}
              onChange={(n) => patch({ basket: { ...ui.basket, [id]: n } })}
            />
          </div>
        ))}
      </section>
      <ActionDock
        state={s}
        action={purchase}
        confirm={confirm}
        back={back}
        title="素材をまとめて購入する"
      />
    </div>
  );
}
