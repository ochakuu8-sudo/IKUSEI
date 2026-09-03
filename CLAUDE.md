# CLAUDE.md

このリポジトリで作業するときの前提。**特にデプロイ周りは間違えやすいので、着手前に必ず読むこと。**

## 何のリポジトリか

`GAME_DESIGN.md` が本体（育成シミュレーションの企画書）。
`src/` はその内容を触って確かめるためのブラウザ版プロトタイプ。

- Vite + React 19 + TypeScript
- 公開先: <https://ochakuu8-sudo.github.io/IKUSEI/>

## コマンド

```bash
npm ci        # 依存インストール
npm run dev   # ローカル開発サーバ
npm run build # 型チェック(tsc --noEmit) + 本番ビルド -> dist/
npm run deploy # ビルドして gh-pages ブランチに公開
```

## デプロイの仕組み（重要）

**GitHub Pages の配信元は `gh-pages` ブランチ**（Settings → Pages が
"Deploy from a branch" 設定）。**GitHub Actions 経由ではない。**

つまり公開＝「ローカルでビルドして `gh-pages` に push」。
これを `npm run deploy` が全部やる（`scripts/deploy.sh`）。

```bash
# main に変更をマージ・push したあと
npm run deploy
```

スクリプトの動作:

1. 作業ツリーが汚れていたら中断（コミット漏れの取り違えを防ぐため）
2. `npm run build`
3. git worktree で `gh-pages` を取り出し、中身を `dist/` で丸ごと置換
4. 差分がなければ「何もせず終了」、あれば commit して push

### やってはいけないこと

- **`gh-pages` ブランチを直接編集しない。** 生成物なので次のデプロイで消える。
  変更は `src/` 側に入れて `npm run deploy` し直す。
- **`vite.config.ts` の `base: '/IKUSEI/'` を消さない。** リポジトリ名の
  サブパス配信なので、外すと本番でJS/CSSが404になる。
- **`public/.nojekyll` を消さない。** これがないと Jekyll が `assets/` を
  無視して本番だけ真っ白になる。ビルド時に `dist/` へ自動コピーされる。
- **GitHub Actions のデプロイワークフローを作り直さない。** 過去に
  `.github/workflows/deploy-pages.yml` があったが、Pages の配信元が
  ブランチ設定のため一度も動かず（手動実行が10時間以上 queued のまま
  ジョブ0件で停止）、削除済み。Actions 方式に戻すなら、先に
  Settings → Pages → Source を "GitHub Actions" に変える必要がある。
  これはリポジトリ設定の変更なので**人間の操作が必須**。

## AIエージェントの権限について

このリポジトリで作業する Claude セッションの実測値:

| 操作 | 可否 |
|---|---|
| `git push`（`main` / `gh-pages` / 作業ブランチ） | ✅ 可 |
| GitHub API でのファイル・PR・Issue 操作 | ✅ 可 |
| Actions のワークフロー/ログ**参照** | ✅ 可 |
| Actions のワークフロー**手動実行・キャンセル** | ❌ 403 |
| リポジトリ Settings の変更（Pages の配信元など） | ❌ 不可 |

デプロイが git push だけで完結する構成にしてあるのは、この権限で
最後まで完了できるようにするため。Actions に依存させると、
エージェントが自力でデプロイを完了できなくなる。

## コードの書き方

- UI文言・企画書は日本語。コード内の識別子とコミットメッセージは英語。
- 画面は `src/App.tsx` に集約、スタイルは `src/styles.css` のCSS変数で管理。
- 数値バランスは `GAME_DESIGN.md` が正。プロトタイプ側だけ勝手に変えない。
