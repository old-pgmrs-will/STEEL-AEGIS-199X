import fs from "fs/promises";
import path from "path";
import OpenAI from "openai";
import { loadLocalEnv } from "./lib/load-env.mjs";
import {
  GENERATION_ERRORS_PATH,
  RAW_DIR,
  ensureSpriteDirectories,
  parseArgs,
  readGenerationErrors,
  readPromptManifest,
  readSpriteList,
  writeGenerationErrors,
  writeSpriteList
} from "./lib/sprite-manifest.mjs";

const options = parseArgs(process.argv.slice(2));
const MAX_RETRIES = 3;

async function main() {
  await loadLocalEnv();

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY が設定されていません。.env.local または .env に設定してください。");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  await ensureSpriteDirectories();

  const spriteList = await readSpriteList();
  const promptManifest = await readPromptManifest();
  const promptMap = new Map(promptManifest.records.map((record) => [record.spriteId, record]));
  const generationErrors = await readGenerationErrors();

  const targetSpriteId = typeof options.sprite === "string" ? options.sprite : null;
  const force = Boolean(options.force);
  const limit = typeof options.limit === "string" ? Number.parseInt(options.limit, 10) : Number.POSITIVE_INFINITY;
  let generatedCount = 0;
  let failureCount = 0;

  logInfo(`生成開始: target=${targetSpriteId ?? "all"}, force=${force}, limit=${Number.isFinite(limit) ? limit : "all"}`);

  for (const record of spriteList) {
    if (generatedCount >= limit) {
      break;
    }

    if (record.required !== "yes") {
      continue;
    }

    if (targetSpriteId && record.sprite_id !== targetSpriteId) {
      continue;
    }

    if (!force && !["planned", "generated"].includes(record.status)) {
      continue;
    }

    const promptRecord = promptMap.get(record.sprite_id);
    if (!promptRecord) {
      throw new Error(`prompt-manifest.json に ${record.sprite_id} の定義がありません。`);
    }

    const variants = Number.isFinite(Number(promptRecord.variants)) ? Number(promptRecord.variants) : 4;
    const prompt = buildPrompt(promptRecord);
    const background = promptRecord.background === "transparent" ? "transparent" : "opaque";

    logInfo(`対象: ${record.sprite_id} (${generatedCount + failureCount + 1})`);

    try {
      const images = await generateWithRetry(client, {
        spriteId: record.sprite_id,
        model: promptRecord.model ?? "gpt-image-1.5",
        prompt,
        size: promptRecord.size ?? "1024x1024",
        quality: promptRecord.quality ?? "high",
        background,
        variants
      });

      await writeGeneratedImages(record.sprite_id, images);
      record.status = "generated";
      generatedCount += 1;
      logInfo(`保存完了: ${record.sprite_id} -> ${images.length} file(s)`);
    } catch (error) {
      const failure = toFailureRecord(record.sprite_id, error);
      generationErrors.failures.push(failure);
      generationErrors.updatedAt = new Date().toISOString();
      failureCount += 1;
      await writeGenerationErrors(generationErrors);
      logError(`失敗: ${record.sprite_id} [${failure.kind}] ${failure.message}`);

      if (failure.fatal) {
        await writeSpriteList(spriteList);
        logError(`致命停止: ${record.sprite_id}`);
        throw new Error(buildFatalErrorMessage(failure));
      }
    }
  }

  await writeSpriteList(spriteList);
  generationErrors.updatedAt = new Date().toISOString();
  await writeGenerationErrors(generationErrors);
  logInfo(`完了: generated=${generatedCount}, failures=${failureCount}, errors=${GENERATION_ERRORS_PATH}`);
}

function buildPrompt(record) {
  const sections = [record.prompt.trim()];

  if (record.background === "magenta") {
    sections.push("Use a perfectly flat solid #FF00FF background.");
  }

  if (record.background === "green") {
    sections.push("Use a perfectly flat solid #00FF00 background.");
  }

  sections.push(
    `The sprite will be normalized into a ${record.cellWidth}x${record.cellHeight} cell after review, so keep the subject centered with clean empty margin.`
  );

  if (record.negativePrompt) {
    sections.push(`Avoid the following: ${record.negativePrompt}`);
  }

  return sections.join("\n\n");
}

async function generateWithRetry(client, request) {
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    attempt += 1;
    logInfo(`生成中: ${request.spriteId} (attempt ${attempt}/${MAX_RETRIES})`);

    try {
      const result = await client.images.generate({
        model: request.model,
        prompt: request.prompt,
        size: request.size,
        quality: request.quality,
        background: request.background,
        output_format: "png",
        n: request.variants
      });

      const images = result.data ?? [];
      if (images.length === 0) {
        throw new Error(`${request.spriteId} の画像生成結果が空でした。`);
      }

      for (const image of images) {
        if (!image.b64_json) {
          throw new Error(`${request.spriteId} のレスポンスに b64_json がありません。`);
        }
      }

      return images;
    } catch (error) {
      const classification = classifyGenerationError(error);

      if (!classification.retryable || attempt >= MAX_RETRIES) {
        throw Object.assign(error instanceof Error ? error : new Error(String(error)), {
          spriteFailure: {
            kind: classification.kind,
            status: classification.status,
            retryable: classification.retryable,
            fatal: classification.fatal,
            attempts: attempt,
            message: classification.message
          }
        });
      }

      logWarn(`再試行: ${request.spriteId} [${classification.kind}] attempt ${attempt}/${MAX_RETRIES}`);
      await delay(backoffMs(attempt));
    }
  }

  throw new Error(`${request.spriteId} の生成に失敗しました。`);
}

async function writeGeneratedImages(spriteId, images) {
  const tempFiles = [];

  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];
    const filename = `${spriteId}__v${String(index + 1).padStart(2, "0")}.png`;
    const filepath = path.join(RAW_DIR, filename);
    const tempPath = `${filepath}.tmp`;
    const buffer = Buffer.from(image.b64_json, "base64");
    tempFiles.push({ filepath, tempPath });
    await fs.writeFile(tempPath, buffer);
  }

  for (const file of tempFiles) {
    await fs.rename(file.tempPath, file.filepath);
  }
}

function classifyGenerationError(error) {
  const status = typeof error?.status === "number" ? error.status : undefined;
  const message = error instanceof Error ? error.message : String(error);
  const name = typeof error?.name === "string" ? error.name : "";

  if (status === 401) {
    return {
      kind: "invalid_api_key",
      status,
      retryable: false,
      fatal: true,
      message: "APIキーが無効です。.env.local の OPENAI_API_KEY を確認してください。"
    };
  }

  if (status === 403) {
    return {
      kind: "forbidden",
      status,
      retryable: false,
      fatal: true,
      message: "APIキーに画像生成の権限がありません。組織設定と課金状態を確認してください。"
    };
  }

  if (status === 429) {
    return {
      kind: "rate_limited",
      status,
      retryable: true,
      fatal: false,
      message: "レート制限に達しました。時間を置いて再試行してください。"
    };
  }

  if (typeof status === "number" && status >= 500) {
    return {
      kind: "server_error",
      status,
      retryable: true,
      fatal: false,
      message: "画像生成APIで一時的なサーバーエラーが発生しました。"
    };
  }

  if (name.includes("Connection") || name.includes("Timeout") || /network|fetch failed|timeout/i.test(message)) {
    return {
      kind: "network_error",
      status,
      retryable: true,
      fatal: false,
      message: "ネットワークまたはタイムアウトにより画像生成APIへ接続できませんでした。"
    };
  }

  return {
    kind: "unknown_error",
    status,
    retryable: false,
    fatal: false,
    message
  };
}

function toFailureRecord(spriteId, error) {
  const embedded = error?.spriteFailure;
  const classification = embedded
    ? embedded
    : {
        ...classifyGenerationError(error),
        attempts: 1
      };

  return {
    spriteId,
    kind: classification.kind,
    status: classification.status ?? null,
    retryable: classification.retryable,
    fatal: classification.fatal,
    attempts: classification.attempts ?? 1,
    message: classification.message,
    timestamp: new Date().toISOString()
  };
}

function buildFatalErrorMessage(failure) {
  return `${failure.message} 失敗詳細は generation-errors.json を確認してください。`;
}

function backoffMs(attempt) {
  return 500 * 2 ** (attempt - 1);
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function logInfo(message) {
  console.log(`[sprites] ${message}`);
}

function logWarn(message) {
  console.warn(`[sprites] ${message}`);
}

function logError(message) {
  console.error(`[sprites] ${message}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
