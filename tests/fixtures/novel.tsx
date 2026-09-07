import type { ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { Dialogue } from "../../src/ui/scene";
import { sceneArtwork } from "../../src/sceneArt";
import { sceneCatalog } from "../../src/scenes";
import "../../src/styles.css";
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
const fit = () =>
  document.documentElement.style.setProperty(
    "--fit",
    String(Math.min(innerWidth / 1200, innerHeight / 500)),
  );
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
window.novelHarness.show();
