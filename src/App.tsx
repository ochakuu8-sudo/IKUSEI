import { useEffect, useState, type ButtonHTMLAttributes } from 'react';
import {
  BookOpen, ChevronDown, Coins, Moon, RotateCcw, Users, Zap,
} from 'lucide-react';
import {
  CHAPTER_DAYS, MAX_STAMINA, NETWORK_COST, NETWORK_STAMINA, REST_RECOVERY,
  TRAIN_COST, TRAIN_STAMINA, axes, axisStage, clients, hasStaminaFor, initialState,
  midGameState, offersForDay, payWithRelation, primaryAxis, relationLabel,
  requiredSkillFor, retiredJobs, sceneScript, shortageFor, skills,
  type Axis, type Client, type DayResult, type GameState, type Job, type SceneLine, type Skill,
} from './game';
import {
  PLACEHOLDER, backgroundSrc, portraitSrc, portraitStage, sceneFallbackSrc, sceneSrc,
} from './art';

const SAVE_KEY = 'ikusei-prototype-save-v2';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'outline' | 'ghost';
  size?: 'default' | 'xs' | 'sm' | 'lg' | 'icon';
};

function Button({ variant = 'primary', size = 'default', className = '', ...props }: ButtonProps) {
  return <button className={`btn ${variant} ${size} ${className}`} {...props} />;
}

/** 素材が無ければ次の候補へ落ちる。描けたぶんから1枚ずつ差し込める。
    hideIfMissing を付けたものは、全部無ければ何も描かない（背景など、
    仮画像で代用すると別の絵と二重に見えてしまうもの）。 */
function Art({ sources, alt, className, hideIfMissing = false }: {
  sources: string[]; alt: string; className?: string; hideIfMissing?: boolean;
}) {
  const key = sources.join('|');
  const [step, setStep] = useState(0);
  useEffect(() => setStep(0), [key]);
  if (hideIfMissing && step >= sources.length) return null;
  return (
    <img
      className={className}
      src={sources[Math.min(step, sources.length - 1)]}
      alt={alt}
      onError={() => setStep((n) => (n < sources.length ? n + 1 : n))}
    />
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

/* 画面の状態機械。1画面につき1つの仕事だけをさせる。 */
type View =
  | { kind: 'home' }
  | { kind: 'contract'; job: Job }
  | { kind: 'rest' }
  | { kind: 'scene'; job: Job; paid: Axis[]; script: SceneLine[]; line: number; result: DayResult }
  | { kind: 'result'; result: DayResult }
  | { kind: 'ending' };

function loadGame(): GameState | null {
  if (typeof window === 'undefined') return null;
  const saved = localStorage.getItem(SAVE_KEY);
  if (!saved) return null;
  try {
    return JSON.parse(saved) as GameState;
  } catch {
    return null;
  }
}

export default function App() {
  const [game, setGame] = useState<GameState | null>(loadGame);
  const [view, setView] = useState<View>({ kind: 'home' });
  const [picked, setPicked] = useState<number[]>([]);

  useEffect(() => {
    if (game) localStorage.setItem(SAVE_KEY, JSON.stringify(game));
    else localStorage.removeItem(SAVE_KEY);
  }, [game]);

  if (!game) {
    return <TitleScreen onStart={(state) => { setGame(state); setView({ kind: 'home' }); setPicked([]); }} />;
  }
  if (view.kind === 'ending') {
    return <EndingScreen game={game} onRestart={() => { setGame(null); setView({ kind: 'home' }); }} />;
  }

  const dignity = game.axes.品位;
  const offers = offersForDay(game.day, dignity);
  const retired = retiredJobs(dignity);
  const stage = portraitStage(game.axes);

  /** 状態を1日ぶん進める。演出はこのあと View 側で見せる。 */
  function commit(patch: Partial<GameState>, narrative: string, publicWork = false) {
    setGame((current) => {
      if (!current) return current;
      const nextAxes = { ...current.axes, ...patch.axes };
      if (!publicWork) nextAxes.威厳 = Math.min(100, nextAxes.威厳 + 2);
      const nextCap = patch.dignityCap ?? current.dignityCap;
      nextAxes.品位 = Math.min(nextAxes.品位, nextCap);
      const lastDay = current.day >= CHAPTER_DAYS;
      return {
        ...current,
        ...patch,
        axes: nextAxes,
        day: lastDay ? CHAPTER_DAYS : current.day + 1,
        ended: lastDay,
        log: [narrative, ...current.log].slice(0, 8),
      };
    });
  }

  function acceptJob(job: Job, chosen: number[]) {
    if (!game) return;
    const terms = chosen.map((index) => job.concessions[index]);
    const relationBonus = game.relations[job.client] * 25;
    const total = job.pay + relationBonus + terms.reduce((sum, t) => sum + t.bonus, 0);
    const nextAxes = { ...game.axes };
    const axisDrops: { axis: Axis; amount: number }[] = [];
    let capDrop = 0;
    terms.forEach((t) => {
      nextAxes[t.axis] = Math.max(0, nextAxes[t.axis] - t.cost);
      axisDrops.push({ axis: t.axis, amount: t.cost });
      if (t.axis === '品位') capDrop += Math.ceil(t.cost / 2);
    });
    const paid = terms.map((t) => t.axis);
    const result: DayResult = {
      kind: 'job', title: job.title,
      narrative: `${job.title}。${terms.length ? '条件を受け入れ、' : '正攻法で勤め、'}${total}Gを得た。`,
      basePay: job.pay, relationBonus,
      paidTerms: terms.map((t) => ({ axis: t.axis, title: t.title, bonus: t.bonus, cost: t.cost })),
      moneyDelta: total, staminaDelta: -job.stamina,
      axisDrops, axisGains: [], dignityCapDrop: capDrop,
    };
    commit({
      money: game.money + total,
      stamina: game.stamina - job.stamina,
      axes: nextAxes,
      dignityCap: Math.max(0, game.dignityCap - capDrop),
      relations: { ...game.relations, [job.client]: Math.min(3, game.relations[job.client] + 1) },
    }, result.narrative, paid.includes('威厳'));
    setPicked([]);
    setView({ kind: 'scene', job, paid, script: sceneScript(job, paid), line: 0, result });
  }

  function rest() {
    if (!game) return;
    const before = game.axes.品位;
    const after = Math.min(game.dignityCap, before + 6);
    const nextStamina = Math.min(MAX_STAMINA, game.stamina + REST_RECOVERY);
    const result: DayResult = {
      kind: 'rest', title: '休養', narrative: '屋敷で静かに休み、身なりを整えた。',
      basePay: 0, relationBonus: 0, paidTerms: [], moneyDelta: 0,
      staminaDelta: nextStamina - game.stamina, axisDrops: [],
      axisGains: after > before ? [{ axis: '品位' as Axis, amount: after - before }] : [],
      dignityCapDrop: 0,
    };
    commit({ stamina: nextStamina, axes: { ...game.axes, 品位: after } }, result.narrative);
    setView({ kind: 'result', result });
  }

  function train(skill: Skill) {
    if (!game || game.money < TRAIN_COST || game.stamina < TRAIN_STAMINA) return;
    const result: DayResult = {
      kind: 'train', title: `${skill}を学ぶ`, narrative: `${skill}を学んだ。今日の収入を将来の力へ変えた。`,
      basePay: 0, relationBonus: 0, paidTerms: [], moneyDelta: -TRAIN_COST,
      staminaDelta: -TRAIN_STAMINA, axisDrops: [], axisGains: [], dignityCapDrop: 0,
    };
    commit({
      money: game.money - TRAIN_COST, stamina: game.stamina - TRAIN_STAMINA,
      skills: { ...game.skills, [skill]: Math.min(5, game.skills[skill] + 1) },
    }, result.narrative);
    setView({ kind: 'result', result });
  }

  function network(client: Client) {
    if (!game || game.money < NETWORK_COST || game.stamina < NETWORK_STAMINA) return;
    const result: DayResult = {
      kind: 'network', title: `${client}を訪ねる`, narrative: `${client}を訪ね、次の仕事につながる話をした。`,
      basePay: 0, relationBonus: 0, paidTerms: [], moneyDelta: -NETWORK_COST,
      staminaDelta: -NETWORK_STAMINA, axisDrops: [], axisGains: [], dignityCapDrop: 0,
    };
    commit({
      money: game.money - NETWORK_COST, stamina: game.stamina - NETWORK_STAMINA,
      relations: { ...game.relations, [client]: Math.min(3, game.relations[client] + 1) },
    }, result.narrative);
    setView({ kind: 'result', result });
  }

  function closeResult() {
    setView(game && game.ended ? { kind: 'ending' } : { kind: 'home' });
  }

  /* ---- イベントシーン：絵とテキストだけの全画面。タップで送る ---- */
  if (view.kind === 'scene') {
    const axis = primaryAxis(view.paid);
    const last = view.line >= view.script.length - 1;
    const current = view.script[view.line];
    return (
      <button
        className="screen scene"
        onClick={() => (last
          ? setView({ kind: 'result', result: view.result })
          : setView({ ...view, line: view.line + 1 }))}
        aria-label="タップして次へ"
      >
        <Art
          className="scene-art"
          sources={[sceneSrc(view.job, axis), sceneFallbackSrc(view.job), PLACEHOLDER]}
          alt={`${view.job.title}の情景`}
        />
        <div className="scene-veil" />
        <div className="textbox">
          {current.speaker && <span className="textbox-name">{current.speaker}</span>}
          <p>{current.text}</p>
          <span className="textbox-next"><ChevronDown /></span>
        </div>
        <span className="scene-progress">{view.line + 1} / {view.script.length}</span>
      </button>
    );
  }

  /* ---- 結果 ---- */
  if (view.kind === 'result') {
    return <ResultScreen result={view.result} stage={stage} onClose={closeResult} />;
  }

  /* ---- 日常パート：立ち絵が主役、コマンドは右に寄せる ---- */
  return (
    <div className="screen home">
      <div className="backdrop">
        <Art className="bg" sources={[backgroundSrc('mansion')]} alt="" hideIfMissing />
        <div className="bg-veil" />
        <Art className="figure" sources={[portraitSrc(stage), PLACEHOLDER]} alt="エレオノール・ラティエの立ち絵" />
      </div>

      <header className="hud">
        <div className="hud-debt">
          <span>残債</span>
          <strong>{Math.max(0, game.debt - game.money).toLocaleString()}<small>G</small></strong>
        </div>
        <div className="hud-track"><i style={{ width: `${Math.min(100, (game.money / game.debt) * 100)}%` }} /></div>
        <div className="hud-chips">
          <span className="chip"><b>{CHAPTER_DAYS - game.day + 1}</b>日</span>
          <span className={`chip ${game.stamina < 30 ? 'low' : ''}`}><Zap /><b>{game.stamina}</b></span>
          <span className="chip"><Coins /><b>{game.money.toLocaleString()}</b></span>
        </div>
        <Button variant="ghost" size="icon" aria-label="最初からやり直す" onClick={() => setGame(null)}>
          <RotateCcw />
        </Button>
      </header>

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
        <h2 className="command-title">本日の依頼<small>三通の依頼状</small></h2>
        <div className="offers">
          {offers.map((job) => {
            const short = shortageFor(job, game);
            const tired = !hasStaminaFor(job, game);
            return (
              <button key={job.id} className={`offer ${tired ? 'disabled' : ''}`} disabled={tired}
                onClick={() => { setPicked([]); setView({ kind: 'contract', job }); }}>
                <div className="offer-line">
                  <h3>{job.title}</h3>
                  <strong>{payWithRelation(job, game)}<small>G</small></strong>
                </div>
                <div className="offer-line sub">
                  <span>{job.client}</span>
                  <span className="offer-tags">
                    <i className={tired ? 'tag bad' : 'tag'}><Zap />{job.stamina}</i>
                    {short > 0
                      ? <i className="tag need">要 上乗せ{short}</i>
                      : <i className="tag ok">そのまま可</i>}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
        <Button variant="outline" className="decline" onClick={() => setView({ kind: 'rest' })}>
          今日は受けない
        </Button>
        {retired.length > 0 && (
          <p className="retired-note">
            紹介されなくなった依頼 {retired.length}件：{retired.map((j) => j.title).join('、')}
          </p>
        )}
      </section>

      {view.kind === 'contract' && (
        <ContractSheet
          job={view.job} game={game} picked={picked} setPicked={setPicked}
          onCancel={() => { setPicked([]); setView({ kind: 'home' }); }}
          onAccept={() => acceptJob(view.job, picked)}
        />
      )}
      {view.kind === 'rest' && (
        <RestSheet
          game={game} onCancel={() => setView({ kind: 'home' })}
          onRest={rest} onTrain={train} onNetwork={network}
        />
      )}
    </div>
  );
}

/** 契約シート。3つの上乗せを必ず横に並べ、どれを払うか比べられるようにする。 */
function ContractSheet({ job, game, picked, setPicked, onCancel, onAccept }: {
  job: Job; game: GameState; picked: number[];
  setPicked: (fn: (current: number[]) => number[]) => void;
  onCancel: () => void; onAccept: () => void;
}) {
  const terms = picked.map((index) => job.concessions[index]);
  const relationBonus = game.relations[job.client] * 25;
  const shortage = shortageFor(job, game);
  const total = job.pay + relationBonus + terms.reduce((sum, t) => sum + t.bonus, 0);
  const ready = picked.length >= shortage;
  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label="契約内容">
      <button className="sheet-backdrop" onClick={onCancel} aria-label="閉じる" />
      <section className="sheet">
        <div className="sheet-head">
          <div>
            <h2>{job.title}</h2>
            <span>{job.client}・{relationLabel(game.relations[job.client])}／{job.skill} 必要{requiredSkillFor(job, game)}（現在{game.skills[job.skill]}）</span>
          </div>
          <div className="sheet-pay">
            <b>{job.pay + relationBonus}<small>G</small></b>
            <i><Zap />{job.stamina}</i>
          </div>
        </div>
        <p className="sheet-desc">{job.description}</p>

        <div className="terms">
          {job.concessions.map((item, index) => {
            const active = picked.includes(index);
            return (
              <button key={item.axis} className={`term ${active ? 'active' : ''}`} aria-pressed={active}
                onClick={() => setPicked((c) => (active ? c.filter((v) => v !== index) : [...c, index]))}>
                <span className={`term-dot dot-${item.axis}`} />
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
                <span className="term-price">
                  <i className={`cost-${item.axis}`}>{item.axis} −{item.cost}</i>
                  {item.axis === '品位' && <i className="cost-品位">上限 −{Math.ceil(item.cost / 2)}</i>}
                  <b>+{item.bonus}G</b>
                </span>
              </button>
            );
          })}
        </div>

        <div className="sheet-foot">
          <div className="sheet-total">
            <span>受取額</span><strong>{total.toLocaleString()}<small>G</small></strong>
          </div>
          {!ready && <p className="warn">上乗せをあと {shortage - picked.length} つ</p>}
          <Button variant="outline" onClick={onCancel}>戻る</Button>
          <Button size="lg" disabled={!ready} onClick={onAccept}>この依頼を受ける</Button>
        </div>
      </section>
    </div>
  );
}

function RestSheet({ game, onCancel, onRest, onTrain, onNetwork }: {
  game: GameState; onCancel: () => void;
  onRest: () => void; onTrain: (skill: Skill) => void; onNetwork: (client: Client) => void;
}) {
  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label="今日は受けない">
      <button className="sheet-backdrop" onClick={onCancel} aria-label="閉じる" />
      <section className="sheet">
        <div className="sheet-head">
          <div><h2>今日は受けない</h2><span>1日を使って、明日以降に備える</span></div>
        </div>
        <div className="alts">
          <div className="alt">
            <Moon /><strong>休養</strong>
            <small>スタミナ+{REST_RECOVERY}／品位が上限まで戻る</small>
            <Button onClick={onRest}>休む</Button>
          </div>
          <div className="alt">
            <BookOpen /><strong>学ぶ</strong>
            <small>{TRAIN_COST}G・スタミナ−{TRAIN_STAMINA}</small>
            <div className="alt-row">
              {skills.map((skill) => (
                <Button key={skill} size="xs" variant="outline"
                  disabled={game.money < TRAIN_COST || game.stamina < TRAIN_STAMINA || game.skills[skill] >= 5}
                  onClick={() => onTrain(skill)}>{skill}</Button>
              ))}
            </div>
          </div>
          <div className="alt">
            <Users /><strong>営業</strong>
            <small>{NETWORK_COST}G・スタミナ−{NETWORK_STAMINA}</small>
            <div className="alt-row">
              {clients.map((client) => (
                <Button key={client} size="xs" variant="outline"
                  disabled={game.money < NETWORK_COST || game.stamina < NETWORK_STAMINA || game.relations[client] >= 3}
                  onClick={() => onNetwork(client)}>{client.replace('ヴァレール', '').replace('家', '')}</Button>
              ))}
            </div>
          </div>
        </div>
        <div className="sheet-foot"><Button variant="outline" onClick={onCancel}>戻る</Button></div>
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
                <div className="row"><span>基本報酬</span><b>{result.basePay}G</b></div>
                {result.relationBonus > 0 && <div className="row"><span>人脈</span><b>+{result.relationBonus}G</b></div>}
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
  const paid = Math.min(game.money, game.debt);
  const complete = paid >= game.debt;
  const lowest = axes.reduce((a, b) => (game.axes[a] <= game.axes[b] ? a : b));
  return (
    <div className="screen title">
      <div className="backdrop">
        <Art className="bg" sources={[backgroundSrc('ending')]} alt="" hideIfMissing />
        <div className="bg-veil strong" />
      </div>
      <section className="title-body">
        <p className="title-eyebrow">第1章・試算結果</p>
        <h1>{complete ? '期限の日、返済票に印が押された。' : '期限の日、足りない金額が読み上げられた。'}</h1>
        <p className="title-lead">
          {complete
            ? `${game.debt.toLocaleString()}Gを返した。家はまだ彼女の名のもとにある。`
            : `${paid.toLocaleString()}Gを納め、${(game.debt - paid).toLocaleString()}Gが次章へ持ち越された。`}
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
