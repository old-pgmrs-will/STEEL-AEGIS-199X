import fs from "fs/promises";
import path from "path";

export const ROOT_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
export const SPRITES_DIR = path.join(ROOT_DIR, "assets", "sprites");
export const RAW_DIR = path.join(SPRITES_DIR, "incoming", "raw");
export const CANDIDATES_DIR = path.join(SPRITES_DIR, "incoming", "candidates");
export const APPROVED_DIR = path.join(SPRITES_DIR, "incoming", "approved");
export const APPROVED_NORMALIZED_DIR = path.join(APPROVED_DIR, "normalized");
export const SHEETS_DIR = path.join(SPRITES_DIR, "sheets");
export const MANIFESTS_DIR = path.join(SPRITES_DIR, "manifests");
export const ARCHIVE_DIR = path.join(SPRITES_DIR, "archive");
export const SPRITE_LIST_PATH = path.join(MANIFESTS_DIR, "sprite-list.csv");
export const PROMPT_MANIFEST_PATH = path.join(MANIFESTS_DIR, "prompt-manifest.json");
export const REVIEW_CHECKLIST_PATH = path.join(MANIFESTS_DIR, "review-checklist.md");
export const SHEET_LAYOUT_PATH = path.join(MANIFESTS_DIR, "sheet-layout.json");
export const GENERATION_ERRORS_PATH = path.join(MANIFESTS_DIR, "generation-errors.json");

export async function ensureSpriteDirectories() {
  const directories = [
    RAW_DIR,
    CANDIDATES_DIR,
    APPROVED_DIR,
    APPROVED_NORMALIZED_DIR,
    SHEETS_DIR,
    MANIFESTS_DIR,
    ARCHIVE_DIR
  ];

  await Promise.all(directories.map((directory) => fs.mkdir(directory, { recursive: true })));
}

export async function readSpriteList() {
  const csv = await fs.readFile(SPRITE_LIST_PATH, "utf8");
  return parseCsv(csv);
}

export async function writeSpriteList(records) {
  const csv = toCsv(records);
  await fs.writeFile(SPRITE_LIST_PATH, csv, "utf8");
}

export async function readPromptManifest() {
  const raw = await fs.readFile(PROMPT_MANIFEST_PATH, "utf8");
  return JSON.parse(raw);
}

export async function writeReviewChecklist(content) {
  await fs.writeFile(REVIEW_CHECKLIST_PATH, content, "utf8");
}

export async function writeSheetLayout(layout) {
  await fs.writeFile(SHEET_LAYOUT_PATH, JSON.stringify(layout, null, 2) + "\n", "utf8");
}

export async function readGenerationErrors() {
  try {
    const raw = await fs.readFile(GENERATION_ERRORS_PATH, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return { updatedAt: null, failures: [] };
    }
    throw error;
  }
}

export async function writeGenerationErrors(content) {
  await fs.writeFile(GENERATION_ERRORS_PATH, JSON.stringify(content, null, 2) + "\n", "utf8");
}

export function parseArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];

    if (!next || next.startsWith("--")) {
      options[key] = true;
      continue;
    }

    options[key] = next;
    index += 1;
  }

  return options;
}

export function resolveApprovedSourcePath(record) {
  if (!record.source_file) {
    return null;
  }

  const normalized = path.join(APPROVED_NORMALIZED_DIR, record.source_file);
  const approved = path.join(APPROVED_DIR, record.source_file);

  return { normalized, approved };
}

function parseCsv(content) {
  const lines = content.trim().split(/\r?\n/);
  const [headerLine, ...rows] = lines;
  const headers = splitCsvLine(headerLine);

  return rows
    .filter((row) => row.trim().length > 0)
    .map((row) => {
      const values = splitCsvLine(row);
      return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
    });
}

function splitCsvLine(line) {
  const values = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === "\"") {
      const next = line[index + 1];
      if (insideQuotes && next === "\"") {
        current += "\"";
        index += 1;
        continue;
      }
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === "," && !insideQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function toCsv(records) {
  if (records.length === 0) {
    return "";
  }

  const headers = Object.keys(records[0]);
  const rows = [headers.join(",")];

  for (const record of records) {
    rows.push(headers.map((header) => escapeCsvValue(record[header] ?? "")).join(","));
  }

  return rows.join("\n") + "\n";
}

function escapeCsvValue(value) {
  const text = String(value);
  if (!text.includes(",") && !text.includes("\"") && !text.includes("\n")) {
    return text;
  }
  return `"${text.replaceAll("\"", "\"\"")}"`;
}
