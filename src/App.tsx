import { useEffect, useState, type ButtonHTMLAttributes } from 'react';
import {
  BookOpen, BriefcaseBusiness, Coins, HeartHandshake, Moon, RotateCcw,
  ScrollText, Users, Zap,
} from 'lucide-react';
import {
  CHAPTER_DAYS, MAX_STAMINA, NETWORK_COST, NETWORK_STAMINA, REST_RECOVERY,
  TRAIN_COST, TRAIN_STAMINA, axes, axisStage, clients, hasStaminaFor, initialState,
  midGameState, offersForDay, payWithRelation, relationLabel, requiredSkillFor,
  retiredJobs, shortageFor, skills,
  type Axis, type Client, type DayResult, type GameState, type Job, type Skill,
} from './game';

const SAVE_KEY = 'ikusei-prototype-save-v2';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'outline' | 'ghost';
  size?: 'default' | 'xs' | 'sm' | 'lg' | 'icon';
};

function Button({ variant = 'primary', size = 'default', className = '', ...props }: ButtonProps) {
  return <button className={`btn ${variant} ${size} ${className}`} {...props} />;
}

/** 目盛り付きゲージ。数値だけでなく、残量が一目で分かる形にする。 */
function Gauge({ value, max = 100, cap, tone }: { value: number; max?: number; cap?: number; tone: string }) {
  return (
    <div className="gauge">
      {cap !== undefined && cap < max && (
        <span className="gauge-lost" style={{ width: `${((max - cap) / max) * 100}%` }} />
      )}
      <i className={`gauge-fill tone-${tone}`} style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }} />
      <span className="gauge-ticks" />
    </div>
  );
}

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
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [result, setResult] = useState<DayResult | null>(null);

  useEffect(() => {
    if (game) localStorage.setItem(SAVE_KEY, JSON.stringify(game));
    else localStorage.removeItem(SAVE_KEY);
  }, [game]);

  function startGame(state: GameState) {
    setGame(state);
    setSelectedJob(null);
    setSelected([]);
    setResult(null);
  }

  if (!game) return <TitleScreen onStart={startGame} />;
  if (game.ended) return <EndingScreen game={game} onRestart={() => setGame(null)} />;

  const dignity = game.axes.品位;
  const offers = offersForDay(game.day, dignity);
  const retired = retiredJobs(dignity);
  const remaining = Math.max(0, game.debt - game.money);
  const repaidRatio = Math.min(100, (game.money / game.debt) * 100);

  const chosenTerms = selectedJob ? selected.map((index) => selectedJob.concessions[index]) : [];
  const relationBonus = selectedJob ? game.relations[selectedJob.client] * 25 : 0;
  const shortage = selectedJob ? shortageFor(selectedJob, game) : 0;
  const termBonus = chosenTerms.reduce((sum, item) => sum + item.bonus, 0);
  const totalPay = selectedJob ? selectedJob.pay + relationBonus + termBonus : 0;
  const enoughTerms = chosenTerms.length >= shortage;

  /** 1日を消費して次の日へ。結果画面に渡すデータもここで組み立てる。 */
  function advanceDay(patch: Partial<GameState>, dayResult: DayResult, publicWork = false) {
    setGame((current) => {
      if (!current) return current;
      const nextAxes = { ...current.axes, ...patch.axes };
      // 威厳は時間で戻る(§1-4)。人目のある仕事をした日は戻らない。
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
        log: [dayResult.narrative, ...current.log].slice(0, 8),
      };
    });
    setResult(dayResult);
    setSelectedJob(null);
    setSelected([]);
  }

  function acceptJob() {
    if (!game || !selectedJob || !enoughTerms || !hasStaminaFor(selectedJob, game)) return;
    const nextAxes = { ...game.axes };
    const axisDrops: { axis: Axis; amount: number }[] = [];
    let capDrop = 0;
    chosenTerms.forEach((item) => {
      nextAxes[item.axis] = Math.max(0, nextAxes[item.axis] - item.cost);
      axisDrops.push({ axis: item.axis, amount: item.cost });
      // 品位は上限そのものが下がり、休んでも戻らない(§1-4)。
      if (item.axis === '品位') capDrop += Math.ceil(item.cost / 2);
    });
    const nextCap = Math.max(0, game.dignityCap - capDrop);
    advanceDay(
      {
        money: game.money + totalPay,
        stamina: game.stamina - selectedJob.stamina,
        axes: nextAxes,
        dignityCap: nextCap,
        relations: { ...game.relations, [selectedJob.client]: Math.min(3, game.relations[selectedJob.client] + 1) },
      },
      {
        kind: 'job',
        title: selectedJob.title,
        narrative: `${selectedJob.title}。${chosenTerms.length ? '条件を受け入れ、' : '正攻法で勤め、'}${totalPay}Gを得た。`,
        basePay: selectedJob.pay,
        relationBonus,
        paidTerms: chosenTerms.map((item) => ({ axis: item.axis, title: item.title, bonus: item.bonus, cost: item.cost })),
        moneyDelta: totalPay,
        staminaDelta: -selectedJob.stamina,
        axisDrops,
        axisGains: [],
        dignityCapDrop: capDrop,
      },
      chosenTerms.some((item) => item.axis === '威厳'),
    );
  }

  function train(skill: Skill) {
    if (!game || game.money < TRAIN_COST || game.stamina < TRAIN_STAMINA) return;
    advanceDay(
      {
        money: game.money - TRAIN_COST,
        stamina: game.stamina - TRAIN_STAMINA,
        skills: { ...game.skills, [skill]: Math.min(5, game.skills[skill] + 1) },
      },
      {
        kind: 'train', title: `${skill}を学ぶ`,
        narrative: `${skill}を学んだ。今日の収入を将来の力へ変えた。`,
        basePay: 0, relationBonus: 0, paidTerms: [],
        moneyDelta: -TRAIN_COST, staminaDelta: -TRAIN_STAMINA,
        axisDrops: [], axisGains: [], dignityCapDrop: 0,
      },
    );
  }

  function rest() {
    if (!game) return;
    // 品位の現在値は戻る。ただし上限までしか戻らない(§1-4)。
    const before = game.axes.品位;
    const after = Math.min(game.dignityCap, before + 6);
    advanceDay(
      {
        stamina: Math.min(MAX_STAMINA, game.stamina + REST_RECOVERY),
        axes: { ...game.axes, 品位: after },
      },
      {
        kind: 'rest', title: '休養',
        narrative: '屋敷で静かに休み、身なりを整えた。',
        basePay: 0, relationBonus: 0, paidTerms: [],
        moneyDelta: 0,
        staminaDelta: Math.min(MAX_STAMINA, game.stamina + REST_RECOVERY) - game.stamina,
        axisDrops: [],
        axisGains: after > before ? [{ axis: '品位' as Axis, amount: after - before }] : [],
        dignityCapDrop: 0,
      },
    );
  }

  function network(client: Client) {
    if (!game || game.money < NETWORK_COST || game.stamina < NETWORK_STAMINA) return;
    advanceDay(
      {
        money: game.money - NETWORK_COST,
        stamina: game.stamina - NETWORK_STAMINA,
        relations: { ...game.relations, [client]: Math.min(3, game.relations[client] + 1) },
      },
      {
        kind: 'network', title: `${client}を訪ねる`,
        narrative: `${client}を訪ね、次の仕事につながる話をした。`,
        basePay: 0, relationBonus: 0, paidTerms: [],
        moneyDelta: -NETWORK_COST, staminaDelta: -NETWORK_STAMINA,
        axisDrops: [], axisGains: [], dignityCapDrop: 0,
      },
    );
  }

  return (
    <div className="app">
      {/* ---- HUD：常時見えるべき数値だけを、重要度の順に置く ---- */}
      <header className="hud">
        <div className="hud-identity">
          <ScrollText />
          <div>
            <h1>没落令嬢の返済録</h1>
            <p>第1章 ── 十四日の猶予</p>
          </div>
        </div>

        <div className="hud-debt">
          <div className="hud-debt-head">
            <span>章末までに納める残債</span>
            <span className="hud-debt-goal">目標 {game.debt.toLocaleString()}G</span>
          </div>
          <strong className="hud-debt-value">
            {remaining.toLocaleString()}<small>G</small>
          </strong>
          <div className="hud-debt-track">
            <i style={{ width: `${repaidRatio}%` }} />
          </div>
          <div className="hud-debt-foot">
            <span>用意できた額 <b>{game.money.toLocaleString()}G</b></span>
            <span>{Math.floor(repaidRatio)}%</span>
          </div>
        </div>

        <div className="hud-stats">
          <div className="hud-stat">
            <span className="hud-stat-label">残り日数</span>
            <strong>{CHAPTER_DAYS - game.day + 1}<small>日</small></strong>
            <span className="hud-stat-sub">{game.day} / {CHAPTER_DAYS}日目</span>
          </div>
          <div className="hud-stat">
            <span className="hud-stat-label"><Zap />スタミナ</span>
            <strong className={game.stamina < 30 ? 'low' : ''}>{game.stamina}</strong>
            <Gauge value={game.stamina} tone="stamina" />
          </div>
          <div className="hud-stat">
            <span className="hud-stat-label"><Coins />所持金</span>
            <strong>{game.money.toLocaleString()}<small>G</small></strong>
          </div>
        </div>

        <Button variant="ghost" size="icon" aria-label="最初からやり直す" onClick={() => setGame(null)}>
          <RotateCcw />
        </Button>
      </header>

      <div className="stage">
        {/* ---- 左：状態。減っていくものをまとめて置く ---- */}
        <aside className="col col-status">
          <div className="portrait">
            <img src={`${import.meta.env.BASE_URL}lady-at-ledger.png`} alt="借金の帳簿に向き合う没落貴族令嬢" />
            <div className="portrait-name">
              <strong>エレオノール・ラティエ</strong>
              <small>二十六歳／ラティエ家当主</small>
            </div>
          </div>

          <section className="block">
            <h2 className="block-title">失われていくもの</h2>
            {axes.map((axis) => {
              const value = game.axes[axis];
              const isDignity = axis === '品位';
              return (
                <div className="axis" key={axis}>
                  <div className="axis-top">
                    <span className={`axis-name axis-${axis}`}>{axis}</span>
                    <span className="axis-num">
                      {value}
                      {isDignity && game.dignityCap < 100 && <small> / 上限{game.dignityCap}</small>}
                    </span>
                  </div>
                  <Gauge value={value} cap={isDignity ? game.dignityCap : undefined} tone={axis} />
                  <p className="axis-stage">{axisStage(axis, value)}</p>
                </div>
              );
            })}
            {game.dignityCap < 100 && (
              <p className="cap-note">品位の上限は {100 - game.dignityCap} 下がったまま戻らない。</p>
            )}
          </section>

          <section className="block">
            <h2 className="block-title">技能</h2>
            <div className="skill-row">
              {skills.map((skill) => (
                <div className="skill" key={skill}>
                  <span>{skill}</span>
                  <div className="pips">
                    {[0, 1, 2, 3, 4].map((index) => (
                      <i key={index} className={index < game.skills[skill] ? 'on' : ''} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="block">
            <h2 className="block-title"><HeartHandshake />人脈</h2>
            {clients.map((client) => (
              <div className="relation" key={client}>
                <span>{client}</span>
                <strong>{relationLabel(game.relations[client])}</strong>
              </div>
            ))}
          </section>
        </aside>

        {/* ---- 中央：本日の選択肢 ---- */}
        <main className="col col-offers">
          <div className="col-head">
            <h2>本日の依頼</h2>
            <span className="col-head-sub">{game.day}日目 ／ 三通の依頼状</span>
          </div>

          {game.log[0] && <p className="ticker">{game.log[0]}</p>}

          <div className="offers">
            {offers.map((job) => {
              const required = requiredSkillFor(job, game);
              const short = shortageFor(job, game);
              const tired = !hasStaminaFor(job, game);
              const active = selectedJob?.id === job.id;
              return (
                <button
                  key={job.id}
                  className={`offer ${active ? 'active' : ''} ${tired ? 'disabled' : ''}`}
                  disabled={tired}
                  onClick={() => { setSelectedJob(job); setSelected([]); }}
                >
                  <div className="offer-head">
                    <div>
                      <h3>{job.title}</h3>
                      <span className="offer-client">{job.client}・{relationLabel(game.relations[job.client])}</span>
                    </div>
                    <div className="offer-pay">
                      <strong>{payWithRelation(job, game)}<small>G</small></strong>
                      <span className={tired ? 'cost low' : 'cost'}><Zap />{job.stamina}</span>
                    </div>
                  </div>
                  <p className="offer-desc">{job.description}</p>
                  <div className="offer-req">
                    <span>{job.skill} {game.skills[job.skill]} / 必要 {required}</span>
                    {short === 0
                      ? <em className="ok">上乗せ無しで受けられる</em>
                      : <em className="need">上乗せが {short} つ必要</em>}
                  </div>
                  {/* §5「上乗せの一覧」は選ぶ前に見えていなければ選択にならない */}
                  <div className="offer-terms">
                    {job.concessions.map((item) => (
                      <span key={item.axis} className={`term-chip chip-${item.axis}`}>
                        {item.axis} −{item.cost}<b>+{item.bonus}G</b>
                      </span>
                    ))}
                  </div>
                  {tired && <p className="offer-blocked">スタミナが足りない</p>}
                </button>
              );
            })}
          </div>

          <div className="col-head sub">
            <h2>今日は受けない</h2>
            <span className="col-head-sub">1日を使って、明日以降に備える</span>
          </div>

          <div className="alts">
            <div className="alt">
              <div className="alt-head"><Moon /><div><strong>休養</strong><small>スタミナ+{REST_RECOVERY}・品位が上限まで戻る</small></div></div>
              <Button size="sm" variant="outline" onClick={rest}>休む</Button>
            </div>
            <div className="alt">
              <div className="alt-head"><BookOpen /><div><strong>学ぶ</strong><small>{TRAIN_COST}G・スタミナ−{TRAIN_STAMINA}</small></div></div>
              <div className="alt-buttons">
                {skills.map((skill) => (
                  <Button key={skill} size="xs" variant="outline"
                    disabled={game.money < TRAIN_COST || game.stamina < TRAIN_STAMINA || game.skills[skill] >= 5}
                    onClick={() => train(skill)}>{skill}</Button>
                ))}
              </div>
            </div>
            <div className="alt">
              <div className="alt-head"><Users /><div><strong>営業</strong><small>{NETWORK_COST}G・スタミナ−{NETWORK_STAMINA}</small></div></div>
              <div className="alt-buttons">
                {clients.map((client) => (
                  <Button key={client} size="xs" variant="outline"
                    disabled={game.money < NETWORK_COST || game.stamina < NETWORK_STAMINA || game.relations[client] >= 3}
                    onClick={() => network(client)}>{client.replace('ヴァレール', '').replace('家', '')}</Button>
                ))}
              </div>
            </div>
          </div>

          {retired.length > 0 && (
            <>
              <div className="col-head sub">
                <h2>もう紹介されない依頼</h2>
                <span className="col-head-sub">品位が下がり、母集団から外れた</span>
              </div>
              <div className="retired">
                {retired.map((job) => (
                  <div className="retired-row" key={job.id}>
                    <s>{job.title}</s>
                    <span>── もう貴女には紹介できません</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </main>

        {/* ---- 右：選択中の依頼を確定する場所 ---- */}
        <aside className={`col col-contract ${selectedJob ? '' : 'is-empty'}`}>
          {selectedJob ? (
            <>
              <div className="col-head">
                <h2>契約内容</h2>
                <span className="col-head-sub">{selectedJob.client}</span>
              </div>
              <h3 className="contract-title">{selectedJob.title}</h3>

              <div className="ledger">
                <div className="ledger-row"><span>基本報酬</span><b>{selectedJob.pay}G</b></div>
                {relationBonus > 0 && <div className="ledger-row"><span>人脈による上乗せ</span><b>+{relationBonus}G</b></div>}
                <div className="ledger-row"><span>必要スタミナ</span><b className="minus">−{selectedJob.stamina}</b></div>
              </div>

              <p className="contract-note">
                {shortage > 0
                  ? `技能が ${shortage} 足りない。その分だけ、別のものを差し出す必要がある。`
                  : '技能は足りている。上乗せは、選ばなくてよい。'}
              </p>

              <div className="terms">
                {selectedJob.concessions.map((item, index) => {
                  const active = selected.includes(index);
                  return (
                    <button
                      key={item.axis}
                      className={`term ${active ? 'active' : ''}`}
                      aria-pressed={active}
                      onClick={() => setSelected((current) => (
                        active ? current.filter((value) => value !== index) : [...current, index]
                      ))}
                    >
                      <span className={`term-dot dot-${item.axis}`} />
                      <div className="term-body">
                        <strong>{item.title}</strong>
                        <p>{item.detail}</p>
                        <small>
                          <span className={`term-cost cost-${item.axis}`}>{item.axis} −{item.cost}</span>
                          {item.axis === '品位' && <span className="term-cost cost-品位">上限 −{Math.ceil(item.cost / 2)}</span>}
                          <span className="term-gain">+{item.bonus}G</span>
                        </small>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="contract-foot">
                <div className="total">
                  <span>受取額</span>
                  <strong>{totalPay.toLocaleString()}<small>G</small></strong>
                </div>
                {!enoughTerms && (
                  <p className="warn">上乗せをあと {shortage - chosenTerms.length} つ選ばないと受けられない。</p>
                )}
                <Button size="lg" className="accept" disabled={!enoughTerms} onClick={acceptJob}>
                  <BriefcaseBusiness />この依頼を受ける
                </Button>
              </div>
            </>
          ) : (
            <div className="empty">
              <ScrollText />
              <h2>依頼を選んでください</h2>
              <p>報酬と、そのために何を差し出すかを、ここで確かめられます。</p>
            </div>
          )}
        </aside>
      </div>

      {result && <ResultOverlay result={result} onClose={() => setResult(null)} />}
    </div>
  );
}

/** 結果画面(§10)。報酬の内訳と、今回下がった軸を同じ画面に置く。 */
function ResultOverlay({ result, onClose }: { result: DayResult; onClose: () => void }) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="本日の結果">
      <div className="result">
        <p className="result-eyebrow">本日の結果</p>
        <h2>{result.title}</h2>
        <p className="result-narrative">{result.narrative}</p>

        {result.kind === 'job' && (
          <div className="result-block">
            <h3>報酬の内訳</h3>
            <div className="ledger-row"><span>基本報酬</span><b>{result.basePay}G</b></div>
            {result.relationBonus > 0 && <div className="ledger-row"><span>人脈</span><b>+{result.relationBonus}G</b></div>}
            {result.paidTerms.map((term) => (
              <div className="ledger-row" key={term.axis}><span>{term.title}</span><b>+{term.bonus}G</b></div>
            ))}
            <div className="ledger-row total-row"><span>受取額</span><b>{result.moneyDelta.toLocaleString()}G</b></div>
          </div>
        )}

        {result.kind !== 'job' && result.moneyDelta !== 0 && (
          <div className="result-block">
            <div className="ledger-row"><span>支出</span><b className="minus">{result.moneyDelta}G</b></div>
          </div>
        )}

        <div className="result-block">
          <h3>今日、動いたもの</h3>
          <div className="ledger-row">
            <span>スタミナ</span>
            <b className={result.staminaDelta < 0 ? 'minus' : 'plus'}>
              {result.staminaDelta < 0 ? `−${Math.abs(result.staminaDelta)}` : `+${result.staminaDelta}`}
            </b>
          </div>
          {result.axisDrops.map((drop) => (
            <div className="ledger-row" key={drop.axis}>
              <span className={`axis-${drop.axis}`}>{drop.axis}</span>
              <b className="minus">−{drop.amount}</b>
            </div>
          ))}
          {result.axisGains.map((gain) => (
            <div className="ledger-row" key={gain.axis}>
              <span className={`axis-${gain.axis}`}>{gain.axis}</span>
              <b className="plus">+{gain.amount}</b>
            </div>
          ))}
          {result.axisDrops.length === 0 && result.axisGains.length === 0 && (
            <p className="result-none">今日は、何も差し出さずに済んだ。</p>
          )}
        </div>

        {/* 品位の上限低下は、現在値の低下と必ず区別して出す(§10) */}
        {result.dignityCapDrop > 0 && (
          <div className="result-block cap-warning">
            <h3>戻らないもの</h3>
            <p>品位の<strong>上限</strong>が {result.dignityCapDrop} 下がった。休んでも、ここまでしか戻らない。</p>
          </div>
        )}

        <Button size="lg" onClick={onClose}>次の日へ</Button>
      </div>
    </div>
  );
}

function TitleScreen({ onStart }: { onStart: (state: GameState) => void }) {
  return (
    <div className="title-screen">
      <div className="title-card">
        <p className="title-eyebrow">Fallen House Management Prototype</p>
        <h1>没落令嬢の返済録</h1>
        <p className="title-lead">借金は返せる。問題は、完済するために何を差し出すか。</p>
        <div className="title-modes">
          <button className="mode" onClick={() => onStart(initialState)}>
            <strong>第1章をはじめから</strong>
            <span>三軸とも健在。何も失っていない状態から始める。</span>
          </button>
          <button className="mode" onClick={() => onStart(midGameState)}>
            <strong>中盤から試す</strong>
            <span>三軸が半分まで落ち、品位の上限も削れた6日目から始める。</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function EndingScreen({ game, onRestart }: { game: GameState; onRestart: () => void }) {
  const paid = Math.min(game.money, game.debt);
  const complete = paid >= game.debt;
  const lowest = axes.reduce((a, b) => (game.axes[a] <= game.axes[b] ? a : b));
  return (
    <div className="title-screen">
      <div className="title-card">
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
              <span>{axis}</span>
              <strong>{game.axes[axis]}</strong>
              <small>{axisStage(axis, game.axes[axis])}</small>
            </div>
          ))}
          <div>
            <span>品位の上限</span>
            <strong>{game.dignityCap}</strong>
            <small>{game.dignityCap < 100 ? '戻らない' : '無傷'}</small>
          </div>
        </div>
        <Button size="lg" onClick={onRestart}><RotateCcw />もう一度試す</Button>
      </div>
    </div>
  );
}
