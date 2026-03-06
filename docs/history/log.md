# Session Log

## 2026-03-06 — 縦スクロールシューティング企画仕様作成

### Key Instructions
- ブラウザで動作する縦スクロールシューティングゲームの企画を行うこと
- 1990年代王道スクロールシューティングの仕様を踏まえること
- 敵キャラクター、スプライトビジュアル、ボス、攻撃力と防御力の成長要素を含めること
- ビジュアル要素は画像生成前提で検討すること

### Decisions Made
- 企画仕様書は `docs/specs/spec.md` に集約し、ゲームデザインとビジュアル制作要件を一体で定義する構成にした
- 対象作品はPCブラウザ向けの王道縦スクロールシューティングとし、1プレイ5ステージ構成を採用した
- 成長システムは攻撃力強化と防御力強化を分離し、被弾後の復帰余地を残す設計とした
- ビジュアル制作は画像生成起点だが、最終使用時にはスプライト向け整形工程を必須とする方針にした

### Changes from Original Plan
- None

### Open Issues
- コンティニュー制限、オンラインランキング、スマートフォン正式対応、ストーリー演出量は未確定

## 2026-03-06 — UI画像生成方針の明文化

### Key Instructions
- `UI/UX 仕様` における画像生成の実現方法を明文化すること

### Decisions Made
- UI はレイアウトと可読情報を実装側で管理し、画像生成は装飾素材制作に限定する方針を明記した
- HUD 全体を一枚絵で生成するのではなく、フレーム、警告帯、パネル、アイコン原画などをパーツ単位で生成する運用にした
- 数値、ラベル、目盛りなど可読性が支配的な要素は非生成対象とし、フォント描画または手組みを前提にした

### Changes from Original Plan
- 初版仕様では UI 画像生成の責務分離が暗黙的だったため、生成対象と非生成対象、状態差分、品質基準を追記した

### Open Issues
- 実際に採用するフォントファミリー
- UI パーツの 9-slice 対応範囲
- 難度別またはステージ別にどこまで HUD 演出差分を持たせるか

## 2026-03-06 — 実装詳細仕様書の作成

### Key Instructions
- 作成済みドキュメントに基づき、実装に必要な詳細仕様書を作成すること

### Decisions Made
- 企画仕様と実装判断を分離するため、詳細仕様は `docs/specs/implementation-spec.md` に新規作成した

## 2026-03-06 — docs フォルダの再整理

### Key Instructions
- `docs` フォルダ内のドキュメント類を目的やカテゴリ単位で整理すること
- `plan` で始まる計画用ファイルは適切なフォルダへ移動すること

### Decisions Made
- 仕様書は `docs/specs/`、アセット運用資料は `docs/assets/`、計画書は `docs/plans/`、履歴は `docs/history/` に分離した
- `plan*.md` はすべて `docs/plans/` へ移動し、フォルダ名で役割が分かる構成にした
- 移動後に壊れる内部参照は新しいパスへ更新した

### Changes from Original Plan
- None

### Open Issues
- None
- 推奨技術スタックとして `TypeScript`、`Vite`、WebGL 対応 2D 描画ライブラリを前提にした
- 実装の核となるゲームループ、シーン遷移、データモデル、ステージスクリプト、保存仕様、性能基準、テスト観点を定義した

### Changes from Original Plan
- 初期の企画仕様書のみでは実装順序とデータ境界が不足していたため、実装用の責務分離と型定義断片を別文書で補完した

### Open Issues
- 描画ライブラリの最終選定
- リプレイ機能の正式実装範囲
- オンラインランキング通信の要否

## 2026-03-06 — 初期プレイアブル版の実装開始

### Key Instructions
- 実装を開始すること

### Decisions Made
- 初期プレイアブル版は `Vite + TypeScript + HTML5 Canvas` で立ち上げ、依存を最小限にした
- 実装範囲はタイトル、プレイ、ポーズ、ゲームオーバー、ステージクリア、自機操作、敵出現、被弾処理、簡易ボス、HUD までとした
- 画像生成アセット未投入期間はプレースホルダー図形描画を採用し、後続差し替えを前提にした

### Changes from Original Plan
- 当初 plan ではボス多段階フェーズを対象外としていたが、単一フェーズの簡易ボスは初期実装に含めた

### Open Issues
- 実ブラウザ上での操作感と難度の調整
- 保存設定と機体選択の追加時期
- スプライトアセット投入後の描画レイヤー再設計要否

## 2026-03-06 — スプライトシート描画アーキテクチャへの移行

### Key Instructions
- キャラクター描画のアーキテクチャを根本変更すること
- 画像生成を使い、ピクセルデータとしてのキャラクターを生成し、スプライトシートで管理し、実装から参照すること

### Decisions Made
- キャラクター描画は図形直描きではなく、ピクセルデータ原稿をスプライトシートへパックして描画する方式へ変更した
- 自機、敵、ボス、弾、アイテムの描画を `spriteId` ベースへ揃え、実装からピクセル本体を直接参照しない構造にした
- 外部画像生成結果が未投入の間は、同一パイプラインに乗るローカルのピクセル原稿を暫定アセットとして使う方針にした

### Changes from Original Plan
- 直前まで残していたプレースホルダー図形描画を廃止し、初期プレイアブル版の時点でスプライトシート参照へ移行した

### Open Issues
- 外部画像生成で得たピクセルデータをどの形式で取り込むか
- スプライトシートのビルド時生成へ移行するか、起動時生成を維持するか
- アニメーション差分とダメージ差分のフレーム管理方法

## 2026-03-06 — 画像生成プロンプト仕様の作成

### Key Instructions
- キャラ画像を収めた画像のスプライトシートを生成するためのプロンプトを詳細に設計・作成すること
- 画像生成自体はユーザー側で実施し、画像ファイルを納品する前提にすること

### Decisions Made
- 画像生成の歩留まりを優先し、推奨方式を「個別スプライト生成」、補助方式を「少数フレームのシート直接生成」として整理した
- プレイヤー3機、主要敵3種、ボス中核、アイテム、弾について、コピペ可能な英語プロンプトを用意した
- 納品条件、背景色、セルサイズ、ネガティブプロンプト、再生成基準まで文書化した

### Changes from Original Plan
- スプライトシートを一発生成する前提ではなく、個別生成から後段でシート化する方式を強く推奨する構成にした

### Open Issues
- 利用する画像生成モデルごとの最適化差分
- 透過背景を安定して出せない場合の運用細則
- 将来のアニメーションフレーム数の確定

## 2026-03-06 — スプライトシート作成手順書の作成

### Key Instructions
- 個別スプライト生成から後段でシート化するための詳細な手順書を作成すること
- ステップを順に踏めば自動的にスプライトデータが揃うことを条件にすること

### Decisions Made
- 必須資産を先に `sprite-list.csv` で固定し、全作業を `status` 管理で進める手順にした
- `raw`, `candidates`, `approved`, `sheets`, `manifests` に分かれた標準ディレクトリ構成を定義した
- シート画像だけでなく、矩形メタデータと台帳を最終納品物に含める運用を明記した

### Changes from Original Plan
- 画像生成プロンプト仕様書とは別に、生成後の整理、検収、正規化、シート化、メタデータ化までを扱う独立手順書を追加した

### Open Issues
- `sheet-layout.json` の自動生成スクリプトを実装するか
- 背景除去とセル正規化をどこまで自動化するか
- 将来のアニメーション差分を同じ台帳で管理するか

## 2026-03-06 — GPT-image-1.5 スプライト自動化基盤の実装

### Key Instructions
- `GPT-image-1.5` を使ったスプライト画像作成の自動化を一式作成すること
- 生成、検収補助、シート化、メタデータ化まで揃えること

### Decisions Made
- `assets/sprites/manifests/` に `sprite-list.csv`、`prompt-manifest.json`、`review-checklist.md`、`sheet-layout.json` を置く構成にした
- `scripts/generate-sprites.mjs` で OpenAI Image API を呼び、`raw` へ個別 PNG を保存する方式にした
- `scripts/build-review-checklist.mjs` と `scripts/pack-sprite-sheets.mjs` を追加し、検収補助とシート化を分離した
- 依存として `openai` SDK と `pngjs` を追加した

### Changes from Original Plan
- 設計だけでなく、実際に運用できるマニフェスト雛形、CLI スクリプト、npm scripts まで実装した

### Open Issues
- 実APIキーを用いた `GPT-image-1.5` 生成の本番確認
- 背景除去とセル正規化のさらなる自動化
- アニメーション差分を prompt manifest と台帳へどう拡張するか

## 2026-03-06 — APIキー設定の簡略化

### Key Instructions
- APIキーを毎回環境変数で渡さずに済むようにすること

### Decisions Made
- リポジトリ直下の `.env.local` と `.env` を自動読込する方式を採用した
- `.env.example` を追加し、設定場所を固定した
- `.gitignore` に `.env` と `.env.local` を追加し、秘密情報がコミットされないようにした

### Changes from Original Plan
- 当初はシェル環境変数を直接要求していたが、ローカル設定ファイル読み込みへ変更した

### Open Issues
- 複数キーや複数環境を運用する場合の切り替え方法

## 2026-03-06 — APIキー無効時の異常系強化

### Key Instructions
- APIキーが無効だった場合の処理を考慮すること
- その異常系ハンドリングを実装すること

### Decisions Made
- `scripts/generate-sprites.mjs` で `401`, `403`, `429`, `5xx`, 通信失敗を分類するようにした
- `401` と `403` は致命エラーとして即時停止し、`.env.local` や権限確認を促すメッセージを返すようにした
- 一時失敗は指数バックオフ付きで再試行し、失敗内容を `assets/sprites/manifests/generation-errors.json` へ記録するようにした
- `sprite-list.csv` の `status` は画像保存完了後にのみ更新するようにした

### Changes from Original Plan
- 当初は例外メッセージをそのまま表示して終了するだけだったが、失敗分類、再試行、失敗ログ、致命エラー停止を加えた

### Open Issues
- 実際の `401/403/429` を使った本番疎通確認
- 一時ファイルの自動クリーンアップをさらに厳密にするか

## 2026-03-06 — 画像生成進捗ログの標準出力対応

### Key Instructions
- 画像の生成プロセスを逐次的に標準出力へ表示するよう実装すること

### Decisions Made
- `scripts/generate-sprites.mjs` に開始、対象、試行、再試行、保存完了、失敗、完了集計の標準出力ログを追加した
- ログは `[sprites]` プレフィックスで統一し、CLI 実行中に追跡しやすい形にした
- 運用ガイドにもログ出力例を追記した

### Changes from Original Plan
- 例外時のみメッセージを出す構成から、通常進行も逐次見える構成へ変更した

### Open Issues
- 実生成時のログ量が多すぎる場合に詳細度を切り替えるか

## 2026-03-06 — raw 生成画像の一次選別

### Key Instructions
- `assets/sprites/incoming/raw/` に格納された生成画像をもとに作業を続行すること

### Decisions Made
- `player_type_a_idle`, `player_type_b_idle`, `enemy_drone_a`, `boss_stage1_core`, `item_shield` について候補画像を1枚ずつ選定した
- 選定結果は `sprite-list.csv` に `candidate` として反映し、`incoming/candidates/` へ集約した
- 現段階では背景除去とセル正規化が未実施のため、`approved` には進めず `candidate` で止めた

### Changes from Original Plan
- 生成完了後すぐにシート化するのではなく、視認性と背景状態を確認したうえで候補選別段階を明確に挟んだ

### Open Issues
- 残りの必須 `spriteId` の生成完了待ち
- 選定済み候補の背景除去とセル正規化
- `approved` へ進めるための検収基準の適用

## 2026-03-06 — candidate 画像の正規化自動化

### Key Instructions
- 候補選別後の背景除去とセル正規化を続けること

### Decisions Made
- `scripts/normalize-candidates.mjs` を追加し、candidate 画像から背景除去とセル正規化を行うようにした
- 正規化済み画像は `incoming/approved/normalized/`、採用原本は `incoming/approved/` に配置する方式にした
- 選定済み5件を `normalized` 状態まで更新した

### Changes from Original Plan
- 手作業前提ではなく、`pngjs` による自動背景除去と最近傍補間でのセル正規化を導入した

### Open Issues
- 背景除去の閾値が今後の画像群でも十分か
- 残りの必須 `spriteId` を生成後に同じ処理で問題なく通せるか

## 2026-03-06 — 必須スプライトのパック完了

### Key Instructions
- 残っている作業をすべて実行すること
- 候補選別、正規化、シート化、最終確認まで完了させること

### Decisions Made
- `enemy_heavy_a`, `item_shot`, `bullet_enemy_small`, `bullet_enemy_large` の候補画像を選定し、`normalized` まで進めた
- `scripts/pack-sprite-sheets.mjs` は固定カテゴリ名ではなく、カテゴリ名とセルサイズからシート名を組み立てる方式へ変更した
- その結果、`item` と `bullet` のセルサイズ混在によるパック失敗を解消し、全必須 `spriteId` を `packed` に到達させた
- `sheet-layout.json` と各 PNG シートを再生成し、`npm run build` で最終確認した

### Changes from Original Plan
- 当初は `item` と `bullet` を同一シートへまとめる前提だったが、セルサイズ混在で成立しないため、カテゴリとセルサイズ単位で分割する方式へ変更した

### Open Issues
- 旧命名規則で生成された未使用シートが `assets/sprites/sheets/` に残っている

## 2026-03-06 — ゲーム実装へのスプライトシート反映

### Key Instructions
- 生成済みスプライトシートをゲーム実装へ反映すること
- コード内ピクセル定義ではなく、PNG シートと `sheet-layout.json` を参照すること

### Decisions Made
- `src/rendering/spriteAssets.ts` を追加し、`import.meta.glob` で `sheet-layout.json` と必要 PNG シートをロードするようにした
- `src/rendering/sprites.ts` はコード内でシートを組み立てる実装をやめ、外部シート画像を切り出して描画する実装へ変更した
- `Game` は `SpriteSheet` を受け取る形に変更し、ゲーム内 `spriteId` を台帳上の ID に合わせた
- 起動処理はスプライト読込完了後に開始し、失敗時は画面上へ通知するようにした
- 不要になった `src/data/pixelSprites.ts` を削除した

### Changes from Original Plan
- None

### Open Issues
- 自機表示はまだ `player_type_a_idle` 固定であり、自機選択と描画差し替えは未対応

## 2026-03-06 — スプライト表示倍率と境界処理の調整

### Key Instructions
- スクリーンサイズに対してキャラが小さいため、表示サイズを 2 倍に拡大すること
- 当たり判定やキャラサイズに応じた境界チェックも適切に合わせること

### Decisions Made
- `SPRITE_SCALE_MULTIPLIER = 2` を導入し、プレイヤー、敵、弾、アイテムの描画倍率を一括で引き上げた
- `SpriteSheet` にフレーム参照 API を追加し、`Game` がスプライト寸法から半幅と半高を計算できるようにした
- プレイヤーの移動クランプ、アイテム取得距離、画面外除去境界をスプライト実寸ベースで計算するようにした
- 既存の当たり判定半径は表示倍率と同じ 2 倍で拡大した
- `npm run build` でビルド確認した

### Changes from Original Plan
- None

### Open Issues
- ブラウザでの手動プレイ確認は未実施

## 2026-03-06 — plan 系ドキュメントの連番化

### Key Instructions
- `docs/plans/` 配下の `plan` 系ファイル名からタイムスタンプを外すこと
- 時系列順の連番へ変更すること

### Decisions Made
- `docs/plans/` の計画書は `plan-001-...` から `plan-007-...` までの 3 桁ゼロ埋め連番へ統一した
- 旧タイムスタンプ付きファイル6本と旧 `plan.md` をすべて連番側へ移行し、固定名ファイルは残さない構成にした
- 旧ファイル名参照と `docs/plans/plan.md` 参照が残っていないことを検索で確認した

### Changes from Original Plan
- None

### Open Issues
- None
