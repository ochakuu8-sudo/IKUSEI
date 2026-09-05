# 素材マニフェスト

## 主人公

- 原本: `public/hero-key-visual.webp`（ユーザー提供、変更なし）
- 表示: `public/art/hero.png`（RGBA・実透明）
- 背景除去の生成試行2点は、透明ピクセルではなくチェック柄が描かれたため不採用。
- 採用マスク: `public/art/hero-matte.png`。built-in imagegenで原画像の前景を白・背景を黒にした輪郭マスクを生成し、元画像へ適用。顔・髪・衣装・ポーズの再設計、全身の描き足しは行っていない。
- 生成指示: Precise extraction matte of supplied original. Same square composition. Entire girl, hair, clothing, lace and ribbons solid white; exterior solid black. No internal details, no text, exact original outer contours.
- 透過検証: 240,585ピクセルが完全透明、793,050ピクセルが完全不透明。不透明部分のRGBは原画像と全画素一致（変更0）。顔・白衣装・レースの確認点はalpha255。暗い背景に重ねて拡大確認。

## 背景

`public/art/backgrounds/` に各場所9点、調合机1点、街の地図1点。
制作: built-in imagegen。PNGの生成原本を保持し、Web配信用に幅1600px以下・WebP品質84へ変換。
共通プロンプト: One finished wide 16:9 game background illustration. Elegant Japanese visual novel environment painting, clean fine linework and soft painterly shading, matching a blonde aristocratic heroine with black ribbons and antique gold roses. Ivory #F6F0E4, ink #25212A, antique gold #A28550, small wine red #8F3046 accents. Authored composition, architectural perspective, detailed focal props, quiet spaces. No text or UI, no panels or collage, no people.

| ID | 個別の制作指示 |
|---|---|
| estate | Noblewoman's bedroom and apothecary salon, ivory plaster, gold mouldings, black ribbon, antique desk and ledger, crimson rose, morning light |
| arnaud | French trading house, dark wood counter, botanical ingredient drawers, parcels, brass scales, wine red drapery |
| academy | Royal academy library, ivory arches, leather books, quiet reading table, golden lamp, muted sage |
| valere | Count's French salon, ivory and gold panels, black carved furniture, crimson velvet, porcelain tea service |
| guild | Guildhall timber beams, cream stone, worktable, blank sealed papers and ropes, warm practical atmosphere |
| hill | Monastery hill, wild roses, stone abbey and bell tower, cream sky, olive herbs and meadows |
| wood | Royal forest path, birches, ancient trees, red poppies and wormwood, warm sunlight |
| backstreet | Narrow French backstreet at dusk, worn stone, amber lanterns, unmarked herbs, violet shadows |
| garden | Walled herb garden, open wrought iron gate, silver herbs, pale roses, glass greenhouse |
| brew | Marble mortar, glass bottles, rose petals, brass balance and blank recipe ledger on dark wooden desk |
| map | Bird's-eye French fantasy town: mansion lower left, trading left center, academy upper center, count right center, guild lower center, monastery upper left, forest upper right, alleys bottom center, garden bottom right. Paths and gardens, no labels |

## SVGアイコンと紋章

- `public/art/items/`: 薬7点・素材6点。薬は容器の輪郭・色・ラベルの図形、素材は植物や物質の輪郭で区別。文字は焼き込まない。
- `public/art/crests/`: 人物7名の紋章。顔や人物設定は追加しない。
- 共通UI: lucide-reactの操作記号、CSSの紙面・封蝋・リボン・金枠。原寸44px以上の操作領域。
- 読込失敗時: Artコンポーネントの専用紋章表示。背景に主人公を流用しない。
