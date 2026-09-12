import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BOOLEAN_SETTINGS_FIELDS, sanitizeSettingsPatch } from "../server/settingsValidation.js";
import { sanitizeStreamerPatch } from "../server/streamerPatchValidation.js";
import { clampSetting, LURK_MESSAGE_MAX_LENGTH, SETTINGS_BOUNDS } from "../src/types.js";

const settingsModalSource = readFileSync(
  new URL("../src/components/SettingsModal.tsx", import.meta.url),
  "utf8",
);
const streamerListSource = readFileSync(
  new URL("../src/components/StreamerList.tsx", import.meta.url),
  "utf8",
);

const numericFields = Object.keys(SETTINGS_BOUNDS) as (keyof typeof SETTINGS_BOUNDS)[];

const SAVE_CALL = "await onSaveSettings({";
const savePayloadStart = settingsModalSource.indexOf(SAVE_CALL);
const savePayloadEnd = settingsModalSource.indexOf("});", savePayloadStart);
const savePayload =
  savePayloadStart === -1 || savePayloadEnd === -1
    ? ""
    : settingsModalSource.slice(savePayloadStart, savePayloadEnd);

describe("clampSetting", () => {
  it("clamps to the bound and rounds to an integer", () => {
    expect(clampSetting(-10, { min: 1, max: 5 })).toBe(1);
    expect(clampSetting(99, { min: 1, max: 5 })).toBe(5);
    expect(clampSetting(2.6, { min: 1, max: 5 })).toBe(3);
  });
});

describe("settings bounds are shared between client and server", () => {
  it.each(numericFields)("%s clamps to SETTINGS_BOUNDS on the server", (field) => {
    const bound = SETTINGS_BOUNDS[field];
    expect(sanitizeSettingsPatch({ [field]: bound.min - 1 })).toEqual({
      ok: true,
      patch: { [field]: bound.min },
    });
    expect(sanitizeSettingsPatch({ [field]: bound.max + 1 })).toEqual({
      ok: true,
      patch: { [field]: bound.max },
    });
  });

  it.each(numericFields)("%s is bounded in the Settings modal by the shared constant", (field) => {
    expect(settingsModalSource).toContain(`SETTINGS_BOUNDS.${field}`);
  });

  it("keeps no hardcoded numeric bounds on the Settings modal inputs", () => {
    expect(settingsModalSource).not.toMatch(/\b(?:min|max|maxLength)=\{\d+\}/);
  });
});

describe("the Settings modal submits every configurable field", () => {
  it("exposes a readable save payload", () => {
    expect(savePayload).not.toBe("");
  });

  it.each(numericFields)("submits %s", (field) => {
    expect(savePayload).toContain(field);
  });

  it.each([...BOOLEAN_SETTINGS_FIELDS, "priorityMode", "predictionStrategy"])(
    "submits %s",
    (field) => {
      expect(savePayload).toContain(field);
    },
  );

  it("sends a payload the server accepts unchanged", () => {
    const payload = {
      maxConcurrentStreams: 2,
      priorityMode: "streak",
      autoClaimBonus: true,
      claimDelaySeconds: 5,
      followRaids: false,
      autoClaimDrops: true,
      autoBetPredictions: false,
      predictionStrategy: "conservative",
      maxBetPoints: 250,
      checkIntervalSeconds: 6,
    };
    expect(sanitizeSettingsPatch(payload)).toEqual({ ok: true, patch: payload });
  });
});

describe("lurk message bound is shared between client and server", () => {
  it("rejects a message longer than the shared maximum", () => {
    const tooLong = "a".repeat(LURK_MESSAGE_MAX_LENGTH + 1);
    expect(sanitizeStreamerPatch({ lurkMessage: tooLong })).toEqual({
      ok: false,
      error: `lurkMessage must be 1-${LURK_MESSAGE_MAX_LENGTH} characters`,
    });
  });

  it("accepts a message exactly at the shared maximum", () => {
    const exact = "b".repeat(LURK_MESSAGE_MAX_LENGTH);
    expect(sanitizeStreamerPatch({ lurkMessage: exact })).toEqual({
      ok: true,
      patch: { lurkMessage: exact },
    });
  });

  it("caps the streamer list input with the same constant", () => {
    expect(streamerListSource).toContain("maxLength={LURK_MESSAGE_MAX_LENGTH}");
  });
});
