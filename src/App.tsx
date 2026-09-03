import { useEffect, useState, type ButtonHTMLAttributes } from 'react';
import {
  BookOpen, BriefcaseBusiness, ChevronDown, ChevronLeft, Handshake, Landmark,
  Map as MapIcon, Moon, RotateCcw, Scale, Store, Zap,
} from 'lucide-react';
import {
  CHAPTERS, CHAPTER_DAYS, MAX_STAMINA, NETWORK_COST, NETWORK_STAMINA, REST_RECOVERY,
  TOTAL_DEBT, applySettlement, axes, axisStage, capDropOf, closedBy, closedJobsAt,
  fatigueRate, hasStaminaFor, initialState, isOpen, jobsBy, listPrice, midGameState,
  openCountAt, openJobs, payWithRelation, peopleAt, personFatigue, personOf, placeOf,
  countsByKind, jobKinds, kindNote, primaryAxis, quotaOf, relationStage, sceneScript,
  settlementOf, stageUpLine, workPlaces,
  type Axis, type DayResult, type GameState, type Job, type PersonId, type PlaceId,
  type SceneLine, type Settlement,
} from './game';
import {
  PLACEHOLDER, backgroundSrc, mapSrc, personSrc, placeSrc, portraitSrc, portraitStage,
  sceneFallbackSrc, sceneSrc,
} from './art';

const SAVE_KEY = 'ikusei-prototype-save-v6';

const PLACE_ICON: Record<PlaceId, typeof Store> = {
  estate: Landmark, arnaud: Store, academy: BookOpen, valere: Landmark, guild: Scale,
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
        <span className={`chip ${game.stamina < 30 ? 'low' : ''}`}><Zap /><b>{game.stamina}</b></span>
      </div>
      <Button variant="ghost" size="icon" aria-label="最初からやり直す" onClick={onReset}><RotateCcw /></Button>
    </header>
  );
}

/* 画面の状態機械。1画面につき仕事は1つ。 */
type View =
  | { kind: 'home' }
  | { kind: 'jobs' }
  | { kind: 'map' }
  | { kind: 'place'; place: PlaceId }
  | { kind: 'contract'; job: Job; from: 'jobs' | 'place' }
  | { kind: 'scene'; job: Job; script: SceneLine[]; line: number; result: DayResult }
  | { kind: 'result'; result: DayResult; back: View }
  | { kind: 'settlement' }
  | { kind: 'ending' };

function loadGame(): GameState | null {
  if (typeof window === 'undefined') return null;
  const saved = localStorage.getItem(SAVE_KEY);
  if (!saved) return null;
  try { return JSON.parse(saved) as GameState; } catch { return null; }
}

export default function App() {
  const [game, setGame] = useState<GameState | null>(loadGame);
  const [view, setView] = useState<View>({ kind: 'home' });

  useEffect(() => {
    if (game) localStorage.setItem(SAVE_KEY, JSON.stringify(game));
    else localStorage.removeItem(SAVE_KEY);
  }, [game]);

  if (!game) {
    return <TitleScreen onStart={(s) => { setGame(s); setView({ kind: 'home' }); }} />;
  }
  if (view.kind === 'ending') {
    return <EndingScreen game={game} onRestart={() => { setGame(null); setView({ kind: 'home' }); }} />;
  }

  const stage = portraitStage(game.axes);
  const reset = () => setGame(null);

  /** 1日を消費する。演出は呼び出し側が View で見せる。 */
  function commit(patch: Partial<GameState>, narrative: string, worked: PersonId | 'none', publicWork = false) {
    setGame((current) => {
      if (!current) return current;
      const nextAxes = { ...current.axes, ...patch.axes };
      if (!publicWork) nextAxes.威厳 = Math.min(100, nextAxes.威厳 + 2);
      const nextCap = patch.dignityCap ?? current.dignityCap;
      nextAxes.品位 = Math.min(nextAxes.品位, nextCap);
      const lastDay = current.day >= CHAPTER_DAYS;
      return {
        ...current, ...patch,
        axes: nextAxes,
        recent: [worked, ...current.recent].slice(0, 6),
        day: lastDay ? CHAPTER_DAYS : current.day + 1,
        awaitingSettlement: lastDay,
        log: [narrative, ...current.log].slice(0, 8),
      };
    });
  }

  function acceptJob(job: Job) {
    if (!game) return;
    const total = payWithRelation(job, game);
    const nextAxes = { ...game.axes };
    const drops: { axis: Axis; amount: number }[] = [];
    job.costs.forEach((c) => {
      nextAxes[c.axis] = Math.max(0, nextAxes[c.axis] - c.amount);
      drops.push({ axis: c.axis, amount: c.amount });
    });
    const capDrop = capDropOf(job);
    const relBefore = game.relations[job.person];
    const relAfter = Math.min(3, relBefore + (job.bond ?? 1));
    const result: DayResult = {
      kind: 'job', title: job.title,
      narrative: job.costs.length
        ? `${job.title}。差し出すものを差し出して、${total}Gを得た。`
        : `${job.title}。何も失わずに、${total}Gを得た。`,
      basePay: total, relationBonus: 0, paidTerms: [],
      moneyDelta: total, staminaDelta: -job.stamina,
      axisDrops: drops, axisGains: [], dignityCapDrop: capDrop,
      relationUp: relAfter > relBefore
        ? { name: personOf(job.person).name, stage: relationStage(relAfter) }
        : undefined,
    };
    commit({
      money: game.money + total,
      stamina: game.stamina - job.stamina,
      axes: nextAxes,
      dignityCap: Math.max(0, game.dignityCap - capDrop),
      relations: { ...game.relations, [job.person]: relAfter },
    }, result.narrative, job.person, job.costs.some((c) => c.axis === '威厳'));
    setView({
      kind: 'scene', job, line: 0, result,
      script: [...sceneScript(job), ...stageUpLine(job.person, relBefore, relAfter)],
    });
  }

  function rest() {
    if (!game) return;
    const before = game.axes.品位;
    const after = Math.min(game.dignityCap, before + 6);
    const next = Math.min(MAX_STAMINA, game.stamina + REST_RECOVERY);
    const result: DayResult = {
      kind: 'rest', title: '休養', narrative: '屋敷で静かに休み、身なりを整えた。',
      basePay: 0, relationBonus: 0, paidTerms: [], moneyDelta: 0,
      staminaDelta: next - game.stamina, axisDrops: [],
      axisGains: after > before ? [{ axis: '品位' as Axis, amount: after - before }] : [],
      dignityCapDrop: 0,
    };
    commit({ stamina: next, axes: { ...game.axes, 品位: after } }, result.narrative, 'none');
    setView({ kind: 'result', result, back: { kind: 'home' } });
  }

  function network(id: PersonId) {
    if (!game || game.money < NETWORK_COST || game.stamina < NETWORK_STAMINA) return;
    const person = personOf(id);
    const before = game.relations[id];
    const after = Math.min(3, before + 1);
    const result: DayResult = {
      kind: 'network', title: `${person.name}に会う`,
      narrative: `${person.name}のもとに顔を出し、仕事の話をした。`,
      basePay: 0, relationBonus: 0, paidTerms: [], moneyDelta: -NETWORK_COST,
      staminaDelta: -NETWORK_STAMINA, axisDrops: [], axisGains: [], dignityCapDrop: 0,
      relationUp: after > before ? { name: person.name, stage: relationStage(after) } : undefined,
    };
    commit({
      money: game.money - NETWORK_COST, stamina: game.stamina - NETWORK_STAMINA,
      relations: { ...game.relations, [id]: after },
    }, result.narrative, 'none');
    setView({ kind: 'result', result, back: { kind: 'place', place: person.place } });
  }

  /** 結果を閉じたあとの行き先。14日目なら章末精算へ。 */
  function closeResult(back: View) {
    setView(game && game.awaitingSettlement ? { kind: 'settlement' } : back);
  }

  /* ---- イベントシーン ---- */
  if (view.kind === 'scene') {
    const axis = primaryAxis(view.job);
    const last = view.line >= view.script.length - 1;
    const line = view.script[view.line];
    return (
      <button className="screen scene" aria-label="タップして次へ"
        onClick={() => (last
          ? setView({ kind: 'result', result: view.result, back: { kind: 'home' } })
          : setView({ ...view, line: view.line + 1 }))}>
        <Art className="scene-art" alt={`${view.job.title}の情景`}
          sources={[sceneSrc(view.job, axis), sceneFallbackSrc(view.job), PLACEHOLDER]} />
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
      <SettlementScreen settlement={sheet} onNext={() => {
        setGame(applySettlement(game, sheet));
        setView(sheet.finished ? { kind: 'ending' } : { kind: 'home' });
      }} />
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
          {list.map((job) => {
            const person = personOf(job.person);
            const tired = !hasStaminaFor(job, game);
            const blocked = tired;
            const list0 = listPrice(job, game);
            const now = payWithRelation(job, game);
            return (
              <button key={job.id} className={`jobcard2 ${blocked ? 'disabled' : ''}`} disabled={blocked}
                onClick={() => setView({ kind: 'contract', job, from: 'jobs' })}>
                <div className="jc-head">
                  <span className="avatar sm">
                    <b>{person.name.slice(0, 1)}</b>
                    <Art className="avatar-img" sources={[personSrc(person.id)]} alt="" hideIfMissing />
                  </span>
                  <span className="jc-name">
                    <b>{job.title}</b>
                    <i><em className={`kindtag k-${job.kind}`}>{job.kind}</em>{person.name}・{placeOf(person.place).short}</i>
                  </span>
                  <span className="jc-pay">
                    <b>{now.toLocaleString()}<small>G</small></b>
                    {now < list0 && <s>{list0.toLocaleString()}</s>}
                  </span>
                </div>

                <div className="jc-req">
                  <i className={tired ? 'tag bad' : 'tag'}><Zap />{job.stamina}</i>
                  {axes.filter((a) => job.needs[a] !== undefined).map((a) => (
                    <i key={a} className="tag flat">{a} {job.needs[a]}以上</i>
                  ))}
                  {tired && <i className="tag need">スタミナ不足</i>}
                </div>

                {/* この依頼を受けると何が減るか。選ばせないので、断言して出す */}
                <div className={`jc-costs n${job.costs.length}`}>
                  {job.costs.length === 0 ? (
                    <span className="cost cost-none">
                      <em>差し出すものは無い</em>
                      <u>{job.bond && job.bond > 1 ? `関係が ${job.bond} 進む席` : '体力だけで済む仕事'}</u>
                    </span>
                  ) : job.costs.map((c) => {
                    const after = Math.max(0, game.axes[c.axis] - c.amount);
                    return (
                      <span key={c.axis} className={`cost cost-cell-${c.axis}`}>
                        <em>{c.axis}</em>
                        <b>−{c.amount}</b>
                        <u>{game.axes[c.axis]}→{after}</u>
                      </span>
                    );
                  })}
                  {capDropOf(job) > 0 && (
                    <span className="cost cost-cap"><em>品位の上限</em><b>−{capDropOf(job)}</b><u>戻らない</u></span>
                  )}
                </div>
              </button>
            );
          })}
          {list.length === 0 && <p className="empty-note">受けられる依頼が一つも無い。</p>}
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
  if (view.kind === 'place') {
    const place = placeOf(view.place);
    const roster = peopleAt(place.id);
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
            <span className={`mini-name axis-${axis}`}>{axis}</span>
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
        {game.log[0] && <p className="ticker">{game.log[0]}</p>}
        <div className="commands">
          <button className="cmd primary" onClick={() => setView({ kind: 'jobs' })}>
            <BriefcaseBusiness />
            <span><b>仕事を受ける</b><i>受けられる依頼を見比べる</i></span>
          </button>
          <button className="cmd" onClick={() => setView({ kind: 'map' })}>
            <MapIcon />
            <span><b>出かける</b><i>人に会い、関係を進める</i></span>
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
            <i><Zap />{job.stamina}</i>
          </div>
        </div>
        <p className="sheet-desc">{job.description}</p>

        <div className="confirm">
          <h3>{job.costs.length ? 'この仕事で差し出すもの' : '差し出すもの'}</h3>
          {job.costs.length === 0 && (
            <p className="confirm-none">何も無い。体力だけで済む。</p>
          )}
          {job.costs.map((c) => {
            const before = game.axes[c.axis];
            const after = Math.max(0, before - c.amount);
            return (
              <div className="confirm-row" key={c.axis}>
                <span className={`confirm-axis axis-${c.axis}`}>{c.axis}</span>
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
        <p className="result-eyebrow">本日の結果</p>
        <h2>{result.title}</h2>
        <p className="result-narrative">{result.narrative}</p>
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
              <div className="row"><span>支出</span><b className="minus">{result.moneyDelta}G</b></div>
            )}
          </div>
          <div className="result-block">
            <h3>今日、動いたもの</h3>
            <div className="row">
              <span>スタミナ</span>
              <b className={result.staminaDelta < 0 ? 'minus' : 'plus'}>
                {result.staminaDelta < 0 ? `−${Math.abs(result.staminaDelta)}` : `+${result.staminaDelta}`}
              </b>
            </div>
            {result.axisDrops.map((d) => (
              <div className="row" key={d.axis}><span className={`axis-${d.axis}`}>{d.axis}</span><b className="minus">−{d.amount}</b></div>
            ))}
            {result.axisGains.map((g) => (
              <div className="row" key={g.axis}><span className={`axis-${g.axis}`}>{g.axis}</span><b className="plus">+{g.amount}</b></div>
            ))}
            {result.axisDrops.length === 0 && result.axisGains.length === 0 && (
              <p className="result-none">今日は、何も差し出さずに済んだ。</p>
            )}
          </div>
        </div>
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
        <Button size="lg" onClick={onClose}>次の日へ</Button>
      </section>
    </div>
  );
}

/** 章末。納めた額と、足りなかった場合に何が起きるかを見せる。 */
function SettlementScreen({ settlement, onNext }: { settlement: Settlement; onNext: () => void }) {
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
        <div className="ending-stats">
          {axes.map((axis) => (
            <div key={axis}>
              <span>{axis}</span><strong>{game.axes[axis]}</strong>
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
