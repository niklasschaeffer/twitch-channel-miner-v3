import { describe, expect, it } from "vitest";
import { sessionPointsPerHour } from "../src/lib/miningRate.js";
import type { MinerStatus } from "../src/types.js";

const status = (uptimeSeconds: number, pointsThisSession: number): MinerStatus => ({
  state: "running",
  uptimeSeconds,
  totalPointsMined: 999_999,
  pointsToday: 0,
  pointsThisHour: 0,
  pointsThisSession,
  activeSlots: [],
  activeSlotsLimit: 2,
  totalClaims: 0,
  totalRaids: 0,
  totalPredictionsPlaced: 0,
  totalPredictionsWon: 0,
  netPredictionPoints: 0,
  totalDropsClaimed: 0,
  activeDropCampaigns: [],
  claimedDropRewards: [],
  lastDropSyncAt: null,
  lastActionTimestamp: new Date(0).toISOString(),
});

describe("sessionPointsPerHour", () => {
  it("has no rate before a minute of uptime", () => {
    expect(sessionPointsPerHour(status(60, 500))).toBeNull();
  });

  it("averages only points earned this session", () => {
    expect(sessionPointsPerHour(status(1800, 300))).toBe(600);
  });
});
