import { describe, expect, it } from "vitest";
import { parseCookieHeader } from "../server/cookies.js";

describe("parseCookieHeader", () => {
  it("returns an empty object for undefined or empty headers", () => {
    expect(parseCookieHeader(undefined)).toEqual({});
    expect(parseCookieHeader(null)).toEqual({});
    expect(parseCookieHeader("")).toEqual({});
  });

  it("parses simple name/value pairs", () => {
    expect(parseCookieHeader("a=1; b=2")).toEqual({ a: "1", b: "2" });
  });

  it("keeps the raw value when decodeURIComponent would throw", () => {
    expect(parseCookieHeader("x=%")).toEqual({ x: "%" });
    expect(parseCookieHeader("miner_session=%; other=fine")).toEqual({
      miner_session: "%",
      other: "fine",
    });
  });

  it("preserves extra = characters inside a value", () => {
    expect(parseCookieHeader("a=b=c")).toEqual({ a: "b=c" });
  });

  it("keeps the last occurrence when a name is duplicated", () => {
    expect(parseCookieHeader("a=1; a=2")).toEqual({ a: "2" });
  });

  it("skips segments with no = separator and blank names", () => {
    expect(parseCookieHeader("a=1; garbage; =nope; b=2")).toEqual({ a: "1", b: "2" });
  });

  it("decodes percent-encoded values", () => {
    expect(parseCookieHeader("a=hello%20world")).toEqual({ a: "hello world" });
  });
});
