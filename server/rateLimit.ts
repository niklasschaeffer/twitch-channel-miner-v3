export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

interface FailureEntry {
  failures: number;
  firstFailureAt: number;
  lockedUntil: number | null;
}

export class FailureRateLimiter {
  private readonly entries = new Map<string, FailureEntry>();

  constructor(
    private readonly maxFailures: number,
    private readonly windowMs: number,
    private readonly lockoutMs: number,
    private readonly maxEntries: number,
    private readonly now: () => number = Date.now,
  ) {}

  private prune(): void {
    const now = this.now();
    for (const [key, entry] of this.entries) {
      const stillLocked = entry.lockedUntil !== null && entry.lockedUntil > now;
      if (!stillLocked && now - entry.firstFailureAt > this.windowMs) {
        this.entries.delete(key);
      }
    }
    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey === undefined) break;
      this.entries.delete(oldestKey);
    }
  }

  check(key: string): RateLimitResult {
    this.prune();
    const entry = this.entries.get(key);
    if (!entry || entry.lockedUntil === null) return { allowed: true, retryAfterSeconds: 0 };
    const remainingMs = entry.lockedUntil - this.now();
    if (remainingMs <= 0) return { allowed: true, retryAfterSeconds: 0 };
    return { allowed: false, retryAfterSeconds: Math.ceil(remainingMs / 1000) };
  }

  recordFailure(key: string): void {
    this.prune();
    const now = this.now();
    const entry = this.entries.get(key);
    if (entry && entry.lockedUntil !== null && entry.lockedUntil > now) {
      return;
    }
    if (!entry || now - entry.firstFailureAt > this.windowMs) {
      this.entries.set(key, { failures: 1, firstFailureAt: now, lockedUntil: null });
      this.prune();
      return;
    }
    entry.failures += 1;
    if (entry.failures >= this.maxFailures) {
      entry.lockedUntil = now + this.lockoutMs;
    }
  }

  recordSuccess(key: string): void {
    this.entries.delete(key);
  }

  size(): number {
    return this.entries.size;
  }
}

interface AttemptEntry {
  count: number;
  windowStart: number;
}

export class AttemptRateLimiter {
  private readonly entries = new Map<string, AttemptEntry>();

  constructor(
    private readonly maxAttempts: number,
    private readonly windowMs: number,
    private readonly maxEntries: number,
    private readonly now: () => number = Date.now,
  ) {}

  private prune(): void {
    const now = this.now();
    for (const [key, entry] of this.entries) {
      if (now - entry.windowStart > this.windowMs) {
        this.entries.delete(key);
      }
    }
    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey === undefined) break;
      this.entries.delete(oldestKey);
    }
  }

  consume(key: string): RateLimitResult {
    this.prune();
    const now = this.now();
    const entry = this.entries.get(key);
    if (!entry || now - entry.windowStart > this.windowMs) {
      this.entries.set(key, { count: 1, windowStart: now });
      this.prune();
      return { allowed: true, retryAfterSeconds: 0 };
    }
    if (entry.count >= this.maxAttempts) {
      const retryAfterSeconds = Math.ceil((entry.windowStart + this.windowMs - now) / 1000);
      return { allowed: false, retryAfterSeconds: Math.max(retryAfterSeconds, 1) };
    }
    entry.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }

  size(): number {
    return this.entries.size;
  }
}
