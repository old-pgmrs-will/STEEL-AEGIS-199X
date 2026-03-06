# GPT-image-1.5 スプライト自動化ガイド

## 1. 概要

本ガイドは、`GPT-image-1.5` を使って個別スプライトを生成し、検収後にスプライトシート化するまでの自動化手順をまとめたものです。

## 2. 前提

- リポジトリ直下の `.env.local` または `.env` に `OPENAI_API_KEY` を設定していること
- 依存パッケージをインストール済みであること
- 生成対象は `assets/sprites/manifests/sprite-list.csv` と `assets/sprites/manifests/prompt-manifest.json` で管理すること

### 2.1 推奨設定場所

最も簡単なのは、リポジトリ直下に `.env.local` を作る方法です。

```bash
cp .env.example .env.local
```

その後、`.env.local` を開いて次のように設定します。

```text
OPENAI_API_KEY=your_real_api_key
```

これで `npm run sprites:generate` 実行時に自動で読み込まれます。

## 3. コマンド

### 3.1 画像生成

```bash
npm run sprites:generate
```

実行中は標準出力に次のような進捗ログが出ます。

```text
[sprites] 生成開始: target=all, force=false, limit=all
[sprites] 対象: player_type_a_idle (1)
[sprites] 生成中: player_type_a_idle (attempt 1/3)
[sprites] 保存完了: player_type_a_idle -> 4 file(s)
[sprites] 完了: generated=1, failures=0, errors=...
```

特定の `spriteId` のみ生成する場合:

```bash
node scripts/generate-sprites.mjs --sprite player_type_a_idle
```

件数を制限する場合:

```bash
node scripts/generate-sprites.mjs --limit 2
```

### 3.2 検収チェックリスト生成

```bash
npm run sprites:review
```

### 3.3 candidate 画像の正規化

```bash
npm run sprites:normalize
```

特定の `spriteId` だけ処理する場合:

```bash
node scripts/normalize-candidates.mjs --sprite player_type_a_idle
```

### 3.4 スプライトシート作成

```bash
npm run sprites:pack
```

## 4. 運用フロー

1. `sprite-list.csv` と `prompt-manifest.json` を更新する
2. `npm run sprites:generate` で `incoming/raw/` に画像を出す
3. 候補を `incoming/candidates/` へ移す
4. 候補を `incoming/candidates/` へ移す
5. `npm run sprites:normalize` で `approved/` と `approved/normalized/` を作る
6. `source_file` と `status` を `sprite-list.csv` に反映する
7. `npm run sprites:pack` で `sheets/` と `sheet-layout.json` を生成する

## 5. 注意

- 生成スクリプトは `status` が `planned` または `generated` の必須アセットを対象にします
- `sprites:pack` は `approved` または `normalized` 状態の行だけを対象にします
- `sprites:pack` はカテゴリとセルサイズごとに別シートへ分離して出力します
- 出力シート名は原則として `<category>-<cellWidth>x<cellHeight>.png` 形式です

## 6. APIキーエラー時の挙動

- `OPENAI_API_KEY` が未設定なら即時停止します
- APIキーが無効な場合は `401` として扱い、即時停止します
- 権限不足は `403` として扱い、即時停止します
- レート制限 `429`、サーバーエラー `5xx`、通信失敗は自動再試行します
- 失敗内容は `assets/sprites/manifests/generation-errors.json` に記録されます

認証系エラーが出た場合は、まず `.env.local` の `OPENAI_API_KEY` と、利用組織の権限・課金状態を確認してください。
