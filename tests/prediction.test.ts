import { describe, expect, it } from "vitest";
import {
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
