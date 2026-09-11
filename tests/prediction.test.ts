import { describe, expect, it } from "vitest";
import {
  MIN_PREDICTION_BET,
  predictionBetAmount,
  predictionFireDelayMs,
  predictionNetPoints,
  PREDICTION_FIRE_FALLBACK_MS,
  selectPredictionOutcome,
  SMART_RATIO_PERCENTAGE_GAP,
  type PredictionOutcomeStats,
} from "../server/prediction.js";

const stats = (users: number | null, points: number | null): PredictionOutcomeStats => ({
  totalUsers: users,
  totalPoints: points,
});

describe("selectPredictionOutcome", () => {
  it("computes odds as pool over side-pool and follows each odds strategy", () => {
    const outcomes = [stats(100, 800), stats(50, 200)];
    expect(selectPredictionOutcome(outcomes, "highest_odds")).toBe(1);
    expect(selectPredictionOutcome(outcomes, "lowest_odds")).toBe(0);
  });

  it("resolves the EV asymmetry case per strategy", () => {
    const outcomes = [stats(90, 900), stats(10, 100)];
    expect(selectPredictionOutcome(outcomes, "highest_odds")).toBe(1);
    expect(selectPredictionOutcome(outcomes, "lowest_odds")).toBe(0);
    expect(selectPredictionOutcome(outcomes, "smart_ratio")).toBe(0);
    expect(selectPredictionOutcome(outcomes, "conservative")).toBe(0);
  });

  it("sends smart_ratio contrarian when the crowd is evenly split", () => {
    const outcomes = [stats(55, 600), stats(45, 400)];
    expect(selectPredictionOutcome(outcomes, "smart_ratio")).toBe(1);
    expect(selectPredictionOutcome(outcomes, "conservative")).toBe(0);
    expect(selectPredictionOutcome(outcomes, "highest_odds")).toBe(1);
    expect(selectPredictionOutcome(outcomes, "lowest_odds")).toBe(0);
  });

  it("falls back to majority users when an outcome has zero points", () => {
    const outcomes = [stats(30, 900), stats(70, 0)];
    expect(selectPredictionOutcome(outcomes, "highest_odds")).toBe(1);
    expect(selectPredictionOutcome(outcomes, "lowest_odds")).toBe(1);
    expect(selectPredictionOutcome(outcomes, "smart_ratio")).toBe(1);
    expect(selectPredictionOutcome(outcomes, "conservative")).toBe(1);
  });

  it("returns index 0 when all stats are null", () => {
    const outcomes = [stats(null, null), stats(null, null)];
    for (const strategy of [
      "lowest_odds",
      "highest_odds",
      "smart_ratio",
      "conservative",
    ] as const) {
      expect(selectPredictionOutcome(outcomes, strategy)).toBe(0);
    }
  });

  it("breaks ties toward the lowest index", () => {
    const tiedOdds = [stats(50, 500), stats(50, 500)];
    expect(selectPredictionOutcome(tiedOdds, "highest_odds")).toBe(0);
    expect(selectPredictionOutcome(tiedOdds, "lowest_odds")).toBe(0);
    expect(selectPredictionOutcome(tiedOdds, "conservative")).toBe(0);

    const tiedUsersZeroPoints = [stats(40, 0), stats(40, 500)];
    expect(selectPredictionOutcome(tiedUsersZeroPoints, "conservative")).toBe(0);
  });

  it("generalizes to three outcomes", () => {
    const outcomes = [stats(60, 1200), stats(30, 300), stats(10, 500)];
    expect(selectPredictionOutcome(outcomes, "highest_odds")).toBe(1);
    expect(selectPredictionOutcome(outcomes, "lowest_odds")).toBe(0);
    expect(selectPredictionOutcome(outcomes, "conservative")).toBe(0);

    const closeSplit = [stats(38, 1200), stats(34, 300), stats(28, 500)];
    expect(selectPredictionOutcome(closeSplit, "smart_ratio")).toBe(1);
    expect(selectPredictionOutcome(closeSplit, "conservative")).toBe(0);
  });

  it("returns 0 for an empty outcomes array", () => {
    for (const strategy of [
      "lowest_odds",
      "highest_odds",
      "smart_ratio",
      "conservative",
    ] as const) {
      expect(selectPredictionOutcome([], strategy)).toBe(0);
    }
  });

  it("exposes the crowd-split gap constant", () => {
    expect(SMART_RATIO_PERCENTAGE_GAP).toBe(20);
  });
});

describe("predictionNetPoints", () => {
  it("nets the gross payout of a win against the stake", () => {
    expect(predictionNetPoints("WIN", 100, 250)).toBe(150);
  });

  it("loses the full stake", () => {
    expect(predictionNetPoints("LOSE", 100, 0)).toBe(-100);
  });

  it("returns nothing for a refund", () => {
    expect(predictionNetPoints("REFUND", 100, 100)).toBe(0);
  });
});

describe("predictionBetAmount", () => {
  it("stakes 10% of the balance up to the configured cap", () => {
    expect(predictionBetAmount(500, 100, "smart_ratio")).toBe(50);
    expect(predictionBetAmount(50_000, 100, "smart_ratio")).toBe(100);
  });

  it("caps the conservative strategy at 5% of the balance", () => {
    expect(predictionBetAmount(1000, 100, "conservative")).toBe(50);
  });

  it("never stakes below the Twitch minimum", () => {
    expect(predictionBetAmount(40, 100, "conservative")).toBe(10);
  });

  it("skips the bet when the configured cap is below the Twitch minimum", () => {
    expect(predictionBetAmount(500, 5, "smart_ratio")).toBe(0);
  });

  it("skips the bet when the balance itself is below the Twitch minimum", () => {
    expect(predictionBetAmount(5, 100, "smart_ratio")).toBe(0);
  });

  it("never exceeds the available balance", () => {
    expect(predictionBetAmount(30, 100, "smart_ratio")).toBeLessThanOrEqual(30);
  });

  it("skips the bet for non-finite inputs", () => {
    expect(predictionBetAmount(Number.NaN, 100, "smart_ratio")).toBe(0);
    expect(predictionBetAmount(500, Number.NaN, "smart_ratio")).toBe(0);
    expect(predictionBetAmount(Number.POSITIVE_INFINITY, 100, "smart_ratio")).toBe(0);
  });

  it("skips the bet for a zero or negative balance", () => {
    expect(predictionBetAmount(0, 100, "smart_ratio")).toBe(0);
    expect(predictionBetAmount(-50, 100, "smart_ratio")).toBe(0);
  });
});

describe("predictionFireDelayMs", () => {
  const createdAt = "2026-09-11T19:00:00.000Z";
  const createdAtMs = Date.parse(createdAt);

  it("fires at 60% of the window when that is later than lock minus the margin", () => {
    const delay = predictionFireDelayMs(createdAt, 20, createdAtMs);
    expect(delay).toBe(20_000 * 0.6);
  });

  it("fires 10s before lock when that is later than the 60% mark", () => {
    const delay = predictionFireDelayMs(createdAt, 60, createdAtMs);
    expect(delay).toBe(60_000 - 10_000);
  });

  it("never returns a negative delay once past the fire point", () => {
    const pastFire = createdAtMs + 55_000;
    expect(predictionFireDelayMs(createdAt, 60, pastFire)).toBe(0);
  });

  it("falls back to a short delay when createdAt is missing", () => {
    expect(predictionFireDelayMs(null, 60, createdAtMs)).toBe(PREDICTION_FIRE_FALLBACK_MS);
  });

  it("falls back to a short delay when the window is missing or invalid", () => {
    expect(predictionFireDelayMs(createdAt, null, createdAtMs)).toBe(PREDICTION_FIRE_FALLBACK_MS);
    expect(predictionFireDelayMs(createdAt, 0, createdAtMs)).toBe(PREDICTION_FIRE_FALLBACK_MS);
    expect(predictionFireDelayMs(createdAt, -5, createdAtMs)).toBe(PREDICTION_FIRE_FALLBACK_MS);
  });

  it("falls back to a short delay when createdAt cannot be parsed", () => {
    expect(predictionFireDelayMs("not-a-date", 60, createdAtMs)).toBe(PREDICTION_FIRE_FALLBACK_MS);
  });

  it("handles Twitch's nanosecond-precision created_at timestamps", () => {
    const nanoPrecise = "2026-09-11T19:00:00.937395583Z";
    const nanoMs = Date.parse(nanoPrecise);
    expect(Number.isNaN(nanoMs)).toBe(false);
    const delay = predictionFireDelayMs(nanoPrecise, 60, nanoMs);
    expect(delay).toBeGreaterThan(0);
    expect(delay).toBeLessThanOrEqual(60_000);
  });

  it("exposes the Twitch minimum bet constant", () => {
    expect(MIN_PREDICTION_BET).toBe(10);
  });
});
