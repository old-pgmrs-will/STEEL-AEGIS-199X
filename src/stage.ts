import type { StageEvent } from "./types";

export const STAGE_EVENTS: StageEvent[] = [
  { atMs: 1200, type: "wave", pattern: "line" },
  { atMs: 3200, type: "wave", pattern: "zigzag" },
  { atMs: 6100, type: "wave", pattern: "sideRush" },
  { atMs: 9600, type: "wave", pattern: "line" },
  { atMs: 12800, type: "wave", pattern: "heavyLine" },
  { atMs: 16300, type: "wave", pattern: "zigzag" },
  { atMs: 19500, type: "wave", pattern: "sideRush" },
  { atMs: 23500, type: "wave", pattern: "heavyLine" },
  { atMs: 27200, type: "wave", pattern: "zigzag" },
  { atMs: 31100, type: "wave", pattern: "line" },
  { atMs: 34700, type: "wave", pattern: "sideRush" },
  { atMs: 39200, type: "wave", pattern: "heavyLine" },
  { atMs: 43800, type: "wave", pattern: "zigzag" },
  { atMs: 48200, type: "wave", pattern: "line" },
  { atMs: 52000, type: "boss" }
];
