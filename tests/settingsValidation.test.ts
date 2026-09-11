import { describe, expect, it } from "vitest";
import { sanitizeSettingsPatch } from "../server/settingsValidation.js";

describe("sanitizeSettingsPatch", () => {
  it("rejects non-object bodies", () => {
    expect(sanitizeSettingsPatch(null)).toEqual({
      ok: false,
      error: "Request body must be an object",
    });
    expect(sanitizeSettingsPatch("nope")).toEqual({
      ok: false,
      error: "Request body must be an object",
    });
  });

  it("passes through valid known fields", () => {
    const result = sanitizeSettingsPatch({
      maxConcurrentStreams: 2,
      priorityMode: "streak",
      autoClaimBonus: true,
      claimDelaySeconds: 5,
      followRaids: false,
      autoClaimDrops: true,
      autoBetPredictions: false,
      predictionStrategy: "conservative",
      maxBetPoints: 250,
    });
    expect(result).toEqual({
      ok: true,
      patch: {
        maxConcurrentStreams: 2,
        priorityMode: "streak",
        autoClaimBonus: true,
        claimDelaySeconds: 5,
        followRaids: false,
        autoClaimDrops: true,
        autoBetPredictions: false,
        predictionStrategy: "conservative",
        maxBetPoints: 250,
      },
    });
  });

  it("drops unknown fields silently, including authToken and clientId", () => {
    const result = sanitizeSettingsPatch({
      authToken: "stolen-token",
      clientId: "custom-client",
      points: 999999,
      maxBetPoints: 50,
    });
    expect(result).toEqual({ ok: true, patch: { maxBetPoints: 50 } });
  });

  it("clamps maxConcurrentStreams to the 1-2 Twitch hard limit", () => {
    expect(sanitizeSettingsPatch({ maxConcurrentStreams: 99 })).toEqual({
      ok: true,
      patch: { maxConcurrentStreams: 2 },
    });
    expect(sanitizeSettingsPatch({ maxConcurrentStreams: -5 })).toEqual({
      ok: true,
      patch: { maxConcurrentStreams: 1 },
    });
  });

  it("clamps maxBetPoints to at least the Twitch minimum bet of 10", () => {
    expect(sanitizeSettingsPatch({ maxBetPoints: 1 })).toEqual({
      ok: true,
      patch: { maxBetPoints: 10 },
    });
  });

  it("rejects non-numeric numeric fields", () => {
    expect(sanitizeSettingsPatch({ maxBetPoints: "100" })).toEqual({
      ok: false,
      error: "maxBetPoints must be a number",
    });
    expect(sanitizeSettingsPatch({ claimDelaySeconds: Number.NaN })).toEqual({
      ok: false,
      error: "claimDelaySeconds must be a number",
    });
  });

  it("rejects invalid enum values", () => {
    expect(sanitizeSettingsPatch({ priorityMode: "chaos" })).toEqual({
      ok: false,
      error: "priorityMode must be one of points_asc, points_desc, streak, manual",
    });
    expect(sanitizeSettingsPatch({ predictionStrategy: "yolo" })).toEqual({
      ok: false,
      error:
        "predictionStrategy must be one of lowest_odds, highest_odds, smart_ratio, conservative",
    });
  });

  it("rejects non-boolean values for boolean fields", () => {
    expect(sanitizeSettingsPatch({ autoClaimBonus: "yes" })).toEqual({
      ok: false,
      error: "autoClaimBonus must be a boolean",
    });
  });

  it("clamps checkIntervalSeconds within its bounds", () => {
    expect(sanitizeSettingsPatch({ checkIntervalSeconds: 0 })).toEqual({
      ok: true,
      patch: { checkIntervalSeconds: 2 },
    });
    expect(sanitizeSettingsPatch({ checkIntervalSeconds: 10000 })).toEqual({
      ok: true,
      patch: { checkIntervalSeconds: 300 },
    });
  });
});
