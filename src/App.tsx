import { useEffect, useState, type ButtonHTMLAttributes } from 'react';
import {
  BookOpen, BriefcaseBusiness, ChevronDown, ChevronLeft, Handshake, Landmark,
  FlaskConical, Flower2, Map as MapIcon, Moon, RotateCcw, Scale, Store, Trees,
} from 'lucide-react';
import {
  CHAPTERS, CHAPTER_DAYS, NETWORK_COST, NETWORK_STAMINA, REST_RECOVERY,
  TOTAL_DEBT, axes, axisStage, capDropOf, closedBy, closedJobsAt,
  fatigueRate, hasStaminaFor, initialState, isOpen, jobsBy, listPrice, midGameState,
  openCountAt, openJobs, payWithRelation, peopleAt, personFatigue, personOf, placeOf,
  countsByKind, jobKinds, kindNote, primaryAxis, quotaOf, relationStage, settlementOf, workPlaces,
  gatherPlaces, gatherYield, hasMaterialsFor, hasStockFor,
  knownRecipes, materialIds, materialOf, recipeOf,
  sellsAt, RECIPE_SOURCE,
  type DayResult, type GameState, type Job, type MaterialId, type PersonId,
  type PlaceId, type RecipeId, type SceneLine, type Settlement,
} from './game';
import {
  PLACEHOLDER, backgroundSrc, mapSrc, personSrc, placeSrc, portraitSrc, portraitStage,
  sceneFallbackSrc, sceneSrc,
} from './art';
import { Mark } from './marks';

import { performAction, type Action } from './engine';
import { parseSave, SAVE_KEY, LEGACY_SAVE_KEY } from './save';
import { SupportPanel } from './SupportPanel';
import { dueSoon, dateLabel, outstandingTotal, offerReason } from './contracts';
import { supportOffers } from './content/support';

const PLACE_ICON: Record<PlaceId, typeof Store> = {
  estate: Landmark, arnaud: Store, academy: BookOpen, valere: Landmark, guild: Scale,
  hill: Flower2, wood: Trees, backstreet: Moon,
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'outline' | 'ghost';
  size?: 'default' | 'xs' | 'sm' | 'lg' | 'icon';
};

function Button({ variant = 'primary', size = 'default', className = '', ...props }: ButtonProps) {
  return <button className={`btn ${variant} ${size} ${className}`} {...props} />;
}

/** 素材が無ければ次の候補へ。hideIfMissing は全滅時に何も描かない。 */
function Art({ sources, alt, className, hideIfMissing = false }: {
  sources: string[]; alt: string; className?: string; hideIfMissing?: boolean;
}) {
  // 同じURLが並ぶと、src が変わらないので onError が二度と起きず候補送りが止まる。
  // （軸ごとの差分が無い依頼で、共通CGと候補が一致して実際に止まっていた）
  const list = [...new Set(sources)];
  const key = list.join('|');
  const [step, setStep] = useState(0);
  useEffect(() => setStep(0), [key]);
  if (hideIfMissing && step >= list.length) return null;
  return (
    <img className={className} src={list[Math.min(step, list.length - 1)]} alt={alt}
      onError={() => setStep((n) => (n < list.length ? n + 1 : n))} />
  );
}

function Gauge({ value, max = 100, cap, tone }: { value: number; max?: number; cap?: number; tone: string }) {
  return (
    <div className="gauge">
      {cap !== undefined && cap < max && (
        <span className="gauge-lost" style={{ width: `${((max - cap) / max) * 100}%` }} />
      )}
      <i className={`gauge-fill tone-${tone}`} style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }} />
    </div>
  );
}

/** 全画面で共通のHUD。残債を最も大きい数字に、今章のノルマを進捗として置く。 */
function Hud({ game, onReset }: { game: GameState; onReset: () => void }) {
  const quota = quotaOf(game);
  const done = game.money >= quota;
  const pct = Math.min(100, (game.money / Math.max(1, quota)) * 100);
  return (
    <header className="hud">
      <div className="hud-debt">
        <span>残債</span>
        <strong>{game.debt.toLocaleString()}<small>G</small></strong>
      </div>
      <div className="hud-quota">
        <div className="hud-quota-head">
          <span>第{game.chapter}章のノルマ</span>
          <span className={done ? 'met' : ''}>
            <b>{game.money.toLocaleString()}</b> / {quota.toLocaleString()}G
            {done && ' 達成'}
          </span>
        </div>
        <div className="hud-track"><i className={done ? 'met' : ''} style={{ width: `${pct}%` }} /></div>
      </div>
      <div className="hud-chips">
        <span className="chip">{game.chapter}<i>/{CHAPTERS}章</i></span>
        <span className="chip">残り<b>{CHAPTER_DAYS - game.day + 1}</b>日</span>
        <span className={`chip ${game.stamina < 30 ? 'low' : ''}`}><Mark name="体力" /><b>{game.stamina}</b></span>
      </div>
      <Button variant="ghost" size="icon" aria-label="最初からやり直す" onClick={onReset}><RotateCcw /></Button>
    </header>
  );
}

/* 画面の状態機械。1画面につき仕事は1つ。 */
type View =
  | { kind: 'home' }
  | { kind: 'jobs' }
  | { kind: 'brew' }
  | { kind: 'support'; offer?: string; obligation?: string }
  | { kind: 'map' }
  | { kind: 'place'; place: PlaceId }
  | { kind: 'contract'; job: Job; from: 'jobs' | 'place' }
  | { kind: 'scene'; job?: Job; script: SceneLine[]; line: number; result: DayResult }
  | { kind: 'result'; result: DayResult; back: View }
  | { kind: 'settlement' }
  | { kind: 'ending' };

function loadGame(): GameState | null {
  if (typeof window === 'undefined') return null;
  try {
    return parseSave(localStorage.getItem(SAVE_KEY)) ?? parseSave(localStorage.getItem(LEGACY_SAVE_KEY));
  } catch { return null; }
}

export default function App() {
  const [game, setGame] = useState<GameState | null>(loadGame);
  const [view, setView] = useState<View>(() => { const saved = loadGame(); return { kind: saved?.ended ? 'ending' : saved?.awaitingSettlement ? 'settlement' : 'home' }; });
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      if (game) localStorage.setItem(SAVE_KEY, JSON.stringify(game));
      else { localStorage.removeItem(SAVE_KEY); localStorage.removeItem(LEGACY_SAVE_KEY); }
    } catch { setError('保存できませんでした。ブラウザの空き容量を確認してください。'); }
  }, [game]);

  if (!game) {
    return <TitleScreen onStart={(s) => { setGame(s); setView({ kind: 'home' }); }} />;
  }
  if (view.kind === 'ending') {
    return <EndingScreen game={game} onRestart={() => { setGame(null); setView({ kind: 'home' }); }} />;
  }

  const stage = portraitStage(game.axes);
  const reset = () => setGame(null);

  function act(action: Action, back: View = { kind: 'home' }) {
    if (!game) return;
    const outcome = performAction(game, action);
    if (outcome.error) { setError(outcome.error); return; }
    setError(''); setGame(outcome.state);
    if (action.type === 'settle') { setView({ kind: outcome.state.ended ? 'ending' : 'home' }); return; }
    if (outcome.scene && outcome.result) {
      setView({ kind: 'scene', job: action.type === 'job' ? jobsByForScene(action.id) : undefined,
        line: 0, script: outcome.scene, result: outcome.result });
    } else if (outcome.result) setView({ kind: 'result', result: outcome.result, back });
  }
  function jobsByForScene(id: string) { return openJobs(game!).find(j => j.id === id); }
  function acceptJob(job: Job) { act({ type: 'job', id: job.id }); }
  function rest() { act({ type: 'rest' }); }
  function network(person: PersonId) { act({ type: 'network', person }, { kind: 'place', place: personOf(person).place }); }
  function gather(place: PlaceId) { act({ type: 'gather', place }, { kind: 'map' }); }
  function buy(place: PlaceId, basket: Partial<Record<MaterialId, number>>) { act({ type: 'buy', place, basket }, { kind: 'map' }); }
  function brew(recipe: RecipeId) { act({ type: 'brew', recipe }); }

  if (view.kind === 'support') return <div className="screen support-screen">
    <div className="backdrop" />
    <Hud game={game} onReset={reset} />
    {error && <p role="alert">{error}</p>}
    <SupportPanel game={game} allocation={game.awaitingSettlement} focusOffer={view.offer} focusObligation={view.obligation}
      onBack={() => setView({ kind: game.awaitingSettlement ? 'settlement' : 'jobs' })}
      onAction={a => act(a, view)} />
  </div>;

  /** 結果を閉じたあとの行き先。14日目なら章末精算へ。 */
  function closeResult(back: View) {
    setView(game && game.awaitingSettlement ? { kind: 'settlement' } : back);
  }

  /* ---- イベントシーン ---- */
  if (view.kind === 'scene') {
    const axis = view.job ? primaryAxis(view.job) : null;
    const last = view.line >= view.script.length - 1;
    const line = view.script[view.line];
    return (
      <button className="screen scene" aria-label="タップして次へ"
        onClick={() => (last
          ? setView({ kind: 'result', result: view.result, back: { kind: view.job ? 'home' : 'support' } })
          : setView({ ...view, line: view.line + 1 }))}>
        <Art className="scene-art" alt={`${view.result.title}の情景`}
          sources={view.job ? [sceneSrc(view.job, axis), sceneFallbackSrc(view.job), PLACEHOLDER] : [PLACEHOLDER]} />
        <div className="scene-veil" />
        <div className="textbox">
          {line.speaker && <span className="textbox-name">{line.speaker}</span>}
          <p>{line.text}</p>
          <span className="textbox-next"><ChevronDown /></span>
        </div>
        <span className="scene-progress">{view.line + 1} / {view.script.length}</span>
      </button>
    );
  }

  if (view.kind === 'result') {
    const back = view.back;
    return <ResultScreen result={view.result} stage={stage} onClose={() => closeResult(back)} />;
  }

  /* ---- 章末：ノルマを納める ---- */
  if (view.kind === 'settlement') {
    const sheet = settlementOf(game);
    return (
      <SettlementScreen settlement={sheet} outstanding={outstandingTotal(game)}
        onAllocate={() => setView({ kind: 'support' })} onNext={() => act({ type: 'settle' })} />
    );
  }

  /* ---- 仕事メニュー：受けられる依頼を一画面で比べる ---- */
  if (view.kind === 'jobs') {
    const counts = countsByKind(game);
    const list = openJobs(game).sort((a, b) => {
      const ka = hasStaminaFor(a, game) ? 0 : 1;
      const kb = hasStaminaFor(b, game) ? 0 : 1;
      if (ka !== kb) return ka - kb;
      const oa = jobKinds.indexOf(a.kind);
      const ob = jobKinds.indexOf(b.kind);
      if (oa !== ob) return oa - ob;
      return payWithRelation(b, game) - payWithRelation(a, game);
    });
    return (
      <div className="screen worklist">
        <div className="backdrop"><div className="bg-veil" /></div>
        <Hud game={game} onReset={reset} />
        <div className="topbar">
          <Button variant="ghost" size="sm" onClick={() => setView({ kind: 'home' })}>
            <ChevronLeft />戻る
          </Button>
          <h2>仕事を受ける</h2>
          <Button size="sm" variant="outline" onClick={() => setView({ kind: 'support' })}>支援と約束</Button>
          <span className="topbar-sub">{list.length}件</span>
        </div>
        <div className="kindbar">
          {jobKinds.map((k) => (
            <span key={k} className={`kindchip k-${k} ${counts[k] === 0 ? 'gone' : ''}`} title={kindNote[k]}>
              {k}<b>{counts[k]}</b>
            </span>
          ))}
        </div>
        <div className="jobgrid">
          {game.obligations.filter(o => o.status === 'active' || o.outstanding > 0).map(o => (
            <button className="jobcard2 paper paper-調剤" key={o.id} onClick={() => setView({ kind: 'support', obligation: o.id })}>
              <span className="stamp stamp-調剤">約束</span>
              <span className="jc-name"><b>{o.terms.title}</b><i>{personOf(o.terms.person).name} ／ {o.status === 'active' ? dateLabel(o.due) + 'まで' : '未精算あり'}</i></span>
              <div className="jc-ledger"><span>{o.terms.kind === 'advance' && o.status === 'active' ? o.terms.options.map(c => recipeOf(c.recipe).name + '×' + c.count).join(' ／ ') : '未精算 ' + o.outstanding + 'G'}</span></div>
              <div className="jc-foot"><span>納品・支払い・条件の確認</span></div>
            </button>
          ))}
          {supportOffers.filter(o => !offerReason(game, o)).map(o => (
            <button className="jobcard2 paper paper-調剤" key={'offer-' + o.id} onClick={() => setView({ kind: 'support', offer: o.id })}>
              <span className="stamp stamp-調剤">支援</span>
              <span className="jc-name"><b>{o.title}</b><i>{personOf(o.person).name} ／ 提示は今章{o.closes}日まで</i></span>
              <div className="jc-ledger"><span>{o.kind === 'advance' ? '前金' + o.money + 'G・納品の約束' : '素材を後払いで仕入れる'}</span><span>期限：受諾から{o.term}日 ／ 未精算{o.repayment}G</span></div>
              <div className="jc-foot"><span>条件を読んで検討する</span></div>
            </button>
          ))}
          {list.map((job) => {
            const person = personOf(job.person);
            const tired = !hasStaminaFor(job, game);
            const noStock = !hasStockFor(job, game);
            const blocked = tired || noStock;
            const list0 = listPrice(job, game);
            const now = payWithRelation(job, game);
            const cap = capDropOf(job);
            // 透かしは「この依頼が主に削る軸」の紋。無償の依頼は結びの紋。
            const seal = primaryAxis(job) ?? '関係';
            const needs = axes.filter((a) => job.needs[a] !== undefined);
            return (
              <button key={job.id} className={`jobcard2 paper paper-${job.kind} ${blocked ? 'disabled' : ''}`} disabled={blocked}
                onClick={() => setView({ kind: 'contract', job, from: 'jobs' })}>
                <span className={`stamp stamp-${job.kind}`} aria-hidden="true">{job.kind}</span>
                {/* 紙に薄く刷られた紋。何を差し出す依頼かが、読む前に分かる */}
                <span className={`jc-seal axis-${seal}`} aria-hidden="true"><Mark name={seal} /></span>

                <span className="jc-name">
                  <b>{job.title}</b>
                  <i>{person.name}・{placeOf(person.place).short}　様</i>
                </span>

                {/* この依頼を受けると何が減るか。紋・量・払ったあとの値だけ。 */}
                <div className="jc-ledger">
                  {job.costs.length === 0 ? (
                    <div className="ledger-row ledger-none">
                      {job.bond && job.bond > 1
                        ? <><Mark name="関係" /><b className="ledger-num">＋{job.bond}</b></>
                        : <b className="ledger-num ledger-dash">—</b>}
                      <span className="leader" />
                      <span className="ledger-after">
                        {job.recipe ? `${recipeOf(job.recipe).name}を${job.count ?? 1}つ納める` : '差し出すもの無し'}
                      </span>
                    </div>
                  ) : job.costs.map((c) => {
                    const after = Math.max(0, game.axes[c.axis] - c.amount);
                    return (
                      <div className={`ledger-row axis-${c.axis}`} key={c.axis}>
                        <Mark name={c.axis} />
                        <b className="ledger-num">−{c.amount}</b>
                        <span className="leader" />
                        <span className="ledger-after">{game.axes[c.axis]}<em>→</em>{after}</span>
                      </div>
                    );
                  })}
                  {cap > 0 && (
                    <div className="ledger-row ledger-cap">
                      <Mark name="品位" />
                      <b className="ledger-num">−{cap}</b>
                      <span className="leader" />
                      <span className="ledger-after">上限。戻らない</span>
                    </div>
                  )}
                </div>

                <div className="jc-foot">
                  {/* 受けるのに要るもの。余白の走り書きの扱いにして、代償より小さく */}
                  <span className="jc-req">
                    {/* 「要」は一度だけ。あとは紋と数だけ並べる ── 一件ごとに「以上」を書かない */}
                    <em className="req-label">要</em>
                    {/* 調剤の注文は、在庫が無ければ受けられない */}
                    {job.recipe && (
                      <span className={noStock ? 'req-note bad' : 'req-note stocked'}>
                        {recipeOf(job.recipe).name}
                        <em>{game.stock[job.recipe] ?? 0}/{job.count ?? 1}</em>
                      </span>
                    )}
                    <span className={tired ? 'req-note bad' : 'req-note'}>
                      <Mark name="体力" />{job.stamina}
                    </span>
                    {needs.map((a) => (
                      <span key={a} className="req-note">
                        <Mark name={a} />{job.needs[a]}
                      </span>
                    ))}
                  </span>
                  <span className="jc-pay">
                    {now < list0 && <s>{list0.toLocaleString()}</s>}
                    <b>{now.toLocaleString()}<small>G</small></b>
                  </span>
                </div>
              </button>
            );
          })}
          {list.length === 0 && <p className="empty-note">受けられる依頼が一つも無い。</p>}
        </div>
      </div>
    );
  }

  /* ---- 調合：日は進まない。減るのは体力と素材(§2-3) ---- */
  if (view.kind === 'brew') {
    const book = knownRecipes(game);
    return (
      <div className="screen worklist">
        <div className="backdrop"><div className="bg-veil" /></div>
        <Hud game={game} onReset={reset} />
        <div className="topbar">
          <Button variant="ghost" size="sm" onClick={() => setView({ kind: 'home' })}>
            <ChevronLeft />戻る
          </Button>
          <h2>調合する</h2>
          <span className="topbar-sub">日は進まない</span>
        </div>
        <div className="matbar">
          {materialIds.map((id) => (
            <span key={id} className={`matchip ${game.materials[id] === 0 ? 'none' : ''}`}>
              <b>{materialOf(id).name}</b><i>{game.materials[id]}</i>
            </span>
          ))}
        </div>
        <div className="jobgrid">
          {book.map((r) => {
            const short = !hasMaterialsFor(r, game);
            const tired = game.stamina < r.stamina;
            const held = game.stock[r.id] ?? 0;
            return (
              <div className={`jobcard2 paper paper-調剤 brewcard ${short || tired ? 'disabled' : ''}`} key={r.id}>
                <span className="stamp stamp-調剤" aria-hidden="true">{r.grade}</span>
                <span className="jc-name">
                  <b>{r.name}</b>
                  <i>{RECIPE_SOURCE[r.id]}</i>
                </span>
                <div className="jc-ledger">
                  {materialIds.filter((m) => (r.needs[m] ?? 0) > 0).map((m) => {
                    const need = r.needs[m] ?? 0;
                    const have = game.materials[m];
                    return (
                      <div className={`ledger-row ${have < need ? 'short' : ''}`} key={m}>
                        <span className="mat-name">{materialOf(m).name}</span>
                        <span className="leader" />
                        <span className="ledger-after">{have}<em>/</em>{need}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="jc-foot">
                  <span className="jc-req">
                    <span className={tired ? 'req-note bad' : 'req-note'}>
                      <Mark name="体力" />{r.stamina}
                    </span>
                    {held > 0 && <span className="req-note held">在庫 {held}</span>}
                  </span>
                  <Button size="sm" disabled={short || tired} onClick={() => brew(r.id)}>
                    調合
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* ---- 地図：どこへ行くかを選ぶ ---- */
  if (view.kind === 'map') {
    return (
      <div className="screen map">
        <div className="backdrop">
          <Art className="bg" sources={[mapSrc()]} alt="" hideIfMissing />
          <div className="bg-veil" />
        </div>
        <Hud game={game} onReset={reset} />
        <div className="topbar">
          <Button variant="ghost" size="sm" onClick={() => setView({ kind: 'home' })}>
            <ChevronLeft />戻る
          </Button>
          <h2>どこへ行く</h2>
          <span className="topbar-sub">{game.day}日目</span>
        </div>
        <div className="map-field">
          <svg className="map-routes" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <polygon points={workPlaces.map((p) => `${p.map.x},${p.map.y}`).join(' ')} />
          </svg>
          {gatherPlaces(game).map((place) => {
            const Icon = PLACE_ICON[place.id];
            const got = gatherYield(place);
            const cost = place.gatherStamina ?? 20;
            const tired = game.stamina < cost;
            return (
              <button key={place.id} className={`marker gatherpin ${tired ? 'shut' : ''}`}
                style={{ left: `${place.map.x}%`, top: `${place.map.y}%` }}
                onClick={() => setView({ kind: 'place', place: place.id })}>
                <span className="marker-pin"><Icon /></span>
                <span className="marker-body">
                  <b>{place.short}</b>
                  <i>{got.map((g) => materialOf(g.id).name).join('・')}</i>
                </span>
                <span className="marker-flags">
                  <em className={tired ? 'flag bad' : 'flag'}><Mark name="体力" />{cost}</em>
                </span>
              </button>
            );
          })}
          {workPlaces.map((place) => {
            const Icon = PLACE_ICON[place.id];
            const roster = peopleAt(place.id);
            const open = openCountAt(place.id, game);
            const shut = closedJobsAt(place.id, game).length;
            const best = Math.max(0, ...roster.map((p) => game.relations[p.id]));
            const canVisit = roster.some((p) => game.relations[p.id] < 3);
            return (
              <button key={place.id} className={`marker ${open === 0 && shut > 0 ? 'shut' : ''}`}
                style={{ left: `${place.map.x}%`, top: `${place.map.y}%` }}
                onClick={() => setView({ kind: 'place', place: place.id })}>
                <span className="marker-pin"><Icon />{canVisit && <em className="marker-dot" />}</span>
                <span className="marker-body">
                  <b>{place.short}</b>
                  <i>{roster.map((p) => p.name).join('・')}</i>
                </span>
                {best > 0 && (
                  <span className="marker-flags"><em className="flag rel">{relationStage(best)}</em></span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  /* ---- 場所：人に会いに行く。仕事は一覧から受けるので、ここには置かない ---- */
  /* ---- 採集地：金の代わりに体力を払って素材を採る ---- */
  if (view.kind === 'place' && placeOf(view.place).kind === 'gather') {
    const place = placeOf(view.place);
    const got = gatherYield(place);
    const cost = place.gatherStamina ?? 20;
    const tired = game.stamina < cost;
    return (
      <div className="screen place">
        <div className="backdrop">
          <Art className="bg" sources={[placeSrc(place.id)]} alt="" hideIfMissing />
          <div className="bg-veil" />
        </div>
        <Hud game={game} onReset={reset} />
        <div className="topbar">
          <Button variant="ghost" size="sm" onClick={() => setView({ kind: 'map' })}>
            <ChevronLeft />地図
          </Button>
          <div className="topbar-title">
            <h2>{place.name}</h2>
            <span>{place.tagline}</span>
          </div>
        </div>

        <div className="gatherbox">
          <h3>ここで採れるもの</h3>
          <div className="matrow">
            {got.map((g) => (
              <span className="matchip" key={g.id}>
                <b>{materialOf(g.id).name}</b><i>×{g.amount}</i>
                <small>持 {game.materials[g.id]}</small>
              </span>
            ))}
          </div>
          <p className="gather-note">{got.map((g) => materialOf(g.id).note).join(' ')}</p>
          <div className="gather-foot">
            <span className={tired ? 'gather-cost bad' : 'gather-cost'}>
              <Mark name="体力" />{cost}　／　1日
            </span>
            <Button size="lg" disabled={tired} onClick={() => gather(place.id)}>
              {tired ? '今日はもう歩けない' : '摘んで帰る'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (view.kind === 'place') {
    const place = placeOf(view.place);
    const roster = peopleAt(place.id);
    const forSale = sellsAt(place);
    return (
      <div className="screen place">
        <div className="backdrop">
          <Art className="bg" sources={[placeSrc(place.id)]} alt="" hideIfMissing />
          <div className="bg-veil" />
        </div>
        <Hud game={game} onReset={reset} />
        <div className="topbar">
          <Button variant="ghost" size="sm" onClick={() => setView({ kind: 'map' })}>
            <ChevronLeft />地図
          </Button>
          <div className="topbar-title">
            <h2>{place.name}</h2>
            <span>{place.tagline}</span>
          </div>
        </div>

        <div className="joblist">
          {forSale.length > 0 && (
            <SupplyPanel place={place.id} game={game} onBuy={buy} />
          )}
          {roster.map((person) => {
            const rel = game.relations[person.id];
            const rate = fatigueRate(person.id, game);
            const mine = jobsBy(person.id);
            const open = mine.filter((job) => isOpen(job, game));
            const shut = mine.filter((job) => !isOpen(job, game));
            return (
              <section className="person" key={person.id}>
                <header className="person-head">
                  <span className="avatar">
                    <b>{person.name.slice(0, 1)}</b>
                    <Art className="avatar-img" sources={[personSrc(person.id)]} alt="" hideIfMissing />
                  </span>
                  <div className="person-id">
                    <b>{person.name}<span>{person.role}</span></b>
                    <p>{person.note}</p>
                  </div>
                  <div className="person-rel">
                    <em>{relationStage(rel)}</em>
                    <span className="relpips">
                      {[0, 1, 2].map((i) => <i key={i} className={i < rel ? 'on' : ''} />)}
                    </span>
                  </div>
                  <Button size="sm" variant="outline"
                    disabled={game.money < NETWORK_COST || game.stamina < NETWORK_STAMINA || rel >= 3}
                    onClick={() => network(person.id)}>
                    <Handshake />顔を出す
                  </Button>
                </header>

                <p className="person-line">
                  {open.length > 0
                    ? <>回せる仕事が <b>{open.length}件</b>。受けるのは「仕事を受ける」から。</>
                    : '回せる仕事は、いまは無い。'}
                  {rate < 1 && <em className="inline-warn">　続けて頼んだので −{Math.round((1 - rate) * 100)}%</em>}
                </p>

                {shut.map((job) => (
                  <div className="jobcard closed" key={job.id}>
                    <s>{job.title}</s>
                    <span>── {closedBy(job, game).join('と')}が足りず、もう紹介できません</span>
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      </div>
    );
  }

  /* ---- 自室：立ち絵が主役。今日どうするかを決める ---- */
  return (
    <div className="screen home">
      <div className="backdrop">
        <Art className="bg" sources={[backgroundSrc('mansion')]} alt="" hideIfMissing />
        <div className="bg-veil" />
        <Art className="figure" sources={[portraitSrc(stage), PLACEHOLDER]} alt="エレオノール・ラティエの立ち絵" />
      </div>
      <Hud game={game} onReset={reset} />

      <div className="figure-status">
        <p className="figure-name"><span>エレオノール・ラティエ</span></p>
        {axes.map((axis) => (
          <div className="mini-axis" key={axis}>
            <span className={`mini-name axis-${axis}`}><Mark name={axis} />{axis}</span>
            <Gauge value={game.axes[axis]} cap={axis === '品位' ? game.dignityCap : undefined} tone={axis} />
            <span className="mini-num">
              {game.axes[axis]}{axis === '品位' && game.dignityCap < 100 && <small>/{game.dignityCap}</small>}
            </span>
          </div>
        ))}
        <p className="figure-stage">
          <b>{game.day}日目</b>
          {axisStage(
            axes.reduce((a, b) => (game.axes[a] <= game.axes[b] ? a : b)),
            Math.min(...axes.map((a) => game.axes[a])),
          )}
        </p>
      </div>

      <section className="command">
        <h2 className="command-title">今日をどう使う<small>1日 ＝ 1行動</small></h2>
        {error && <p role="alert">{error}</p>}
        <button className="promise-ticker" onClick={() => setView({ kind: 'support' })}>
          {dueSoon(game) ? '次の約束：' + dateLabel(dueSoon(game)!.due) : '支援を相談する'} ／ 未精算{outstandingTotal(game)}G
        </button>
        {game.log[0] && <p className="ticker">{game.log[0]}</p>}
        <div className="commands">
          <button className="cmd primary" onClick={() => setView({ kind: 'jobs' })}>
            <BriefcaseBusiness />
            <span><b>仕事を受ける</b><i>受けられる依頼を見比べる</i></span>
          </button>
          <button className="cmd" onClick={() => setView({ kind: 'brew' })}>
            <FlaskConical />
            <span><b>調合する</b><i>日は進まない。体力と素材を使う</i></span>
          </button>
          <button className="cmd" onClick={() => setView({ kind: 'map' })}>
            <MapIcon />
            <span><b>出かける</b><i>素材を採る／買う／人に会う</i></span>
          </button>
          <button className="cmd" onClick={rest}>
            <Moon />
            <span><b>休む</b><i>スタミナ+{REST_RECOVERY}・品位が上限まで戻る</i></span>
          </button>
        </div>
      </section>

      {view.kind === 'contract' && (
        <ContractSheet job={view.job} game={game}
          onCancel={() => setView(view.from === 'jobs'
            ? { kind: 'jobs' }
            : { kind: 'place', place: personOf(view.job.person).place })}
          onAccept={() => acceptJob(view.job)} />
      )}
    </div>
  );
}

/** 受けるかどうかを決める最後の画面。何を差し出すかを断言して見せる。 */
/** 仕入れ棚。まとめ買いして1日で帰る ── 金があるほど日が浮く(§2-2)。 */
function SupplyPanel({ place, game, onBuy }: {
  place: PlaceId; game: GameState;
  onBuy: (place: PlaceId, basket: Partial<Record<MaterialId, number>>) => void;
}) {
  const [basket, setBasket] = useState<Partial<Record<MaterialId, number>>>({});
  const forSale = sellsAt(placeOf(place));
  const total = forSale.reduce((sum, m) => sum + (m.buy ?? 0) * (basket[m.id] ?? 0), 0);
  const over = total > game.money;
  const bump = (id: MaterialId, d: number) =>
    setBasket((b) => ({ ...b, [id]: Math.max(0, (b[id] ?? 0) + d) }));
  return (
    <section className="supply">
      <header className="supply-head">
        <h3>素材を仕入れる</h3>
        <span>持ち金 {game.money.toLocaleString()}G</span>
      </header>
      <div className="supply-rows">
        {forSale.map((m) => (
          <div className="supply-row" key={m.id}>
            <span className="sup-name"><b>{m.name}</b><i>手持ち {game.materials[m.id]}</i></span>
            <span className="sup-price">{m.buy}G</span>
            <span className="sup-step">
              <button onClick={() => bump(m.id, -1)} disabled={!basket[m.id]} aria-label={`${m.name}を減らす`}>−</button>
              <b>{basket[m.id] ?? 0}</b>
              <button onClick={() => bump(m.id, 1)} aria-label={`${m.name}を増やす`}>＋</button>
            </span>
          </div>
        ))}
      </div>
      <div className="supply-foot">
        <span className={over ? 'sup-total bad' : 'sup-total'}>計 {total.toLocaleString()}G</span>
        <Button size="sm" disabled={total === 0 || over} onClick={() => onBuy(place, basket)}>
          仕入れて帰る<small>（1日）</small>
        </Button>
      </div>
    </section>
  );
}

function ContractSheet({ job, game, onCancel, onAccept }: {
  job: Job; game: GameState; onCancel: () => void; onAccept: () => void;
}) {
  const person = personOf(job.person);
  const pay = payWithRelation(job, game);
  const fatigue = personFatigue(job.person, game);
  const cap = capDropOf(job);
  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label="依頼の確認">
      <button className="sheet-backdrop" onClick={onCancel} aria-label="閉じる" />
      <section className="sheet">
        <div className="sheet-head">
          <div>
            <h2>{job.title}</h2>
            <span>
              {person.name}・{relationStage(game.relations[job.person])}
              {fatigue > 0 && <em className="inline-warn">／相場 −{Math.round((1 - fatigueRate(job.person, game)) * 100)}%</em>}
            </span>
          </div>
          <div className="sheet-pay">
            <b>{pay.toLocaleString()}<small>G</small></b>
            <i><Mark name="体力" />{job.stamina}</i>
          </div>
        </div>
        <p className="sheet-desc">{job.description}</p>

        {job.recipe && (
          <p className="confirm-deliver">
            <b>{recipeOf(job.recipe).name}</b>を <b>{job.count ?? 1}</b> つ納める
            <em>（在庫 {game.stock[job.recipe] ?? 0}）</em>
          </p>
        )}

        <div className="confirm">
          <h3>{job.costs.length ? 'この仕事で差し出すもの' : '差し出すもの'}</h3>
          {job.costs.length === 0 && (
            <p className="confirm-none">
              {job.recipe ? '何も無い。調合したものを渡すだけで済む。' : '何も無い。体力だけで済む。'}
            </p>
          )}
          {job.costs.map((c) => {
            const before = game.axes[c.axis];
            const after = Math.max(0, before - c.amount);
            return (
              <div className="confirm-row" key={c.axis}>
                <span className={`confirm-axis axis-${c.axis}`}><Mark name={c.axis} />{c.axis}</span>
                <span className="lossbar">
                  <i className={`keep tone-${c.axis}`} style={{ width: `${after}%` }} />
                  <i className="lose" style={{ width: `${Math.min(before, c.amount)}%` }} />
                </span>
                <b>{before}<span>→</span>{after}</b>
              </div>
            );
          })}
          {cap > 0 && (
            <p className="confirm-cap">品位の<strong>上限</strong>も {cap} 下がる。休んでも、ここまでしか戻らない。</p>
          )}
        </div>

        <div className="sheet-foot">
          <div className="sheet-total"><span>受取額</span><strong>{pay.toLocaleString()}<small>G</small></strong></div>
          <Button variant="outline" onClick={onCancel}>戻る</Button>
          <Button size="lg" onClick={onAccept}>この依頼を受ける</Button>
        </div>
      </section>
    </div>
  );
}

function ResultScreen({ result, stage, onClose }: { result: DayResult; stage: string; onClose: () => void }) {
  return (
    <div className="screen result-screen">
      <div className="backdrop">
        <Art className="bg" sources={[backgroundSrc('mansion')]} alt="" hideIfMissing />
        <div className="bg-veil strong" />
        <Art className="figure dim" sources={[portraitSrc(stage as never), PLACEHOLDER]} alt="" />
      </div>
      <section className="result">
        <p className="result-eyebrow">行動の結果 ／ {result.days ?? 1}日</p>
        <h2>{result.title}</h2>
        <p className="result-narrative">{result.narrative}</p>
        <div className="result-details">
        <div className="result-cols">
          <div className="result-block">
            <h3>{result.kind === 'job' ? '報酬の内訳' : '収支'}</h3>
            {result.kind === 'job' ? (
              <>
                <div className="row"><span>提示額</span><b>{result.basePay}G</b></div>
                {result.paidTerms.map((t) => (
                  <div className="row" key={t.axis}><span>{t.title}</span><b>+{t.bonus}G</b></div>
                ))}
                <div className="row total"><span>受取額</span><b>{result.moneyDelta.toLocaleString()}G</b></div>
              </>
            ) : (
              <div className="row"><span>収支</span><b className={result.moneyDelta < 0 ? "minus" : "plus"}>{result.moneyDelta}G</b></div>
            )}
          </div>
          <div className="result-block">
            <h3>今日、動いたもの</h3>
            <div className="row">
              <span><Mark name="体力" />スタミナ</span>
              <b className={result.staminaDelta < 0 ? 'minus' : 'plus'}>
                {result.staminaDelta < 0 ? `−${Math.abs(result.staminaDelta)}` : `+${result.staminaDelta}`}
              </b>
            </div>
            {result.axisDrops.map((d) => (
              <div className="row" key={d.axis}><span className={`axis-${d.axis}`}><Mark name={d.axis} />{d.axis}</span><b className="minus">−{d.amount}</b></div>
            ))}
            {result.axisGains.map((g) => (
              <div className="row" key={g.axis}><span className={`axis-${g.axis}`}><Mark name={g.axis} />{g.axis}</span><b className="plus">+{g.amount}</b></div>
            ))}
            {result.axisDrops.length === 0 && result.axisGains.length === 0 && (
              <p className="result-none">今日は、何も差し出さずに済んだ。</p>
            )}
          </div>
        </div>
        {result.materialDeltas && result.materialDeltas.length > 0 && (
          <div className="result-block">
            <h3>持ち帰ったもの</h3>
            {result.materialDeltas.map((m) => (
              <div className="row" key={m.id}>
                <span>{materialOf(m.id).name}</span><b className="plus">+{m.amount}</b>
              </div>
            ))}
          </div>
        )}
        {result.learned && result.learned.length > 0 && (
          <div className="result-block learned">
            <h3>覚えた</h3>
            {result.learned.map((id) => (
              <p key={id}><strong>{recipeOf(id).name}</strong>　{RECIPE_SOURCE[id]}</p>
            ))}
          </div>
        )}
        {result.relationUp && (
          <div className="result-block rel-up">
            <h3>関係が変わった</h3>
            <p><strong>{result.relationUp.name}</strong>とは、これで「{result.relationUp.stage}」。</p>
          </div>
        )}
        {result.dignityCapDrop > 0 && (
          <div className="result-block cap-warning">
            <h3>戻らないもの</h3>
            <p>品位の<strong>上限</strong>が {result.dignityCapDrop} 下がった。休んでも、ここまでしか戻らない。</p>
          </div>
        )}
        <div className="result-notices">{result.notices?.map((n, i) => <p key={i}>{n}</p>)}</div>
        </div>
        <Button size="lg" onClick={onClose}>続ける</Button>
      </section>
    </div>
  );
}

/** 章末。納めた額と、足りなかった場合に何が起きるかを見せる。 */
function SettlementScreen({ settlement, onNext, outstanding, onAllocate }: { settlement: Settlement; onNext: () => void; outstanding: number; onAllocate: () => void }) {
  const s = settlement;
  const short = s.shortfall > 0;
  return (
    <div className="screen title">
      <div className="backdrop">
        <Art className="bg" sources={[backgroundSrc('ledger')]} alt="" hideIfMissing />
        <div className="bg-veil strong" />
      </div>
      <section className="title-body settle">
        <p className="title-eyebrow">第{s.chapter}章 章末</p>
        <h1>{short ? '足りない額が読み上げられた。' : '返済票に、印が押された。'}</h1>

        <div className="settle-details">
        <div className="settle-rows">
          <div className="row"><span>今章のノルマ</span><b>{s.quota.toLocaleString()}G</b></div>
          <div className="row"><span>納めた額</span><b className="plus">{s.paid.toLocaleString()}G</b></div>
          {short && <div className="row"><span>不足</span><b className="minus">{s.shortfall.toLocaleString()}G</b></div>}
          {short && <div className="row"><span>利息（25%）</span><b className="minus">＋{s.interest.toLocaleString()}G</b></div>}
          <div className="row total">
            <span>残債</span>
            <b>{s.debtBefore.toLocaleString()}<i>→</i>{s.debtAfter.toLocaleString()}G</b>
          </div>
        </div>

        {short && (
          <div className="settle-penalty">
            <h3>返せない見本として</h3>
            <p>街に名が回る。</p>
            <div className="settle-pen-row">
              {s.penalties.map((p) => (
                <span key={p.axis} className={`pen axis-${p.axis}`}>{p.axis} −{p.amount}</span>
              ))}
            </div>
            {!s.finished && (
              <p className="settle-next">次章のノルマは <b>{s.nextQuota.toLocaleString()}G</b> になる。</p>
            )}
          </div>
        )}
        {!short && !s.finished && (
          <p className="settle-next">次章のノルマは <b>{s.nextQuota.toLocaleString()}G</b>。</p>
        )}

        </div>
        <Button variant="outline" size="sm" onClick={onAllocate}>返済前に約束の支払いを選ぶ（未精算{outstanding}G）</Button>
        <Button size="lg" onClick={onNext}>
          {s.finished ? '結末を見る' : `第${s.chapter + 1}章へ`}
        </Button>
      </section>
    </div>
  );
}

function TitleScreen({ onStart }: { onStart: (state: GameState) => void }) {
  return (
    <div className="screen title">
      <div className="backdrop">
        <Art className="bg" sources={[backgroundSrc('title')]} alt="" hideIfMissing />
        <div className="bg-veil strong" />
      </div>
      <section className="title-body">
        <p className="title-eyebrow">Fallen House Management Prototype</p>
        <h1>没落令嬢の返済録</h1>
        <p className="title-lead">借金は返せる。問題は、完済するために何を差し出すか。</p>
        <div className="title-modes">
          <button className="mode" onClick={() => onStart(initialState)}>
            <strong>第1章をはじめから</strong><span>三軸とも健在。何も失っていない状態から。</span>
          </button>
          <button className="mode" onClick={() => onStart(midGameState)}>
            <strong>中盤から試す</strong><span>三軸が半分まで落ち、品位の上限も削れた6日目から。</span>
          </button>
        </div>
      </section>
    </div>
  );
}

function EndingScreen({ game, onRestart }: { game: GameState; onRestart: () => void }) {
  const complete = game.debt <= 0;
  const lowest = axes.reduce((a, b) => (game.axes[a] <= game.axes[b] ? a : b));
  return (
    <div className="screen title">
      <div className="backdrop">
        <Art className="bg" sources={[backgroundSrc('ending')]} alt="" hideIfMissing />
        <div className="bg-veil strong" />
      </div>
      <section className="title-body">
        <p className="title-eyebrow">全{CHAPTERS}章 ・ 結末</p>
        <h1>{complete ? '最後の返済票に、印が押された。' : '期限を過ぎても、額は残っていた。'}</h1>
        <p className="title-lead">
          {complete
            ? `${TOTAL_DEBT.toLocaleString()}Gを返しきった。家はまだ彼女の名のもとにある。`
            : `${game.debt.toLocaleString()}Gが残った。家は、彼女の手を離れる。`}
          {' '}最も傷ついたものは「{lowest}」だった。
        </p>
        <p className="ending-obligations">約束の未精算：{outstandingTotal(game)}G ／ 履行済み：{game.obligations.filter(o => o.status === 'fulfilled').length}件</p>
        <div className="ending-stats">
          {axes.map((axis) => (
            <div key={axis}>
              <span><Mark name={axis} />{axis}</span><strong>{game.axes[axis]}</strong>
              <small>{axisStage(axis, game.axes[axis])}</small>
            </div>
          ))}
          <div>
            <span>品位の上限</span><strong>{game.dignityCap}</strong>
            <small>{game.dignityCap < 100 ? '戻らない' : '無傷'}</small>
          </div>
        </div>
        <Button size="lg" onClick={onRestart}><RotateCcw />もう一度試す</Button>
      </section>
    </div>
  );
}
