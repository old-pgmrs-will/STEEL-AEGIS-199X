import {
  ensureSpriteDirectories,
  readSpriteList,
  writeReviewChecklist
} from "./lib/sprite-manifest.mjs";

async function main() {
  await ensureSpriteDirectories();
  const spriteList = await readSpriteList();
  const requiredSprites = spriteList.filter((record) => record.required === "yes");

  const lines = ["# Review Checklist", ""];

  for (const record of requiredSprites) {
    lines.push(`## ${record.sprite_id}`);
    lines.push(`- [ ] 背景が透過または完全単色`);
    lines.push(`- [ ] 文字やロゴの混入なし`);
    lines.push(`- [ ] 輪郭がぼけていない`);
    lines.push(`- [ ] 前方方向が明確`);
    lines.push(`- [ ] セルサイズ ${record.cell_width}x${record.cell_height} に収められる`);
    lines.push(`- [ ] 同カテゴリ内で視点とサイズ感が揃う`);
    lines.push(`- [ ] 採用`);
    lines.push("");
  }

  await writeReviewChecklist(lines.join("\n"));
  console.log(`review sections: ${requiredSprites.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
