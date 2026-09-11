import { describe, expect, it } from "vitest";
import { AttemptRateLimiter, FailureRateLimiter } from "../server/rateLimit.js";

describe("FailureRateLimiter", () => {
  it("allows requests below the failure threshold", () => {
    let now = 0;
    const limiter = new FailureRateLimiter(3, 60_000, 30_000, 100, () => now);
    limiter.recordFailure("a");
    limiter.recordFailure("a");
    expect(limiter.check("a").allowed).toBe(true);
  });

  it("locks out after reaching the failure threshold", () => {
    let now = 0;
    const limiter = new FailureRateLimiter(3, 60_000, 30_000, 100, () => now);
    limiter.recordFailure("a");
    limiter.recordFailure("a");
    limiter.recordFailure("a");
    const result = limiter.check("a");
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("unlocks once the lockout window elapses", () => {
    let now = 0;
    const limiter = new FailureRateLimiter(2, 60_000, 10_000, 100, () => now);
    limiter.recordFailure("a");
    limiter.recordFailure("a");
    expect(limiter.check("a").allowed).toBe(false);
    now += 10_001;
    expect(limiter.check("a").allowed).toBe(true);
  });

  it("does not let further failures during a lockout extend or reset it", () => {
    let now = 0;
    const limiter = new FailureRateLimiter(2, 60_000, 10_000, 100, () => now);
    limiter.recordFailure("a");
    limiter.recordFailure("a");
    const lockedAt = limiter.check("a");
    now += 5_000;
    limiter.recordFailure("a");
    now += 5_001;
    expect(limiter.check("a").allowed).toBe(true);
    expect(lockedAt.allowed).toBe(false);
  });

  it("clears the counter on success", () => {
    let now = 0;
    const limiter = new FailureRateLimiter(2, 60_000, 10_000, 100, () => now);
    limiter.recordFailure("a");
    limiter.recordSuccess("a");
    limiter.recordFailure("a");
    expect(limiter.check("a").allowed).toBe(true);
  });

  it("bounds the number of tracked keys", () => {
    let now = 0;
    const limiter = new FailureRateLimiter(5, 60_000, 60_000, 3, () => now);
    for (let i = 0; i < 10; i++) {
      limiter.recordFailure(`key-${i}`);
      now += 1;
    }
    expect(limiter.size()).toBeLessThanOrEqual(3);
  });

  it("prunes stale entries outside the tracking window", () => {
    let now = 0;
    const limiter = new FailureRateLimiter(5, 1_000, 1_000, 100, () => now);
    limiter.recordFailure("a");
    now += 5_000;
    limiter.recordFailure("b");
    expect(limiter.size()).toBe(1);
  });
});

describe("AttemptRateLimiter", () => {
  it("allows attempts under the cap within the window", () => {
    let now = 0;
    const limiter = new AttemptRateLimiter(3, 60_000, 100, () => now);
    expect(limiter.consume("ip").allowed).toBe(true);
    expect(limiter.consume("ip").allowed).toBe(true);
    expect(limiter.consume("ip").allowed).toBe(true);
  });

  it("blocks once the cap is reached within the window", () => {
    let now = 0;
    const limiter = new AttemptRateLimiter(2, 60_000, 100, () => now);
    limiter.consume("ip");
    limiter.consume("ip");
    const result = limiter.consume("ip");
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets the window after it elapses", () => {
    let now = 0;
    const limiter = new AttemptRateLimiter(1, 1_000, 100, () => now);
    limiter.consume("ip");
    expect(limiter.consume("ip").allowed).toBe(false);
    now += 1_001;
    expect(limiter.consume("ip").allowed).toBe(true);
  });

  it("bounds the number of tracked keys", () => {
    let now = 0;
    const limiter = new AttemptRateLimiter(5, 60_000, 3, () => now);
    for (let i = 0; i < 10; i++) {
      limiter.consume(`ip-${i}`);
      now += 1;
    }
    expect(limiter.size()).toBeLessThanOrEqual(3);
  });
});
