---
type: reference
title: Architecture Overview
description: Server entrypoint, miner engine manager, and per-user miner worker
  — the three layers that run the mining engine and expose the API.
tags: [ architecture, express, miner-engine, miner-worker, sse ]
last_updated: 2026-09-10T08:40:08.449Z
updated_by: Niklas Schäffer
---

# Architecture Overview

Three layers, one process:

```
Express (server.ts)
  ├── auth + streamer/settings/logs/analytics REST routes ─┐
  ├── SSE endpoint /api/logs/stream ───────────────────────┤ userId-threaded
  └── MinerEngine (server/minerEngine.ts) ─────────────────┘ delegation API
        ├── workers: Map<userId, MinerWorker>
        └── SSE client list, scoped per userId
              └── MinerWorker per user (server/minerWorker.ts)
                    ├── tick loop (2s default)
                    ├── PubSub websocket (wss://pubsub-edge.twitch.tv/v1)
                    ├── IRC websocket (wss://irc-ws.chat.twitch.tv:443)
                    ├── spade heartbeats + authenticated GQL mutations
                    └── Prisma, every query scoped by userId
```

## server.ts — Express app

Single entrypoint for API, auth, and static assets:

- Session middleware parses the `miner_session` httpOnly cookie, loads the `Session` row (with user) and attaches `req.user` when unexpired
- A global gate middleware rejects all `/api/*` routes without a session except: `/api/health`, `/api/auth/*`, `/api/twitch/device/*`, `/api/twitch/status`, `/api/status` (see [Authentication](./authentication.md))
- REST endpoints (full map below), SSE fan-out at `GET /api/logs/stream`
- Twitch device-flow routes with an in-memory `twitchLoginSessions` map (device code, user code, state, and the `ownerUserId` captured at `/api/twitch/device/start`)
- Dev mode: Vite in middleware mode inside the same process; production: serves `dist/` and falls back to `index.html`
- Boot: `minerEngine.spawnWorkersFromDb()` runs before `app.listen` (with a retry wrapper); password hashing uses scrypt (`hashPassword` / `verifyPassword`, format salt-hex(32) + key-hex(128))

### API map

| Method & path | Purpose |
| --- | --- |
| `GET /api/health` | Health check (public; used by the Compose healthcheck) |
| `POST /api/auth/register` / `login` / `logout`, `GET /api/auth/me` | Local account lifecycle |
| `GET /api/auth/google/start` / `callback` | Google OAuth authorization-code flow |
| `POST /api/twitch/device/start` / `poll`, `GET /api/twitch/status`, `POST /api/twitch/disconnect` | Device flow pairing + connection state |
| `GET /api/status`, `GET /api/miner/connections`, `POST /api/miner/start` / `pause` / `stop` / `test-claim` | Engine control |
| `GET/POST /api/streamers`, `DELETE/PATCH /api/streamers/:username` | Watchlist CRUD (ownership-scoped) |
| `GET /api/streamers/:username/live-stats` / `chat`, `POST .../chat`, `POST .../toggle-live`, `POST /api/streamers/refresh-live` | Per-channel live data and chat |
| `GET/POST /api/settings` | Miner settings (token never returned — `hasAuthToken` flag instead) |
| `GET /api/logs`, `POST /api/logs/clear`, `GET /api/logs/stream` | Logs + SSE |
| `GET/POST /api/statistics`, `GET /api/analytics` | Stats records and aggregation |

## MinerEngine — the manager (`server/minerEngine.ts`)

- `ensureWorker(userId)` / `disposeWorker(userId)` maintain one `MinerWorker` per user; `destroy()` disposes all
- `spawnWorkersFromDb()` boots a worker for every `MinerSetting` row with a non-empty `authToken` (and calls `adoptLegacyRows()` first — see below)
- `subscribeSSE(send, userId)` registers SSE clients; `deliverSSE` only sends a worker's events to clients of the same user, and filters `streamers` payloads for legacy `userId`-less rows
- Exposes a userId-threaded delegation API consumed by `server.ts` (`startMiner(userId)`, `addStreamer(..., userId)`, `getLogs(..., userId)`, …); `getSettings()` returns `hasAuthToken` instead of the token
- `extractTwitchUsername()` lives here (mirrored in `src/lib/twitch.ts` for the frontend): strips `twitch.tv/` URL prefixes, `@`, query/hash fragments, and matches the `[a-z0-9_]{1,35}` login pattern

### Legacy row adoption

`adoptLegacyRows()` runs at boot: rows with `userId: null` (pre-multi-user data) in `MinerSetting`, `Streamer`, `LogRecord`, and `StatisticalRecord` are re-owned by the oldest `User` by `createdAt`. The settings row is only assigned if the oldest user doesn't already own one. Adoption is logged once via `console.warn`.

## MinerWorker — one per user (`server/minerWorker.ts`)

Owns all per-user state and the Twitch integration (details in [Twitch integration](../twitch/index.md)):

- **Tick loop** (`startLoop`, interval from `checkIntervalSeconds`, default 3s in settings / 2s engine tick): status broadcast, `checkAllStreamersOnlineStatus()` every 2 ticks (populates the `channelIds` map), `rebalanceActiveSlots()` by priority mode and live state, then simulation-only accrual if `isSimulationMode`
- **PubSub websocket** — LISTENs to `community-points-user-v1.{userId}` plus `raid.*`, `predictions-channel-v1.*`, `community-points-channel-v1.*` for mining channels; PING every 120s; 5-minute `fetchBalanceSnapshot()` fallback
- **IRC websocket** — anonymous read connection per slot chat, PASS/NICK with the OAuth token when writing (lurk posts, user chat messages)
- **Heartbeats & claims** — spade `minute-watched` posts, persisted GQL mutations (`ClaimCommunityPoints`, `JoinRaid`, `MakePrediction`, `DropsPage_ClaimDropRewards`) via `authenticatedGqlHeaders()`
- **Watch streaks & lurk days** — `noteWatchedDay` advances `lastWatchDay`/`watchStreak`; init resets streaks with no watch today/yesterday; lurk dedupe uses durable `lastLurkDay` plus a self-echo chat-buffer check
- **Chat buffers** — per-streamer `ChatMessage[]` ring buffers, bot-filtered (`KNOWN_CHAT_BOTS`), plus `handleUserChatMessage` for sending from the UI
- **Logs/stats** — in-memory `LogEntry` list mirrored into `LogRecord` rows; `recordStatisticalData` writes `StatisticalRecord`s used by analytics
- **Settings lifecycle** — `initDatabase()` loads `MinerSetting` + `Streamer` rows for its userId; `updateSettings` persists and probes GQL with a new `clientId`; setting `authToken: ""` makes `MinerEngine.disposeWorker()` tear the worker down
- **Token validation** — `validateStoredAuthToken()` calls `id.twitch.tv/oauth2/validate`, returning `{ login, userId, hasChatEdit }`; drives `authLoginName`, `pubsubUserId`, `hasChatEditScope`
- **`dispose()` is leak-free** — guards the dispose-during-init race (init's async continuation checks `this.disposed` before starting the loop), and clears every timer (tick, PubSub ping/reconnect/snapshot)

## Simulation vs. production

`isSimulationMode` gates all fabricated earnings and connection state (seeded status counters, +10 watch deltas, chest countdowns, fake live stats). Defaults: `true` only when `NODE_ENV=development`; production must run with it off — the UI shows a "SANDBOX SIMULATION" badge when active. See [Development → Simulation mode](../development/simulation-mode.md).