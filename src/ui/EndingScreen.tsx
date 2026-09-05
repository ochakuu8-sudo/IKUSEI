import { heroSrc } from "../art";
import { outstandingTotal } from "../contracts";
import { people, type GameState } from "../game";
import { Art, AxisPanel, Button, Heading, money } from "./components";
import type { Route } from "./routes";

export function EndingScreen({
  s,
  setRoute,
}: {
  s: GameState;
  setRoute: (r: Route) => void;
}) {
  return (
    <>
      <Heading eyebrow="THE LAST PAGE">返済録の結末</Heading>
      <div className="ending-layout">
        <Art src={heroSrc} className="ending-hero" alt="エレオノール" />
        <section className="paper">
          <h2>
            {s.debt === 0 ? "帳面に、終わりを。" : "それでも、明日は来る。"}
          </h2>
          <p>
            残債 <strong>{money(s.debt)}</strong> ／ 所持金 {money(s.money)}
          </p>
          <AxisPanel state={s} />
          <h3>築いた関係</h3>
          {people
            .filter((p) => s.relations[p.id] > 0)
            .map((p) => (
              <p key={p.id}>
                {p.name} · {s.relations[p.id]} / 3
              </p>
            ))}
          <p>
            解禁した人物 {s.unlockedPeople.length} ／ 場所{" "}
            {s.unlockedPlaces.length} ／ 読んだ出来事 {s.playedEvents.length}
          </p>
          <p>
            果たした約束{" "}
            {s.obligations.filter((o) => o.status === "fulfilled").length}件 ／
            未精算 {money(outstandingTotal(s))}
          </p>
          <Button primary onClick={() => setRoute("title")}>
            タイトルへ
          </Button>
        </section>
      </div>
    </>
  );
}
