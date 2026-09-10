---
type: reference
title: Watch Earning & Chests
description: Spade minute-watched heartbeats, chest progress and eligibility,
  and local watch-streak tracking.
tags: [twitch, spade, heartbeat, chest, watch-streak]
last_updated: 2026-09-10T08:40:43.435Z
updated_by: Niklas Schäffer
---

# Watch Earning & Chests

## Spade heartbeats (watch earning)

Twitch awards watch points on its own schedule once it receives the same telemetry the web player sends:

1. For each mining channel, once per minute the worker builds a `minute-watched` event: `{ event: "minute-watched", properties: { channel_id, broadcast_id, player: "site", user_id: pubsubUserId, live: true, channel } }`
2. The payload array is base64-encoded and POSTed as form data (`data=<base64>`) to `https://spade.twitch.tv/track` with a browser User-Agent
3. **HTTP 204 = accepted.** The worker then increments `uptimeMinutes` and `watchedMinutesSinceChest`, recomputes chest progress via `computeChestProgress()` (`server/chest.ts`), and calls `noteWatchedDay()` for streak tracking

The spade URL is extracted from `assets.twitch.tv/config/settings.*.js` (upstream's mechanism), not scraped from channel HTML. A non-204 response means Twitch rejected the heartbeat — no points are recorded, keeping analytics honest.

## Bonus chests

- Chest progress derives from real watch minutes: `CHEST_WATCH_MINUTES_REQUIRED = 15` in `server/chest.ts`; `computeChestProgress(watchedMinutes)` returns `nextChestEstimateSeconds` (countdown) and `chestAvailable` (watched ≥ 15)
- Eligibility gate: the channel must be partner or affiliate (GQL `roles { isPartner isAffiliate }` from the status check) — fixed in 1.9.6 ("repair dead auto-claim poll and gate claims by partner/affiliate eligibility")
- When PubSub reports a chest, the worker polls `availableClaim.id` and executes the persisted `ClaimCommunityPoints` mutation with the authenticated TV-client-id headers (see [Client IDs & GQL](./gql.md))
- Dedupe: `claimsInFlight` (per-channel set) plus `claimDelaySeconds` (default 4s) for a human-like delay; each HTTP call uses an 8s timeout
- In simulation mode, a synthetic countdown ticks `nextChestEstimateSeconds` down and fabricates a +50 claim — production (`isSimulationMode` off) only ever reports real claims

## Watch streaks

Twitch GQL has **no** watch-streak field (verified by error-probing `CommunityPointsProperties` and introspection — it returns empty). Streaks are therefore tracked locally:

- `Streamer.lastWatchDay` stores the last UTC day (`YYYY-MM-DD`) an accepted heartbeat (or streak award) was recorded
- `noteWatchedDay()` advances `watchStreak` when the day changes and the prior day is contiguous; missed days reset the streak to 1 (honest reset, no hardcoding)
- PubSub `WATCH_STREAK` awards (a `reason_code` on `points-earned` events) advance the streak in parallel with heartbeats
- Worker init resets streaks that have no watch today or yesterday

The streak badge shows in the watchlist; per-day granularity is UTC to match Twitch's own day boundaries.

## Watch slots and priority

- `maxConcurrentStreams` caps simultaneous watch slots (default 2 — Twitch's practical hard limit); `isMining` marks the streamer occupying a slot
- `rebalanceActiveSlots()` runs each tick after status refresh, ordering by `priorityMode`: `points_asc` (default, lowest points first), `points_desc`, `streak`, or `manual` (per-streamer `priority` ranks, persisted server-side since 1.9.5)
- Only live, enabled channels fill slots; going offline releases the slot (logged as WARN)

## Points lifecycle

```
accepted spade heartbeat ─▶ uptimeMinutes++, watchedMinutesSinceChest++, noteWatchedDay()
PubSub points-earned     ─▶ balance sync, watch-earnings stat records (delta only)
ClaimCommunityPoints 200 ─▶ claimsCount++, chest points logged once (claims category)
5-min GQL snapshot       ─▶ reconciles per-channel balance if PubSub missed events
```

Claims are logged once under the claims category; later balance syncs record only the difference as watch earnings, so nothing is double-counted.
