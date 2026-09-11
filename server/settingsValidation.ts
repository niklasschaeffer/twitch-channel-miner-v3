import { PredictionStrategy, PriorityMode } from "../src/types.js";

const PRIORITY_MODES = [
  "points_asc",
  "points_desc",
  "streak",
  "manual",
] as const satisfies readonly PriorityMode[];
const PREDICTION_STRATEGIES = [
  "lowest_odds",
  "highest_odds",
  "smart_ratio",
  "conservative",
] as const satisfies readonly PredictionStrategy[];

export interface SettingsPatch {
  maxConcurrentStreams?: number;
  priorityMode?: PriorityMode;
  autoClaimBonus?: boolean;
  claimDelaySeconds?: number;
  followRaids?: boolean;
  autoClaimDrops?: boolean;
  autoBetPredictions?: boolean;
  predictionStrategy?: PredictionStrategy;
  maxBetPoints?: number;
  checkIntervalSeconds?: number;
}

export type SettingsPatchResult = { ok: true; patch: SettingsPatch } | { ok: false; error: string };

const MIN_CONCURRENT_STREAMS = 1;
const MAX_CONCURRENT_STREAMS = 2;
const MIN_CLAIM_DELAY_SECONDS = 1;
const MAX_CLAIM_DELAY_SECONDS = 15;
const MIN_BET_POINTS = 10;
const MAX_BET_POINTS = 1_000_000;
const MIN_CHECK_INTERVAL_SECONDS = 2;
const MAX_CHECK_INTERVAL_SECONDS = 300;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const clampInt = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Math.round(value)));

const BOOLEAN_FIELDS = [
  "autoClaimBonus",
  "followRaids",
  "autoClaimDrops",
  "autoBetPredictions",
] as const;

export function sanitizeSettingsPatch(body: unknown): SettingsPatchResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Request body must be an object" };
  }
  const input = body as Record<string, unknown>;
  const patch: SettingsPatch = {};

  if ("maxConcurrentStreams" in input) {
    if (!isFiniteNumber(input.maxConcurrentStreams)) {
      return { ok: false, error: "maxConcurrentStreams must be a number" };
    }
    patch.maxConcurrentStreams = clampInt(
      input.maxConcurrentStreams,
      MIN_CONCURRENT_STREAMS,
      MAX_CONCURRENT_STREAMS,
    );
  }

  if ("claimDelaySeconds" in input) {
    if (!isFiniteNumber(input.claimDelaySeconds)) {
      return { ok: false, error: "claimDelaySeconds must be a number" };
    }
    patch.claimDelaySeconds = clampInt(
      input.claimDelaySeconds,
      MIN_CLAIM_DELAY_SECONDS,
      MAX_CLAIM_DELAY_SECONDS,
    );
  }

  if ("checkIntervalSeconds" in input) {
    if (!isFiniteNumber(input.checkIntervalSeconds)) {
      return { ok: false, error: "checkIntervalSeconds must be a number" };
    }
    patch.checkIntervalSeconds = clampInt(
      input.checkIntervalSeconds,
      MIN_CHECK_INTERVAL_SECONDS,
      MAX_CHECK_INTERVAL_SECONDS,
    );
  }

  if ("maxBetPoints" in input) {
    if (!isFiniteNumber(input.maxBetPoints)) {
      return { ok: false, error: "maxBetPoints must be a number" };
    }
    patch.maxBetPoints = clampInt(input.maxBetPoints, MIN_BET_POINTS, MAX_BET_POINTS);
  }

  if ("priorityMode" in input) {
    if (
      typeof input.priorityMode !== "string" ||
      !PRIORITY_MODES.includes(input.priorityMode as PriorityMode)
    ) {
      return { ok: false, error: `priorityMode must be one of ${PRIORITY_MODES.join(", ")}` };
    }
    patch.priorityMode = input.priorityMode as PriorityMode;
  }

  if ("predictionStrategy" in input) {
    if (
      typeof input.predictionStrategy !== "string" ||
      !PREDICTION_STRATEGIES.includes(input.predictionStrategy as PredictionStrategy)
    ) {
      return {
        ok: false,
        error: `predictionStrategy must be one of ${PREDICTION_STRATEGIES.join(", ")}`,
      };
    }
    patch.predictionStrategy = input.predictionStrategy as PredictionStrategy;
  }

  for (const key of BOOLEAN_FIELDS) {
    if (key in input) {
      const value = input[key];
      if (typeof value !== "boolean") {
        return { ok: false, error: `${key} must be a boolean` };
      }
      patch[key] = value;
    }
  }

  return { ok: true, patch };
}
