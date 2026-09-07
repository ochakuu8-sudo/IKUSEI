export type TextPage = { start: number; end: number; text: string };
const segmenter = new Intl.Segmenter("ja", { granularity: "grapheme" });
export const graphemes = (text: string) =>
  Array.from(segmenter.segment(text), (part) => part.segment);
const noStart =
  /^[、。，．？！!?：；」』）］｝】〉》〕〗〙〛ー〜…々ぁぃぅぇぉゃゅょっァィゥェォャュョッヵヶ]/;
const noEnd = /^[「『（［｛【〈《〔〖〘〚]$/;

/** 実フォントの幅で行を折り、最大2行を1ページにする。原文の位置を保持する。 */
export function paginateText(
  text: string,
  width: number,
  measure: (text: string) => number,
): TextPage[] {
  const tokens = Array.from(segmenter.segment(text), ({ segment, index }) => ({
    text: segment,
    start: index,
    end: index + segment.length,
  }));
  const rows: TextPage[] = [];
  let i = 0;
  while (i < tokens.length) {
    let end = i;
    while (
      end < tokens.length &&
      !/[\r\n]/.test(tokens[end].text) &&
      measure(
        tokens
          .slice(i, end + 1)
          .map((t) => t.text)
          .join(""),
      ) <= width
    )
      end++;
    if (end === i && !/[\r\n]/.test(tokens[i].text)) end++;
    if (end < tokens.length && !/[\r\n]/.test(tokens[end].text)) {
      while (
        end > i + 1 &&
        (noStart.test(tokens[end].text) || noEnd.test(tokens[end - 1].text))
      )
        end--;
      if (
        /^[a-zA-Z0-9]$/.test(tokens[end]?.text ?? "") &&
        /^[a-zA-Z0-9]$/.test(tokens[end - 1]?.text ?? "")
      ) {
        let word = end;
        while (word > i && /^[a-zA-Z0-9]$/.test(tokens[word - 1].text)) word--;
        if (word > i) end = word;
      }
    }
    const display = tokens
      .slice(i, end)
      .map((t) => t.text)
      .join("");
    if (end < tokens.length && /[\r\n]/.test(tokens[end].text)) end++;
    rows.push({
      start: tokens[i].start,
      end: tokens[end - 1].end,
      text: display,
    });
    i = end;
  }
  const pages: TextPage[] = [];
  for (let row = 0; row < rows.length; row += 2) {
    const pair = rows.slice(row, row + 2);
    pages.push({
      start: pair[0].start,
      end: pair.at(-1)!.end,
      text: pair.map((r) => r.text).join("\n"),
    });
  }
  return pages.length ? pages : [{ start: 0, end: 0, text: "" }];
}
