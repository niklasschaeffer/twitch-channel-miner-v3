import { describe, expect, it } from "vitest";
import { sanitizeStreamerPatch } from "../server/streamerPatchValidation.js";

describe("sanitizeStreamerPatch", () => {
  it("rejects non-object bodies", () => {
    expect(sanitizeStreamerPatch(null)).toEqual({
      ok: false,
      error: "Request body must be an object",
    });
  });

  it("passes through valid known fields", () => {
    expect(
      sanitizeStreamerPatch({
        enabled: true,
        priority: 3,
        lurkEnabled: true,
        lurkMessage: " !lurk ",
      }),
    ).toEqual({
      ok: true,
      patch: { enabled: true, priority: 3, lurkEnabled: true, lurkMessage: "!lurk" },
    });
  });

  it("drops fields not in the allowlist, including points and viewerCount", () => {
    expect(
      sanitizeStreamerPatch({
        points: 999999,
        isLive: true,
        viewerCount: 1,
        game: "x",
        priority: 2,
      }),
    ).toEqual({ ok: true, patch: { priority: 2 } });
  });

  it("rejects non-boolean enabled/lurkEnabled", () => {
    expect(sanitizeStreamerPatch({ enabled: "yes" })).toEqual({
      ok: false,
      error: "enabled must be a boolean",
    });
    expect(sanitizeStreamerPatch({ lurkEnabled: 1 })).toEqual({
      ok: false,
      error: "lurkEnabled must be a boolean",
    });
  });

  it("rejects non-integer or out-of-range priority", () => {
    expect(sanitizeStreamerPatch({ priority: 1.5 })).toEqual({
      ok: false,
      error: "priority must be an integer between 1 and 1000000",
    });
    expect(sanitizeStreamerPatch({ priority: 0 })).toEqual({
      ok: false,
      error: "priority must be an integer between 1 and 1000000",
    });
    expect(sanitizeStreamerPatch({ priority: Number.NaN })).toEqual({
      ok: false,
      error: "priority must be an integer between 1 and 1000000",
    });
  });

  it("rejects an empty or oversized lurkMessage", () => {
    expect(sanitizeStreamerPatch({ lurkMessage: "   " })).toEqual({
      ok: false,
      error: "lurkMessage must be 1-500 characters",
    });
    expect(sanitizeStreamerPatch({ lurkMessage: "a".repeat(501) })).toEqual({
      ok: false,
      error: "lurkMessage must be 1-500 characters",
    });
  });

  it("rejects a non-string lurkMessage", () => {
    expect(sanitizeStreamerPatch({ lurkMessage: 123 })).toEqual({
      ok: false,
      error: "lurkMessage must be a string",
    });
  });
  it("accepts an autoPrimeSub toggle", () => {
    expect(sanitizeStreamerPatch({ autoPrimeSub: true })).toEqual({
      ok: true,
      patch: { autoPrimeSub: true },
    });
    expect(sanitizeStreamerPatch({ autoPrimeSub: false })).toEqual({
      ok: true,
      patch: { autoPrimeSub: false },
    });
  });

  it("rejects a non-boolean autoPrimeSub", () => {
    expect(sanitizeStreamerPatch({ autoPrimeSub: "yes" })).toEqual({
      ok: false,
      error: "autoPrimeSub must be a boolean",
    });
  });
});
