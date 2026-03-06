import fs from "fs/promises";
import path from "path";
import { ROOT_DIR } from "./sprite-manifest.mjs";

export async function loadLocalEnv() {
  const envFiles = [".env", ".env.local"];

  for (const filename of envFiles) {
    const filepath = path.join(ROOT_DIR, filename);

    try {
      const content = await fs.readFile(filepath, "utf8");
      applyEnvContent(content);
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        continue;
      }
      throw error;
    }
  }
}

function applyEnvContent(content) {
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = stripQuotes(rawValue);

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function stripQuotes(value) {
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
