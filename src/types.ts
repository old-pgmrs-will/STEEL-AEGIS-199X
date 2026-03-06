export type SceneId = "title" | "playing" | "gameover" | "stageclear";

export type Player = {
  x: number;
  y: number;
  speed: number;
  focusSpeed: number;
  hitRadius: number;
  collisionRadius: number;
  shield: number;
  shieldMax: number;
  lives: number;
  bombs: number;
  shotLevel: 1 | 2 | 3 | 4 | 5;
  shotCooldownMs: number;
  invincibleMs: number;
  bombMs: number;
  respawnMs: number;
};

export type EnemyType = "drone" | "zigzag" | "heavy" | "boss";

export type Enemy = {
  id: number;
  type: EnemyType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hp: number;
  maxHp: number;
  shootCooldownMs: number;
  ageMs: number;
  scoreValue: number;
};

export type BulletOwner = "player" | "enemy";

export type Bullet = {
  id: number;
  owner: BulletOwner;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  ttlMs: number;
};

export type ItemType = "shot" | "shield" | "bomb";

export type Item = {
  id: number;
  type: ItemType;
  x: number;
  y: number;
  vy: number;
  radius: number;
  ttlMs: number;
  magnetized: boolean;
};

export type StageEvent =
  | { atMs: number; type: "wave"; pattern: "line" | "zigzag" | "heavyLine" | "sideRush" }
  | { atMs: number; type: "boss" };

export type Star = {
  x: number;
  y: number;
  speed: number;
  size: number;
};
