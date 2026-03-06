import type { SpriteAssetBundle, SpriteLayoutEntry } from "./spriteAssets";

type SpriteFrame = {
  sheet: string;
  x: number;
  y: number;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
};

type DrawSpriteOptions = {
  scale?: number;
  alpha?: number;
  flipX?: boolean;
  flipY?: boolean;
};

export class SpriteSheet {
  private readonly images: Map<string, HTMLImageElement>;
  private readonly frames: Map<string, SpriteFrame>;

  constructor(assets: SpriteAssetBundle) {
    this.images = assets.images;
    this.frames = buildFrames(assets.layout);
  }

  getFrame(spriteId: string): Readonly<SpriteFrame> | null {
    return this.frames.get(spriteId) ?? null;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    spriteId: string,
    x: number,
    y: number,
    options: DrawSpriteOptions = {}
  ): void {
    const frame = this.frames.get(spriteId);
    const image = frame ? this.images.get(frame.sheet) : null;

    if (!frame || !image) {
      return;
    }

    const scale = options.scale ?? 1;
    const alpha = options.alpha ?? 1;
    const flipX = options.flipX ? -1 : 1;
    const flipY = options.flipY ? -1 : 1;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.scale(flipX, flipY);
    ctx.drawImage(
      image,
      frame.x,
      frame.y,
      frame.width,
      frame.height,
      -frame.anchorX * scale,
      -frame.anchorY * scale,
      frame.width * scale,
      frame.height * scale
    );
    ctx.restore();
  }
}

const SPRITE_ANCHOR_OVERRIDES: Partial<Record<string, { anchorX: number; anchorY: number }>> = {};

function buildFrames(layout: Record<string, SpriteLayoutEntry>): Map<string, SpriteFrame> {
  const frames = new Map<string, SpriteFrame>();

  for (const [spriteId, entry] of Object.entries(layout)) {
    const anchor = SPRITE_ANCHOR_OVERRIDES[spriteId];
    frames.set(spriteId, {
      sheet: entry.sheet,
      x: entry.x,
      y: entry.y,
      width: entry.width,
      height: entry.height,
      anchorX: anchor?.anchorX ?? entry.width / 2,
      anchorY: anchor?.anchorY ?? entry.height / 2
    });
  }

  return frames;
}
