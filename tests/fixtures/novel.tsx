import type { ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { Dialogue } from "../../src/ui/scene";
import { sceneArtwork } from "../../src/sceneArt";
import { sceneCatalog } from "../../src/scenes";
import "../../src/styles.css";
import "../../src/reform.css";
import { reformArt } from "../../src/ui/ReformScreens";
type Harness = {
  sceneArtwork: typeof sceneArtwork;
  catalog: typeof sceneCatalog;
  done: number;
  settings: object[];
  show: (options?: Partial<ComponentProps<typeof Dialogue>>) => void;
};
declare global {
  interface Window {
    novelHarness: Harness;
  }
}
const root = createRoot(document.getElementById("fixture")!);
const fit = () => {
  const width = Math.min(1280, innerWidth);
  document.documentElement.style.setProperty("--fit", "1");
  document.documentElement.style.setProperty("--stage-w", `${width}px`);
  document.documentElement.style.setProperty(
    "--stage-h",
    `${innerWidth < innerHeight ? innerHeight : Math.min(innerHeight, (width * 9) / 16)}px`,
  );
  document.documentElement.style.setProperty(
    "--reform-book",
    `url("${reformArt.book}")`,
  );
  document.documentElement.style.setProperty(
    "--reform-room",
    `url("${reformArt.room}")`,
  );
};
fit();
addEventListener("resize", fit);
let sequence = 0;
window.novelHarness = {
  sceneArtwork,
  catalog: sceneCatalog,
  done: 0,
  settings: [],
  show(options = {}) {
    this.done = 0;
    this.settings = [];
    root.render(
      <Dialogue
        key={++sequence}
        title="商会の依頼"
        lines={[
          { speaker: "エレオノール", text: "「……ありがとうございます」" },
        ]}
        place="arnaud"
        speed={0}
        motion={true}
        onDone={() => {
          this.done++;
          root.render(<p>終了</p>);
        }}
        onSettingsChange={(patch) => this.settings.push(patch)}
        {...options}
      />,
    );
  },
};
const sample = new URLSearchParams(location.search).get("sample");
sceneArtwork["qa:cg"] = { image: "backgrounds/valere.webp", subtitle: "top" };
const long =
  "「庭で摘んだ薬草を、銀の皿に並べていく。窓から差す光はやわらかく、ここでなら名前を呼ばれずに済む気がした。けれど、扉の向こうには依頼人が待っている。約束した分だけ働き、屋敷へ帰ろう。」";
window.novelHarness.show(
  sample
    ? {
        textSize: 28,
        sceneId: sample === "cg" ? "qa:cg" : "qa:long",
        lines: [
          { speaker: "エレオノール", text: long },
          { text: "ここからは初めて読む交流。", sceneId: "qa:first-bond" },
        ],
      }
    : {},
);
