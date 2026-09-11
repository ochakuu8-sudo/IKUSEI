import type { DailyState } from "../daily";
import { Art, GameButton as Button } from "./shell";
import { reformArt } from "./ReformScreens";
import "./demo.css";

export function DemoCompletion({ state, onExport, onGallery, onTitle }: {
  state: DailyState; onExport: () => void; onGallery: () => void; onTitle: () => void;
}) {
  const receipt = state.chapterResults.find(r => r.chapter === 1);
  return <section className="demo-completion" aria-label="体験版の記録">
    <Art src={reformArt.hero} className="demo-hero" alt="エレオノール" />
    <div className="demo-copy">
      <small>CHAPTER ONE · FREE DEMO</small>
      <h1>{receipt ? "最初の返済を終えて" : "この先の記録は保管中"}</h1>
      <p>{receipt ? "第1章はここまでです。遊んでくださって、ありがとうございます。" : "この体験版で遊べるのは第1章までです。以前の進行はそのまま残しています。"}</p>
      <dl className="demo-receipt">
        {receipt && <div><dt>今回の返済</dt><dd>{receipt.paid.toLocaleString()} G{receipt.shortfall > 0 && <small>不足 {receipt.shortfall.toLocaleString()} G</small>}</dd></div>}
        <div><dt>手元に残ったお金</dt><dd>{state.money.toLocaleString()} G</dd></div>
        <div><dt>残りの借金</dt><dd>{state.debt.toLocaleString()} G</dd></div>
      </dl>
      <p className="demo-save-note">成長・尊厳・約束と返済の記録を保存しました。続編用に、保存ファイルを手元にも残せます。</p>
      <div className="demo-actions"><Button primary onClick={onExport}>記録を書き出す</Button><Button onClick={onGallery}>回想</Button><Button onClick={onTitle}>タイトルへ</Button></div>
    </div>
  </section>;
}
