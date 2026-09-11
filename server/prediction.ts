import type { PredictionStrategy } from "../src/types.js";

export interface PredictionOutcomeStats {
  totalUsers: number | null;
  totalPoints: number | null;
}

export const SMART_RATIO_PERCENTAGE_GAP = 20;

export function selectPredictionOutcome(
  outcomes: PredictionOutcomeStats[],
  strategy: PredictionStrategy,
): number {
  if (outcomes.length === 0) {
    return 0;
  }

  const firstUsers = outcomes[0].totalUsers ?? 0;
  const firstPoints = outcomes[0].totalPoints ?? 0;
  let usersSum = firstUsers;
  let computable = outcomes.length >= 2 && firstPoints > 0;
  let minPoints = firstPoints;
  let maxPoints = firstPoints;
  let minPointsIndex = 0;
  let maxPointsIndex = 0;
  let majorityIndex = 0;
  let majorityUsers = firstUsers;
  let minUsers = firstUsers;
  let maxUsers = firstUsers;
  let hasPositiveUsers = firstUsers > 0;

  for (let index = 1; index < outcomes.length; index++) {
    const users = outcomes[index].totalUsers ?? 0;
    const points = outcomes[index].totalPoints ?? 0;
    usersSum += users;
    if (points <= 0) {
      computable = false;
    }
    if (users > 0) {
      hasPositiveUsers = true;
    }
    if (points < minPoints) {
      minPoints = points;
      minPointsIndex = index;
    }
    if (points > maxPoints) {
      maxPoints = points;
      maxPointsIndex = index;
    }
    if (users > majorityUsers) {
      majorityUsers = users;
      majorityIndex = index;
    }
    if (users < minUsers) {
      minUsers = users;
    }
    if (users > maxUsers) {
      maxUsers = users;
    }
  }

  if (computable && usersSum > 0) {
    if (strategy === "conservative") {
      return majorityIndex;
    }
    if (
      strategy === "smart_ratio" &&
      (100 * (maxUsers - minUsers)) / usersSum >= SMART_RATIO_PERCENTAGE_GAP
    ) {
      return majorityIndex;
    }
    if (strategy === "lowest_odds") {
      return maxPointsIndex;
    }
    return minPointsIndex;
  }

  if (hasPositiveUsers) {
    return majorityIndex;
  }
  return 0;
}

export type PredictionResultType = "WIN" | "LOSE" | "REFUND";

export function predictionNetPoints(
  result: PredictionResultType,
  betAmount: number,
  pointsWon: number,
): number {
  if (result === "WIN") return pointsWon - betAmount;
  if (result === "LOSE") return -betAmount;
  return 0;
}

export const MIN_PREDICTION_BET = 10;

export function predictionBetAmount(
  balance: number,
  maxBetPoints: number,
  strategy: PredictionStrategy,
): number {
  if (
    !Number.isFinite(balance) ||
    !Number.isFinite(maxBetPoints) ||
    balance <= 0 ||
    maxBetPoints <= 0
  ) {
    return 0;
  }
  const share = strategy === "conservative" ? 0.05 : 0.1;
  const cappedByBalance = Math.min(maxBetPoints, balance);
  const desired = Math.max(MIN_PREDICTION_BET, Math.floor(balance * share));
  const amount = Math.min(cappedByBalance, desired);
  return amount < MIN_PREDICTION_BET ? 0 : amount;
}

export const PREDICTION_FIRE_FALLBACK_MS = 15_000;
export const PREDICTION_FIRE_LOCK_MARGIN_MS = 10_000;
export const PREDICTION_FIRE_WINDOW_FRACTION = 0.6;

export function predictionFireDelayMs(
  createdAtIso: string | null,
  windowSeconds: number | null,
  nowMs: number,
): number {
  if (
    !createdAtIso ||
    windowSeconds === null ||
    !Number.isFinite(windowSeconds) ||
    windowSeconds <= 0
  ) {
    return PREDICTION_FIRE_FALLBACK_MS;
  }
  const createdAtMs = Date.parse(createdAtIso);
  if (Number.isNaN(createdAtMs)) {
    return PREDICTION_FIRE_FALLBACK_MS;
  }
  const windowMs = windowSeconds * 1000;
  const lockAtMs = createdAtMs + windowMs;
  const fractionMs = createdAtMs + windowMs * PREDICTION_FIRE_WINDOW_FRACTION;
  const fireAtMs = Math.max(fractionMs, lockAtMs - PREDICTION_FIRE_LOCK_MARGIN_MS);
  return Math.max(0, fireAtMs - nowMs);
}
