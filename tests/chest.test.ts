import { describe, expect, it } from "vitest";
import { formatSubTier } from "../src/lib/badges.js";
import { computeChestProgress, CHEST_WATCH_MINUTES_REQUIRED } from "../server/chest.js";

describe("formatSubTier", () => {
  it("maps Twitch tier codes to display labels", () => {
    expect(formatSubTier("1000")).toBe("T1");
    expect(formatSubTier("2000")).toBe("T2");
    expect(formatSubTier("3000")).toBe("T3");
    expect(formatSubTier("prime")).toBe("Prime");
  });

  it("uppercases unknown tiers", () => {
    expect(formatSubTier("gold")).toBe("GOLD");
  });
});

describe("computeChestProgress", () => {
  it("counts down from 15:00 with each watched minute", () => {
    expect(computeChestProgress(0)).toEqual({
      nextChestEstimateSeconds: 900,
      chestAvailable: false,
    });
    expect(computeChestProgress(1)).toEqual({
      nextChestEstimateSeconds: 840,
      chestAvailable: false,
    });
    expect(computeChestProgress(7)).toEqual({
      nextChestEstimateSeconds: 480,
      chestAvailable: false,
    });
  });

  it("marks the chest available exactly at the required threshold", () => {
    const atThreshold = computeChestProgress(CHEST_WATCH_MINUTES_REQUIRED);
    expect(atThreshold).toEqual({ nextChestEstimateSeconds: 0, chestAvailable: true });
    expect(computeChestProgress(CHEST_WATCH_MINUTES_REQUIRED - 1).chestAvailable).toBe(false);
  });

  it("clamps overwatched minutes instead of going negative", () => {
    const over = computeChestProgress(CHEST_WATCH_MINUTES_REQUIRED + 10);
    expect(over).toEqual({ nextChestEstimateSeconds: 0, chestAvailable: true });
  });
});
