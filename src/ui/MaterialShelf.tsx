import {
  materials,
  placeOpen,
  places,
  recipes,
  type GameState,
} from "../game";
import { preparationMaterials } from "../presentation";
import type { UIState } from "../uiState";
import { Item } from "./components";

/** ゲージの目盛り。素材は片手で数えられる量しか持たないので8で足りる。 */
const TICKS = 8;

/** 手持ちの素材の棚。
    「一つの素材が二つの品に分岐する」（乾燥ケシ＝眠り薬か媚薬か）は
    このゲームの中身なのに、画面のどこにも出ていなかった。
    採る／買う／貰うの経路と一緒に、その競合をここで見せる。 */
export function MaterialShelf({ s, ui }: { s: GameState; ui: UIState }) {
  const lack = preparationMaterials(s, ui.selection, ui.memo);
  return (
    <section className="shelf" aria-label="手持ちの素材">
      <h3>手持ちの素材</h3>
      {materials.map((m) => {
        const held = s.materials[m.id] ?? 0;
        // 未習得の処方は伏せる。レシピ帳は「どこを通ってきたかの記録」なので、
        // 素材の棚から先に中身を漏らさない。
        const uses = recipes.filter(
          (r) => s.known.includes(r.id) && r.needs[m.id],
        );
        const gathered = places
          .filter((p) => placeOpen(p, s) && p.gathers?.[m.id])
          .map((p) => p.short);
        const sold = places.some(
          (p) => placeOpen(p, s) && p.sells?.includes(m.id),
        );
        const short = lack[m.id] ?? 0;
        // 「分岐」の印は、買い足しで逃げられない素材だけに付ける。
        // 苦艾のように安く買えるものまで印を付けると、印の意味が薄れる。
        const scarce = !m.buy || m.buy >= 26;
        return (
          <article
            className={`shelf-row ${short ? "is-short" : ""}`}
            key={m.id}
          >
            <Item id={m.id} />
            <b className="shelf-name">{m.name}</b>
            <span className="shelf-count">
              <i>{held}</i>
              <span className="shelf-bar" aria-hidden="true">
                {Array.from({ length: TICKS }, (_, i) => (
                  <u key={i} className={i < held ? "filled" : ""} />
                ))}
              </span>
              {short > 0 && <em>あと{short}</em>}
            </span>
            <span className="shelf-uses">
              {uses.length ? (
                uses.map((r, i) => (
                  <span key={r.id}>
                    {i > 0 && (
                      <b className="shelf-branch" aria-label="分岐">
                        ⟋
                      </b>
                    )}
                    {r.name}
                  </span>
                ))
              ) : (
                <small className="muted">使い道はまだ知らない</small>
              )}
              {uses.length > 1 && scarce && (
                <em className="shelf-note">分岐</em>
              )}
            </span>
            <span className="shelf-source">
              {gathered.length
                ? gathered.join("・")
                : sold
                  ? "買うのみ"
                  : "表では買えない"}
              {m.buy ? ` ／ ${m.buy}G` : ""}
            </span>
          </article>
        );
      })}
    </section>
  );
}
