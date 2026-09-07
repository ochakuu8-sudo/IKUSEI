import assert from "node:assert/strict";
import { paginateText, graphemes } from "@game/ui/novelText";
const measure = (text) => graphemes(text).length * 10;
for (const text of [
  "「帰りましょう。約束は、忘れていません。」".repeat(10),
  "一行目\n二行目\n三行目",
  "\n\n",
  "",
  "👩‍👩‍👧‍👦と薬瓶。か\u3099".repeat(8),
  "VeryLongUnbrokenEnglishWordAndMore content",
]) {
  const pages = paginateText(text, 100, measure);
  assert.equal(
    pages.map((p) => text.slice(p.start, p.end)).join(""),
    text,
    "原文を欠落・重複させない",
  );
  assert.equal(
    pages
      .map((p) => p.text)
      .join("")
      .replace(/[\r\n]/g, ""),
    text.replace(/[\r\n]/g, ""),
  );
  for (const page of pages) {
    assert(page.text.split("\n").length <= 2);
    assert(page.text.split("\n").every((row) => measure(row) <= 100));
  }
}
const punctuation = paginateText(
  "あいうえおかきくけ「こんにちは」、ありがとう。",
  100,
  measure,
);
assert(
  punctuation
    .flatMap((p) => p.text.split("\n"))
    .every(
      (row) =>
        !/[「『（]$/.test(row) &&
        !/^[、。「」』）]/.test(row.replace(/^「/, "")),
    ),
);
assert.equal(graphemes("👩‍👩‍👧‍👦か\u3099").length, 2);
console.log(
  "PASS novel text: 2行、実測幅、改行、禁則、原文の保存、結合文字・絵文字",
);
