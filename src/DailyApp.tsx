import { useEffect, useRef, useState } from "react";
import { BookOpen, Moon, Settings } from "lucide-react";
import {
  axes,
  axisStage,
  CHAPTER_DAYS,
  jobs,
  personOf,
  placeOf,
  relationStage,
  type Job,
} from "./game";
import {
  closingPreview,
  dailyAction,
  fatigueCount,
  fatigueRateOf,
  freshDaily,
  listPriceOf,
  markSeen,
  materialCostOf,
  offersOf,
  payOf,
  quotaOf,
  staminaOf,
  takeReason,
  tracesOf,
  type DailyState,
  type DayOutcome,
} from "./daily";
import { clearDaily, loadDaily, saveDaily, SAVE_KEY, UI_KEY } from "./saveV14";
import { Art, Modal } from "./ui/shell";
import { Mark } from "./marks";
import { Rings, StateTag } from "./ui/symbols";
import { Dialogue } from "./ui/scene";
import { backgroundSrc, heroSrc } from "./art";
import { fullscreenSupported, useFullscreen } from "./ui/fullscreen";
import "./chapter.css";

const gold = (n: number) => `${n.toLocaleString()}G`;

type Tab = "today" | "journal";
type UI = { tab: Tab; sheet: string | null; speed: number; motion: boolean };
const freshUI = (): UI => ({
  tab: "today",
  sheet: null,
  speed: 24,
  motion: false,
});
function loadUI(): UI {
  try {
    const v = JSON.parse(localStorage.getItem(UI_KEY) ?? "null"),
      d = freshUI();
    if (!v) return d;
    if (v.tab === "journal") d.tab = "journal";
    if ([0, 24, 50].includes(v.speed)) d.speed = v.speed;
    d.motion = v.motion === true;
    return d;
  } catch {
    return freshUI();
  }
}

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

/** 何を差し出すか。紋と「払ったあとの値」を並べる（§5「隠して受けさせない」）。 */
function Costs({ job, s }: { job: Job; s: DailyState }) {
  if (!job.costs.length)
    return (
      <span className="c-costs c-free">
        <Mark name="関係" decorative />
        差し出すものはない
      </span>
    );
  return (
    <span className="c-costs">
      {job.costs.map((c) => (
        <span key={c.axis} className={`c-cost c-cost-${c.axis}`}>
          <Mark name={c.axis} label={c.axis} />−{c.amount}
          <small>
            {s.axes[c.axis]}→{Math.max(0, s.axes[c.axis] - c.amount)}
          </small>
        </span>
      ))}
    </span>
  );
}

function OfferRow({
  job,
  s,
  onOpen,
}: {
  job: Job;
  s: DailyState;
  onOpen: () => void;
}) {
  const reason = takeReason(job, s),
    tired = !reason ? null : reason.startsWith("体力");
  return (
    <article
      className={`c-order-card c-offer ${job.costs.length ? "c-paid" : "c-clean"} ${reason ? "c-state-shut" : ""}`}
    >
      <button className="c-card-link" onClick={onOpen} disabled={!!reason}>
        <span className="c-kind">{job.kind}</span>
        <span className="c-card-body">
          <b>{job.title}</b>
          <small>
            {personOf(job.person).name}
            {s.relations[job.person] > 0 && (
              <Rings
                stage={s.relations[job.person]}
                label={`${personOf(job.person).name}との関係 ${s.relations[job.person]}／3`}
              />
            )}
            · {placeOf(personOf(job.person).place).short}
          </small>
        </span>
        <Costs job={job} s={s} />
        <span className="c-card-pay">
          {gold(payOf(job, s))}
          <small>
            <Mark name="体力" decorative />
            {staminaOf(job)}
          </small>
        </span>
      </button>
      {reason && <StateTag kind={tired ? "brew" : "shut"}>{reason}</StateTag>}
    </article>
  );
}

export default function DailyApp() {
  const [loaded] = useState(() => loadDaily(localStorage)),
    [s, setS] = useState<DailyState | null>(loaded.state),
    [ui, setUI] = useState<UI>(loadUI),
    [started, setStarted] = useState(false),
    [notice, setNotice] = useState(loaded.notice),
    [saveError, setSaveError] = useState(""),
    [settings, setSettings] = useState(false),
    [reset, setReset] = useState<"new" | "delete" | null>(null),
    [pending, setPending] = useState<Job | "rest" | null>(null),
    [scene, setScene] = useState<DayOutcome | null>(null),
    [result, setResult] = useState<DayOutcome | null>(null);
  const lock = useRef(false),
    stateRef = useRef(s);
  stateRef.current = s;
  const fullscreen = useFullscreen(),
    patch = (p: Partial<UI>) => setUI((u) => ({ ...u, ...p }));

  useEffect(() => {
    try {
      localStorage.setItem(UI_KEY, JSON.stringify(ui));
    } catch {
      /* 表示設定の失敗でゲームを止めない。 */
    }
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

  function persist(next: DailyState) {
    stateRef.current = next;
    setS(next);
    try {
      saveDaily(localStorage, next);
      setSaveError("");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "保存に失敗しました");
    }
  }

  /* 提示された依頼は「見た」ことにする。閉じたあと跡として残すため（§5）。 */
  useEffect(() => {
    if (!s || !started || s.awaitingSettlement || s.ended) return;
    const ids = offersOf(s).map((j) => j.id);
    const next = markSeen(s, ids);
    if (next !== s) persist(next);
  }, [s?.revision, s?.day, s?.chapter, started]);

  function commit(action: Parameters<typeof dailyAction>[1]) {
    if (lock.current || saveError || !stateRef.current) return;
    lock.current = true;
    setPending(null);
    const out = dailyAction(stateRef.current, action);
    if (out.error) setNotice(out.error);
    else {
      persist(out.state);
      patch({ sheet: null });
      if (out.outcome?.scene.length) setScene(out.outcome);
      else setResult(out.outcome ?? null);
    }
    window.setTimeout(() => {
      lock.current = false;
    }, 180);
  }

  function begin() {
    setUI(freshUI());
    setNotice("");
    setSaveError("");
    persist(freshDaily());
    setStarted(true);
    setReset(null);
  }

  const offers = s && started ? offersOf(s) : [];
  const sheetJob = ui.sheet ? jobs.find((j) => j.id === ui.sheet) : undefined;
  const due = s ? quotaOf(s) : 0;
  const traces = s ? tracesOf(s) : [];

  return (
    <>
      <div
        className={`chapter-app ${!started ? "c-title" : ui.tab === "today" && !sheetJob ? "c-home" : ""}`}
        style={{
          backgroundImage: `url(${backgroundSrc(!started ? "title" : "home")})`,
        }}
      >
        {!started ? (
          <>
            <Art src={heroSrc} className="c-title-hero" alt="エレオノール" />
            <div className="c-title-panel">
              <div className="c-eyebrow">IKUSEI · CHAPTER ONE</div>
              <h1>没落令嬢の返済録</h1>
              <p>
                借金は返せる。
                <br />
                問題は、完済するために何を差し出すか。
              </p>
              <Button primary disabled={!s} onClick={() => setStarted(true)}>
                続きから
              </Button>
              <Button onClick={() => (s ? setReset("new") : begin())}>
                はじめから
              </Button>
              <Button onClick={() => setSettings(true)}>設定</Button>
              <small>
                1日 = 1行動 ／ 全6章 × 14日
                <br />
                全端末で縦横比固定・横持ちを想定
              </small>
              {notice && <p className="c-note">{notice}</p>}
            </div>
          </>
        ) : s ? (
          <>
            <header className="c-hud">
              <button onClick={() => patch({ tab: "journal" })}>
                <b>{s.day}日目</b>
                <small>第{s.chapter}章</small>
              </button>
              <span className="c-stamina">
                <Mark name="体力" label="体力" />
                <span className="c-gauge">
                  <i style={{ width: `${s.stamina}%` }} />
                </span>
                <b>{s.stamina}</b>
              </span>
              <span className="c-purse">
                <b>{gold(s.money)}</b>
              </span>
              <span className="c-debt">
                <b>{gold(s.debt)}</b>
                <small>
                  この章で納める {gold(due)} ・ 残り
                  {CHAPTER_DAYS - s.day + 1}日
                </small>
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
                    <div key={a} className={`c-ax c-ax-${a}`}>
                      <Mark name={a} label={a} />
                      <span className="c-gauge">
                        <i style={{ width: `${s.axes[a]}%` }} />
                        {a === "品位" && s.dignityCap < 100 && (
                          <u
                            style={{ left: `${s.dignityCap}%` }}
                            aria-label={`品位上限 ${s.dignityCap}`}
                          />
                        )}
                      </span>
                      {ui.tab === "today" && !sheetJob && (
                        <em>{axisStage(a, s.axes[a])}</em>
                      )}
                      <b>{s.axes[a]}</b>
                    </div>
                  ))}
                </div>
              </aside>
              {!(ui.tab === "today" && !sheetJob) && (
                <nav className="c-nav">
                  <button
                    className={ui.tab === "today" ? "selected" : ""}
                    onClick={() => patch({ tab: "today", sheet: null })}
                  >
                    <BookOpen size={22} />
                    今日
                  </button>
                  <button
                    className={ui.tab === "journal" ? "selected" : ""}
                    onClick={() => patch({ tab: "journal", sheet: null })}
                  >
                    <Moon size={22} />
                    台帳
                  </button>
                </nav>
              )}
              <main className="c-main">
                {s.awaitingSettlement ? (
                  <section className="c-screen c-sheet">
                    <div className="c-sheet-body">
                      <h2>第{s.chapter}章 章末</h2>
                      <p className="c-who">返済の日。</p>
                      <div className="c-goods">
                        <span>
                          <b>{gold(due)}</b>
                          <small>
                            所持 {gold(s.money)}
                            {s.money < due
                              ? ` ・ ${gold(due - s.money)}足りない`
                              : " ・ 納められる"}
                          </small>
                        </span>
                      </div>
                      {s.money < due && (
                        <p className="c-warning">
                          不足分に利息25%が付いて次章へ。威厳−15・品位−10。
                        </p>
                      )}
                    </div>
                    <footer className="c-footer">
                      <Button
                        primary
                        onClick={() => commit({ type: "settle" })}
                      >
                        返済を確定する
                      </Button>
                    </footer>
                  </section>
                ) : s.ended ? (
                  <div className="c-empty">
                    <h1>{s.debt === 0 ? "完済した" : "返しきれなかった"}</h1>
                    <p>
                      残債 {gold(s.debt)} ／ 手元 {gold(s.money)}
                      <br />
                      {axes.map((a) => `${a} ${s.axes[a]}`).join(" ／ ")}
                      （品位上限 {s.dignityCap}）
                    </p>
                    <Button onClick={() => setStarted(false)}>
                      タイトルへ
                    </Button>
                  </div>
                ) : sheetJob ? (
                  <section className="c-screen c-sheet">
                    <div className="c-sheet-body">
                      <div className="c-eyebrow">{sheetJob.kind}</div>
                      <h2>{sheetJob.title}</h2>
                      <p className="c-who">
                        {personOf(sheetJob.person).name}
                        {s.relations[sheetJob.person] > 0 && (
                          <Rings stage={s.relations[sheetJob.person]} />
                        )}
                        · {placeOf(personOf(sheetJob.person).place).name}
                      </p>
                      <p className="c-lead">{sheetJob.description}</p>
                      <div className="c-terms">
                        <div>
                          <small>受け取る</small>
                          <b>{gold(payOf(sheetJob, s))}</b>
                          {fatigueCount(sheetJob.person, s) > 0 && (
                            <em>
                              ▼ 通い詰め{" "}
                              {Math.round(
                                (1 - fatigueRateOf(sheetJob.person, s)) * 100,
                              )}
                              %引き（定価 {gold(listPriceOf(sheetJob, s))}）
                            </em>
                          )}
                          {materialCostOf(sheetJob) > 0 && (
                            <em>素材の自腹 −{materialCostOf(sheetJob)}G</em>
                          )}
                        </div>
                        <div>
                          <small>使う体力</small>
                          <b>
                            <Mark name="体力" decorative />
                            {staminaOf(sheetJob)}
                          </b>
                          <em>
                            {s.stamina}→{s.stamina - staminaOf(sheetJob)}
                          </em>
                        </div>
                        <div>
                          <small>差し出すもの</small>
                          <Costs job={sheetJob} s={s} />
                          {!!sheetJob.costs.find((c) => c.axis === "品位") && (
                            <em className="c-warning">
                              品位の上限も下がる（戻らない）
                            </em>
                          )}
                        </div>
                      </div>
                      {closingPreview(sheetJob, s).length > 0 && (
                        <p className="c-closing">
                          これを受けると、もう紹介されなくなる：
                          <b>{closingPreview(sheetJob, s).join("、")}</b>
                        </p>
                      )}
                    </div>
                    <footer className="c-footer">
                      <div className="c-row">
                        <Button
                          primary
                          disabled={!!takeReason(sheetJob, s)}
                          onClick={() => setPending(sheetJob)}
                        >
                          この依頼を受ける
                        </Button>
                        <Button onClick={() => patch({ sheet: null })}>
                          戻る
                        </Button>
                        <span className="c-footer-note">
                          {takeReason(sheetJob, s)}
                        </span>
                      </div>
                    </footer>
                  </section>
                ) : ui.tab === "journal" ? (
                  <div className="c-scroll">
                    <h2>台帳</h2>
                    <h3>関係</h3>
                    {[...new Set(jobs.map((j) => j.person))]
                      .filter(
                        (p) =>
                          !personOf(p).requiresUnlock || s.unlocked.includes(p),
                      )
                      .map((p) => (
                        <p className="c-use-row" key={p}>
                          {personOf(p).name}
                          <Rings stage={s.relations[p]} />
                          <small>{relationStage(s.relations[p])}</small>
                        </p>
                      ))}
                    <h3>もう紹介されない依頼</h3>
                    {!traces.length && <p className="c-muted">まだ無い。</p>}
                    {traces.map((t) => (
                      <p className="c-use-row c-trace" key={t.job.id}>
                        {t.job.title}
                        <small>{t.reason}</small>
                      </p>
                    ))}
                    <h3>記録</h3>
                    {!s.log.length && <p className="c-muted">まだ無い。</p>}
                    {s.log.map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>
                ) : (
                  <div className="c-today">
                    <h2>今日は、何をしましょうか。</h2>
                    <div className="c-offers">
                      {offers.map((job) => (
                        <OfferRow
                          key={job.id}
                          job={job}
                          s={s}
                          onOpen={() => patch({ sheet: job.id })}
                        />
                      ))}
                      {!offers.length && (
                        <p className="c-muted">
                          今日は誰からも声がかからない。
                        </p>
                      )}
                      <article className="c-order-card c-offer c-rest">
                        <button
                          className="c-card-link"
                          onClick={() => setPending("rest")}
                        >
                          <span className="c-kind">休む</span>
                          <span className="c-card-body">
                            <b>今日は受けない</b>
                            <small>
                              何も払わない。1日だけを使う
                              {s.stamina < 100 && " ・ 体力が戻る"}
                            </small>
                          </span>
                          <span className="c-card-pay">
                            {s.stamina < 100 ? (
                              <>
                                <Mark name="体力" decorative />
                                {s.stamina}→100
                              </>
                            ) : (
                              <small>1日を使う</small>
                            )}
                          </span>
                        </button>
                      </article>
                    </div>
                    {traces.length > 0 && (
                      <button
                        className="c-trace-link"
                        onClick={() => patch({ tab: "journal" })}
                      >
                        もう紹介されない依頼 {traces.length}件 ▸
                      </button>
                    )}
                  </div>
                )}
              </main>
            </div>
          </>
        ) : (
          <div className="c-empty">
            <h2>はじめから始めてください</h2>
            <Button primary onClick={begin}>
              はじめる
            </Button>
          </div>
        )}
      </div>

      {pending && s && (
        <Modal
          title={pending === "rest" ? "今日は受けない" : pending.title}
          onClose={() => setPending(null)}
          footer={
            <>
              <Button onClick={() => setPending(null)}>戻る</Button>
              <Button
                primary
                onClick={() =>
                  commit(
                    pending === "rest"
                      ? { type: "rest" }
                      : { type: "take", job: pending.id },
                  )
                }
              >
                確定する
              </Button>
            </>
          }
        >
          {pending === "rest" ? (
            <p>
              1日を使います。体力は100に戻り、何も受け取らず、何も差し出しません。
            </p>
          ) : (
            <>
              <p>
                {gold(payOf(pending, s))} を受け取り、体力を{" "}
                {staminaOf(pending)} 使います。
              </p>
              <p>
                <Costs job={pending} s={s} />
              </p>
              {!!pending.costs.find((c) => c.axis === "品位") && (
                <p className="c-warning">
                  品位の上限も下がります。上限は戻りません。
                </p>
              )}
              {closingPreview(pending, s).length > 0 && (
                <p className="c-warning">
                  これを受けると、
                  {closingPreview(pending, s).join("、")}
                  はもう紹介されません。
                </p>
              )}
            </>
          )}
        </Modal>
      )}

      {scene && s && (
        <Dialogue
          title={scene.title}
          lines={scene.scene}
          place={personOf(scene.person ?? "vernet").place}
          speed={ui.speed}
          onDone={() => {
            setResult(scene);
            setScene(null);
          }}
        />
      )}

      {result && s && (
        <Modal
          variant="result"
          title={result.title}
          onClose={() => setResult(null)}
          footer={
            <Button primary onClick={() => setResult(null)}>
              確認
            </Button>
          }
        >
          <div className="c-result">
            {result.pay !== 0 && (
              <p className="c-pay">
                <b>
                  {result.pay > 0 ? "+" : ""}
                  {gold(result.pay)}
                </b>
                <span>
                  {result.fatigueRate < 1
                    ? `定価 ${gold(result.listPrice)} から ${Math.round((1 - result.fatigueRate) * 100)}%引き`
                    : result.kind === "settle"
                      ? `納めた（ノルマ ${gold(result.listPrice)}）`
                      : "定価どおり"}
                </span>
              </p>
            )}
            {result.drops.map((d) => (
              <p className="c-move c-drop" key={d.axis}>
                <Mark name={d.axis} label={d.axis} />
                {d.axis} −{d.amount}
                <small>
                  {d.before}→{d.after}
                </small>
              </p>
            ))}
            {result.capDrop > 0 && (
              <p className="c-move c-capdrop">
                <Mark name="品位" decorative />
                品位の上限 −{result.capDrop}
                <small>戻らない</small>
              </p>
            )}
            {result.gains.map((g) => (
              <p className="c-move c-gain" key={g.axis}>
                <Mark name={g.axis} label={g.axis} />
                {g.axis} ＋{g.amount}
                <small>
                  {g.before}→{g.after}
                </small>
              </p>
            ))}
            {result.staminaDelta !== 0 && (
              <p className="c-move">
                <Mark name="体力" decorative />
                体力 {result.staminaDelta > 0 ? "＋" : "−"}
                {Math.abs(result.staminaDelta)}
                <small>いま {s.stamina}</small>
              </p>
            )}
            {result.relationUp && (
              <p className="c-move c-gain">
                <Mark name="関係" decorative />
                {result.relationUp.name}
                <small>{result.relationUp.stage}</small>
              </p>
            )}
            {result.closedNow.map((c) => (
              <p className="c-move c-closed" key={c.title}>
                {c.title}
                <small>もう紹介されない（{c.axis}）</small>
              </p>
            ))}
            {result.notices.map((n, i) => (
              <p key={i} className="c-muted">
                {n}
              </p>
            ))}
          </div>
        </Modal>
      )}

      {settings && (
        <Modal
          title="設定"
          onClose={() => setSettings(false)}
          footer={
            <Button primary onClick={() => setSettings(false)}>
              閉じる
            </Button>
          }
        >
          <div className="c-modal-content">
            <label>
              文字送りの速さ
              <select
                value={ui.speed}
                onChange={(e) => patch({ speed: Number(e.target.value) })}
              >
                <option value={50}>ゆっくり</option>
                <option value={24}>ふつう</option>
                <option value={0}>すぐ出す</option>
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={ui.motion}
                onChange={(e) => patch({ motion: e.target.checked })}
              />
              動きを減らす
            </label>
            {fullscreenSupported() && (
              <Button onClick={fullscreen.toggle}>
                {fullscreen.active ? "全画面をやめる" : "全画面で遊ぶ"}
              </Button>
            )}
            <Button onClick={() => setReset("delete")}>保存を消す</Button>
            {saveError && <p className="c-warning">{saveError}</p>}
          </div>
        </Modal>
      )}

      {reset && (
        <Modal
          title={reset === "new" ? "はじめから" : "保存を消す"}
          onClose={() => setReset(null)}
          footer={
            <>
              <Button onClick={() => setReset(null)}>戻る</Button>
              <Button
                primary
                onClick={() => {
                  if (reset === "new") begin();
                  else {
                    clearDaily(localStorage);
                    setS(null);
                    setStarted(false);
                    setSettings(false);
                    setReset(null);
                  }
                }}
              >
                確定する
              </Button>
            </>
          }
        >
          <p>いまの記録（{SAVE_KEY}）は消えます。元に戻せません。</p>
        </Modal>
      )}

      {notice && started && (
        <Modal
          title="お知らせ"
          onClose={() => setNotice("")}
          footer={
            <Button primary onClick={() => setNotice("")}>
              閉じる
            </Button>
          }
        >
          <p>{notice}</p>
        </Modal>
      )}
    </>
  );
}
