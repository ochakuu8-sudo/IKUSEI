import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Expand, RotateCw } from "lucide-react";
import { fullscreenSupported, useFullscreen } from "./fullscreen";
import { GameButton } from "./shell";

/** Keep tiny viewports from turning the fixed game canvas into unreadable controls. */
export function ScreenGuide() {
  const ref = useRef<HTMLDialogElement>(null);
  const [portrait, setPortrait] = useState(false);
  const fullscreen = useFullscreen();
  useEffect(() => {
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)";
    document.body.append(probe);
    const fit = () => {
      const css = getComputedStyle(probe), n = (v: string) => parseFloat(v) || 0;
      const width = (window.visualViewport?.width ?? innerWidth) - n(css.paddingLeft) - n(css.paddingRight);
      const height = (window.visualViewport?.height ?? innerHeight) - n(css.paddingTop) - n(css.paddingBottom);
      setPortrait(width < height);
      const small = width < 844 || height < 352;
      if (small && !ref.current?.open) queueMicrotask(() => { if (ref.current?.isConnected && !ref.current.open) ref.current.showModal(); });
      if (!small) ref.current?.close();
    };
    fit(); window.addEventListener("resize", fit); window.visualViewport?.addEventListener("resize", fit);
    return () => { probe.remove(); window.removeEventListener("resize", fit); window.visualViewport?.removeEventListener("resize", fit); };
  }, []);
  return createPortal(<dialog ref={ref} className="screen-guide" onCancel={e => e.preventDefault()} aria-label="画面サイズの案内">
    <RotateCw aria-hidden="true" /><h2>{portrait ? "画面を横向きに" : "もう少し広い画面で"}</h2>
    <p>{portrait ? "手紙と物語を読みやすい大きさで楽しむために、端末を横向きにしてください。" : "ウィンドウを広げるか、全画面表示をご利用ください。"}</p>
    <small>表示できる大きさになると、そのままの場面に戻ります。</small>
    {fullscreenSupported() && !fullscreen.active && <GameButton onClick={fullscreen.toggle}><Expand aria-hidden="true" />全画面で開く</GameButton>}
  </dialog>, document.body);
}
