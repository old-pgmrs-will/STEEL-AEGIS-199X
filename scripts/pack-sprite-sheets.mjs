import fs from "fs/promises";
import path from "path";
import { PNG } from "pngjs";
import {
  SHEETS_DIR,
  ensureSpriteDirectories,
  readSpriteList,
  resolveApprovedSourcePath,
  writeSheetLayout,
  writeSpriteList
} from "./lib/sprite-manifest.mjs";

async function main() {
  await ensureSpriteDirectories();

  const spriteList = await readSpriteList();
  const packTargets = [];

  for (const record of spriteList) {
    if (!["approved", "normalized", "packed"].includes(record.status)) {
      continue;
    }

    const resolved = resolveApprovedSourcePath(record);
    if (!resolved) {
      continue;
    }

    const filePath = await firstExistingPath([resolved.normalized, resolved.approved]);
    if (!filePath) {
      continue;
    }

    const buffer = await fs.readFile(filePath);
    const png = PNG.sync.read(buffer);
    const cellWidth = Number.parseInt(record.cell_width, 10);
    const cellHeight = Number.parseInt(record.cell_height, 10);

    if (png.width > cellWidth || png.height > cellHeight) {
      throw new Error(
        `${record.sprite_id} の画像サイズ ${png.width}x${png.height} がセル ${cellWidth}x${cellHeight} を超えています。`
      );
    }

    packTargets.push({
      record,
      filePath,
      png,
      cellWidth,
      cellHeight,
      sheetName: record.sheet_name || buildSheetName(record, cellWidth, cellHeight)
    });
  }

  const bySheet = groupBy(packTargets, (target) => target.sheetName);
  const layout = {};

  for (const [sheetName, entries] of bySheet.entries()) {
    const first = entries[0];
    const columns = Math.min(8, Math.max(1, Math.ceil(Math.sqrt(entries.length))));
    const rows = Math.ceil(entries.length / columns);
    const sheet = new PNG({
      width: columns * first.cellWidth,
      height: rows * first.cellHeight
    });

    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      if (entry.cellWidth !== first.cellWidth || entry.cellHeight !== first.cellHeight) {
        throw new Error(`${sheetName} に異なるセルサイズを混在させることはできません。`);
      }

      const col = index % columns;
      const row = Math.floor(index / columns);
      const frameX = col * entry.cellWidth;
      const frameY = row * entry.cellHeight;
      const offsetX = Math.floor((entry.cellWidth - entry.png.width) / 2);
      const offsetY = Math.floor((entry.cellHeight - entry.png.height) / 2);

      blit(entry.png, sheet, frameX + offsetX, frameY + offsetY);

      entry.record.status = "packed";
      entry.record.sheet_name = sheetName;
      entry.record.frame_x = String(frameX);
      entry.record.frame_y = String(frameY);

      layout[entry.record.sprite_id] = {
        sheet: sheetName,
        x: frameX,
        y: frameY,
        width: entry.cellWidth,
        height: entry.cellHeight
      };
    }

    const outputPath = path.join(SHEETS_DIR, sheetName);
    const bytes = PNG.sync.write(sheet);
    await fs.writeFile(outputPath, bytes);
  }

  await writeSheetLayout(layout);
  await writeSpriteList(spriteList);
  console.log(`packed: ${Object.keys(layout).length}`);
}

function blit(source, target, targetX, targetY) {
  PNG.bitblt(source, target, 0, 0, source.width, source.height, targetX, targetY);
}

async function firstExistingPath(paths) {
  for (const candidate of paths) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

function groupBy(items, selector) {
  const map = new Map();

  for (const item of items) {
    const key = selector(item);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(item);
  }

  return map;
}

function buildSheetName(record, cellWidth, cellHeight) {
  const normalizedCategory = record.category.replace(/_/g, "-");
  return `${normalizedCategory}-${cellWidth}x${cellHeight}.png`;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
