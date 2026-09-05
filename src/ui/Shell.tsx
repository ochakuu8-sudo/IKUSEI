import {
  BookOpen,
  CalendarDays,
  Coins,
  FlaskConical,
  Flower2,
  Heart,
  HelpCircle,
  Home,
  Map,
  ScrollText,
  Settings,
} from "lucide-react";
import { absoluteDay } from "../contracts";
import { quotaOf, type GameState } from "../game";
import { Button, money } from "./components";
import type { Route } from "./routes";
const nav = [
  ["home", "自室", Home],
  ["orders", "薬の依頼書", ScrollText],
  ["brew", "調合", FlaskConical],
  ["map", "地図", Map],
  ["journal", "約束帳", BookOpen],
] as const;
export function Shell({
  s,
  route,
  setCalendar,
  go,
  setSettings,
  setHelp,
}: {
  s: GameState;
  route: Route;
  setCalendar: (v: boolean) => void;
  go: (r: Route) => void;
  setSettings: (v: boolean) => void;
  setHelp: (v: boolean) => void;
}) {
  const due = s.obligations.filter(
    (o) => o.status === "active" && o.due === absoluteDay(s),
  );
  return (
    <>
      <header className="hud">
        <button
          className="hud-date"
          onClick={() => {
            setCalendar(true);
            go("journal");
          }}
          aria-label="日付から予定表を開く"
        >
          <CalendarDays />
          <span>
            <small>第{s.chapter}章</small>
            <b>
              {absoluteDay(s)}
              <small>日目</small>
            </b>
          </span>
        </button>
        <div className="hud-resource">
          <Coins />
          <span>
            <small>所持金</small>
            <b>{money(s.money)}</b>
          </span>
        </div>
        <div className="hud-resource">
          <Heart />
          <span>
            <small>体力</small>
            <b>
              {s.stamina}
              <small> / 100</small>
            </b>
          </span>
        </div>
        <div className="hud-payment">
          <span>
            返済まで <b>{14 - s.day + 1}日</b>{" "}
            <small>必要 {money(quotaOf(s))}</small>
          </span>
          <span className={s.money < quotaOf(s) ? "text-crimson" : ""}>
            不足 {money(Math.max(0, quotaOf(s) - s.money))}
          </span>
        </div>
        <Button aria-label="設定" onClick={() => setSettings(true)}>
          <Settings size={19} />
        </Button>
      </header>
      <nav className="main-nav" aria-label="主な画面">
        <Flower2 className="nav-rose" />
        {nav.map(([id, label, Icon]) => (
          <button
            key={id}
            aria-label={label}
            aria-current={route === id ? "page" : undefined}
            disabled={s.awaitingSettlement && id !== "journal"}
            onClick={() => {
              setCalendar(false);
              go(id);
            }}
          >
            <Icon size={21} />
            <span>{label}</span>
            {id === "journal" && due.length > 0 && <i>{due.length}</i>}
          </button>
        ))}
        <Button aria-label="遊び方" onClick={() => setHelp(true)}>
          <HelpCircle size={19} />
          <span>遊び方</span>
        </Button>
      </nav>
    </>
  );
}
