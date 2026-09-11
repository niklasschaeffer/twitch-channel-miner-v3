import { describe, expect, it } from "vitest";
import {
  predictionBetAmount,
  predictionNetPoints,
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
});
