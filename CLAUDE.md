# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`AGENTS.md` is the full agent onboarding guide for this repo — read it for details on Twitch integration ground rules, the auth model, and conventions. The essentials are repeated here.

## What this is

A self-hosted Twitch channel-points miner: Bun/Node + Express backend with a Vite/React 19 + Tailwind 4 dashboard. It autonomously claims bonus chests, claims drops, joins raids, places predictions, and sends spade watch heartbeats via real Twitch APIs (PubSub + IRC websockets + persisted GQL mutations). Multi-user: each account with a stored Twitch token gets an isolated `MinerWorker`. Data: Prisma + SQLite.

## Commands

- **Run the app via Docker only**: `docker compose build && docker compose up -d`. Do NOT run `npm run dev`/`node`/`bun` on the host — a second engine opening the bind-mounted `prisma/dev.db` next to the container corrupts it.
- `npm run lint` — `tsc --noEmit`; MUST pass before every commit/merge
- `npm run test` — vitest suite in `tests/`; MUST pass before every commit/merge
- `npm run build` — Vite frontend build + esbuild bundle of `server.ts` to `dist/server.cjs`
- Run a single test file: `npx vitest run tests/chest.test.ts`
- `npm run db:push` — apply `prisma/schema.prisma` to SQLite (schema-first, no migration files; **stop the container first**)

Releases are fully automated via semantic-release on `main` (version bump + `CHANGELOG.md` + `chore(release)` commits) — commit messages MUST follow Conventional Commits (`feat:`, `fix:`, …) since the analyzer parses them; never hand-edit `CHANGELOG.md` or the version in `package.json`.

- Pre-commit (husky): `bunx oxlint --import-plugin --vitest-plugin --react-plugin && bunx oxfmt && npm run lint`
- Smoke-test: `GET /api/health` on `http://localhost:3000`

## The single biggest hazard

`prisma/dev.db` is bind-mounted to `/app/data/miner.db`, but the WAL `-wal`/`-shm` sidecars live only inside the container. Host-side reads/copies see stale data, and a host-side `prisma db push` while the container runs corrupts the DB (`invalid rootpage`). **Stop the container before any host-side DB operation.**

## Architecture

- `server.ts` — Express app: auth (Twitch device flow, Google OAuth, scrypt local login), streamer CRUD, SSE broadcast, session gate middleware (httpOnly `miner_session` cookie, Session table, 30-day expiry)
- `server/minerEngine.ts` — per-user `MinerWorker` registry (`ensureWorker`/`disposeWorker`), boot spawn from stored tokens (`spawnWorkersFromDb`, adopts legacy NULL-`userId` rows), per-user SSE fan-out, userId-threaded delegation API
- `server/minerWorker.ts` — one worker per user: 2-second tick loop, PubSub + IRC websockets, spade heartbeats, balances, chat buffers, stats; every Prisma query scoped by `userId`
- `server/chest.ts`, `server/prediction.ts`, `server/yourChannels.ts` — pure logic extracted from the worker (chest progress math, prediction strategy/outcome stats, channel suggestions); they map 1:1 to the unit tests in `tests/`
- `src/` — React frontend; `src/i18n.ts` holds all translation resources (en + de)
- `prisma/schema.prisma` — SQLite schema; live DB is `prisma/dev.db` (gitignored, never commit)
- `Dockerfile` (Bun, needs AVX2) and `Dockerfile.node` (Node 25, older/ARM hardware) — same `dist/server.cjs` app; the Node image is for CPUs without AVX2 that crash with `Illegal instruction` on the Bun image
- `tests/` — vitest; CI runs `bun run test`

## Enforced code rules

- **No `any`** — use `unknown` + narrowing
- **No comments/docstrings** — the `omp-comment-checker` hook mechanically blocks writes containing them; make code self-documenting
- **No tiny wrapper functions** unless they encode a durable contract
- **i18n**: every user-facing string needs keys in both `en` and `de` in `src/i18n.ts`
- Deploy cadence: every change → commit, push to `origin/main`, `docker compose build && docker compose up -d --build`

## Twitch integration (critical details)

- **Client-Id policy:** authenticated GQL (viewer context) uses the TV client id `ue6666qo983tsx6so1t0vnawi233wa`; anonymous GQL telemetry uses the public web id `kimne78kx3ncx6brgo4mv6wki5h1ko`. Custom ids get HTTP 400 from GQL.
- The device-flow OAuth token is stored server-side only (`MinerSettings.authToken`); the frontend gets `hasAuthToken`, never the token. Scopes: `user_read chat:read chat:edit channel_read`.
- Watch earning = base64 minute-watched event POSTed to `spade.twitch.tv/track` (spade URL extracted from `assets.twitch.tv/config/settings.*.js`).
- Twitch GQL has NO watch-streak field — streaks are tracked locally per UTC day, advanced per accepted heartbeat and per PubSub `WATCH_STREAK` award. Never hardcode streak values.
- Raid attribution: resolve the watched channel by reverse-looking up the `raid.{id}` topic through `channelIds` — never attribute to `raid.target_login` (the destination).
- The app fabricates no data anywhere — every displayed value comes from real Twitch API responses.
