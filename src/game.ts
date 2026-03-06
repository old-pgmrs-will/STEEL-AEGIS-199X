import {
  FIXED_TIMESTEP,
  GAME_HEIGHT,
  GAME_WIDTH,
  ITEM_PICKUP_LINE_Y,
  MAX_STAGE_TIME_MS,
  PLAYER_COLLISION_RADIUS,
  PLAYER_FOCUS_SPEED,
  PLAYER_HIT_RADIUS,
  PLAYER_TOP_SPEED
} from "./config";
import { InputController } from "./input";
import { SpriteSheet } from "./rendering/sprites";
import { STAGE_EVENTS } from "./stage";
import type { Bullet, Enemy, EnemyType, Item, ItemType, Player, SceneId, StageEvent, Star } from "./types";

const SPRITE_SCALE_MULTIPLIER = 2;
const PLAYER_SPRITE_ID = "player_type_a_idle";
const PLAYER_BULLET_SPRITE_ID = "bullet_player_small";

const SPRITE_BASE_SCALES: Record<string, number> = {
  player_type_a_idle: 1.25,
  enemy_drone_a: 1,
  enemy_zigzag_a: 1,
  enemy_heavy_a: 1.2,
  boss_stage1_core: 2,
  item_shot: 1.5,
  item_shield: 1.5,
  item_bomb: 1.5,
  bullet_player_small: 2,
  bullet_enemy_small: 2,
  bullet_enemy_large: 2
};

type HudSnapshot = {
  score: number;
  combo: number;
  lives: number;
  shield: number;
  shieldMax: number;
  bombs: number;
  shotLevel: number;
  stageTimeMs: number;
};

export class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly input: InputController;
  private readonly sprites: SpriteSheet;
  private readonly stars: Star[];

  private scene: SceneId = "title";
  private animationFrameId = 0;
  private accumulatorMs = 0;
  private lastFrameMs = 0;
  private entityId = 1;
  private eventIndex = 0;

  private player!: Player;
  private enemies: Enemy[] = [];
  private playerBullets: Bullet[] = [];
  private enemyBullets: Bullet[] = [];
  private items: Item[] = [];
  private score = 0;
  private combo = 0;
  private comboTimerMs = 0;
  private stageTimeMs = 0;
  private bossSpawned = false;
  private bossDefeated = false;
  private paused = false;
  private hud: HudSnapshot = {
    score: 0,
    combo: 0,
    lives: 0,
    shield: 0,
    shieldMax: 0,
    bombs: 0,
    shotLevel: 0,
    stageTimeMs: 0
  };

  constructor(canvas: HTMLCanvasElement, sprites: SpriteSheet) {
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Canvas 2D context を取得できませんでした。");
    }

    this.canvas = canvas;
    this.ctx = ctx;
    this.input = new InputController(window);
    this.sprites = sprites;
    this.stars = this.createStars();
    this.resetRun();
  }

  start(): void {
    this.lastFrameMs = performance.now();
    this.animationFrameId = window.requestAnimationFrame(this.frame);
  }

  dispose(): void {
    window.cancelAnimationFrame(this.animationFrameId);
  }

  private readonly frame = (timestampMs: number): void => {
    const deltaMs = Math.min(timestampMs - this.lastFrameMs, 100);
    this.lastFrameMs = timestampMs;
    this.accumulatorMs += deltaMs;

    while (this.accumulatorMs >= FIXED_TIMESTEP) {
      this.update(FIXED_TIMESTEP);
      this.accumulatorMs -= FIXED_TIMESTEP;
    }

    this.render();
    this.input.endFrame();
    this.animationFrameId = window.requestAnimationFrame(this.frame);
  };

  private resetRun(): void {
    this.player = {
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT - 140,
      speed: PLAYER_TOP_SPEED,
      focusSpeed: PLAYER_FOCUS_SPEED,
      hitRadius: scaleGameplayValue(PLAYER_HIT_RADIUS),
      collisionRadius: scaleGameplayValue(PLAYER_COLLISION_RADIUS),
      shield: 100,
      shieldMax: 100,
      lives: 3,
      bombs: 2,
      shotLevel: 1,
      shotCooldownMs: 0,
      invincibleMs: 0,
      bombMs: 0,
      respawnMs: 0
    };
    this.enemies = [];
    this.playerBullets = [];
    this.enemyBullets = [];
    this.items = [];
    this.score = 0;
    this.combo = 0;
    this.comboTimerMs = 0;
    this.stageTimeMs = 0;
    this.eventIndex = 0;
    this.bossSpawned = false;
    this.bossDefeated = false;
    this.paused = false;
    this.updateHud();
  }

  private update(deltaMs: number): void {
    if (this.input.consume("pause") && this.scene === "playing") {
      this.paused = !this.paused;
    }

    if (this.scene === "title") {
      if (this.input.consume("confirm") || this.input.consume("shot")) {
        this.scene = "playing";
        this.resetRun();
      }
      this.updateStars(deltaMs);
      return;
    }

    if (this.scene === "gameover" || this.scene === "stageclear") {
      if (this.input.consume("confirm") || this.input.consume("shot")) {
        this.scene = "title";
      }
      this.updateStars(deltaMs);
      return;
    }

    if (this.paused) {
      this.updateStars(deltaMs * 0.25);
      return;
    }

    this.stageTimeMs += deltaMs;
    this.updateStars(deltaMs);
    this.consumeStageEvents();
    this.updatePlayer(deltaMs);
    this.updateEnemies(deltaMs);
    this.updateBullets(deltaMs);
    this.updateItems(deltaMs);
    this.updateCombo(deltaMs);
    this.handleCollisions();
    this.cleanupEntities();
    this.updateHud();

    if (this.stageTimeMs >= MAX_STAGE_TIME_MS && !this.bossSpawned) {
      this.spawnBoss();
    }

    if (this.player.lives < 0) {
      this.scene = "gameover";
    }

    if (this.bossDefeated) {
      this.scene = "stageclear";
    }
  }

  private updatePlayer(deltaMs: number): void {
    if (this.player.respawnMs > 0) {
      this.player.respawnMs = Math.max(0, this.player.respawnMs - deltaMs);
    }

    this.player.shotCooldownMs = Math.max(0, this.player.shotCooldownMs - deltaMs);
    this.player.invincibleMs = Math.max(0, this.player.invincibleMs - deltaMs);
    this.player.bombMs = Math.max(0, this.player.bombMs - deltaMs);

    const moveX = Number(this.input.isDown("right")) - Number(this.input.isDown("left"));
    const moveY = Number(this.input.isDown("down")) - Number(this.input.isDown("up"));
    const moving = moveX !== 0 || moveY !== 0;

    if (moving && this.player.respawnMs <= 0) {
      const magnitude = Math.hypot(moveX, moveY) || 1;
      const speed = this.input.isDown("focus") ? this.player.focusSpeed : this.player.speed;

      this.player.x += ((moveX / magnitude) * speed * deltaMs) / 1000;
      this.player.y += ((moveY / magnitude) * speed * deltaMs) / 1000;
    }

    const playerBounds = this.getSpriteBounds(PLAYER_SPRITE_ID);
    this.player.x = clamp(this.player.x, playerBounds.halfWidth, GAME_WIDTH - playerBounds.halfWidth);
    this.player.y = clamp(this.player.y, playerBounds.halfHeight, GAME_HEIGHT - playerBounds.halfHeight);

    if (this.input.consume("bomb")) {
      this.activateBomb();
    }

    if (this.input.isDown("shot") && this.player.respawnMs <= 0) {
      this.firePlayerShot();
    }
  }

  private updateEnemies(deltaMs: number): void {
    for (const enemy of this.enemies) {
      enemy.ageMs += deltaMs;

      if (enemy.type === "zigzag") {
        enemy.x += Math.sin(enemy.ageMs / 220) * 1.8;
      }

      if (enemy.type === "boss") {
        if (enemy.y < 180) {
          enemy.y += (enemy.vy * deltaMs) / 1000;
        } else {
          enemy.y = 180;
          enemy.x = GAME_WIDTH / 2 + Math.sin(enemy.ageMs / 900) * 120;
        }
      } else {
        enemy.x += (enemy.vx * deltaMs) / 1000;
        enemy.y += (enemy.vy * deltaMs) / 1000;
      }

      enemy.shootCooldownMs -= deltaMs;

      if (enemy.shootCooldownMs <= 0) {
        this.fireEnemyShot(enemy);
      }
    }
  }

  private updateBullets(deltaMs: number): void {
    for (const bullet of this.playerBullets) {
      bullet.x += (bullet.vx * deltaMs) / 1000;
      bullet.y += (bullet.vy * deltaMs) / 1000;
      bullet.ttlMs -= deltaMs;
    }

    for (const bullet of this.enemyBullets) {
      bullet.x += (bullet.vx * deltaMs) / 1000;
      bullet.y += (bullet.vy * deltaMs) / 1000;
      bullet.ttlMs -= deltaMs;
    }
  }

  private updateItems(deltaMs: number): void {
    const magnetize = this.player.y <= ITEM_PICKUP_LINE_Y;

    for (const item of this.items) {
      item.ttlMs -= deltaMs;
      item.magnetized = item.magnetized || magnetize;

      if (item.magnetized) {
        const angle = Math.atan2(this.player.y - item.y, this.player.x - item.x);
        item.x += Math.cos(angle) * 14;
        item.y += Math.sin(angle) * 14;
      } else {
        item.y += (item.vy * deltaMs) / 1000;
      }
    }
  }

  private updateCombo(deltaMs: number): void {
    if (this.comboTimerMs > 0) {
      this.comboTimerMs = Math.max(0, this.comboTimerMs - deltaMs);
      if (this.comboTimerMs === 0) {
        this.combo = 0;
      }
    }
  }

  private handleCollisions(): void {
    for (const bullet of this.playerBullets) {
      for (const enemy of this.enemies) {
        if (distanceSquared(bullet.x, bullet.y, enemy.x, enemy.y) <= (bullet.radius + enemy.radius) ** 2) {
          bullet.ttlMs = 0;
          enemy.hp -= bullet.damage;

          if (enemy.hp <= 0) {
            this.destroyEnemy(enemy);
          }
        }
      }
    }

    if (this.player.invincibleMs <= 0 && this.player.respawnMs <= 0 && this.player.bombMs <= 0) {
      for (const bullet of this.enemyBullets) {
        if (
          distanceSquared(bullet.x, bullet.y, this.player.x, this.player.y) <=
          (bullet.radius + this.player.hitRadius) ** 2
        ) {
          bullet.ttlMs = 0;
          this.applyPlayerDamage(22);
        }
      }

      for (const enemy of this.enemies) {
        if (
          distanceSquared(enemy.x, enemy.y, this.player.x, this.player.y) <=
          (enemy.radius + this.player.collisionRadius) ** 2
        ) {
          this.applyPlayerDamage(enemy.type === "boss" ? 45 : 30);
        }
      }
    }

    for (const item of this.items) {
      if (distanceSquared(item.x, item.y, this.player.x, this.player.y) <= (item.radius + this.player.collisionRadius) ** 2) {
        item.ttlMs = 0;
        this.collectItem(item.type);
      }
    }
  }

  private cleanupEntities(): void {
    this.playerBullets = this.playerBullets.filter((bullet) => {
      const margin = this.getSpriteBounds(PLAYER_BULLET_SPRITE_ID).maxRadius;
      return bullet.ttlMs > 0 && bullet.y >= -margin && bullet.y <= GAME_HEIGHT + margin;
    });

    this.enemyBullets = this.enemyBullets.filter((bullet) => {
      const spriteId = bullet.radius >= scaleGameplayValue(7) ? "bullet_enemy_large" : "bullet_enemy_small";
      const margin = this.getSpriteBounds(spriteId).maxRadius;
      return (
        bullet.ttlMs > 0 &&
        bullet.x >= -margin &&
        bullet.x <= GAME_WIDTH + margin &&
        bullet.y <= GAME_HEIGHT + margin
      );
    });

    this.enemies = this.enemies.filter((enemy) => {
      const bounds = this.getEnemyBounds(enemy.type);
      if (enemy.type === "boss") {
        return enemy.hp > 0;
      }
      return (
        enemy.hp > 0 &&
        enemy.y <= GAME_HEIGHT + bounds.halfHeight &&
        enemy.x >= -bounds.halfWidth &&
        enemy.x <= GAME_WIDTH + bounds.halfWidth
      );
    });

    this.items = this.items.filter((item) => {
      const bounds = this.getSpriteBounds(itemSpriteId(item.type));
      return item.ttlMs > 0 && item.y <= GAME_HEIGHT + bounds.halfHeight;
    });
  }

  private consumeStageEvents(): void {
    while (this.eventIndex < STAGE_EVENTS.length && STAGE_EVENTS[this.eventIndex].atMs <= this.stageTimeMs) {
      const event = STAGE_EVENTS[this.eventIndex];
      this.handleStageEvent(event);
      this.eventIndex += 1;
    }
  }

  private handleStageEvent(event: StageEvent): void {
    if (event.type === "boss") {
      this.spawnBoss();
      return;
    }

    switch (event.pattern) {
      case "line":
        for (let index = 0; index < 6; index += 1) {
          this.spawnEnemy("drone", 70 + index * 80, -50 - index * 30, 0, 180);
        }
        break;
      case "zigzag":
        for (let index = 0; index < 5; index += 1) {
          this.spawnEnemy("zigzag", 90 + index * 90, -60 - index * 50, 0, 170);
        }
        break;
      case "heavyLine":
        for (let index = 0; index < 3; index += 1) {
          this.spawnEnemy("heavy", 120 + index * 150, -80 - index * 40, 0, 110);
        }
        break;
      case "sideRush":
        for (let index = 0; index < 4; index += 1) {
          const left = this.spawnEnemy("drone", -40 - index * 40, 180 + index * 70, 180, 70);
          const right = this.spawnEnemy("drone", GAME_WIDTH + 40 + index * 40, 200 + index * 70, -180, 70);
          left.vy = 120;
          right.vy = 120;
        }
        break;
      default:
        break;
    }
  }

  private spawnEnemy(type: EnemyType, x: number, y: number, vx: number, vy: number): Enemy {
    const enemy = createEnemy(this.nextId(), type, x, y, vx, vy);
    this.enemies.push(enemy);
    return enemy;
  }

  private spawnBoss(): void {
    if (this.bossSpawned) {
      return;
    }
    this.bossSpawned = true;
    this.enemies.push({
      id: this.nextId(),
      type: "boss",
      x: GAME_WIDTH / 2,
      y: -180,
      vx: 0,
      vy: 100,
      radius: scaleGameplayValue(72),
      hp: 420,
      maxHp: 420,
      shootCooldownMs: 800,
      ageMs: 0,
      scoreValue: 24000
    });
  }

  private firePlayerShot(): void {
    if (this.player.shotCooldownMs > 0) {
      return;
    }

    this.player.shotCooldownMs = 90;

    const patterns = {
      1: [-8, 8],
      2: [-14, 0, 14],
      3: [-18, -6, 6, 18],
      4: [-22, -8, 8, 22, 0],
      5: [-24, -12, 0, 12, 24, 36]
    } as const;

    for (const offset of patterns[this.player.shotLevel]) {
      this.playerBullets.push({
        id: this.nextId(),
        owner: "player",
        x: this.player.x + offset,
        y: this.player.y - 22,
        vx: offset * 0.8,
        vy: -720,
        radius: scaleGameplayValue(5),
        damage: this.player.shotLevel >= 4 ? 11 : 9,
        ttlMs: 1800
      });
    }
  }

  private fireEnemyShot(enemy: Enemy): void {
    if (enemy.type === "boss") {
      enemy.shootCooldownMs = 520;

      for (let angleDeg = -50; angleDeg <= 50; angleDeg += 20) {
        const angle = Math.atan2(this.player.y - enemy.y, this.player.x - enemy.x) + radians(angleDeg);
        this.enemyBullets.push({
          id: this.nextId(),
          owner: "enemy",
          x: enemy.x,
          y: enemy.y + 30,
          vx: Math.cos(angle) * 210,
          vy: Math.sin(angle) * 210,
          radius: scaleGameplayValue(8),
          damage: 18,
          ttlMs: 4800
        });
      }
      return;
    }

    enemy.shootCooldownMs = enemy.type === "heavy" ? 1150 : 1450;
    const angle = Math.atan2(this.player.y - enemy.y, this.player.x - enemy.x);
    const spread = enemy.type === "heavy" ? [-0.22, 0, 0.22] : [0];

    for (const offset of spread) {
      this.enemyBullets.push({
        id: this.nextId(),
        owner: "enemy",
        x: enemy.x,
        y: enemy.y + enemy.radius * 0.2,
        vx: Math.cos(angle + offset) * 200,
        vy: Math.sin(angle + offset) * 200,
        radius: enemy.type === "heavy" ? scaleGameplayValue(7) : scaleGameplayValue(5),
        damage: enemy.type === "heavy" ? 16 : 12,
        ttlMs: 5000
      });
    }
  }

  private destroyEnemy(enemy: Enemy): void {
    if (enemy.hp <= 0) {
      enemy.hp = 0;
      const multiplier = 1 + this.combo * 0.05;
      this.score += Math.floor(enemy.scoreValue * multiplier);
      this.combo += 1;
      this.comboTimerMs = 2200;

      if (enemy.type === "boss") {
        this.bossDefeated = true;
      } else if (enemy.type === "heavy") {
        this.spawnItem(enemy.x, enemy.y, Math.random() > 0.5 ? "shield" : "shot");
      } else if (Math.random() > 0.78) {
        this.spawnItem(enemy.x, enemy.y, Math.random() > 0.72 ? "bomb" : "shot");
      }
    }
  }

  private spawnItem(x: number, y: number, type: ItemType): void {
    this.items.push({
      id: this.nextId(),
      type,
      x,
      y,
      vy: 140,
      radius: scaleGameplayValue(12),
      ttlMs: 8000,
      magnetized: false
    });
  }

  private collectItem(type: ItemType): void {
    switch (type) {
      case "shot":
        this.player.shotLevel = Math.min(5, this.player.shotLevel + 1) as Player["shotLevel"];
        this.score += 300;
        break;
      case "shield":
        this.player.shield = Math.min(this.player.shieldMax, this.player.shield + 32);
        this.score += 250;
        break;
      case "bomb":
        this.player.bombs = Math.min(5, this.player.bombs + 1);
        this.score += 450;
        break;
      default:
        break;
    }
  }

  private activateBomb(): void {
    if (this.player.bombs <= 0 || this.player.bombMs > 0 || this.scene !== "playing") {
      return;
    }

    this.player.bombs -= 1;
    this.player.bombMs = 1400;
    this.player.invincibleMs = Math.max(this.player.invincibleMs, 1400);
    this.enemyBullets = [];

    for (const enemy of this.enemies) {
      enemy.hp -= enemy.type === "boss" ? 84 : 68;
      if (enemy.hp <= 0) {
        this.destroyEnemy(enemy);
      }
    }
  }

  private applyPlayerDamage(amount: number): void {
    if (this.player.invincibleMs > 0 || this.player.bombMs > 0) {
      return;
    }

    this.player.shield -= amount;
    this.player.invincibleMs = 1200;

    if (this.player.shield > 0) {
      return;
    }

    this.player.lives -= 1;
    this.combo = 0;
    this.comboTimerMs = 0;
    this.player.shield = Math.floor(this.player.shieldMax * 0.65);
    this.player.shotLevel = Math.max(1, this.player.shotLevel - 1) as Player["shotLevel"];
    this.player.invincibleMs = 2600;
    this.player.respawnMs = 900;
    this.player.x = GAME_WIDTH / 2;
    this.player.y = GAME_HEIGHT - 140;
    this.enemyBullets = [];

    if (this.player.lives < 0) {
      this.scene = "gameover";
    }
  }

  private updateStars(deltaMs: number): void {
    for (const star of this.stars) {
      star.y += (star.speed * deltaMs) / 1000;
      if (star.y > GAME_HEIGHT) {
        star.y = 0;
        star.x = Math.random() * GAME_WIDTH;
      }
    }
  }

  private render(): void {
    this.ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.renderBackground();
    this.renderStage();
    this.renderHud();
    this.renderOverlay();
  }

  private renderBackground(): void {
    const gradient = this.ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    gradient.addColorStop(0, "#04101c");
    gradient.addColorStop(0.55, "#0b2236");
    gradient.addColorStop(1, "#02070c");
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.ctx.globalAlpha = 0.35;
    for (const star of this.stars) {
      this.ctx.fillStyle = "#c8ecff";
      this.ctx.fillRect(star.x, star.y, star.size, star.size);
    }
    this.ctx.globalAlpha = 1;

    const bandOffset = (this.stageTimeMs * 0.06) % 220;
    this.ctx.strokeStyle = "rgba(0, 180, 255, 0.18)";
    this.ctx.lineWidth = 2;
    for (let y = -220; y < GAME_HEIGHT + 220; y += 220) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y + bandOffset);
      this.ctx.lineTo(GAME_WIDTH, y + 80 + bandOffset);
      this.ctx.stroke();
    }
  }

  private renderStage(): void {
    for (const item of this.items) {
      const spriteId = itemSpriteId(item.type);
      this.sprites.draw(this.ctx, spriteId, item.x, item.y, { scale: this.getSpriteScale(spriteId) });
    }

    for (const bullet of this.playerBullets) {
      this.sprites.draw(this.ctx, PLAYER_BULLET_SPRITE_ID, bullet.x, bullet.y, {
        scale: this.getSpriteScale(PLAYER_BULLET_SPRITE_ID)
      });
    }

    for (const bullet of this.enemyBullets) {
      const spriteId = bullet.radius >= scaleGameplayValue(7) ? "bullet_enemy_large" : "bullet_enemy_small";
      this.sprites.draw(this.ctx, spriteId, bullet.x, bullet.y, { scale: this.getSpriteScale(spriteId) });
    }

    for (const enemy of this.enemies) {
      const spriteId = enemySpriteId(enemy.type);
      this.sprites.draw(this.ctx, spriteId, enemy.x, enemy.y, { scale: this.getSpriteScale(spriteId) });
    }

    if (this.player.bombMs > 0) {
      const ratio = this.player.bombMs / 1400;
      this.ctx.fillStyle = `rgba(74, 223, 255, ${0.12 + ratio * 0.2})`;
      this.ctx.beginPath();
      this.ctx.arc(this.player.x, this.player.y, 120 - ratio * 35, 0, Math.PI * 2);
      this.ctx.fill();
    }

    const flashing = this.player.invincibleMs > 0 && Math.floor(this.player.invincibleMs / 100) % 2 === 0;
    if (!flashing || this.player.bombMs > 0) {
      this.sprites.draw(this.ctx, PLAYER_SPRITE_ID, this.player.x, this.player.y, {
        scale: this.getSpriteScale(PLAYER_SPRITE_ID)
      });
    }

    if (this.input.isDown("focus") && this.scene === "playing") {
      this.ctx.strokeStyle = "#ffffff";
      this.ctx.lineWidth = 1.5;
      this.ctx.beginPath();
      this.ctx.arc(this.player.x, this.player.y, this.player.hitRadius, 0, Math.PI * 2);
      this.ctx.stroke();
    }
  }

  private renderHud(): void {
    this.ctx.fillStyle = "rgba(4, 10, 18, 0.74)";
    this.ctx.fillRect(12, 12, 516, 88);
    this.ctx.fillRect(12, 106, 170, 94);
    this.ctx.fillRect(358, 106, 170, 94);

    this.ctx.fillStyle = "#dcebf7";
    this.ctx.font = "16px monospace";
    this.ctx.fillText(`SCORE ${this.hud.score.toString().padStart(7, "0")}`, 28, 42);
    this.ctx.fillText(`COMBO x${this.hud.combo}`, 28, 68);
    this.ctx.fillText(`TIME ${(this.hud.stageTimeMs / 1000).toFixed(1)}s`, 360, 42);
    this.ctx.fillText(`POWER Lv.${this.hud.shotLevel}`, 360, 68);
    this.ctx.fillText(`LIFE ${Math.max(this.hud.lives, 0)}`, 28, 134);
    this.ctx.fillText(`BOMB ${this.hud.bombs}`, 28, 160);
    this.ctx.fillText(`SHIELD`, 374, 134);

    this.ctx.fillStyle = "#213746";
    this.ctx.fillRect(374, 146, 120, 18);
    this.ctx.fillStyle = this.player.shield < 35 ? "#ff7b6d" : "#61f0c9";
    this.ctx.fillRect(374, 146, 120 * (this.hud.shield / this.hud.shieldMax), 18);

    const boss = this.enemies.find((enemy) => enemy.type === "boss");
    if (boss) {
      this.ctx.fillStyle = "rgba(4, 10, 18, 0.82)";
      this.ctx.fillRect(70, 214, 400, 28);
      this.ctx.fillStyle = "#692531";
      this.ctx.fillRect(82, 222, 376, 12);
      this.ctx.fillStyle = "#ff6d85";
      this.ctx.fillRect(82, 222, 376 * (boss.hp / boss.maxHp), 12);
      this.ctx.fillStyle = "#f8d7de";
      this.ctx.fillText("BOSS", 246, 234);
    }
  }

  private renderOverlay(): void {
    if (this.scene === "title") {
      this.ctx.fillStyle = "rgba(0, 0, 0, 0.38)";
      this.ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      this.ctx.fillStyle = "#edf6ff";
      this.ctx.font = "bold 44px monospace";
      this.ctx.fillText("STEEL AEGIS 199X", 46, 240);
      this.ctx.font = "18px monospace";
      this.ctx.fillText("縦スクロールシューティング 初期実装版", 86, 290);
      this.ctx.fillText("Enter / Z で出撃", 168, 520);
      this.ctx.fillText("移動: Arrow / WASD", 154, 572);
      this.ctx.fillText("ショット: Z / Space   ボム: X   低速: Shift", 58, 604);
      return;
    }

    if (this.paused) {
      this.ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      this.ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      this.ctx.fillStyle = "#f0fbff";
      this.ctx.font = "bold 40px monospace";
      this.ctx.fillText("PAUSED", 188, 460);
      this.ctx.font = "18px monospace";
      this.ctx.fillText("Esc で再開", 212, 500);
      return;
    }

    if (this.scene === "gameover" || this.scene === "stageclear") {
      this.ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
      this.ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      this.ctx.fillStyle = "#edf6ff";
      this.ctx.font = "bold 42px monospace";
      this.ctx.fillText(this.scene === "gameover" ? "GAME OVER" : "STAGE CLEAR", 130, 420);
      this.ctx.font = "20px monospace";
      this.ctx.fillText(`SCORE ${this.score.toString().padStart(7, "0")}`, 176, 472);
      this.ctx.fillText("Enter / Z でタイトルへ", 130, 520);
    }
  }

  private updateHud(): void {
    this.hud = {
      score: this.score,
      combo: this.combo,
      lives: this.player.lives,
      shield: Math.max(this.player.shield, 0),
      shieldMax: this.player.shieldMax,
      bombs: this.player.bombs,
      shotLevel: this.player.shotLevel,
      stageTimeMs: this.stageTimeMs
    };
  }

  private createStars(): Star[] {
    return Array.from({ length: 70 }, () => ({
      x: Math.random() * GAME_WIDTH,
      y: Math.random() * GAME_HEIGHT,
      speed: 30 + Math.random() * 180,
      size: 1 + Math.random() * 2
    }));
  }

  private nextId(): number {
    const value = this.entityId;
    this.entityId += 1;
    return value;
  }

  private getSpriteScale(spriteId: string): number {
    const baseScale = SPRITE_BASE_SCALES[spriteId] ?? 1;
    return baseScale * SPRITE_SCALE_MULTIPLIER;
  }

  private getSpriteBounds(spriteId: string): { halfWidth: number; halfHeight: number; maxRadius: number } {
    const frame = this.sprites.getFrame(spriteId);
    const scale = this.getSpriteScale(spriteId);

    if (!frame) {
      return {
        halfWidth: 0,
        halfHeight: 0,
        maxRadius: 0
      };
    }

    const halfWidth = (frame.width * scale) / 2;
    const halfHeight = (frame.height * scale) / 2;

    return {
      halfWidth,
      halfHeight,
      maxRadius: Math.max(halfWidth, halfHeight)
    };
  }

  private getEnemyBounds(type: EnemyType): { halfWidth: number; halfHeight: number; maxRadius: number } {
    return this.getSpriteBounds(enemySpriteId(type));
  }
}

function createEnemy(id: number, type: EnemyType, x: number, y: number, vx: number, vy: number): Enemy {
  switch (type) {
    case "drone":
      return {
        id,
        type,
        x,
        y,
        vx,
        vy,
        radius: scaleGameplayValue(18),
        hp: 24,
        maxHp: 24,
        shootCooldownMs: 900,
        ageMs: 0,
        scoreValue: 280
      };
    case "zigzag":
      return {
        id,
        type,
        x,
        y,
        vx,
        vy,
        radius: scaleGameplayValue(19),
        hp: 28,
        maxHp: 28,
        shootCooldownMs: 950,
        ageMs: 0,
        scoreValue: 340
      };
    case "heavy":
      return {
        id,
        type,
        x,
        y,
        vx,
        vy,
        radius: scaleGameplayValue(26),
        hp: 74,
        maxHp: 74,
        shootCooldownMs: 650,
        ageMs: 0,
        scoreValue: 980
      };
    case "boss":
      return {
        id,
        type,
        x,
        y,
        vx,
        vy,
        radius: scaleGameplayValue(72),
        hp: 420,
        maxHp: 420,
        shootCooldownMs: 800,
        ageMs: 0,
        scoreValue: 24000
      };
    default:
      return assertNever(type);
  }
}

function enemySpriteId(type: EnemyType): string {
  switch (type) {
    case "drone":
      return "enemy_drone_a";
    case "zigzag":
      return "enemy_zigzag_a";
    case "heavy":
      return "enemy_heavy_a";
    case "boss":
      return "boss_stage1_core";
    default:
      return assertNever(type);
  }
}

function itemSpriteId(type: ItemType): string {
  switch (type) {
    case "shot":
      return "item_shot";
    case "shield":
      return "item_shield";
    case "bomb":
      return "item_bomb";
    default:
      return assertNever(type);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function scaleGameplayValue(value: number): number {
  return value * SPRITE_SCALE_MULTIPLIER;
}

function distanceSquared(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function radians(value: number): number {
  return (value * Math.PI) / 180;
}

function assertNever(value: never): never {
  throw new Error(`未対応の値です: ${value}`);
}
