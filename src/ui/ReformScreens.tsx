import { useState, type ReactNode } from "react";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  LockKeyhole,
  Settings,
  Volume2,
} from "lucide-react";
import {
  axes,
  people,
  personOf,
  placeOf,
  relationStage,
  CHAPTER_DAYS,
  type PersonId,
} from "../game";
import {
  quotaOf,
  tracesOf,
  dailyAction,
  type DailyState,
  type DayOutcome,
} from "../daily";
import { catalogCounts, type SceneEntry, type SceneKind } from "../scenes";
import { artAssetSrc, personSrc } from "../art";
import { Art } from "./shell";
import { Mark } from "../marks";
import { Rings } from "./symbols";
import { visualFor } from "./sceneVisuals";
import { paperSound } from "./paperAudio";
import type { ReadingSettings } from "./scene";

export const reformArt = {
  plaque: artAssetSrc("ui/portrait/status-notebook.svg"),
  binding: artAssetSrc("ui/portrait/header.svg"),
  window: artAssetSrc("ui/portrait/header.svg"),
  room: artAssetSrc("ui/portrait/study.png"),
  paper: artAssetSrc("ui/portrait/letter.svg"),
  book: artAssetSrc("ui/portrait/open-book.svg"),
  closedBook: artAssetSrc("ui/portrait/closed-book.svg"),
  mat: artAssetSrc("ui/portrait/writing-mat.svg"),
  button: artAssetSrc("ui/portrait/button.svg"),
  bookmark: artAssetSrc("ui/portrait/bookmark.svg"),
  wax: artAssetSrc("ui/portrait/wax.svg"),
  hero: artAssetSrc("ui/reform/hero.png"),
};
const gold = (n: number) => `${n.toLocaleString()}G`;
const Button = ({
  children,
  primary,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) => (
  <button
    {...props}
    type="button"
    className={`c-button ${primary ? "c-primary" : ""} ${className}`}
  >
    {children}
  </button>
);

export function ReformGallery({
  seen,
  onPlay,
  onClose,
  onSettings,
}: {
  seen: string[];
  onPlay: (entry: SceneEntry) => void;
  onClose: () => void;
  onSettings: () => void;
}) {
  const [kind, setKind] = useState<SceneKind | "すべて">("すべて");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<SceneEntry | null>(null);
  const rows = catalogCounts(seen).rows.filter((r) => r.written);
  const shown = rows.filter((r) => kind === "すべて" || r.entry.kind === kind);
  const pages = Math.max(1, Math.ceil(shown.length / 6));
  const imageOf = (entry: SceneEntry) => {
    const v = visualFor(entry.id, entry.place);
    return v.image ?? v.background;
  };
  return (
    <section className="r-gallery r-object-screen" aria-label="回想">
      <header className="r-screen-head">
        <div>
          <small>ALBUM</small>
          <h2>思い出のアルバム</h2>
        </div>
        <Button aria-label="設定" onClick={onSettings}>
          <Settings size={20} />
        </Button>
      </header>
      <div className="r-album r-book-surface">
        <nav className="r-tabs" aria-label="回想の分類">
          {(["すべて", "依頼", "関係", "結末"] as const).map((k) => (
            <Button
              key={k}
              primary={kind === k}
              aria-pressed={kind === k}
              onClick={() => {
                setKind(k);
                setPage(0);
                setSelected(null);
              }}
            >
              {k === "依頼" ? "物語" : k === "関係" ? "交流" : k}
            </Button>
          ))}
          <small>
            記録 {rows.filter((r) => r.seen).length} / {rows.length}
          </small>
        </nav>
        {selected ? (
          <div className="r-recall-detail">
            <Art
              src={imageOf(selected)}
              alt={selected.title}
              className="r-recall-picture"
            />
            <div>
              <small>
                {selected.kind} · {placeOf(selected.place).name}
              </small>
              <h3>{selected.title}</h3>
              <p>記録された場面を、もう一度。</p>
              <Button primary onClick={() => onPlay(selected)}>
                この場面を読む
              </Button>
              <Button onClick={() => setSelected(null)}>一覧に戻る</Button>
            </div>
          </div>
        ) : (
          <div className="r-memory-grid">
            {shown.slice(page * 6, page * 6 + 6).map(({ entry, seen: got }) => (
              <button
                type="button"
                key={entry.id}
                className={`r-memory ${got ? "is-seen" : "is-locked"}`}
                disabled={!got}
                onClick={() => setSelected(entry)}
              >
                <span className="r-memory-image">
                  {got ? (
                    <Art src={imageOf(entry)} alt="" />
                  ) : (
                    <>
                      <LockKeyhole size={26} />
                      <span>未解禁</span>
                    </>
                  )}
                </span>
                <strong>{got ? entry.title : "まだ綴られていない記憶"}</strong>
                <small>{got ? placeOf(entry.place).name : entry.hint}</small>
              </button>
            ))}
            {!shown.length && (
              <p className="r-empty-note">
                この分類には、まだ収録された場面がありません。
              </p>
            )}
          </div>
        )}
        {!selected && (
          <nav className="r-pagination" aria-label="アルバムのページ">
            <Button
              disabled={page === 0}
              aria-label="前のページ"
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft size={18} />
            </Button>
            <span>
              {page + 1} / {pages}
            </span>
            <Button
              disabled={page + 1 >= pages}
              aria-label="次のページ"
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight size={18} />
            </Button>
          </nav>
        )}
      </div>
      <footer className="r-screen-foot">
        <Button onClick={onClose}>← アルバムを閉じる</Button>
        <small>回想は、はじめから遊んでも残ります。</small>
      </footer>
    </section>
  );
}

export function Journal({
  s,
  onClose,
  onGallery,
}: {
  s: DailyState;
  onClose: () => void;
  onGallery: () => void;
}) {
  const [tab, setTab] = useState("人物");
  const available = people.filter(
    (p) => !p.requiresUnlock || s.unlocked.includes(p.id),
  );
  const [person, setPerson] = useState<PersonId>(available[0].id);
  const selected = personOf(person),
    stage = s.relations[person],
    traces = tracesOf(s);
  return (
    <section className="r-journal r-object-screen" aria-label="台帳">
      <header className="r-screen-head">
        <div>
          <small>THE LATIER JOURNAL</small>
          <h2>ラティエ家の台帳</h2>
        </div>
        <Button onClick={onGallery}>
          <BookOpen size={18} /> 回想を開く
        </Button>
      </header>
      <div className="r-book-surface r-journal-book">
        <nav className="r-tabs" aria-label="台帳の分類">
          {["人物", "届かない依頼", "最近の記録", "返済"].map((t) => (
            <Button
              key={t}
              aria-pressed={tab === t}
              primary={tab === t}
              onClick={() => setTab(t)}
            >
              {t}
            </Button>
          ))}
        </nav>
        {tab === "人物" ? (
          <div className="r-spread r-people">
            <nav className="r-person-list" aria-label="人物">
              {available.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  aria-pressed={p.id === person}
                  onClick={() => setPerson(p.id)}
                >
                  <img src={personSrc(p.id)} alt="" />
                  <span>
                    {p.name}
                    <small>{relationStage(s.relations[p.id])}</small>
                  </span>
                </button>
              ))}
            </nav>
            <article className="r-person-detail">
              <img className="r-person-crest" src={personSrc(person)} alt="" />
              <small>{placeOf(selected.place).name}</small>
              <h3>{selected.name}</h3>
              <Rings stage={stage} />
              <p>{relationStage(stage)}</p>
              <blockquote>
                {stage > 0
                  ? selected.stageLines[stage - 1]
                  : "まだ、依頼を通じて知る相手。"}
              </blockquote>
            </article>
          </div>
        ) : tab === "届かない依頼" ? (
          <div className="r-book-reading">
            <h3>いま、届かなくなった依頼</h3>
            <p className="r-help">
              現在の条件による記録です。品位上限の低下とは異なり、条件が戻れば再び届く場合があります。
            </p>
            {traces.length ? (
              traces.map((t) => (
                <article className="r-record" key={t.job.id}>
                  <b>{t.job.title}</b>
                  <span>{personOf(t.job.person).name}</span>
                  <small>{t.reason}</small>
                </article>
              ))
            ) : (
              <p>該当する依頼はありません。</p>
            )}
          </div>
        ) : tab === "最近の記録" ? (
          <div className="r-book-reading">
            <h3>最近の記録</h3>
            <small>最新12件</small>
            {s.log.length ? (
              s.log.map((line, i) => (
                <p className="r-record" key={i}>
                  {line}
                </p>
              ))
            ) : (
              <p>まだ記録はありません。</p>
            )}
          </div>
        ) : (
          <div className="r-spread r-debt-pages">
            <div>
              <small>第{s.chapter}章の返済</small>
              <h3>
                {s.awaitingSettlement
                  ? "今日は返済の日"
                  : `あと${CHAPTER_DAYS - s.day + 1}日`}
              </h3>
              <Amount label="納入予定" value={gold(quotaOf(s))} />
              <Amount label="現在の所持金" value={gold(s.money)} />
              <Amount
                label="不足"
                value={gold(Math.max(0, quotaOf(s) - s.money))}
              />
            </div>
            <div>
              <h3>家の借金</h3>
              <Amount label="総残債" value={gold(s.debt)} />
              <Amount label="前章からの繰越" value={gold(s.carryOver)} />
              <p className="r-help">返済は各章の最終日に行います。</p>
            </div>
          </div>
        )}
      </div>
      <footer className="r-screen-foot">
        <Button onClick={onClose}>← 机に戻る</Button>
      </footer>
    </section>
  );
}

function Amount({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="r-amount">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

export function Settlement({
  s,
  onAccept,
}: {
  s: DailyState;
  onAccept: () => void;
}) {
  // The preview uses the same pure transition as commit, without saving or changing state.
  const preview = dailyAction(s, { type: "settle" });
  const due = quotaOf(s),
    paid = Math.min(s.money, due),
    short = due - paid;
  return (
    <section className="r-settlement r-object-screen" aria-label="返済明細">
      <header className="r-screen-head">
        <div>
          <small>CHAPTER {s.chapter}</small>
          <h2>返済の日</h2>
        </div>
        <span>ラティエ家 御中</span>
      </header>
      <div className="r-book-surface">
        <div className="r-spread r-settlement-pages">
          <div>
            <h3>今章の明細</h3>
            <Amount label="納入予定" value={gold(due)} />
            <Amount label="現在の所持金" value={gold(s.money)} />
            <Amount label="今回納める" value={gold(paid)} />
            <Amount label="不足" value={gold(short)} />
            <Amount
              label="利息"
              value={gold(preview.state.debt - Math.max(0, s.debt - paid))}
            />
          </div>
          <div>
            <h3>納入後</h3>
            <Amount label="手元" value={gold(preview.state.money)} />
            <Amount label="残債" value={gold(preview.state.debt)} />
            <Amount
              label={s.chapter === 6 ? "未達分と利息" : "次章への繰越"}
              value={gold(preview.state.carryOver)}
            />
            {preview.outcome?.drops.map((d) => (
              <p className="r-warning" key={d.axis}>
                {d.axis} {d.before} → {d.after}
              </p>
            ))}
            <p className="r-help">
              {short
                ? "不足分には25%の利息が付きます。"
                : "今章の納入額を用意できています。"}
            </p>
          </div>
        </div>
      </div>
      <footer className="r-screen-foot">
        <span>内容を確かめて、納める。</span>
        <Button primary onClick={onAccept}>
          この内容で納める
        </Button>
      </footer>
    </section>
  );
}

export function DayRecord({
  before,
  after,
  result,
}: {
  before: DailyState;
  after: DailyState;
  result: DayOutcome;
}) {
  return (
    <div
      className={`r-day-record ${result.kind === "settle" ? "r-receipt" : ""}`}
    >
      <div className="r-record-caption">
        {result.kind === "settle"
          ? `第${before.chapter}章の受領記録`
          : `第${before.chapter}章 · ${before.day}日目の夜`}
      </div>
      <div className="r-spread">
        <section>
          <h3>{result.kind === "settle" ? "納めたもの" : "今日の手元"}</h3>
          <Amount
            label={
              result.kind === "settle"
                ? "納入"
                : result.kind === "rest"
                  ? "収入"
                  : "受け取った報酬"
            }
            value={`${result.pay > 0 ? "+" : ""}${gold(result.pay)}`}
          />
          {result.fatigueRate < 1 && (
            <small>
              定価 {gold(result.listPrice)}から
              {Math.round((1 - result.fatigueRate) * 100)}%引き
            </small>
          )}
          <Amount
            label="所持金"
            value={`${gold(before.money)} → ${gold(after.money)}`}
          />
          <Amount label="体力" value={`${before.stamina} → ${after.stamina}`} />
          {result.drops.map((d) => (
            <p className="r-warning" key={d.axis}>
              <Mark name={d.axis} decorative /> {d.axis} {d.before} → {d.after}
            </p>
          ))}
          {result.capDrop > 0 && (
            <p className="r-warning r-cap-warning">
              品位の上限 {before.dignityCap} → {after.dignityCap}
              <small>この上限低下は戻りません。</small>
            </p>
          )}
          {result.gains.length > 0 && (
            <div className="r-daily-recovery">
              <small>一日の終わりの回復</small>
              {result.gains.map((g) => (
                <p key={g.axis}>
                  {g.axis} {g.before} → {g.after}
                </p>
              ))}
            </div>
          )}
        </section>
        <section>
          <h3>
            {result.kind === "settle" ? "受領後の記録" : "今日、残ったこと"}
          </h3>
          {result.kind === "settle" ? (
            <>
              <span className="r-received">受領</span>
              <Amount
                label="残債"
                value={`${gold(before.debt)} → ${gold(after.debt)}`}
              />
              <Amount label="未達分と利息" value={gold(after.carryOver)} />
            </>
          ) : result.relationUp ? (
            <div className="r-bond-record">
              <Mark name="関係" decorative />
              <b>{result.relationUp.name}</b>
              <p>{result.relationUp.stage}</p>
            </div>
          ) : (
            <p>
              {result.kind === "rest"
                ? "依頼状を置き、身体を休めた。"
                : "今日の仕事を、台帳に書き留めた。"}
            </p>
          )}
          {result.closedNow.map((c) => (
            <p className="r-warning" key={c.title}>
              {c.title}
              <small>いまは紹介されない（{c.axis}）</small>
            </p>
          ))}
          {result.notices.map((n, i) => (
            <p className="r-help" key={i}>
              {n}
            </p>
          ))}
        </section>
      </div>
    </div>
  );
}

export function Ending({
  s,
  onTitle,
  onGallery,
}: {
  s: DailyState;
  onTitle: () => void;
  onGallery: () => void;
}) {
  const [record, setRecord] = useState(false);
  return (
    <section className="r-ending">
      <Art src={reformArt.hero} className="r-ending-hero" alt="エレオノール" />
      <div className="r-ending-copy">
        <small>FIN</small>
        <h1>{s.debt === 0 ? "返済の日々を終えて" : "残された返済録"}</h1>
        <p>
          {s.debt === 0
            ? "ラティエ家の借金は、すべて返し終えた。"
            : "最後の返済日を迎えた。まだ、借金は残っている。"}
        </p>
        <Button onClick={() => setRecord((v) => !v)} aria-expanded={record}>
          終幕の記録
        </Button>
        {record && (
          <div className="r-ending-record">
            <Amount label="残債" value={gold(s.debt)} />
            <Amount label="手元" value={gold(s.money)} />
            {axes.map((a) => (
              <Amount key={a} label={a} value={s.axes[a]} />
            ))}
            <small>品位上限 {s.dignityCap}</small>
          </div>
        )}
        <div className="r-ending-actions">
          <Button onClick={onGallery}>回想</Button>
          <Button primary onClick={onTitle}>
            タイトルへ
          </Button>
        </div>
      </div>
    </section>
  );
}

export function GameSettings({
  value,
  onChange,
  volume,
  onVolume,
  data,
  screen,
}: {
  value: ReadingSettings;
  onChange: (patch: Partial<ReadingSettings>) => void;
  volume?: number;
  onVolume?: (n: number) => void;
  data?: ReactNode;
  screen?: ReactNode;
}) {
  const [tab, setTab] = useState("文章・演出");
  return (
    <div className="r-settings">
      <nav className="r-tabs" aria-label="設定の分類">
        {[
          "文章・演出",
          ...(onVolume ? ["音"] : []),
          ...(screen ? ["画面"] : []),
          ...(data ? ["データ"] : []),
        ].map((t) => (
          <Button
            key={t}
            primary={tab === t}
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
          >
            {t}
          </Button>
        ))}
      </nav>
      {tab === "文章・演出" ? (
        <div className="r-settings-reading">
          <div>
            <fieldset>
              <legend>文字の大きさ</legend>
              <div className="r-choice-row">
                {[22, 24, 26, 28].map((n, i) => (
                  <Button
                    key={n}
                    aria-pressed={value.textSize === n}
                    primary={value.textSize === n}
                    onClick={() => onChange({ textSize: n })}
                  >
                    {["小", "標準", "大", "特大"][i]}
                  </Button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>文字送り</legend>
              <div className="r-choice-row">
                {[50, 24, 0].map((n, i) => (
                  <Button
                    key={n}
                    aria-pressed={value.speed === n}
                    primary={value.speed === n}
                    onClick={() => onChange({ speed: n })}
                  >
                    {["ゆっくり", "ふつう", "すぐ"][i]}
                  </Button>
                ))}
              </div>
            </fieldset>
            <label className="r-toggle">
              <input
                type="checkbox"
                checked={value.strongText}
                onChange={(e) => onChange({ strongText: e.target.checked })}
              />
              <span>字幕の地を濃くする</span>
            </label>
            <label className="r-toggle">
              <input
                type="checkbox"
                checked={value.motion}
                onChange={(e) => onChange({ motion: e.target.checked })}
              />
              <span>動きを減らす</span>
            </label>
          </div>
          <div
            className={`r-reading-preview ${value.strongText ? "is-strong" : ""}`}
            style={
              { "--preview-font": `${value.textSize}px` } as React.CSSProperties
            }
          >
            <small>字幕の見え方</small>
            <div>
              <b>エレオノール</b>
              <p>
                今日の便りを、
                <br />
                一通ずつ確かめる。
              </p>
            </div>
          </div>
        </div>
      ) : tab === "音" ? (
        <div className="r-audio">
          <Volume2 />
          <label>
            紙と道具の音 <b>{volume}%</b>
            <input
              type="range"
              aria-label="紙の音量"
              min="0"
              max="100"
              step="5"
              value={volume}
              onChange={(e) => onVolume?.(Number(e.target.value))}
            />
          </label>
          <Button onClick={() => paperSound(volume ?? 30, "book")}>
            音を確かめる
          </Button>
        </div>
      ) : tab === "データ" ? (
        <div className="r-settings-data">{data}</div>
      ) : (
        <div className="r-settings-data">{screen}</div>
      )}
    </div>
  );
}
