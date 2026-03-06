# 画像生成プロンプト仕様書

## 1. 文書目的

本書は、縦スクロールシューティングゲーム `STEEL AEGIS 199X` のキャラクター画像を、画像生成で制作し、最終的にスプライトシートとして実装へ投入するための発注用プロンプト仕様書です。  
画像生成担当者が、そのまま生成作業へ着手できることを目的とします。

## 2. 基本方針

### 2.1 推奨方式

- 推奨は「1画像 = 1スプライト」または「1画像 = 1キャラクターの少数フレーム」です
- 生成後にこちらで切り出し、スプライトシートへパックします
- 画像生成モデルに、最終完成形のスプライトシート全体を一発で作らせる方法は非推奨です

### 2.2 非推奨方式

- 多数キャラを1枚に詰めた巨大シートを一発生成すること
- 背景込み、エフェクト込み、文字込みで生成すること
- 斜め角度や視点がフレームごとに変わること
- アンチエイリアスやぼかしが強いこと

### 2.3 理由

1. セル境界の崩れ、構図ズレ、スケール不一致が起きやすいためです
2. 実装では `spriteId` 単位で切り出して使うため、個別生成の方が管理しやすいためです
3. 後から差分追加、再生成、差し替えをしやすくするためです

## 3. 共通アート要件

### 3.1 世界観

- 1990年代アーケード縦スクロールシューティング
- 軍用SFメカ
- 記号性の強いシルエット
- 高密度だが読みやすい情報設計

### 3.2 視点

- 真上視点ではなく、上から見下ろした軽い前方傾斜
- プレイヤー機と敵機で視点を揃える
- 左右非対称があっても、前方方向が一目で分かること

### 3.3 ピクセル表現

- 明確なピクセルアート
- ハードエッジ
- 限定パレット
- 輪郭が潰れない
- 縮小後も判読可能

### 3.4 背景条件

- 理想は透過背景
- 透過に弱い生成系では、単色のクロマキー背景を使います
- 推奨背景色は `#FF00FF` または `#00FF00` のどちらか1色固定です
- 背景には影、床、煙、光、グラデーションを入れないでください

## 4. 共通生成ルール

### 4.1 構図ルール

- 被写体は必ず1体のみ
- 画面中央配置
- 全体がフレーム内に収まる
- 外周に最低 2px 相当の余白を確保する
- 武器、翼、尾部、噴射口が途中で切れない

### 4.2 品質ルール

- no text
- no logo
- no watermark
- no UI
- no background scene
- no glow bloom that bleeds outside silhouette
- no motion blur
- no antialiasing
- no painterly texture

### 4.3 一貫性ルール

- 同一カテゴリは同じパレット傾向で生成する
- 同一カテゴリは同じ視点で生成する
- 同一カテゴリは同程度の描き込み密度に揃える
- シリーズ生成時は可能であれば seed を固定または近似させる

## 5. 納品仕様

### 5.1 推奨納品単位

- `PNG`
- 1キャラクターごとに1ファイル
- または1キャラクターごとに少数フレームを整列させた1ファイル

### 5.2 推奨ファイル命名

- `player_type_a_idle.png`
- `player_type_b_idle.png`
- `player_type_c_idle.png`
- `enemy_drone_a.png`
- `enemy_zigzag_a.png`
- `enemy_heavy_a.png`
- `boss_stage1_core.png`

### 5.3 推奨解像度

| 用途 | 推奨セルサイズ | 備考 |
| --- | --- | --- |
| プレイヤー機 | 32x32 | 実装では 2x から 3x 拡大を想定 |
| 小型敵 | 32x32 | 余白込みで管理 |
| 中型敵 | 40x40 | 重装感を出す |
| ボス部位 | 96x64 または 128x96 | 分割前提 |
| アイテム | 16x16 | 輪郭重視 |
| 小弾 | 8x12 | 縦長 |
| 大弾 | 10x10 または 12x12 | 読みやすさ優先 |

## 6. 共有ベースプロンプト

### 6.1 ベースプロンプト

以下を全アセットの共通土台として使います。

```text
pixel art sprite for a 1990s arcade vertical shoot'em up, military sci-fi mechanical design, top-down with slight front tilt, crisp silhouette, readable shape, hard edge pixels, limited palette, hand-crafted retro arcade sprite look, centered subject, full body visible, no background, transparent background or solid chroma key background, no text, no logo, no watermark, no UI, no motion blur, no antialiasing, no painterly shading, no photorealism
```

### 6.2 共通ネガティブプロンプト

```text
photorealistic, 3d render, smooth shading, blurry, anti-aliased, painterly, watercolor, soft edges, background scene, landscape, cockpit interior, pilot portrait, humanoid face, text, letters, numbers, logo, watermark, cropped, cut off wings, multiple subjects, explosion, smoke cloud, bloom overflow, lens flare
```

## 7. 生成方式A: 個別スプライト生成

### 7.1 推奨手順

1. まず各キャラクターの `idle / neutral` を1枚ずつ生成します
2. 形状が確定したら、必要な差分だけ追加生成します
3. 差分は `bank left`, `bank right`, `damaged`, `boost`, `weapon open` など最小限に絞ります

### 7.2 個別生成テンプレート

```text
[共通ベースプロンプト],
[被写体固有の説明],
single sprite only,
centered composition,
pixel perfect silhouette,
designed to remain readable at [セルサイズ],
empty margin around the subject,
retro arcade shooter asset
```

## 8. 生成方式B: スプライトシート直接生成

### 8.1 使用条件

- 生成モデルがグリッド整列に比較的強い場合のみ使います
- フレーム数は 2 から 5 程度に抑えます

### 8.2 シート生成テンプレート

```text
pixel art sprite sheet for a 1990s arcade vertical shoot'em up, [被写体固有の説明], fixed grid layout, [列数] columns and [行数] rows, each cell exactly [セルサイズ], centered sprite in every cell, same camera angle in every cell, same palette in every cell, no overlapping between cells, solid chroma key background, no text, no labels, no effects outside cell borders, hard edge pixels, no antialiasing
```

### 8.3 シート生成時の注意

- 各セルに別個体を入れない
- セルごとに大きさを変えすぎない
- 余白なしで端まで描かない
- 背景色は全セルで完全一致させる

## 9. 必須アセットの発注プロンプト

## 9.1 プレイヤー機 Type-A `Valk Lance`

### 用途

- 現在の初期プレイアブル版の主役機候補

### 推奨サイズ

- 32x32

### 個別生成プロンプト

```text
pixel art sprite for a 1990s arcade vertical shoot'em up, military sci-fi player starfighter, top-down with slight front tilt, sleek spearhead silhouette, narrow nose, twin side wings, central cockpit canopy, forward guns clearly visible, bright cyan and white main colors with deep navy shadows, crisp silhouette, readable at 32x32, single sprite only, centered, empty margin around the subject, transparent background or solid magenta chroma key background, hard edge pixels, no antialiasing, no text, no logo, no watermark
```

### 差分用シート生成プロンプト

```text
pixel art sprite sheet for a 1990s arcade vertical shoot'em up, military sci-fi player starfighter with sleek spearhead silhouette, cyan and white body, top-down with slight front tilt, 5 columns and 1 row, each cell exactly 32x32, frames are neutral, bank left, hard bank left, bank right, hard bank right, centered sprite in every cell, same palette and same camera angle, solid magenta background, no text, no labels, no effects outside cell borders, hard edge pixels, no antialiasing
```

## 9.2 プレイヤー機 Type-B `Iris Gail`

### 推奨サイズ

- 32x32

### 個別生成プロンプト

```text
pixel art sprite for a 1990s arcade vertical shoot'em up, high mobility player starfighter, top-down with slight front tilt, swept wings, agile lightweight frame, split tail fins, missile pods under wings, emerald green and white body with dark steel shadows, readable at 32x32, single sprite only, centered, empty margin, transparent background or solid magenta background, hard edge pixels, no antialiasing, no text, no logo, no watermark
```

## 9.3 プレイヤー機 Type-C `Bulwark Note`

### 推奨サイズ

- 32x32

### 個別生成プロンプト

```text
pixel art sprite for a 1990s arcade vertical shoot'em up, heavy armored player gunship, top-down with slight front tilt, broad body, thick frontal armor, side-mounted support pods, visible rear thrusters, deep red and steel gray body with pale highlights, readable at 32x32, single sprite only, centered, empty margin, transparent background or solid magenta background, hard edge pixels, no antialiasing, no text, no logo, no watermark
```

## 9.4 小型敵 `enemy_drone`

### 推奨サイズ

- 32x32

### 個別生成プロンプト

```text
pixel art sprite for a 1990s arcade vertical shoot'em up, small hostile attack drone, top-down with slight front tilt, sharp triangular hull, simple readable enemy silhouette, twin side blades, front cannon, orange and ivory body with dark rust shadows, readable at 32x32, single sprite only, centered, empty margin, transparent background or solid magenta background, hard edge pixels, no antialiasing, no text, no logo, no watermark
```

## 9.5 変則小型敵 `enemy_zigzag`

### 推奨サイズ

- 32x32

### 個別生成プロンプト

```text
pixel art sprite for a 1990s arcade vertical shoot'em up, agile hostile zigzag fighter, top-down with slight front tilt, crooked swept silhouette, asymmetrical winglets, fast attack drone design, orange and sand body with dark brown shadows, readable at 32x32, single sprite only, centered, empty margin, transparent background or solid magenta background, hard edge pixels, no antialiasing, no text, no logo, no watermark
```

## 9.6 中型敵 `enemy_heavy`

### 推奨サイズ

- 40x40

### 個別生成プロンプト

```text
pixel art sprite for a 1990s arcade vertical shoot'em up, medium armored enemy gunship, top-down with slight front tilt, heavy central hull, side armor blocks, visible weapon ports, intimidating but readable silhouette, red-orange and dark iron body, readable at 40x40, single sprite only, centered, empty margin, transparent background or solid magenta background, hard edge pixels, no antialiasing, no text, no logo, no watermark
```

## 9.7 ボス中核 `boss_core`

### 推奨サイズ

- 96x64

### 個別生成プロンプト

```text
pixel art sprite for a 1990s arcade vertical shoot'em up, stage boss core module, top-down with slight front tilt, massive fortress-mecha centerpiece, wide armored body, central vulnerable core, layered weapon housings, ceremonial military sci-fi design, dark crimson, rose red, pale core highlights, readable at 96x64, single sprite only, centered, empty margin, transparent background or solid magenta background, hard edge pixels, no antialiasing, no text, no logo, no watermark
```

### 部位分解用追加指示

- 可能なら `left wing battery`, `right wing battery`, `center core`, `top cannon` を別画像でも生成してください
- 部位ごとに同じパレットと同じ視点を維持してください

## 10. 補助アセットの発注プロンプト

## 10.1 ショット強化アイテム

```text
pixel art sprite for a retro arcade shooter item icon, compact energy capsule, top-down, gold and cream colors, readable at 16x16, single sprite only, centered, transparent background or solid magenta background, hard edge pixels, no antialiasing, no text, no logo
```

## 10.2 シールド回復アイテム

```text
pixel art sprite for a retro arcade shooter item icon, compact shield recharge core, top-down, mint green and pale cyan colors, readable at 16x16, single sprite only, centered, transparent background or solid magenta background, hard edge pixels, no antialiasing, no text, no logo
```

## 10.3 ボム補給アイテム

```text
pixel art sprite for a retro arcade shooter item icon, compact bomb stock core, top-down, violet and pale white colors, readable at 16x16, single sprite only, centered, transparent background or solid magenta background, hard edge pixels, no antialiasing, no text, no logo
```

## 10.4 自機弾

```text
pixel art sprite for a retro arcade shooter player bullet, narrow vertical energy bolt, cyan and white core, readable at 8x12, centered, transparent background or solid magenta background, hard edge pixels, no antialiasing, no text, no logo
```

## 10.5 敵小弾

```text
pixel art sprite for a retro arcade shooter enemy bullet, compact hostile energy pellet, pink-red with pale center, readable at 8x8, centered, transparent background or solid magenta background, hard edge pixels, no antialiasing, no text, no logo
```

## 10.6 敵大弾

```text
pixel art sprite for a retro arcade shooter enemy bullet, larger hostile plasma orb, orange with bright core, readable at 10x10, centered, transparent background or solid magenta background, hard edge pixels, no antialiasing, no text, no logo
```

## 11. 直接コピペ用の発注セット

## 11.1 発注テンプレート

以下を画像生成担当者への依頼文としてそのまま使えます。

```text
Create pixel art sprites for a 1990s arcade vertical shoot'em up.
Use a top-down view with a slight front tilt.
All sprites must have crisp silhouettes, hard edge pixels, limited palettes, and remain readable after downscaling.
No text, no logo, no watermark, no background scene, no motion blur, no antialiasing, no painterly look.
Prefer transparent background. If transparency is unstable, use a flat solid magenta background (#FF00FF).
Keep one subject per image, centered, with empty margin around it.
Deliver PNG files for each sprite separately.

Required assets:
1. Player ship Type-A, 32x32
2. Player ship Type-B, 32x32
3. Player ship Type-C, 32x32
4. Small enemy drone, 32x32
5. Zigzag enemy fighter, 32x32
6. Heavy enemy gunship, 40x40
7. Boss core module, 96x64
8. Shot power item, 16x16
9. Shield item, 16x16
10. Bomb item, 16x16
11. Player bullet, 8x12
12. Enemy small bullet, 8x8
13. Enemy large bullet, 10x10
```

## 11.2 各カテゴリ共通ネガティブ

```text
photorealistic, 3d render, blur, bloom, soft edges, anti-aliased, painterly, watercolor, background scene, landscape, pilot portrait, humanoid character, text, logo, watermark, multiple subjects, cropped wings, cut off body, oversized glow, smoke, explosion, perspective drift
```

## 12. スプライトシート化の前提ルール

### 12.1 こちらで切り出しやすい画像の条件

- 背景色が完全単色
- 被写体が中央
- 外周に余白がある
- 被写体外のノイズがない
- 影や発光がセル外へ大きくはみ出さない

### 12.2 再生成判断基準

以下のいずれかがあれば再生成対象です。

- 視点が横向きに寄りすぎている
- ピクセルがぼやけている
- 機首方向が分からない
- 背景色が完全単色ではない
- 同カテゴリ内でサイズ感が大きくズレている
- 文字や記号が混入している

## 13. 将来拡張用プロンプト指針

### 13.1 アニメーション差分

- `neutral`
- `bank_left`
- `bank_right`
- `boost`
- `damaged`
- `weapon_open`

### 13.2 ボス部位差分

- `core_normal`
- `core_damaged`
- `wing_left`
- `wing_right`
- `turret_top`
- `turret_side`

### 13.3 エフェクト差分

- muzzle flash
- small explosion
- medium explosion
- engine exhaust
- shield hit spark

## 14. まとめ

本案件では、画像生成結果をそのまま完成スプライトシートとして使うのではなく、個別または少数フレーム単位で安定生成し、後からスプライトシートへ統合する方が成功率が高いです。  
したがって、発注時は「単体スプライトの品質と一貫性」を最優先し、背景、構図、視点、パレット、余白のルールを厳格に固定してください。
