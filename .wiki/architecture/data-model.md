---
type: reference
title: Data Model
description: Prisma SQLite schema — users, streamers, settings, sessions, log
  and statistical records; ownership scoping and analytics integrity rules.
tags: [ prisma, sqlite, schema, data-model ]
last_updated: 2026-09-10T08:40:17.233Z
updated_by: Niklas Schäffer
---

# Data Model

`prisma/schema.prisma` — SQLite, `prisma-client-js` generator, connection string from `DATABASE_URL`. Workflow is **schema-first**: `npm run db:push` applies the schema directly, there are no migration files. `prisma/seed.ts` only populates demo data when `NODE_ENV=development` (and auto-runs `db push` if tables are missing).

The live DB is `prisma/dev.db` (gitignored), bind-mounted to `/app/data/miner.db` in the container. Operational care (WAL hazard) is covered in [Operations → Database](../operations/database.md).

## User

App account. `email` unique, `password` nullable (Google accounts have none, `provider: 'google'`), `avatarUrl` defaults to a Gravatar identicon for local registrations. Owns streamers, sessions, settings, logs, and statistics.

## Session

DB-backed session: `id` (64-char random hex) is the `miner_session` cookie value, with a 30-day `expiresAt`. Persisting sessions in SQLite means logins survive restarts. Logout deletes the row.

## Streamer

One row per watched channel per user, `@@unique([userId, username])`, cascade-deleted with the user. Fields worth knowing:

| Field | Meaning |
| --- | --- |
| `points`, `totalPointsMined`, `uptimeMinutes` | Per-channel balance, lifetime mined, watched minutes |
| `watchStreak`, `lastWatchDay` | Local watch-streak tracking (UTC `YYYY-MM-DD`); Twitch GQL has no streak field |
| `isMining`, `enabled`, `priority` | Slot assignment, watchlist toggle, order rank (manual ordering persists here) |
| `lurkEnabled`, `lurkMessage` (default `!lurk`), `lastLurkDay` | Auto-lurk config + daily dedupe marker |
| `isPartner`, `isAffiliate`, `subscriptionTier` | Eligibility data from GQL `roles` — chest claims require partner/affiliate |
| `chestAvailable`, `nextChestEstimateSeconds`, `lastClaimTime` | Bonus-chest progress (see `server/chest.ts`) |
| `isLive`, `viewerCount`, `game`, `avatar`, `displayName` | Refreshed by `checkAllStreamersOnlineStatus` |

`userId` is technically nullable for the legacy-adoption path; fresh rows always carry the owner (see below).

## MinerSetting

One per user (`userId @unique`, nullable for legacy adoption). Holds the Twitch OAuth token (`authToken`), `clientId`, and all miner options:

- `isSimulationMode` (default `true`, effectively dev-only), `maxConcurrentStreams` (default 2 — Twitch's hard limit), `priorityMode` (`points_asc` / `points_desc` / `streak` / `manual`)
- Toggles: `autoClaimBonus`, `followRaids`, `autoClaimDrops`, `autoBetPredictions`
- `predictionStrategy` (`lowest_odds` / `highest_odds` / `smart_ratio` / `conservative`), `maxBetPoints` (default 100)
- `claimDelaySeconds` (4), `checkIntervalSeconds` (3)

The token is **server-side only**: `GET /api/settings` returns `hasAuthToken` instead of the token string. Clearing `authToken` to `""` disposes the worker.

## LogRecord

In-memory log entries mirrored to DB. `level` is one of the `LogLevel` strings (`INFO`, `SUCCESS`, `CLAIM`, `WATCH`, `RAID`, `PREDICTION`, `DROP`, `WARN`, `ERROR`, `CHAT`, `CMD`), `channel` optionally names the streamer, `pointsDelta` records earned points.

## StatisticalRecord

Per-hour aggregation rows: `hourKey` (e.g. `"14:00"`), `channel`, counters (`pointsMined`, `claimsCount`, `raidsCount`, `predictionsWon`/`Lost`, `netPredictionPoints`, `dropsCount`) and category point sums (`chestsPoints`, `watchTimePoints`). `GET /api/analytics` aggregates these into the frontend's charts.

## Ownership scoping rules

1. Every Prisma query a `MinerWorker` issues is filtered by its `userId` — streamer CRUD, settings, logs, stats all resolve through `MinerEngine` methods that thread `req.user.id` from the routes.
2. New streamers are created with the owning user's id; uniqueness is per `(userId, username)`, so two users can watch the same channel independently.
3. SSE delivery is scoped: a worker's `streamers`/`status`/`log`/`chat`/`settings` events go only to clients whose `userId` matches.
4. Legacy `userId: null` rows are adopted by the oldest user at boot (`adoptLegacyRows()` in `minerEngine.ts`) rather than leaking between accounts.

## Analytics integrity

- Claims log their earned points **once** under the claims category; subsequent balance syncs record only the delta beyond that as watch earnings — nothing is double-counted.
- Earnings are attributed to the watched channel that earned them (raids are attributed via the `raid.{topicId}` → `channelIds` reverse lookup, never to the raid destination).
- Raid/drop counters are not seeded with point totals (fixed in 1.10.1); the claims card reads real chest points (fixed in 1.12.0).
- Production never fabricates analytics: all seeded/simulated numbers are gated behind `isSimulationMode`.