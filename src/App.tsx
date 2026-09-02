'use client';

import { useEffect, useMemo, useState, type ButtonHTMLAttributes } from 'react';
import { BookOpen, BriefcaseBusiness, Eye, HeartHandshake, RotateCcw, Shield, Sparkles, Users } from 'lucide-react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'xs' | 'sm' | 'lg' | 'icon';
};

function Button({ variant = 'default', size = 'default', className = '', ...props }: ButtonProps) {
  return <button className={`ui-button ${variant} ${size} ${className}`} {...props} />;
}

type Skill = '礼法' | '学識' | '商才';
type Axis = '貞操' | '品位' | '威厳';
type Client = 'アルノー商会' | '王立学院' | 'ヴァレール伯爵家' | '街の組合';
type Concession = { axis: Axis; title: string; detail: string; bonus: number; cost: number };
type Job = { id: string; title: string; client: Client; skill: Skill; required: number; pay: number; fatigue: number; description: string; concessions: Concession[] };
type GameState = { day: number; money: number; debt: number; fatigue: number; skills: Record<Skill, number>; axes: Record<Axis, number>; relations: Record<Client, number>; log: string[]; ended: boolean };

const skills: Skill[] = ['礼法', '学識', '商才'];
const axes: Axis[] = ['貞操', '品位', '威厳'];
const clients: Client[] = ['アルノー商会', '王立学院', 'ヴァレール伯爵家', '街の組合'];
const initialState: GameState = { day: 1, money: 120, debt: 1800, fatigue: 18, skills: { 礼法: 1, 学識: 1, 商才: 0 }, axes: { 貞操: 100, 品位: 100, 威厳: 100 }, relations: { アルノー商会: 0, 王立学院: 0, ヴァレール伯爵家: 0, 街の組合: 0 }, log: ['返済期限まで、あと14日。机には三通の依頼状が届いている。'], ended: false };

const terms: Record<Axis, [string, string]> = {
  貞操: ['個人的な要求も受ける', '仕事の後、依頼人の私室まで付き添う。'],
  品位: ['扱いへの異議を捨てる', '役目も呼び方も、相手の決めたものを受け入れる。'],
  威厳: ['人目のある条件を呑む', '没落した家名ごと、客寄せとして使わせる。'],
};

function makeJob(id: string, title: string, client: Client, skill: Skill, required: number, pay: number, fatigue: number, description: string): Job {
  return { id, title, client, skill, required, pay, fatigue, description, concessions: axes.map((axis, index) => ({ axis, title: terms[axis][0], detail: terms[axis][1], bonus: 105 + required * 25 + index * 20, cost: 9 + required + index })) };
}

const jobs: Job[] = [
  makeJob('ledger', '商会の帳簿整理', 'アルノー商会', '学識', 1, 130, 24, '数字は多いが、日が暮れるまでに終えれば約束の額になる。'),
  makeJob('banquet', '商家の晩餐で給仕', 'アルノー商会', '礼法', 2, 190, 30, '客は作法に厳しい。かつての身分を面白がる者もいる。'),
  makeJob('tutor', '商家の娘の家庭教師', '王立学院', '学識', 2, 210, 26, '静かな仕事だが、学院の推薦に応える知識が必要だ。'),
  makeJob('auction', '旧家財の競売補佐', '街の組合', '商才', 1, 160, 22, '品物の来歴を語り、少しでも高く売る。'),
  makeJob('secretary', '伯爵家の臨時秘書', 'ヴァレール伯爵家', '礼法', 3, 300, 34, '社交界の手紙と来客を一日で捌く高額依頼。'),
  makeJob('copyist', '学院文書の筆耕', '王立学院', '学識', 2, 175, 20, '報酬は控えめだが、継続雇用につながる。'),
  makeJob('market', '市場の仕入れ交渉', '街の組合', '商才', 2, 220, 28, '相場を読み、複数の店を回って条件をまとめる。'),
  makeJob('escort', '夜会への同伴', 'ヴァレール伯爵家', '礼法', 2, 240, 24, '昔の知人と顔を合わせる可能性がある。'),
  makeJob('packing', '商会倉庫の荷造り', '街の組合', '商才', 0, 95, 38, '誰でもできる安全な仕事。ただしひどく疲れる。'),
];

function offersForDay(day: number) {
  const first = jobs[(day * 2 - 2) % 8];
  const secondCandidate = jobs[(day * 3 + 1) % 8];
  const second = secondCandidate.id === first.id ? jobs[(day + 4) % 8] : secondCandidate;
  return [first, second, jobs[8]];
}

function axisLabel(value: number) {
  if (value >= 76) return '守られている';
  if (value >= 51) return '揺らいでいる';
  if (value >= 26) return '失われつつある';
  return '底に近い';
}

function relationLabel(value: number) { return ['疎遠', '既知', '信頼', '懇意'][value] ?? '懇意'; }

export default function Home() {
  const [game, setGame] = useState<GameState>(() => {
    if (typeof window === 'undefined') return initialState;
    const saved = localStorage.getItem('ikusei-prototype-save');
    if (!saved) return initialState;
    try { return JSON.parse(saved) as GameState; } catch { return initialState; }
  });
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [showForecast, setShowForecast] = useState(false);
  useEffect(() => { localStorage.setItem('ikusei-prototype-save', JSON.stringify(game)); }, [game]);

  const offers = useMemo(() => offersForDay(game.day), [game.day]);
  const chosenTerms = selectedJob ? selected.map((index) => selectedJob.concessions[index]) : [];
  const relationBonus = selectedJob ? game.relations[selectedJob.client] * 25 : 0;
  const effectiveRequired = selectedJob ? Math.max(0, selectedJob.required - Math.floor(game.relations[selectedJob.client] / 2)) : 0;
  const shortage = selectedJob ? Math.max(0, effectiveRequired - game.skills[selectedJob.skill]) : 0;
  const totalPay = selectedJob ? selectedJob.pay + relationBonus + chosenTerms.reduce((sum, item) => sum + item.bonus, 0) : 0;
  const enoughTerms = chosenTerms.length >= shortage;
  const enoughEnergy = !!selectedJob && game.fatigue + selectedJob.fatigue <= 100;

  function finishDay(patch: Partial<GameState>, message: string, publicLoss = false) {
    setGame((current) => {
      const nextAxes = { ...current.axes, ...patch.axes };
      if (!publicLoss) nextAxes.威厳 = Math.min(100, nextAxes.威厳 + 2);
      return { ...current, ...patch, axes: nextAxes, day: current.day >= 14 ? 14 : current.day + 1, ended: current.day >= 14, log: [message, ...current.log].slice(0, 7) };
    });
    setSelectedJob(null); setSelected([]); setShowForecast(false);
  }

  function acceptJob() {
    if (!selectedJob || !enoughTerms || !enoughEnergy) return;
    const nextAxes = { ...game.axes };
    chosenTerms.forEach((item) => { nextAxes[item.axis] = Math.max(0, nextAxes[item.axis] - item.cost); });
    finishDay({ money: game.money + totalPay, fatigue: game.fatigue + selectedJob.fatigue, axes: nextAxes, relations: { ...game.relations, [selectedJob.client]: Math.min(3, game.relations[selectedJob.client] + 1) } }, `${selectedJob.title}。${chosenTerms.length ? '条件を受け入れ、' : '正攻法で勤め、'}${totalPay}Gを得た。`, chosenTerms.some((item) => item.axis === '威厳'));
  }

  function train(skill: Skill) {
    if (game.money < 70 || game.fatigue > 85) return;
    finishDay({ money: game.money - 70, fatigue: game.fatigue + 12, skills: { ...game.skills, [skill]: Math.min(5, game.skills[skill] + 1) } }, `${skill}を学んだ。今日の収入を将来の力へ変えた。`);
  }

  function rest() { finishDay({ fatigue: Math.max(0, game.fatigue - 58), axes: { ...game.axes, 品位: Math.min(100, game.axes.品位 + 6) } }, '屋敷で静かに休み、身なりを整えた。'); }

  function network(client: Client) {
    if (game.money < 20 || game.fatigue > 90) return;
    finishDay({ money: game.money - 20, fatigue: game.fatigue + 8, relations: { ...game.relations, [client]: Math.min(3, game.relations[client] + 1) } }, `${client}を訪ね、次の仕事につながる話をした。`);
  }

  function resetGame() { localStorage.removeItem('ikusei-prototype-save'); setGame(initialState); setSelectedJob(null); setSelected([]); }

  if (game.ended) {
    const paid = Math.min(game.money, game.debt);
    const complete = paid >= game.debt;
    const lowest = axes.reduce((a, b) => game.axes[a] <= game.axes[b] ? a : b);
    return <main className="ending-shell"><section className="ending-card"><p className="eyebrow">第1章・試算結果</p><h1>{complete ? '期限の日、返済票に印が押された。' : '期限の日、足りない金額が読み上げられた。'}</h1><p className="ending-copy">{complete ? `${game.debt}Gを返した。家はまだ彼女の名のもとにある。` : `${paid}Gを納め、${game.debt - paid}Gが次章へ持ち越された。`} 最も傷ついたものは「{lowest}」だった。</p><div className="ending-stats"><span>所持金 {game.money}G</span><span>体力 {100 - game.fatigue}</span>{axes.map((axis) => <span key={axis}>{axis} {game.axes[axis]}</span>)}</div><Button size="lg" onClick={resetGame}><RotateCcw />もう一度試す</Button></section></main>;
  }

  return (
    <main className="game-shell">
      <header className="topbar">
        <div><p className="eyebrow">Fallen House Management Prototype</p><h1>没落令嬢の返済録</h1></div>
        <div className="deadline"><span>第1章</span><strong>{game.day}<small> / 14日</small></strong></div>
        <div className="debt-block"><span>返済額</span><strong>{game.debt.toLocaleString()}G</strong><div className="debt-track"><i style={{ width: `${Math.min(100, game.money / game.debt * 100)}%` }} /></div><small>手元 {game.money.toLocaleString()}G</small></div>
        <Button variant="ghost" size="icon" aria-label="最初からやり直す" onClick={resetGame}><RotateCcw /></Button>
      </header>

      <div className="game-grid">
        <aside className="character-panel">
          <div className="portrait-frame"><img src={`${import.meta.env.BASE_URL}lady-at-ledger.png`} alt="借金の帳簿に向き合う成人の没落貴族令嬢" /><div className="portrait-caption"><span>エレオノール・ラティエ</span><small>二十六歳／ラティエ家当主</small></div></div>
          <section className="status-section"><div className="section-heading"><span>現在の状態</span><strong>体力 {100 - game.fatigue}</strong></div><div className="meter"><i className="stamina" style={{ width: `${100 - game.fatigue}%` }} /></div>
            {axes.map((axis) => <div className="axis-row" key={axis}><div><span>{axis}</span><small>{axisLabel(game.axes[axis])}</small></div><div className="meter"><i className={`axis-${axis}`} style={{ width: `${game.axes[axis]}%` }} /></div></div>)}
          </section>
          <section className="status-section"><div className="section-heading"><span>技能</span><small>最大5</small></div><div className="skills-grid">{skills.map((skill) => <div key={skill}><span>{skill}</span><strong>{game.skills[skill]}</strong></div>)}</div></section>
        </aside>

        <section className="work-panel">
          <div className="panel-title"><div><p className="eyebrow">本日の依頼</p><h2>三通の依頼状</h2></div><Button variant="outline" onClick={() => setShowForecast((v) => !v)}><Eye />明日の気配</Button></div>
          {showForecast && <div className="forecast">明日は「{offersForDay(Math.min(14, game.day + 1))[0].client}」から、{offersForDay(Math.min(14, game.day + 1))[0].skill}を求める依頼が届きそうだ。</div>}
          <div className="job-list">{offers.map((job) => {
            const required = Math.max(0, job.required - Math.floor(game.relations[job.client] / 2));
            const short = Math.max(0, required - game.skills[job.skill]);
            return <button key={job.id} className={`job-card ${selectedJob?.id === job.id ? 'selected' : ''}`} onClick={() => { setSelectedJob(job); setSelected([]); }}><div className="job-seal">{job.skill[0]}</div><div className="job-main"><div className="job-meta"><span>{job.client}・{relationLabel(game.relations[job.client])}</span><span>体力 −{job.fatigue}</span></div><h3>{job.title}</h3><p>{job.description}</p><div className="requirement"><span>{job.skill} {game.skills[job.skill]} / 必要{required}</span>{short === 0 ? <em>正攻法が可能</em> : <b>条件が{short}つ必要</b>}</div></div><strong className="job-pay">{job.pay + game.relations[job.client] * 25}G</strong></button>;
          })}</div>
          <div className="alternatives"><div className="panel-title compact"><div><p className="eyebrow">仕事を受けない</p><h2>今日を将来に使う</h2></div></div><div className="alternative-grid">
            <div className="alt-card"><BookOpen /><div><strong>学ぶ</strong><small>70G・体力−12</small></div>{skills.map((skill) => <Button key={skill} size="xs" variant="outline" disabled={game.money < 70 || game.fatigue > 85 || game.skills[skill] >= 5} onClick={() => train(skill)}>{skill}</Button>)}</div>
            <div className="alt-card"><Sparkles /><div><strong>休養</strong><small>体力＋58・品位＋6</small></div><Button size="sm" variant="outline" onClick={rest}>休む</Button></div>
            <div className="alt-card wide"><Users /><div><strong>営業</strong><small>20Gを使い、人脈を深める</small></div>{clients.map((client) => <Button key={client} size="xs" variant="outline" disabled={game.money < 20 || game.fatigue > 90 || game.relations[client] >= 3} onClick={() => network(client)}>{client.replace('ヴァレール', '伯爵')}</Button>)}</div>
          </div></div>
        </section>

        <aside className="decision-panel">
          {selectedJob ? <><p className="eyebrow">契約条件</p><h2>{selectedJob.title}</h2><p className="decision-intro">不足している力は、別の条件を受け入れることで補える。</p><div className="contract-summary"><span>基本報酬＋人脈</span><strong>{selectedJob.pay + relationBonus}G</strong><span>技能不足</span><strong>{shortage}</strong></div><div className="concession-list">{selectedJob.concessions.map((item, index) => {
            const active = selected.includes(index);
            return <button key={item.axis} aria-label={`${item.title}。${item.axis}を${item.cost}失い、報酬が${item.bonus}G増える`} aria-pressed={active} className={`concession ${active ? 'active' : ''}`} onClick={() => setSelected((current) => active ? current.filter((value) => value !== index) : [...current, index])}><span className={`axis-dot dot-${item.axis}`} /><div><strong>{item.title}</strong><p>{item.detail}</p><small>{item.axis} −{item.cost} ／ +{item.bonus}G</small></div></button>;
          })}</div><div className="total-row"><span>受取額</span><strong>{totalPay}G</strong></div>{!enoughEnergy ? <p className="warning">体力が足りない。今日は休む必要がある。</p> : !enoughTerms ? <p className="warning">正攻法には技能が足りない。条件をあと{shortage - chosenTerms.length}つ選ぶ必要がある。</p> : <p className="ready">この内容で契約できる。</p>}<Button size="lg" className="accept-button" disabled={!enoughTerms || !enoughEnergy} onClick={acceptJob}><BriefcaseBusiness />この依頼を受ける</Button></> : <div className="empty-contract"><Shield /><h2>依頼を選んでください</h2><p>報酬だけでなく、必要な技能と提示される条件を確認できます。</p></div>}
          <section className="relations"><div className="section-heading"><span>人脈</span><HeartHandshake /></div>{clients.map((client) => <div key={client}><span>{client}</span><strong>{relationLabel(game.relations[client])}</strong></div>)}</section>
          <section className="journal"><div className="section-heading"><span>最近の記録</span></div>{game.log.slice(0, 3).map((item, index) => <p key={`${item}-${index}`}>{item}</p>)}</section>
        </aside>
      </div>
    </main>
  );
}
