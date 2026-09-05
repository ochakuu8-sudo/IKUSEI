import { useEffect, useState } from "react";

/** ページがスクロールしない作りなので、ブラウザのツールバーは自動では引っ込まない。
    横持ちではそれが画面の約17%にあたるので、明示的に返してもらう。
    iOS Safari/Chrome は要素の全画面化に対応しないので、その場合は出さない
    （かわりにホーム画面へ追加すると manifest の standalone で同じ結果になる）。 */
export const fullscreenSupported = () =>
  typeof document !== "undefined" &&
  (document.fullscreenEnabled ?? false) &&
  typeof document.documentElement.requestFullscreen === "function";

export function useFullscreen() {
  const [active, setActive] = useState(
    () => typeof document !== "undefined" && !!document.fullscreenElement,
  );
  useEffect(() => {
    const sync = () => setActive(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  const toggle = () => {
    // 失敗しても画面は壊れない。権限やブラウザ差は握りつぶしてよい。
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void document.documentElement.requestFullscreen().catch(() => {});
  };
  return { active, toggle };
}
