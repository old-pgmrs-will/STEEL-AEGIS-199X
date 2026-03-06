import fs from "fs/promises";
import path from "path";
import { PNG } from "pngjs";
import {
  APPROVED_DIR,
  APPROVED_NORMALIZED_DIR,
  CANDIDATES_DIR,
  ensureSpriteDirectories,
  parseArgs,
  readSpriteList,
  writeSpriteList
} from "./lib/sprite-manifest.mjs";

const options = parseArgs(process.argv.slice(2));

async function main() {
  await ensureSpriteDirectories();

  const onlySprite = typeof options.sprite === "string" ? options.sprite : null;
  const spriteList = await readSpriteList();
  const targets = spriteList.filter((record) => {
    if (record.status !== "candidate") {
      return false;
    }
    if (!record.source_file) {
      return false;
    }
    if (onlySprite && record.sprite_id !== onlySprite) {
      return false;
    }
    return true;
  });

  logInfo(`正規化開始: target=${onlySprite ?? "all"}, count=${targets.length}`);

  for (const record of targets) {
    const inputPath = path.join(CANDIDATES_DIR, record.source_file);
    const approvedPath = path.join(APPROVED_DIR, record.source_file);
    const normalizedPath = path.join(APPROVED_NORMALIZED_DIR, record.source_file);

    logInfo(`処理中: ${record.sprite_id}`);

    const buffer = await fs.readFile(inputPath);
    const png = PNG.sync.read(buffer);
    const masked = removeBackground(png);
    const normalized = normalizeToCell(
      masked,
      Number.parseInt(record.cell_width, 10),
      Number.parseInt(record.cell_height, 10)
    );

    await fs.copyFile(inputPath, approvedPath);
    await fs.writeFile(normalizedPath, PNG.sync.write(normalized));

    record.status = "normalized";
    logInfo(`保存完了: ${record.sprite_id} -> ${normalizedPath}`);
  }

  await writeSpriteList(spriteList);
  logInfo(`完了: normalized=${targets.length}`);
}

function removeBackground(png) {
  const output = clonePng(png);
  const visited = new Uint8Array(output.width * output.height);
  const queue = [];

  enqueueBorderPixels(output.width, output.height, queue);

  while (queue.length > 0) {
    const index = queue.shift();
    if (visited[index]) {
      continue;
    }
    visited[index] = 1;

    const x = index % output.width;
    const y = Math.floor(index / output.width);
    const offset = (y * output.width + x) * 4;
    const rgba = readPixel(output.data, offset);

    if (!isBackgroundPixel(rgba)) {
      continue;
    }

    output.data[offset + 3] = 0;

    const neighbors = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1]
    ];

    for (const [nx, ny] of neighbors) {
      if (nx < 0 || ny < 0 || nx >= output.width || ny >= output.height) {
        continue;
      }
      queue.push(ny * output.width + nx);
    }
  }

  return output;
}

function normalizeToCell(png, cellWidth, cellHeight) {
  const bounds = findOpaqueBounds(png);
  if (!bounds) {
    throw new Error("背景除去後に不透明ピクセルが残りませんでした。");
  }

  const cropped = cropPng(png, bounds);
  const margin = cellWidth <= 16 || cellHeight <= 16 ? 1 : 2;
  const maxWidth = Math.max(1, cellWidth - margin * 2);
  const maxHeight = Math.max(1, cellHeight - margin * 2);
  const scale = Math.min(maxWidth / cropped.width, maxHeight / cropped.height);
  const targetWidth = Math.max(1, Math.min(maxWidth, Math.round(cropped.width * scale)));
  const targetHeight = Math.max(1, Math.min(maxHeight, Math.round(cropped.height * scale)));
  const resized = resizeNearest(cropped, targetWidth, targetHeight);
  const canvas = new PNG({ width: cellWidth, height: cellHeight });
  const offsetX = Math.floor((cellWidth - targetWidth) / 2);
  const offsetY = Math.floor((cellHeight - targetHeight) / 2);

  PNG.bitblt(resized, canvas, 0, 0, targetWidth, targetHeight, offsetX, offsetY);
  return canvas;
}

function cropPng(png, bounds) {
  const result = new PNG({ width: bounds.width, height: bounds.height });
  PNG.bitblt(png, result, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0);
  return result;
}

function resizeNearest(source, targetWidth, targetHeight) {
  const result = new PNG({ width: targetWidth, height: targetHeight });

  for (let y = 0; y < targetHeight; y += 1) {
    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = Math.min(source.width - 1, Math.floor((x / targetWidth) * source.width));
      const sourceY = Math.min(source.height - 1, Math.floor((y / targetHeight) * source.height));
      const sourceOffset = (sourceY * source.width + sourceX) * 4;
      const targetOffset = (y * targetWidth + x) * 4;

      result.data[targetOffset + 0] = source.data[sourceOffset + 0];
      result.data[targetOffset + 1] = source.data[sourceOffset + 1];
      result.data[targetOffset + 2] = source.data[sourceOffset + 2];
      result.data[targetOffset + 3] = source.data[sourceOffset + 3];
    }
  }

  return result;
}

function findOpaqueBounds(png) {
  let minX = png.width;
  let minY = png.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const offset = (y * png.width + x) * 4;
      const alpha = png.data[offset + 3];
      if (alpha === 0) {
        continue;
      }
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    return null;
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}

function enqueueBorderPixels(width, height, queue) {
  for (let x = 0; x < width; x += 1) {
    queue.push(x);
    queue.push((height - 1) * width + x);
  }

  for (let y = 1; y < height - 1; y += 1) {
    queue.push(y * width);
    queue.push(y * width + (width - 1));
  }
}

function isBackgroundPixel(rgba) {
  const [r, g, b, a] = rgba;
  if (a === 0) {
    return true;
  }

  const { saturation, value } = rgbToHsv(r, g, b);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  if (saturation <= 0.18) {
    return true;
  }

  if (value <= 0.18) {
    return true;
  }

  if (saturation <= 0.32 && luminance <= 130) {
    return true;
  }

  return false;
}

function rgbToHsv(r, g, b) {
  const nr = r / 255;
  const ng = g / 255;
  const nb = b / 255;
  const max = Math.max(nr, ng, nb);
  const min = Math.min(nr, ng, nb);
  const delta = max - min;

  const saturation = max === 0 ? 0 : delta / max;
  const value = max;

  return { saturation, value };
}

function clonePng(png) {
  const clone = new PNG({ width: png.width, height: png.height });
  png.data.copy(clone.data);
  return clone;
}

function readPixel(data, offset) {
  return [data[offset + 0], data[offset + 1], data[offset + 2], data[offset + 3]];
}

function logInfo(message) {
  console.log(`[sprites] ${message}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
