import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { specialOffers } from "../content/support";
import { absoluteDay, dateLabel } from "../contracts";
import type { Action } from "../engine";
import { personOf, recipeOf, type GameState } from "../game";
import { previewAction } from "../presentation";
import { Badge, Button, Empty, Heading, money, Tabs } from "./components";
import { OfferDetails } from "./Orders";
export function Journal({
  s,
  confirm,
  openPromise,
  initialTab = "promises",
}: {
  s: GameState;
  initialTab?: string;
  confirm: (a: Action, title: string) => void;
  /** 依頼画面のその約束の詳細を開く。準備と納品はそちらで完結させる。 */
  openPromise: (promiseId: string) => void;
}) {
  const [filter, setFilter] = useState("active"),
    [selected, setSelected] = useState(""),
    [page, setPage] = useState(Math.floor((absoluteDay(s) - 1) / 14)),
    [tab, setTab] = useState(initialTab);
  const today = absoluteDay(s);
  const rows = s.obligations
    .filter((o) =>
      filter === "all"
        ? true
        : filter === "today"
          ? o.status === "active" && o.due === today
          : filter === "payments"
            ? o.outstanding > 0 &&
              (o.terms.kind === "credit" || o.status !== "active")
            : filter === "complete"
              ? o.status === "fulfilled" ||
                (o.status !== "active" && o.outstanding === 0)
              : o.status === "active",
    )
    .sort((a, b) => a.due - b.due || a.id.localeCompare(b.id));
  const o = rows.find((o) => o.id === selected) ?? rows[0];
  const actionButton = (a: Action, label: string) => {
    const reason = previewAction(s, a).error;
    return (
      <div key={label}>
        <Button disabled={!!reason} onClick={() => confirm(a, label)}>
          {label}
        </Button>
        {reason && <small className="muted">{reason}</small>}
      </div>
    );
  };
  return (
    <>
      <Heading eyebrow="PROMISES & CALENDAR">約束帳</Heading>
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          ["promises", "約束一覧"],
          ["calendar", "14日予定表"],
        ]}
      />
      {tab === "calendar" ? (
        <section className="paper">
          <div className="card-top">
            <Button
              aria-label="前の14日"
              disabled={page <= 0}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft />
            </Button>
            <h2>
              第{page + 1}章 · {page * 14 + 1}〜{page * 14 + 14}日目
            </h2>
            <Button
              aria-label="次の14日"
              disabled={page >= 5}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight />
            </Button>
          </div>
          <p>
            指定納品日は当日だけ、支払期限はその日まで。既に出現した依頼と受諾済みの約束を表示します。
          </p>
          <div className="calendar">
            {Array.from({ length: 14 }, (_, i) => page * 14 + i + 1).map(
              (day) => (
                <div
                  className={`calendar-day ${day === today ? "today" : ""}`}
                  key={day}
                >
                  <b>
                    {day}日目 {day === today && "・今日"}
                  </b>
                  {s.obligations
                    .filter((o) => o.due === day)
                    .map((o) => (
                      <button
                        key={o.id}
                        onClick={() => {
                          setSelected(o.id);
                          setFilter("all");
                          setTab("promises");
                        }}
                      >
                        <Badge
                          tone={o.status === "fulfilled" ? "ready" : "warn"}
                        >
                          {o.status === "fulfilled"
                            ? "完了"
                            : o.terms.schedule
                              ? "指定納品"
                              : "支払・履行期限"}
                        </Badge>
                        {o.terms.title}
                      </button>
                    ))}
                  {specialOffers
                    .filter(
                      (o) =>
                        o.schedule!.appears <= today &&
                        o.schedule!.closes === day &&
                        !s.obligations.some((p) => p.offerId === o.id),
                    )
                    .map((o) => (
                      <small key={o.id}>受付終了：{o.title}</small>
                    ))}
                  {day % 14 === 0 && <Badge>章末返済</Badge>}
                </div>
              ),
            )}
          </div>
        </section>
      ) : (
        <>
          <Tabs
            value={filter}
            onChange={setFilter}
            options={[
              ["active", "準備中"],
              ["today", "本日"],
              ["payments", "返還・支払待ち"],
              ["complete", "完了"],
              ["all", "すべて"],
            ]}
          />
          <div className="split">
            <section>
              {rows.map((o) => (
                <button
                  className={`journal-row paper ${selected === o.id ? "selected" : ""}`}
                  key={o.id}
                  onClick={() => setSelected(o.id)}
                >
                  <Badge
                    tone={
                      o.status === "fulfilled"
                        ? "ready"
                        : o.due === today
                          ? "warn"
                          : ""
                    }
                  >
                    {o.status === "fulfilled"
                      ? "完了"
                      : o.status === "cancelled"
                        ? "解消"
                        : o.status === "defaulted"
                          ? "期限経過"
                          : o.due === today
                            ? "本日"
                            : "準備中"}
                  </Badge>
                  <b>{o.terms.title}</b>
                  <small>
                    {dateLabel(o.due)} ／ {personOf(o.terms.person).name}
                  </small>
                </button>
              ))}
              {!rows.length && <Empty>この分類の約束はありません。</Empty>}
            </section>
            {o && (
              <article className="paper">
                <h2>{o.terms.title}</h2>
                <p>
                  {o.terms.schedule ? "指定納品日" : "履行・支払期限"}：
                  <b>{dateLabel(o.due)}</b>
                </p>
                {o.terms.kind === "advance" ? (
                  <OfferDetails offer={o.terms} />
                ) : (
                  <p>{o.terms.description}</p>
                )}
                <p>
                  未精算額 <b>{money(o.outstanding)}</b>
                </p>
                {o.status === "active" && o.terms.kind === "advance" && (
                  <>
                    <Button primary onClick={() => openPromise(o.id)}>
                      {o.due === today ? "まとめ納品へ" : "薬を準備する"}
                    </Button>
                    <div className="promise-actions">
                      {o.terms.options
                        .filter((c) => c.days === 2)
                        .map((c) =>
                          actionButton(
                            { type: "fulfill", id: o.id, option: c.id },
                            `${c.label}・スタミナ${c.stamina}`,
                          ),
                        )}
                    </div>
                  </>
                )}
                <div className="promise-actions">
                  {o.outstanding > 0 &&
                    (o.status !== "active" || o.terms.kind === "credit") &&
                    actionButton({ type: "pay", id: o.id }, "未精算額を支払う")}
                  {o.status === "active" &&
                    actionButton(
                      { type: "cancel", id: o.id },
                      "約束を解消する",
                    )}
                  {o.status === "active" &&
                    !o.terms.schedule &&
                    o.terms.extensionLimit > 0 &&
                    actionButton(
                      { type: "renegotiate", id: o.id },
                      "期限の延長を相談する",
                    )}
                </div>
                <details>
                  <summary>約束について</summary>
                  <p>
                    受諾時の内容を保存しています。解消・期限超過でも前金の返還義務は残ります。返還するまで同じ相手の新規支援は停止します。通常販売は続けられます。
                  </p>
                  {o.terms.options.map((c) => (
                    <p key={c.id}>
                      {recipeOf(c.recipe).name} × {c.count} ／ スタミナ
                      {c.stamina}{" "}
                    </p>
                  ))}
                </details>
              </article>
            )}
          </div>
        </>
      )}
    </>
  );
}
