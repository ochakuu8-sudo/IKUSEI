# ADVコンテンツ制作ガイド

2026-09-10。検証用台本を後から本番へ差し替えるためのガイド。設計思想は [条件付き選択の指示書](ADV_CHOICE_CONDITIONS.md) を参照。現在の人物・物語・数値は仮置き。

## 1. どこを編集するか

| 編集したいもの | 場所 |
|---|---|
| 成長名、説明、経験境界 | `src/adv/growth.ts` |
| 尊厳のランク境界・回復制限 | `src/dignity.ts` |
| 依頼の題名、依頼主、基本報酬、体力、候補条件 | `src/game.ts` の `jobs`（検証用は `src/content/debug.ts`） |
| 台詞、選択文、条件、効果、分岐 | `src/content/` の台本ファイル |
| 台本の登録 | `src/content/scenarios.ts` の `scenarios` |
| 人物名、場所などの基本情報 | `src/game.ts` の `people` と関連する型・定義 |
| 場面の画像・演出指定 | 既存の `SceneLine.visual` と `src/ui/sceneVisuals.ts` の対応定義 |

台本の追加や本文変更のために、条件評価・保存・画面側へ場面ID別の処理を追加しない。新しい人物を追加する場合は `PersonId` と人物の定義を整合させる。使用中IDの改名・削除は、旧セーブ・回想からの参照の移行も必要。

## 2. 台本の最小例

以下は仮の登録例。`src/content/myStory.ts` などに置き、`scenarios.ts` で読み込む。既存台本とIDを重複させない。

```ts
import type { Scenario } from "../adv/types";

export const myStory: Scenario = {
  id: "example.adjustment", version: 1, entry: "intro",
  nodes: {
    intro: {
      id: "intro", kind: "text",
      lines: [{ speaker: "依頼主", text: "この取り決めを確認してください。" }],
      next: "choice",
    },
    choice: {
      id: "choice", kind: "choice", prompt: "どう対応する？",
      choices: [
        { id: "normal", text: "通常の確認を済ませる", next: "end" },
        {
          id: "adjust", text: "取り決めの調整を引き受ける",
          condition: { kind: "range", value: { kind: "skill", id: "negotiation" }, min: 1 },
          hint: "仲介や条件調整の仕事で交渉を育てる",
          effects: { bonusMoney: 30, storyFlags: { "example.promised": true } },
          next: "adjusted",
        },
      ],
    },
    adjusted: {
      id: "adjusted", kind: "text",
      lines: [{ speaker: "依頼主", text: "続きの仕事もお願いします。" }], next: "end",
    },
    end: { id: "end", kind: "end" },
  },
};
```

登録例：`export const scenarios: Scenario[] = [...debugScenarios, myStory];`。

対応する依頼を `jobs` に登録する。`scenarioId` が台本IDと一致すれば同じエンジンで動く。

```ts
{
  id: "example-adjustment", title: "取り決めの確認", person: "vernet",
  kind: "実務", category: "ordinary", cadence: "repeat",
  pay: 80, stamina: 10, needs: {}, costs: [],
  description: "書類と取り決めを確認する仕事。",
  scenarioId: "example.adjustment",
  growthRewards: { negotiation: 1 },
  growthHint: "依頼の完了で交渉経験 +1",
}
```

`growthRewards` は全経路の終了時報酬。特定の選択だけで経験を得る場合は、その選択の `effects.growthXP` に書く。両方に書けば両方を得る。通常依頼では `debugOnly` を省略、検証専用では `true` にする。

## 3. 条件と効果

条件参照は `skill`（成長の段階）、`axis`（尊厳ランク0〜5）、`relation`（人物別関係）。`min` と `max` は境界を含む。両方指定すると範囲、同じ値なら一致。境界には整数を指定する。`all.items` はすべて、`any.items` はいずれか。`flag` は `id` と `equals` で出来事の有無を確認する。

成長IDは `negotiation`（交渉）、`knowledge`（知見）、`courage`（胆力）、`charm`（魅力）。暫定の累積経験0・2・5・9が段階0・1・2・3に対応する。尊厳条件は貞操・品位・威厳を個別参照し、合計値で代用しない。尊厳による同一台本の分岐は必要な場所だけで使う。

| 効果 | 意味 |
|---|---|
| `growthXP: { negotiation: 2 }` | 対象の累積経験を増やす。上限で止まる |
| `bonusMoney: 30` | 固定された基本報酬とは別の追加報酬。0以上 |
| `axisDelta: { 威厳: -10 }` | 指定した尊厳の現在値を変更 |
| `relationDelta: { vernet: 1 }` | その人物だけの関係を変更 |
| `storyFlags: { "example.promised": true }` | 選択で起こった出来事を記録 |
| `grantCapabilities: ["garden-orders"]` | 指定した紹介資格を付与 |

尊厳は数値81〜100がランク5、61〜80が4、41〜60が3、21〜40が2、1〜20が1、1未満が0。独立した品位上限と `dignityCapDrop` は廃止した。`axisDelta` は数値を変える効果であり、ランクを直接足し引きする指定ではない。正の効果は同ランク内だけ有効で、例えば品位45に+20を与えても60で止まる。ランク0は回復しない。日次回復も同じ制限を使う。

条件は直前までの選択効果を反映した状態で判定する。基本報酬、依頼終了時の成長・関係上昇、翌朝回復は先取りしない。条件を満たさない選択自身の報酬で条件を満たすこともできない。未達選択は文と必要値・現在値を表示するため、選ぶ前に秘密の答えを漏らす選択文を避ける。

## 4. 後続依頼と3枠の候補

後続依頼には `requiresStoryFlags: ["example.promised"]` を設定する。終了時に `example.completed` を立て、後続依頼に `forbidsStoryFlags: ["example.completed"]` を指定すれば完了後に消える。前提となる出来事は、現在の尊厳だけから推測せず記録で判定する。

依頼候補の `needs` は必要な尊厳ランク、`opensBelow` はそのランク以下で届く条件。いずれも0〜5の整数で指定する。例えば `needs: { 品位: 3 }` はランク3以上（数値41以上）、`opensBelow: { 威厳: 0 }` はランク0だけ。必要に応じて `entryCondition` に複合条件を使える。`requiresCapability` は紹介資格。受注頻度 `cadence` は `repeat`・`once`・`chapter`。

`offerPriority` が正の候補は高い順で先に3枠へ入り、残りを従来の抽選で埋める。検証後続は100、育成は90、挑戦は80。優先依頼を4件以上同時に作ると低い優先の依頼が待つため、本番配信の保証や期限には別の設計が必要。

## 5. 差し替え・保存・回想

本文を改稿したら台本の `version` を増やす。台本IDは同じ物語の改稿で維持し、別の物語には新しいIDを付ける。ノード・選択のIDは各台本内で安定させる。

受諾済みのセッションは台本・依頼・受諾時の見積額を保存している。改稿後も古い版で続き、新たな受諾から新版を読む。選択の回想は実際に通った本文と選択を保持する。未到達の分岐や改稿後の本文を補完せず、本編の報酬やフラグを再実行しない。

本編保存は `ikusei-prototype-save-v16`、独立回想は `ikusei-adv-archive-v1`。v15の数値・成長・フラグ・セッションを保持し、品位上限を削除して移行する。凍結された依頼・台本の数値条件は、その数値が属するランクに変換する。残りの回復には新しい制限を適用する。v14も既に確定している日付・報酬を維持して移行する。読めないv16から旧版に自動で戻すことはしない。新規開始・本編保存の削除では回想を残し、「回想を消す」で明示的に削除する。

成長項目のID・上限や人物の削除、型・保存形式の変更は、本文の差し替えより広い変更である。既存保存に対する移行処理と回帰確認を追加すること。

## 6. 検証手順

1. タイトルから「検証シナリオで始める」。この開始は現在の本編進行を置き換える。
2. 「経験を使って役割を選ぶ」で未達の4選択が見えることを確認し、通常の仕事で完了する。
3. 「共同作業」で1項目を育てる。結果画面・成長一覧に段階と経験が反映される。
4. 再び役割の依頼を受け、育てた項目の選択を選ぶ。専用の本文と後続依頼を確認する。
5. 「状態と複合条件」で変化を選び、次の画面で以上・以下・範囲・AND・ORを確認する。必要なら複数日繰り返す。
   尊厳が100から60へ下がったらランク3になり、翌朝・回復の選択でも60を越えないことを確認する。さらに0へ下げた軸は回復しない。
6. 本文中・選択待ち・結果表示で再読込し、再開位置と報酬の一回性を確認する。スキップが未選択の選択画面を越えないことも確認する。
7. 「成長」またはタイトルから「選択の回想」を開き、通った経路だけを再生する。

開発サーバーを起動したうえで自動確認する。

```sh
npm run dev -- --host 127.0.0.1 --port 5174
# 別の端末で
npm test
npm run build
npm run test:adv-ui
npm run test:ui
```

UI試験の接続先は `IKUSEI_TEST_URL`、ADVの画像保存先は `IKUSEI_CAPTURE_DIR` で変更できる。試験用ブラウザの保存は独立しており、通常ブラウザのプレイ記録は書き換えない。描画寸法は全端末で1200×500を維持し、端末サイズには全体を縮小して収める。

台本検証は未登録参照・存在しない遷移先・循環・不正効果・無条件の出口がない選択などを拒否する。台本追加時は `npm test` に含まれる登録済み台本の検証を通すこと。検証用数値をそのまま本番バランスとして採用しない。
