import assert from "node:assert/strict";
import {
  loadReadScenes,
  recordReadScene,
  sceneRange,
  READ_SCENES_KEY,
} from "@game/ui/readScenes";
const data = new Map();
const storage = {
  getItem: (k) => data.get(k) ?? null,
  setItem: (k, v) => data.set(k, v),
};
assert.deepEqual(loadReadScenes(storage), []);
const lines = [
  { sceneId: "job:a", text: "依頼の冒頭" },
  { text: "依頼の最後" },
  { sceneId: "bond:a:1", text: "初見の交流" },
  { text: "交流の最後" },
];
assert.deepEqual(sceneRange(lines, 0, "job:a"), {
  id: "job:a",
  start: 0,
  end: 2,
});
assert.deepEqual(sceneRange(lines, 1, "job:a"), {
  id: "job:a",
  start: 0,
  end: 2,
});
assert.deepEqual(sceneRange(lines, 2, "job:a"), {
  id: "bond:a:1",
  start: 2,
  end: 4,
});
recordReadScene(storage, "job:a");
recordReadScene(storage, "job:a");
assert.deepEqual(loadReadScenes(storage), ["job:a"]);
assert(
  !loadReadScenes(storage).includes(sceneRange(lines, 2, "job:a").id),
  "次の交流を既読にしない",
);
data.set(READ_SCENES_KEY, "broken");
assert.deepEqual(loadReadScenes(storage), []);
assert.doesNotThrow(() =>
  recordReadScene(
    {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    },
    "job:a",
  ),
);
console.log(
  "PASS read metadata: scene boundaries, first-read protection, duplicate and corrupt storage",
);
