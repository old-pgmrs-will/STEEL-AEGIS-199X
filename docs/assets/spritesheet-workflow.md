# スプライトシート作成手順書

## 1. 文書目的

本書は、`個別スプライト生成 -> 後段でシート化` の運用を、作業者が順番に実施するだけで漏れなくスプライトデータを揃えられるようにするための実務手順書です。  
対象は、画像生成担当者、アセット整理担当者、実装投入担当者です。

## 2. ゴール

本手順を完了した時点で、最低限以下が揃っていることを完了条件とします。

- 必須スプライトがすべて生成済み
- 全ファイルが `spriteId` と対応付け済み
- すべての画像が検収済み
- セルサイズが確定済み
- スプライトシート画像が完成済み
- スプライトメタデータが完成済み
- 実装側が `spriteId` で参照可能な状態になっている

## 3. 前提

### 3.1 参照ドキュメント

- [asset-prompt-spec.md](../assets/asset-prompt-spec.md)
- [spec.md](../specs/spec.md)
- [implementation-spec.md](../specs/implementation-spec.md)

### 3.2 対象アセット

初期対象は以下です。

- 自機
- 小型敵
- 中型敵
- ボス中核
- アイテム
- 弾

### 3.3 基本原則

- 1ファイル1スプライトを原則とする
- 背景は透過、または完全単色クロマキーに限定する
- ファイル名は `spriteId` と一致させる
- シート化前に必ず検収する
- 未検収画像をスプライトシートへ混ぜない

## 4. 標準ディレクトリ構成

以下の構成を必須とします。

```text
assets/
  sprites/
    incoming/
      raw/
      candidates/
      approved/
    sheets/
    manifests/
    archive/
```

### 4.1 役割

- `incoming/raw/`: 画像生成直後の未整理データ
- `incoming/candidates/`: 候補として残した画像
- `incoming/approved/`: 検収を通過した最終採用画像
- `sheets/`: 完成スプライトシート
- `manifests/`: 台帳、矩形情報、採用リスト
- `archive/`: 不採用や旧版の保管

## 5. 必須管理ファイル

本手順では、次の3ファイルを必須にします。

### 5.1 `assets/sprites/manifests/sprite-list.csv`

用途:
全 `spriteId` の要求一覧です。  
このファイルが埋まっていない状態では生成を開始しません。

必須列:

- `sprite_id`
- `category`
- `variant`
- `cell_width`
- `cell_height`
- `required`
- `status`
- `source_file`
- `sheet_name`
- `frame_x`
- `frame_y`

### 5.2 `assets/sprites/manifests/review-checklist.md`

用途:
検収基準のチェック記録です。

### 5.3 `assets/sprites/manifests/sheet-layout.json`

用途:
完成シートの矩形メタデータです。  
実装側は最終的にこの情報を参照します。

## 6. 初期 spriteId 一覧

初期プレイアブル版では、最低限以下を作成対象とします。

| sprite_id             | category     | variant     | cell  |
| --------------------- | ------------ | ----------- | ----- |
| `player_type_a_idle`  | player       | idle        | 32x32 |
| `player_type_b_idle`  | player       | idle        | 32x32 |
| `player_type_c_idle`  | player       | idle        | 32x32 |
| `enemy_drone_a`       | enemy_small  | base        | 32x32 |
| `enemy_zigzag_a`      | enemy_small  | base        | 32x32 |
| `enemy_heavy_a`       | enemy_medium | base        | 40x40 |
| `boss_stage1_core`    | boss         | core        | 96x64 |
| `item_shot`           | item         | shot        | 16x16 |
| `item_shield`         | item         | shield      | 16x16 |
| `item_bomb`           | item         | bomb        | 16x16 |
| `bullet_player_small` | bullet       | player      | 8x12  |
| `bullet_enemy_small`  | bullet       | enemy_small | 8x8   |
| `bullet_enemy_large`  | bullet       | enemy_large | 10x10 |

## 7. 作業全体フロー

1. `sprite-list.csv` を作る
2. 各 `spriteId` の生成プロンプトを確定する
3. 個別画像を生成する
4. `raw` へ保存する
5. 候補選別して `candidates` へ移す
6. 検収して `approved` へ移す
7. 画像をセルサイズへ正規化する
8. シート配置順を確定する
9. スプライトシートを作る
10. `sheet-layout.json` を作る
11. 実装参照用の最終一覧を更新する

## 8. ステップ詳細

## 8.1 ステップ1: 台帳を作成する

### 作業

- `sprite-list.csv` に全 `spriteId` を書き出す
- すべての `required` を `yes` または `no` で埋める
- 必須対象は `status = planned` で開始する

### 条件

- 台帳に無い `spriteId` は生成しない
- 台帳にある必須項目は、最終的に全件 `packed` になるまで完了扱いにしない

### テンプレート

```csv
sprite_id,category,variant,cell_width,cell_height,required,status,source_file,sheet_name,frame_x,frame_y
player_type_a_idle,player,idle,32,32,yes,planned,,,,
player_type_b_idle,player,idle,32,32,yes,planned,,,,
player_type_c_idle,player,idle,32,32,yes,planned,,,,
enemy_drone_a,enemy_small,base,32,32,yes,planned,,,,
enemy_zigzag_a,enemy_small,base,32,32,yes,planned,,,,
enemy_heavy_a,enemy_medium,base,40,40,yes,planned,,,,
boss_stage1_core,boss,core,96,64,yes,planned,,,,
item_shot,item,shot,16,16,yes,planned,,,,
item_shield,item,shield,16,16,yes,planned,,,,
item_bomb,item,bomb,16,16,yes,planned,,,,
bullet_player_small,bullet,player,8,12,yes,planned,,,,
bullet_enemy_small,bullet,enemy_small,8,8,yes,planned,,,,
bullet_enemy_large,bullet,enemy_large,10,10,yes,planned,,,,
```

## 8.2 ステップ2: プロンプトを確定する

### 作業

- [asset-prompt-spec.md](../assets/asset-prompt-spec.md) から対象アセットのプロンプトを選ぶ
- 生成モデルごとの差分が必要なら、台帳とは別に `prompt-notes.md` を作る

### 必須記録項目

- 使用したプロンプト本文
- ネガティブプロンプト
- モデル名
- seed
- 生成枚数

### 完了条件

- 全必須 `spriteId` にプロンプトが紐付いている

## 8.3 ステップ3: 個別画像を生成する

### 作業

- 1回の生成では1 `spriteId` のみ扱う
- 1 `spriteId` につき最低 4 枚、推奨 8 枚の候補を出す
- 出力ファイルはすべて `incoming/raw/` に保存する

### ファイル命名ルール

```text
[sprite_id]__v[連番].png
```

例:

```text
player_type_a_idle__v01.png
player_type_a_idle__v02.png
enemy_drone_a__v01.png
boss_stage1_core__v01.png
```

### 完了条件

- 必須 `spriteId` すべてに raw 候補が存在する

## 8.4 ステップ4: 候補選別を行う

### 作業

- 各 `spriteId` ごとに raw 候補から 1 から 3 枚に絞る
- 残した画像のみ `incoming/candidates/` へ移す
- 不採用 raw は削除せず `archive/` へ移してよい

### 選別基準

- 前方方向が分かる
- 輪郭が潰れていない
- 背景が透過または完全単色
- 機体サイズがセル想定に合う
- 同カテゴリ内で視点が揃っている

### 台帳更新

- 候補が残った `spriteId` は `status = candidate`

## 8.5 ステップ5: 検収を行う

### 作業

- `review-checklist.md` を使って1画像ずつ検収する
- 通過画像だけを `incoming/approved/` へ移す
- 採用画像は `source_file` に確定ファイル名を記録する

### 検収チェック項目

- 文字が入っていない
- 背景色が汚れていない
- エッジがぼけていない
- 余白が確保されている
- パレットが暴れていない
- 過剰なグローや影がない
- 同カテゴリ内でサイズ感が揃っている

### `review-checklist.md` テンプレート

```md
# Review Checklist

## player_type_a_idle

- [ ] 前方方向が明確
- [ ] 背景が透過または完全単色
- [ ] 文字や記号の混入なし
- [ ] 輪郭がぼけていない
- [ ] 余白あり
- [ ] セル内に収まる
- [ ] 採用

## enemy_drone_a

- [ ] 前方方向が明確
- [ ] 背景が透過または完全単色
- [ ] 文字や記号の混入なし
- [ ] 輪郭がぼけていない
- [ ] 余白あり
- [ ] セル内に収まる
- [ ] 採用
```

### 台帳更新

- 採用済みの `spriteId` は `status = approved`

## 8.6 ステップ6: セルサイズへ正規化する

### 作業

- approved 画像を、台帳の `cell_width` と `cell_height` に合わせて揃える
- 背景除去、余白調整、位置補正を行う
- キャラの基準位置をセル中央へ揃える

### ルール

- 画像の縦横比は極力維持する
- 無理な拡大補間を避ける
- ぼかし補間を使わない
- 外周に最低 1 から 2px の余白を残す

### 出力先

- `incoming/approved/normalized/` を使ってよい

### 台帳更新

- 正規化完了後は `status = normalized`

## 8.7 ステップ7: シート配置順を確定する

### 作業

- 同じカテゴリを同じシートへまとめる
- セルサイズが大きく異なるものは別シートに分ける

### 推奨シート構成

| sheet_name              | 内容         |
| ----------------------- | ------------ |
| `player-ships.png`      | 自機3種      |
| `enemy-small.png`       | 小型敵       |
| `enemy-medium.png`      | 中型敵       |
| `boss-parts.png`        | ボス部位     |
| `items-and-bullets.png` | アイテムと弾 |

### 配置順ルール

- 左上から右へ
- 行終端後に次の行へ
- シート内順序は `sprite-list.csv` と一致させる

### 台帳更新

- `sheet_name` を埋める

## 8.8 ステップ8: スプライトシートを作る

### 作業

- 正規化済み画像を、確定した順番で並べる
- セル間隔は 0 または 1px のどちらかに固定する
- 実装が単純になるよう、当面は `0px` 間隔を推奨する

### シート作成ルール

- シートごとに背景は完全透過
- 同シート内のセルサイズは統一
- 1シート内で異なるセルサイズを混在させない
- 端数サイズを作らない

### 出力先

- `assets/sprites/sheets/[sheet_name]`

### 台帳更新

- シート化した `spriteId` は `status = packed`
- `frame_x`, `frame_y` を記録する

## 8.9 ステップ9: メタデータを作る

### 作業

- `sheet-layout.json` を作る
- 各 `spriteId` のシート名と矩形情報を記録する

### 形式

```json
{
  "player_type_a_idle": {
    "sheet": "player-ships.png",
    "x": 0,
    "y": 0,
    "width": 32,
    "height": 32
  },
  "enemy_drone_a": {
    "sheet": "enemy-small.png",
    "x": 0,
    "y": 0,
    "width": 32,
    "height": 32
  }
}
```

### 完了条件

- 全 `packed` レコードに矩形情報がある

## 8.10 ステップ10: 最終整合確認を行う

### チェック内容

- `required = yes` のレコードがすべて `packed`
- `source_file` が空欄でない
- `sheet_name` が空欄でない
- `frame_x`, `frame_y` が空欄でない
- シート画像とメタデータの件数が一致する

### 完了判定式

以下を満たしたら完了です。

```text
必須件数 = packed件数
```

## 9. 状態遷移ルール

台帳の `status` は次の順番以外を禁止します。

```text
planned -> generated -> candidate -> approved -> normalized -> packed
```

### 更新タイミング

- raw が出たら `generated`
- 候補選別後は `candidate`
- 採用決定後は `approved`
- セル正規化後は `normalized`
- シート化とメタデータ記録後は `packed`

## 10. 作業漏れを防ぐための運用ルール

### 10.1 1アセット単位で完了させない

- 個々の画像が良くても、台帳上で `packed` になるまで完了扱いにしない

### 10.2 シート化前に必ず全必須項目を確認する

- シート化を先走ると、後から順序が崩れやすいためです

### 10.3 `spriteId` を変更しない

- 命名変更は台帳、シート、メタデータ、実装参照の全部に影響するため、開始後は固定します

## 11. 失敗しやすいポイントと対策

### 11.1 背景色が揺れる

- 背景を完全単色へ固定して再生成する

### 11.2 同カテゴリでサイズ感が揺れる

- 比較用に同カテゴリの基準画像を常時横に置いて選別する

### 11.3 ボスだけ視点が違う

- ボス専用でも共通の視点文言をプロンプトから外さない

### 11.4 ぼやけたピクセルになる

- 生成時に `hard edge pixels`, `no antialiasing` を強める
- 後処理時にぼかし補間を使わない

## 12. 実装投入時の最終納品物

最終的に実装側へ渡すものは次の3点です。

1. `assets/sprites/sheets/*.png`
2. `assets/sprites/manifests/sheet-layout.json`
3. `assets/sprites/manifests/sprite-list.csv`

## 13. この手順で自動的に揃う理由

本手順では、最初に `sprite-list.csv` で必須資産を固定し、その後の全作業がその台帳の `status` 更新に紐付いています。  
そのため、作業者は「未完了の `spriteId` を上から埋める」だけで進行でき、最後に `required = yes` が全件 `packed` であることを確認すれば、スプライトデータの不足が自動的に検出できます。

## 14. 次の拡張

今後は以下を追加できます。

- アニメーション差分用の複数フレーム管理
- ダメージ差分
- ボス部位ごとのシート分割ルール
- `sheet-layout.json` を自動生成する補助スクリプト
