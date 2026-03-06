# 縦スクロールシューティングゲーム実装詳細仕様書

## 1. 文書目的

本書は [spec.md](../specs/spec.md) を実装可能な粒度へ展開した詳細仕様書です。  
企画仕様で定めたゲーム内容を、ブラウザ実装、データ設計、アセット運用、テスト、性能管理まで落とし込み、開発者がそのままタスク化できる状態を目標とします。

## 2. 適用範囲

### 2.1 対象

- ランタイム構成
- 推奨ディレクトリ構成
- ゲームループ
- シーン遷移
- プレイヤー、敵、弾、アイテム、ボスのデータモデル
- ステージ進行スクリプト
- UI/HUD 実装方針
- アセット読み込みと画像生成後加工の接続
- セーブ、設定、ハイスコア保存
- 性能基準とテスト観点

### 2.2 非対象

- 実際のソースコード
- 画像生成サービス個別の契約条件
- バックエンドサーバー実装
- オンラインランキングの通信仕様詳細

## 3. 前提技術方針

### 3.1 推奨技術スタック

- 言語: `TypeScript`
- ビルド: `Vite`
- 描画: 初期フェーズは `HTML5 Canvas`、拡張フェーズでは `PixiJS` または同等の WebGL 対応 2D 描画ライブラリを検討
- 音声: `Web Audio API`
- 設定保存: `localStorage`
- スプライト自動化: `openai` SDK と `pngjs`

### 3.2 採用理由

1. スプライト数、弾数、エフェクト数が多く、Canvas 単独より描画負荷管理をしやすい
2. TypeScript により、敵定義、弾定義、ステージ定義の整合性を維持しやすい
3. ブラウザ配布前提であり、追加のネイティブ依存を避けられる

### 3.3 初期実装フェーズ方針

- リポジトリ初期状態では依存を増やしすぎず、`Canvas` でプレイアブル版を先に成立させる
- 描画層は `Renderer` 境界で閉じ、後続で `PixiJS` へ移行できるようにする
- キャラクター見た目は、`assets/sprites/sheets/` に配置した生成済みスプライトシートを利用する

### 3.4 実装前提の技術判断

- 描画ライブラリは差し替え可能だが、ゲームロジックは描画 API に直接依存させない
- ゲーム進行は固定時間ステップで更新し、描画のみ可変フレームに追従させる
- 当たり判定、敵出現、スコア計算は純粋なゲーム状態として管理し、UI 表示と分離する

## 4. 推奨ディレクトリ構成

```text
src/
  core/
    app/
    loop/
    scene/
    state/
    storage/
  gameplay/
    player/
    enemy/
    bullet/
    item/
    boss/
    stage/
    score/
    collision/
  rendering/
    sprites/
    effects/
    ui/
    audio/
  data/
    ships/
    weapons/
    enemies/
    bosses/
    stages/
    ui/
  assets/
    sprites/
    backgrounds/
    ui/
    audio/
```

### 4.1 責務分離

- `core/`: アプリ初期化、ゲームループ、シーン遷移、永続化
- `gameplay/`: ルール、状態更新、当たり判定、スコア計算
- `rendering/`: 画面表示、スプライトシート参照、アニメーション、エフェクト、音声再生
- `data/`: JSON または TypeScript 定義による調整値とステージ記述
- `assets/`: 画像生成後に整形済みの最終アセット

### 4.3 スプライトデータ構成

- `rendering/`: スプライトシート読込、矩形メタデータ管理、描画 API
- `assets/sprites/`: 外部画像生成後に確定した PNG スプライトシートとメタデータの配置先
- `assets/sprites/manifests/sheet-layout.json`: 実行時に参照する矩形メタデータ
- `src/rendering/spriteAssets.ts`: Vite の `import.meta.glob` で必要シートを解決し、画像読込を完了させる
- `src/rendering/sprites.ts`: 読込済みシート画像とレイアウトから `SpriteSheet` を構築する
- `src/main.ts`: スプライトアセット読込完了後に `Game` を生成する
- `Game` は `SpriteSheet` からフレーム寸法を参照し、描画倍率と境界計算に利用する

### 4.4 自動化パイプライン構成

- `assets/sprites/manifests/sprite-list.csv`: 要求資産台帳
- `assets/sprites/manifests/prompt-manifest.json`: `spriteId` ごとの生成条件
- `scripts/generate-sprites.mjs`: OpenAI Image API 呼び出し
- `scripts/build-review-checklist.mjs`: 検収チェックリスト生成
- `scripts/normalize-candidates.mjs`: candidate 画像の背景除去とセル正規化
- `scripts/pack-sprite-sheets.mjs`: approved 画像からカテゴリとセルサイズ単位のシートとメタデータを生成
- `assets/sprites/manifests/sheet-layout.json`: 実装参照用の矩形情報
- `assets/sprites/manifests/generation-errors.json`: 生成失敗ログ

### 4.2 依存方向

- `core` -> `gameplay`
- `core` -> `rendering`
- `gameplay` -> `data`
- `rendering` -> `assets`
- `rendering` は `gameplay` の読み取りのみを行い、状態更新はしない

## 5. ランタイム構成

### 5.1 初期化順序

1. `App` が描画コンテキストを初期化する
2. 設定保存領域を読み込む
3. `sheet-layout.json` と必須 PNG シートをプリロードする
4. 読込済みスプライトアセットを `Game` へ渡す
5. `TitleScene` を開始する
6. シーン遷移要求に応じて `SceneManager` が切り替える

### 5.2 ゲームループ

- 更新周期: `1/60 sec`
- 描画周期: `requestAnimationFrame`
- 固定更新で積み残しが発生した場合、1フレームあたり最大4回まで追従し、それ以上はフレームスキップ扱いとする

### 5.3 1フレーム更新順

1. 入力状態反映
2. システムポーズ確認
3. プレイヤー更新
4. 敵出現イベント処理
5. 敵更新
6. 弾更新
7. アイテム更新
8. 当たり判定
9. スコア、コンボ、内部ランク更新
10. 消滅予約エンティティの回収
11. UI 用の読み取り専用スナップショット生成
12. 描画

## 6. シーン仕様

### 6.1 シーン一覧

| シーン            | 役割                 | 遷移先                                              |
| ----------------- | -------------------- | --------------------------------------------------- |
| `BootScene`       | 初期化とロード       | `TitleScene`                                        |
| `TitleScene`      | タイトル、開始、設定 | `ShipSelectScene`, `OptionsScene`                   |
| `ShipSelectScene` | 自機選択             | `StageIntroScene`                                   |
| `StageIntroScene` | ステージ導入演出     | `GameScene`                                         |
| `GameScene`       | 通常プレイ           | `PauseScene`, `ResultScene`, `GameOverScene`        |
| `PauseScene`      | 一時停止             | `GameScene`, `TitleScene`                           |
| `ResultScene`     | ステージ結果         | 次ステージの `StageIntroScene` または `EndingScene` |
| `GameOverScene`   | 続行確認             | `GameScene`, `TitleScene`                           |
| `EndingScene`     | エンディング         | `TitleScene`                                        |
| `OptionsScene`    | 入力、音量、表示設定 | `TitleScene`, `PauseScene`                          |
| `LoadErrorScene`  | 読み込み失敗通知     | `TitleScene`                                        |

### 6.2 シーン共通インターフェース

```ts
type Scene = {
  enter(payload?: unknown): void;
  update(deltaMs: number): void;
  render(): void;
  exit(): void;
};
```

## 7. 座標系と時間仕様

### 7.1 座標系

- 原点はゲームプレイ領域左上
- 基準解像度は `1080 x 1920`
- 内部座標は浮動小数点で保持し、描画時に丸める

### 7.2 当たり判定座標

- 自機判定は中心点ベースの半径判定
- 敵と敵弾は円またはカプセルで近似
- ボス部位は矩形と円の複合コリジョンを許可する

### 7.3 時間単位

- データ定義上の時間はすべて `ms`
- 連射間隔、無敵時間、フェーズ遷移時間も `ms` で統一する

## 8. ゲーム状態モデル

### 8.1 グローバル状態

```ts
type GameState = {
  scene: SceneId;
  difficulty: "Novice" | "Arcade" | "Expert";
  stageIndex: number;
  player: PlayerState;
  score: ScoreState;
  rank: RankState;
  entities: EntityCollections;
  stage: StageRuntimeState;
  settings: SettingsState;
  runStats: RunStats;
};
```

### 8.2 エンティティ集合

```ts
type EntityCollections = {
  enemies: EnemyState[];
  enemyBullets: BulletState[];
  playerBullets: BulletState[];
  items: ItemState[];
  effects: EffectState[];
  bosses: BossPartState[];
};
```

### 8.3 補助型

```ts
type SceneId =
  | "BootScene"
  | "TitleScene"
  | "ShipSelectScene"
  | "StageIntroScene"
  | "GameScene"
  | "PauseScene"
  | "ResultScene"
  | "GameOverScene"
  | "EndingScene"
  | "OptionsScene"
  | "LoadErrorScene";

type CollisionShape =
  | { type: "circle"; radius: number; offsetX?: number; offsetY?: number }
  | { type: "capsule"; radius: number; length: number; rotationDeg: number }
  | {
      type: "rect";
      width: number;
      height: number;
      offsetX?: number;
      offsetY?: number;
    };

type StageRuntimeState = {
  elapsedMs: number;
  checkpointIndex: number;
  bossActive: boolean;
  warningActive: boolean;
  currentBackgroundOffsetY: number;
};

type RunStats = {
  missCount: number;
  bombCount: number;
  itemPickupCount: number;
  grazeCount: number;
  currentShipId: string;
};

type EffectState = {
  id: string;
  effectId: string;
  x: number;
  y: number;
  ttlMs: number;
  zIndex: number;
};

type BossPartState = {
  id: string;
  bossId: string;
  partId: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  collision: CollisionShape;
  destructible: boolean;
};

type BossSummonEvent = {
  atMs: number;
  enemyTypeId: string;
  count: number;
};

type AssetEntry = {
  id: string;
  path: string;
  preload: boolean;
};
```

## 9. プレイヤー詳細仕様

### 9.1 PlayerState

```ts
type PlayerState = {
  shipId: string;
  x: number;
  y: number;
  moveSpeed: number;
  focusSpeed: number;
  hitRadius: number;
  lives: number;
  shield: number;
  shieldMax: number;
  shotLevel: 1 | 2 | 3 | 4 | 5;
  subWeaponLevel: 0 | 1 | 2 | 3;
  bombStock: number;
  boostTimerMs: number;
  damageReductionTimerMs: number;
  invincibleTimerMs: number;
  respawnTimerMs: number;
  chargeMeterMs: number;
};
```

### 9.2 初期値

- `lives = 3`
- `shield = 100`
- `shieldMax = 100`
- `shotLevel = 1`
- `subWeaponLevel = 0`
- `bombStock = 2`
- `hitRadius = 6`

### 9.3 移動仕様

- 通常移動速度: `540 px/sec`
- 低速移動速度: `280 px/sec`
- 斜め移動時は正規化する
- 画面外移動は禁止し、境界でクランプする

### 9.4 被弾仕様

- 被弾時はまず `shield` を減算する
- `shield <= 0` になった時点では即ミスにせず、残余ダメージがある場合のみミス扱いにする
- ミス時は `lives -= 1`、`invincibleTimerMs = 3000`、`respawnTimerMs = 1200`
- ミス後の復帰時、`shotLevel` を 1 段階低下、`subWeaponLevel` を 1 段階低下させる
- `shield` は `shieldMax * 0.6` で復旧する

### 9.5 ショット仕様

- ショット間隔: `90 ms`
- レベルごとに弾数と射角を変化させる

| レベル | 弾数 | 基本ダメージ | 備考                 |
| ------ | ---- | ------------ | -------------------- |
| 1      | 2    | 8            | 正面集中             |
| 2      | 3    | 8            | 補助弾追加           |
| 3      | 4    | 9            | 幅拡大               |
| 4      | 5    | 9            | 前方密度増加         |
| 5      | 6    | 10           | 端弾に軽微な追尾補正 |

### 9.6 サブウェポン仕様

- レベルは `0` から `3`
- 使用条件は常時自動発射または内部クールダウン式
- クールダウン目安: `350 ms` から `900 ms`

### 9.7 補助チャージ仕様

- 低速移動継続 `1200 ms` で発動可能状態
- ショット入力中かつ発動可能時に自動発動
- 効果時間 `800 ms`
- 前方バリア弾を生成し、通常弾の `1.6 倍` の DPS と弾消し微効果を持つ

## 10. 武器・ダメージ仕様

### 10.1 BulletState

```ts
type BulletState = {
  id: string;
  owner: "player" | "enemy";
  kind: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  pierce: number;
  ttlMs: number;
  grazeEligible: boolean;
};
```

### 10.2 ダメージ計算

- 基本式: `finalDamage = baseDamage * attackMultiplier * defenseMultiplier`
- `attackMultiplier`
  - 通常時: `1.0`
  - 金アイテム中: `1.25`
  - 補助チャージ中: `1.6`
- `defenseMultiplier`
  - 通常時: `1.0`
  - 紫アイテム中: `0.7`

### 10.3 ボム仕様

- 初期 `bombStock = 2`
- 効果時間 `1500 ms`
- 全敵弾を除去
- 雑魚敵へ大ダメージ、ボスへ最大HP比 `6%` ダメージ
- ボム中に被弾判定を受けない

## 11. アイテム仕様

### 11.1 ItemState

```ts
type ItemState = {
  id: string;
  type:
    | "shot"
    | "sub"
    | "attackBoost"
    | "shieldMax"
    | "shieldHeal"
    | "damageReduction"
    | "scoreStar";
  x: number;
  y: number;
  vx: number;
  vy: number;
  magnetized: boolean;
  ttlMs: number;
};
```

### 11.2 効果量

| 種類              | 効果                                   |
| ----------------- | -------------------------------------- |
| `shot`            | `shotLevel` を 1 段階上昇、最大 5      |
| `sub`             | `subWeaponLevel` を 1 段階上昇、最大 3 |
| `attackBoost`     | `boostTimerMs = 10000`                 |
| `shieldMax`       | `shieldMax += 20`, 最大 180            |
| `shieldHeal`      | `shield += 30`, `shieldMax` を超えない |
| `damageReduction` | `damageReductionTimerMs = 12000`       |
| `scoreStar`       | 固定スコア加算とコンボ延長             |

### 11.3 吸引仕様

- プレイヤーが上部回収ラインを超えた場合、全アイテムを吸引状態にする
- 吸引速度は `900 px/sec`

## 12. 敵仕様

### 12.1 EnemyState

```ts
type EnemyState = {
  id: string;
  enemyTypeId: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  collision: CollisionShape;
  behaviorState: string;
  timers: Record<string, number>;
  scoreValue: number;
  dropTableId?: string;
  pathId?: string;
};
```

### 12.2 敵定義データ

```ts
type EnemyDefinition = {
  id: string;
  category: "small" | "medium" | "large" | "turret" | "special";
  spriteId: string;
  hp: number;
  movePatternId: string;
  attackPatternIds: string[];
  collision: CollisionShape;
  scoreValue: number;
  dropTableId?: string;
};
```

### 12.3 ドロップテーブル

```ts
type DropTableEntry = {
  itemType: ItemState["type"];
  probability: number;
  quantity: number;
};
```

### 12.4 敵更新原則

- 移動は `movePattern`
- 射撃は `attackPattern`
- 特殊効果は `behaviorState`
- 敵ごとの個別ロジックは最小化し、組み合わせデータで表現する

## 13. ボス仕様

### 13.1 BossState

```ts
type BossRuntimeState = {
  bossId: string;
  phaseIndex: number;
  phaseTimerMs: number;
  totalHp: number;
  parts: BossPartState[];
  enrage: boolean;
};
```

### 13.2 BossPhaseDefinition

```ts
type BossPhaseDefinition = {
  id: string;
  durationMs: number;
  hpThreshold?: number;
  movementPatternId: string;
  attackPatternIds: string[];
  summonEvents?: BossSummonEvent[];
  breakParts?: string[];
};
```

### 13.3 フェーズ遷移条件

- `durationMs` 経過
- `hpThreshold` 到達
- 指定部位破壊完了

### 13.4 ボス部位仕様

- 各部位は独立 HP を持つ
- 破壊時に攻撃パターンが弱体化または変化する
- 一部部位はスコアボーナス対象

## 14. 弾幕・パターン定義

### 14.1 移動パターン定義

```ts
type MovePattern =
  | { type: "line"; vx: number; vy: number }
  | { type: "curve"; speed: number; angularVelocity: number }
  | { type: "waypoints"; points: { x: number; y: number; tMs: number }[] }
  | {
      type: "followPlayer";
      speed: number;
      turnRate: number;
      durationMs: number;
    };
```

### 14.2 攻撃パターン定義

```ts
type AttackPattern = {
  id: string;
  intervalMs: number;
  burst?: number;
  bulletTypeId: string;
  emitters: EmitterDefinition[];
};
```

### 14.3 EmitterDefinition

```ts
type EmitterDefinition = {
  angleDeg: number;
  angleSpreadDeg?: number;
  count: number;
  speed: number;
  speedVariance?: number;
  aimAtPlayer?: boolean;
  rotatePerShotDeg?: number;
};
```

## 15. ステージスクリプト仕様

### 15.1 ステージ定義

```ts
type StageDefinition = {
  id: string;
  name: string;
  durationMs: number;
  backgroundId: string;
  musicId: string;
  spawnEvents: SpawnEvent[];
  midBossEvent?: BossSpawnEvent;
  bossEvent: BossSpawnEvent;
};
```

### 15.2 SpawnEvent

```ts
type SpawnEvent = {
  atMs: number;
  enemyTypeId: string;
  count: number;
  formationId?: string;
  positions?: { x: number; y: number }[];
  pathId?: string;
  delayBetweenMs?: number;
};
```

### 15.3 フォーメーション定義

```ts
type FormationDefinition = {
  id: string;
  offsets: { x: number; y: number }[];
};
```

### 15.4 ステージ進行原則

- ステージ開始後 `20 sec` 以内に最初のパワーアップ取得機会を出す
- 中型敵は約 `45 sec` ごとに配置する
- ボス前 `15 sec` は警告演出専用時間を確保する
- 初見殺し要素は同種前兆を必ず事前配置する

## 16. スコア・コンボ・内部ランク仕様

### 16.1 ScoreState

```ts
type ScoreState = {
  total: number;
  combo: number;
  comboTimerMs: number;
  grazeCount: number;
  itemChainCount: number;
  stageBonus: number;
};
```

### 16.2 基本スコア式

- `enemyScore = baseScore * (1 + combo * 0.02)`
- 接近撃破は `+25%`
- 部位破壊は部位ごとに固定ボーナス
- かすりは 1 回ごとに `+50`

### 16.3 コンボ維持

- 初期維持時間 `1800 ms`
- 大型敵撃破時 `+700 ms`
- `scoreStar` 回収時 `+500 ms`
- ミスまたは時間切れで `combo = 0`

### 16.4 内部ランク

```ts
type RankState = {
  value: number;
};
```

- 開始値 `0`
- ノーミス継続 `10 sec` ごとに `+1`
- ボム使用時 `-2`
- 連続被弾時 `-3`
- 難度ごとの上限
  - `Novice = 8`
  - `Arcade = 15`
  - `Expert = 24`

## 17. 当たり判定仕様

### 17.1 衝突組み合わせ

- 自機 vs 敵弾
- 自機 vs 敵本体
- 自機弾 vs 敵
- 自機 vs アイテム
- ボム vs 敵弾
- ボム vs 敵

### 17.2 最適化方針

- まず画面を `6 x 10` の粗い空間グリッドに分割する
- グリッド単位で近傍候補を抽出し、詳細判定を行う
- ボス部位のみ個別コリジョンテーブルを持つ

### 17.3 かすり判定

- 自機中心半径 `hitRadius + 18` 以内で、被弾判定の外側に弾が入ったとき成立
- 同一弾での連続かすりは1回のみ

## 18. UI/HUD 実装仕様

### 18.1 UI 更新方針

- UI は `GameState` の読み取り専用スナップショットから描画する
- UI レイヤーはプレイレイヤーと分離する
- 数値表示はテキストレンダラまたはビットマップフォントで構成する

### 18.2 HUD 固定要素

- 左上: 残機、シールド、ボム
- 右上: スコア、コンボ、内部ランク表示
- 右下: ショットレベル、サブウェポンレベル
- 上部中央: ステージ進行度
- 下部中央: 一時的な取得通知、警告表示
- ボス戦中上端: ボスHPバー

### 18.3 UI アニメーション

- 数値増加時は `120 ms` のカウントアップ補間
- 警告帯は `300 ms` ごとに明滅
- ダメージ時のシールドゲージは `200 ms` の赤フラッシュ

### 18.4 UI アセット実装

- 装飾フレームは 9-slice 相当で伸縮可能にする
- アイコンは `32x32`, `64x64`, `128x128` の使用サイズを基準に出力する
- ボスHP枠は状態差分として `normal`, `alert`, `break` の3種を用意する

## 19. 入力仕様

### 19.1 入力マッピング

```ts
type InputAction =
  | "moveUp"
  | "moveDown"
  | "moveLeft"
  | "moveRight"
  | "shot"
  | "bomb"
  | "focus"
  | "pause"
  | "confirm"
  | "cancel";
```

### 19.2 入力処理方針

- キーボードとゲームパッドは同一アクションへ正規化する
- 1フレーム内に複数入力源がある場合は、最後の有効入力を採用する
- ポーズ中は `confirm`, `cancel`, `pause` のみ受け付ける

## 20. アセット管理仕様

### 20.1 アセットマニフェスト

```ts
type AssetManifest = {
  spritesheets: AssetEntry[];
  backgrounds: AssetEntry[];
  audio: AssetEntry[];
  ui: AssetEntry[];
};
```

### 20.2 読み込み方針

- `BootScene` で共通 UI とステージ1必須アセットを読む
- 次ステージのアセットはステージ終了前に先読みする
- ボス用アセットはステージ開始時点で読み込み完了させる

### 20.3 スプライトシート仕様

```ts
type PixelSpriteSource = {
  id: string;
  width: number;
  height: number;
  palette: string[];
  pixels: string[];
  anchorX: number;
  anchorY: number;
};

type SpriteFrame = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
};
```

- `pixels` は1文字1ピクセルのインデックス表現とする
- 透明色は `.` を予約文字として扱う
- 起動時は `PixelSpriteSource` 群をスプライトシートへパックし、`SpriteFrame` 辞書を生成する
- 外部画像生成結果へ移行する場合も、最終的に `SpriteFrame` 互換メタデータへ変換する

### 20.4 画像生成自動化入出力

```ts
type PromptManifestRecord = {
  spriteId: string;
  prompt: string;
  negativePrompt?: string;
  cellWidth: number;
  cellHeight: number;
  background: "transparent" | "magenta" | "green";
  quality?: "low" | "medium" | "high";
  size?: string;
  variants?: number;
};
```

- 生成スクリプトは `PromptManifestRecord` を読み、`raw` へ PNG を保存する
- OpenAI API キーはリポジトリ直下の `.env.local` または `.env` から読み込めるようにする
- `sprite-list.csv` の `status` は `planned -> generated -> candidate -> approved -> normalized -> packed` で遷移する
- シート化スクリプトは `approved/normalized` を優先し、カテゴリ名とセルサイズから `<category>-<width>x<height>.png` 形式のシート名を決定する
- メタデータ出力は `spriteId`、`sheet`、`x`、`y`、`width`、`height` を最小必須項目とする
- ランタイムは `sheet-layout.json` と PNG シートを読込み、`spriteId` ごとのアンカーは実装側の補助マップで解決する
- `Game` は `SpriteSheet` をコンストラクタ引数で受け取り、ゲーム内で使う `spriteId` は台帳 ID と一致させる
- 描画倍率変更時は、描画だけでなく当たり判定半径、プレイヤー移動クランプ、画面外除去境界も同一基準で更新する
- 現行実装では `Game` 内の `getSpriteScale` と `getSpriteBounds` がフレーム寸法から半幅と半高を計算し、描画、当たり判定、消滅判定に共通利用する
- 画像生成失敗時は `generation-errors.json` に `spriteId`、失敗分類、HTTP status、時刻、メッセージを記録する
- `401` と `403` は認証系の致命エラーとして全体停止する
- `429` と `5xx` と通信失敗は再試行対象とし、上限回数超過後に失敗ログへ記録する
- 実行中ログは `stdout` へ出し、開始、対象、試行、再試行、保存、完了件数を追跡できるようにする

### 20.5 画像生成後の受け入れ条件

- 透過 PNG 化済み
- スプライト境界に不要余白が少ない
- 縮小後の輪郭が崩れていない
- 発光レイヤーと本体レイヤーが分離できる

## 21. 音響実装仕様

### 21.1 音声チャンネル

- `bgm`
- `sfxPlayer`
- `sfxEnemy`
- `sfxUi`
- `voiceOptional`

### 21.2 音量設定

- `master`
- `bgm`
- `sfx`
- `ui`

### 21.3 音声ルール

- ボス警告時に `bgm` を一時的に -6dB 下げる
- ボム発動中はプレイヤーショット音を抑制して可読性を上げる

## 22. 保存仕様

### 22.1 SettingsState

```ts
type SettingsState = {
  keymap: Record<InputAction, string[]>;
  audio: {
    master: number;
    bgm: number;
    sfx: number;
    ui: number;
  };
  reduceFlashing: boolean;
  showHitbox: boolean;
};
```

### 22.2 永続化対象

- 設定
- ハイスコア上位10件
- クリア履歴
- 機体別最高到達ステージ

### 22.3 保存キー例

- `steel-aegis.settings`
- `steel-aegis.highscores`
- `steel-aegis.progress`

## 23. エラーハンドリングとフェイルセーフ

### 23.1 アセット読み込み失敗

- 1回だけ再試行する
- 失敗継続時は `LoadErrorScene` 相当の簡易表示へ遷移する

### 23.2 画像生成API失敗

- `.env.local` または `.env` にキーが無い場合は即時停止する
- 無効キーまたは権限不足の場合は即時停止し、生成対象の `status` を進めない
- 一時失敗は指数バックオフ付きで再試行する
- 失敗の最終結果は `generation-errors.json` に残す

### 23.3 不正データ検出

- ステージ定義、敵定義、武器定義は起動時にバリデーションする
- 必須キー欠落時はゲーム開始を止め、開発用エラーレポートを表示する

### 23.4 フレーム落ち対策

- 連続 2 秒以上 `50fps` 未満の場合、演出密度を下げる軽量モード候補を提示する

## 24. 性能基準

### 24.1 目標

- 通常プレイ時平均 `60fps`
- ボス戦高密度時でも `55fps` 以上を維持
- ステージ切替ロード時間 `3 sec` 以内

### 24.2 想定同時数上限

- 敵弾: 700
- 自機弾: 120
- 敵: 80
- アイテム: 60
- エフェクト: 150

### 24.3 最適化優先順位

1. 弾描画のバッチ化
2. 当たり判定の空間分割
3. エフェクト寿命短縮
4. 背景レイヤー更新頻度最適化

## 25. テスト仕様

### 25.1 自動テスト対象

- ダメージ計算
- アイテム効果反映
- コンボ継続と切断
- ランク上下
- ステージイベント時刻順処理
- ボスフェーズ遷移
- 保存データのシリアライズ

### 25.2 手動テスト対象

- 入力遅延体感
- HUD 視認性
- ボス警告演出
- ミス後復帰の理不尽度
- 画像生成アセットの縮小視認性

### 25.3 ステージ受け入れ条件

- ステージごとの最初のパワーアップ導線が機能する
- 中型敵とボスで難度の段差が急すぎない
- 背景と弾の視認性が保たれる

## 26. 実装順序

1. `core` と `SceneManager` を実装する
2. プレイヤー移動、ショット、当たり判定の最小縦スクロールを作る
3. ステージスクリプトと敵出現を実装する
4. アイテム、成長、ボム、スコアを実装する
5. ボスフェーズ管理と UI/HUD を実装する
6. アセット差し替え、音響、演出、設定保存を実装する
7. 性能調整と難度調整を行う

## 27. 未確定事項

- `PixiJS` を採用するか、より軽量な描画レイヤーを採用するか
- オンラインランキング用 API の有無
- リプレイ保存の正式対応有無
- 難度別にどの程度内部ランク差を強く出すか

## 28. 変更管理方針

- 企画変更がゲームルールへ影響する場合は先に [spec.md](../specs/spec.md) を更新する
- 実装都合でデータ構造、ファイル構成、保存形式、計算式が変わる場合は本書を更新する
- 実装開始後は、本書の型定義断片を実コードの単一情報源へ寄せ、文書とコードが乖離しないよう管理する
