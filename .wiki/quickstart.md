---
type: guide
title: Quickstart
description: Install, configure, and run the miner — Docker deployment,
  first-run account + Twitch device-flow pairing, and development commands.
tags: [ quickstart, setup, docker, dev ]
last_updated: 2026-09-10T08:39:54.263Z
updated_by: Niklas Schäffer
---

# Quickstart

## Requirements

- Docker + Docker Compose (recommended deployment)
- Node ≥ 21 if running outside Docker (the container pins `oven/bun:1`)
- A Twitch account — the miner acts on this account's behalf
- Optional: Google OAuth credentials for "Sign in with Google"

## Install and run

```bash
git clone <repo-url> twitch-miner
cd twitch-miner

cp .env.example .env
```

Edit `.env` (all keys are documented in `.env.example`):

```ini
TWITCH_CLIENT_ID="ue6666qo983tsx6so1t0vnawi233wa"   # required; see client-id policy
GOOGLE_CLIENT_ID=""                                  # optional
GOOGLE_CLIENT_SECRET=""                              # optional
APP_URL="http://localhost:3000"                      # must be a real origin — OAuth redirects break otherwise
DATABASE_URL="file:./dev.db"                         # container overrides to /app/data/miner.db
```

Build and start:

```bash
docker compose build
docker compose up -d
```

The app serves at `http://localhost:3000`. The SQLite database lives at `prisma/dev.db` on the host, bind-mounted into the container as `/app/data/miner.db`. Compose runs `prisma db push --skip-generate` before each boot, so the schema is applied automatically.

> **Client-id policy:** the TV client id `ue6666qo983tsx6so1t0vnawi233wa` is required — device-flow tokens pair with it for authenticated GQL viewer context (balance binding). Anonymous telemetry uses the public web id `kimne78kx3ncx6brgo4mv6wki5h1ko`. Custom client ids are rejected by Twitch GQL with HTTP 400. See [Twitch integration](./twitch/index.md).

## First-run setup

1. **Create an account.** Unauthenticated visitors see the login screen. Register locally (email + username + password, min 8 chars, scrypt-hashed) or use the Google button if configured. There is no auto-provisioning — registration is the only way to create a local account.
2. **Connect Twitch.** In Settings → Twitch connection, click connect. The device flow shows you a code (e.g. `ABCD-EFGH`) and a link to `twitch.tv/activate`; enter the code, approve on Twitch, and the widget polls for up to a minute before showing **Connected** with your login name. The token is stored server-side only — the browser never sees it.
3. **Add channels.** In _Monitored Channels_, click **Add Channel** and paste a Twitch username or channel URL (e.g. `twitch.tv/somechannel`); input is sanitized by `extractTwitchUsername()`.
4. **Watch it mine.** Live channels fill the active watch slots (2 by default — Twitch's hard limit) and balances sync within moments.

If the stored token goes stale, a red banner appears with a reconnect button.

## Daily use

- **Dashboard tab** — watchlist with live status, viewer counts, points, and watch-streak badges; IRC chat panel (known bots and the broadcaster are filtered out); live console with per-channel and per-level filters.
- **Statistical Analytics tab** — hourly points/claims history, per-channel distribution, and a category breakdown (chests vs. watch time vs. raids vs. predictions vs. drops).
- **Settings** — start/pause/stop the engine, concurrency, auto-claim bonus/drops, follow raids, prediction strategy and max bet, Twitch connection. Toggling lurk per channel happens in the watchlist.

## Development without Docker

```bash
bun install            # or npm install
bun run db:push        # apply prisma/schema.prisma to the SQLite DB
npm run dev            # tsx server.ts — Express serves the Vite dev middleware in the same process
```

`npm run dev` serves both API and frontend on port 3000 (Vite runs in middleware mode unless `NODE_ENV=production`).

## Verification

There is no full test suite. Verification means:

- `npm run lint` (which is `tsc --noEmit`) — must pass before any commit/merge; husky runs it with oxlint as the pre-commit hook
- Live smoke tests against `http://localhost:3000`, health endpoint: `GET /api/health` (returns `{ status: "ok", database: "sqlite-prisma", time: ... }`)

A small Vitest suite exists for pure helpers (`tests/chest.test.ts`, `tests/gravatar.test.ts`, `tests/i18n.test.ts`, `tests/twitch.test.ts`) — run with `npm run test`.

## Troubleshooting

- **Custom client id rejected** — GQL answers HTTP 400; keep the TV client id for `TWITCH_CLIENT_ID`.
- **OAuth redirect broken** — `APP_URL` must be the real public origin (e.g. `http://localhost:3000`), not `localhost` shorthand or a proxied path.
- **Lurk never posts** — tokens paired before `chat:edit` was added lack the scope; re-pair via the device flow. The worker logs a once-per-worker WARN and never reports the lurk as sent.
- **DB shows stale data / `invalid rootpage` on host-side `db push`** — single-file bind-mount WAL hazard; see [Operations → Database care](./operations/database.md).
- **Simulation artifacts in dev** — seeded points/claims only appear when `isSimulationMode` is on; production must run with it off.