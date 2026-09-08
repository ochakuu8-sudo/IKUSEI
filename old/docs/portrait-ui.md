# 立ち絵に合わせた UI

1200×500（2.4:1）の固定構図。縦持ちも同じ画面を中央に縮小表示する。

## 描画方針

- 元の `public/art/ui/reform/hero.png` を基準に、線画・柔らかい陰影・墨色・アイボリー・くすんだ薔薇色を揃える。
- 背景は built-in image_gen で制作。人物・文字・UI を含めず、立ち絵と操作要素を重ねる。
- 手帳・便箋・封蝋・綴じ具は編集可能な SVG。写実的な木目・汚れ・金属の盛り上がりを使わない。
- SVG の原稿は `scripts/draw-stationery.mjs`。同スクリプトを Node.js で実行して再出力する。
- 既存の三軸・砂時計・関係の紋章と、ゲームの数値・条件・保存形式は維持。
- 書類を開閉する既存の動きと減動設定を維持。

## 背景を見せる配置

- 主画面を囲う書き物用マットを取り外し、3通の便箋を右下へ配置。
- 折りたたんだ便箋は各210×180。左右を±6度、中央を32px下げた浅い扇形で、面積は計約19%。依頼名16px、報酬23px。説明文と関係の詳細は開いた便箋へ集約。
- 日付・返済・所持金・操作は右上の562×66の小さな表示にまとめる。
- 状態手帳は308×154。紋章、数値、状態説明を残し、行間を整理して低くする。
- 一覧でも上限低下、紹介停止、体力不足などの判断に必要な警告を表示する。
- 依頼詳細は右側の一枚の紙に本文・署名・条件・返事をまとめる。背後の二通は装飾として残し、操作対象から外す。
- 手紙は元の位置から持ち上がり、縦に開く。机へ戻すと元の位置へ収まり、フォーカスも元の便箋へ戻る。減動設定では即座に切り替える。
- 右壁に飾り棚、本、薔薇の額絵、花瓶、小箱を追加。左の立ち絵・状態手帳と1200×500の固定比率は維持。

## 素材

`public/art/ui/portrait/`:

- `study.png`: 背景（image_gen、1942×810）
- `study-furnished.png`: 使用中の背景。既存背景を built-in image_gen で編集した1942×810画像をそのまま使用。
- `header.svg`, `button.svg`, `writing-mat.svg`: ヘッダー、操作ボタン、書き物用マット
- `status-notebook.svg`, `closed-book.svg`, `open-book.svg`: 状態手帳、台帳、開いた帳面
- `letter.svg`, `bookmark.svg`, `wax.svg`: 便箋、依頼分類の栞、封蝋
- `folded-letter.svg`, `unfolded-letter.svg`: 折りたたんだ便箋と開いた一枚の手紙。文字はすべてHTMLで描画する。

## 背景の最終生成プロンプト

方式: built-in image_gen。参照1は立ち絵に絵柄を合わせ直した構図案、参照2は既存立ち絵。

Create one production BACKGROUND ILLUSTRATION ONLY for the same game as reference 1, using reference 2 (the actual heroine portrait) as the strict art-style guide. A fixed 2.4:1 landscape composition, full image around 2400x1000, no outside bars.

Remove ALL people, ALL UI, ALL text, all letters/cards/books/buttons/panels/frames used as interfaces from reference 1. This asset is only the quiet interior behind the live character and the live UI. Do not leave blank silhouettes or holes where objects were removed. Invent the naturally continuing room underneath.

COMPOSITION: left 29% of the image has the original elegant tall pale manor window, soft dusty-mauve curtains at the far left with one restrained golden tie, a small vase of pink roses near the far left lower third. Clear open window area from x8% to x27% where the original heroine will later stand. At the right 71% is a subdued manor study wall, clean simple framed wall panels or a distant bookcase with only a few large readable shapes. The UI will cover most of this right area, so keep contrast low and no focal ornament. A smooth quiet writing-desk surface runs horizontally across the bottom 20% of the image; no clutter in the center or right foreground. Upper-right area uses cool charcoal-mauve/brown neutrals, rather than bright noisy wood. Window light is pale cream daylight with a hint of sky blue.

DRAWING: match the clean Japanese anime line art and soft cel shading of reference 2. Fine controlled warm-grey contours, smooth carefully shaded color areas, neat architectural edges, clean painted curtains with designed broad folds. Two or three shades per material. Quiet matte surfaces. No visible grain, rough painterly strokes, sepia wash, speckles, scratches, lens blur, bokeh, photoreal wood grain, shiny 3D bevels, heavy chiaroscuro, or generative ornate noise. Crisp finished anime background illustration that harmonizes with the heroine, not a realistic photo or oil painting.

No humans, no character, no typography, no icons, no UI of any kind, no sign, no foreground papers, no frames floating in front of the room. One clean reusable room background.

## 確認

主画面・依頼詳細・台帳・設定を実ブラウザーで目視し、日付のコントラスト、紋章の色、紙面の伸縮、設定の見切れを修正。依頼選択からシナリオ、結果、翌朝への進行を一巡。公開用ビルドで TypeScript と Vite を確認。

## 飾り棚を追加した背景の最終編集プロンプト

方式: built-in image_gen。参照: study.png。生成出力をリサイズ・加工せず使用。

Use case: precise-object-edit.
Edit the supplied anime manor-study background. Preserve the current art style, camera, architecture, daylight, palette, and 2.4:1 full-bleed canvas. This is a production background asset for a Japanese illustrated game, NOT a UI mockup.

KEEP THE ENTIRE LEFT THIRD UNCHANGED: the window, sky, garden view, mauve curtains, curtain tie, rose vase and window sill. Also preserve the position and height of the existing desk across the bottom. No people or silhouettes.

Change only the sparsely furnished wall on the RIGHT TWO THIRDS to make this feel like a young noblewoman's lived-in study:
1. A small tasteful framed botanical drawing of a dusty-pink rose, centered around x43%, y27%, spanning approximately x38–48% and y17–37%. The frame is narrow, muted champagne colored, with simple neat corners, not rococo. The paper and rose are quiet soft colors.
2. One shallow, elegant wall-mounted display shelf across x57–95%, with its horizontal base around y42%. Use the same subdued ash-brown wood as the room, simple fine profiles, two small graceful supports. On the left side of this shelf place a group of six or seven used but well-kept books, varied in height, some upright and one or two stacked. Bindings in muted plum, sage, slate-blue and ivory, with thin small gold lines, no readable titles.
3. On the right end of the shelf, a small ivory ceramic bud vase with a few soft green leaves and two pale pink flowers. Between the books and vase leave generous open space and place a single small closed keepsake box in desaturated mauve with a restrained rose detail.
The shelf and objects should have clear large silhouettes, fine controlled outlines and soft cel-shaded shadows. They must look physically attached to the room and illuminated by the existing window on the left. No floating objects.

UI COMPOSITION CONSTRAINTS: The top-right x52–99%, y3–17% will be covered by a compact HUD; put no important new decoration there. The right foreground x40–99%, y44–94% will contain selectable letters later; keep those lower areas and the desk calm and uncluttered. Put the new focal furnishings in the visible upper-middle band, primarily y19–42%. Do NOT draw any UI, letters, envelopes, widgets, counters, labels or text into this background. Do NOT add an ornate frame around the image. Background decoration must be lower contrast than a character portrait and foreground ivory letters.

Match the source's clean Japanese anime architectural line art, smooth matte color fields and soft warm daylight. Avoid photorealism, shiny embossed metal, busy carvings, thick texture, grunge, speckles, dramatic lighting, exaggerated perspective, visual noise, giant objects, dense wall-to-wall books, extra furniture, or clutter. Retain the peaceful, elegant, slightly wistful atmosphere. Full complete room image, same very wide 2.4:1 aspect ratio.

## 折り便箋の確認

主画面と警告のある依頼詳細を目視。開閉・受諾・シナリオ・日次結果・翌朝への進行を一巡。減動設定の切り替えも確認。ゲームの計算や保存形式は変更していない。
