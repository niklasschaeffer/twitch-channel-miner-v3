# AGENTS.md

Twitch channel-points miner webapp: a self-hosted Bun/Node + Express + Vite/React dashboard that autonomously claims bonus chests, claims drops, joins raids, and places predictions on Twitch, with live IRC chat and per-channel point tracking backed by Prisma/SQLite.

## Commands

Run the app via Docker only — `docker compose build && docker compose up -d`; do NOT run the server directly on the host with `npm run dev`/`bun`/`node`: a second engine opening the bind-mounted `prisma/dev.db` next to the container's corrupts it (see the WAL hazard under Architecture)

- `docker compose build && docker compose up -d` — run/deploy the app (add `--force-recreate` after compose/env/volume changes); smoke-test against `http://localhost:3000` (health endpoint: `GET /api/health`)
- `npm run lint` — **`tsc --noEmit`**; MUST pass before any commit/merge
- Pre-commit (husky): `bunx oxlint --import-plugin --vitest-plugin --react-plugin && bunx oxfmt && npm run lint` — oxlint runs with the import/vitest/react plugins, then the oxfmt formatter; `.oxfmtrc.json` ignores `CHANGELOG.md`, `.oxlintrc.json` keeps `no-unused-vars` and `typescript/no-explicit-any` as warnings
- `npm run test` — vitest suite in `tests/`; MUST pass before any commit/merge (CI runs `bun run test`)
- `npm run build` — Vite frontend build + esbuild bundle of `server.ts` to `dist/server.cjs`
- `npm run db:push` — apply `prisma/schema.prisma` to the SQLite DB (no migration files; schema-first workflow; stop the container first)
- `npm run dev` (`tsx server.ts`) exists for rare host-side development only and is not the supported way to run the app

## Architecture

- `server.ts` — Express app: auth routes (Twitch device flow, Google OAuth, local email login), streamer CRUD, SSE broadcast, session endpoints
- `server/minerEngine.ts` — engine manager: per-user `MinerWorker` registry (`ensureWorker`/`disposeWorker`), boot spawn from stored tokens (`spawnWorkersFromDb`, which also adopts legacy NULL-`userId` rows into the oldest account), SSE fan-out scoped per user, and a userId-threaded delegation API consumed by `server.ts`
- `server/minerWorker.ts` — one worker per user with a stored Twitch token: owns its state (tick loop, PubSub + IRC websockets, spade heartbeats, balances, chat buffers, logs/stats, watch-streak + lurk-day tracking) and scopes every Prisma query by `userId`; `dispose()` is leak-free (guards the dispose-during-init race). Device flow persists tokens only with an owning session (`ownerUserId` captured at `/api/twitch/device/start`)
- `src/` — React 19 + Vite + Tailwind 4 frontend; `src/i18n.ts` holds all translation resources (en + de)
- `prisma/schema.prisma` — SQLite schema; the live DB is `prisma/dev.db` (gitignored, bind-mounted to `/app/data/miner.db` in the container). **Single-file bind-mount WAL hazard:** the `-wal`/`-shm` sidecars live inside the container, so host-side reads/copies of `dev.db` see stale data and a host-side `prisma db push` while the container runs corrupts the DB (`invalid rootpage`). Stop the container (or read/checkpoint from inside it) before any host-side DB operation

### Twitch integration ground rules

- **Client-Id policy:** authenticated GQL (viewer context) uses the TV client id `ue6666qo983tsx6so1t0vnawi233wa`; anonymous GQL telemetry uses the public web id `kimne78kx3ncx6brgo4mv6wki5h1ko`. Custom client ids receive HTTP 400 from GQL — `updateSettings` probes and rejects them
- Device-flow OAuth token is stored server-side in `MinerSettings.authToken` only; never sent to the frontend (`getSettings()` returns `hasAuthToken` instead). Scopes requested: `user_read chat:read chat:edit channel_read` — tokens paired before `chat:edit` was added must be re-paired for chat posting (lurk)
- Watch earning = POST base64 minute-watched event to `spade.twitch.tv/track` (spade URL extracted from `assets.twitch.tv/config/settings.*.js`, not channel HTML); 204 = accepted
- Claims/raids/drops/predictions are persisted GQL mutations mirroring upstream TwitchDropsMiner (`Twitch.py`); no Client-Integrity token needed
- Raids: PubSub `raid.{channelId}` topics are only subscribed for channels in the `channelIds` map (populated by `checkAllStreamersOnlineStatus`, which runs every `checkIntervalSeconds` rounded to 2-second ticks) — topics built at `ws.onopen`; a status-check cycle must run before raid/prediction topics go live after boot. On `raid_go_v2` the worker joins via `JoinRaid` and records `raidsCount` attributed to the watched channel (resolved by reverse-looking up the topic id through `channelIds`; never attribute to `raid.target_login` — that is the raid destination, not the watched channel). Raid bonus points are recorded as `raidPoints` only from `points-earned` gains with `reason_code: RAID` — never estimate them
- PubSub payload parsing lives in `server/pubsub.ts` and accepts both the `data` envelope and top-level fields; a recognized message with no usable fields logs a rate-limited `PubSub <topic> message had no usable fields` WARN listing the keys. `predictions-user-v1` is sent in its own LISTEN frame so a rejected topic cannot take down the balance/raid subscription
- Watch streaks: Twitch GQL has NO watch-streak field (verified by error-probing `CommunityPointsProperties` and introspection — it returns empty). Streaks are tracked locally: `lastWatchDay` (UTC `YYYY-MM-DD`) on `Streamer`, advanced per accepted spade heartbeat and per PubSub `WATCH_STREAK` award (`reason_code` on `points-earned`); init resets streaks with no watch today/yesterday. Never hardcode streak values
- Auto-lurk: per-streamer `lurkEnabled`/`lurkMessage` posts the message via IRC `PRIVMSG` when the channel transitions offline→live. Dedupe is two-layer: durable `lastLurkDay` (one post per UTC day, survives restarts) plus a self-echoed chat-buffer check (Twitch does not echo own PRIVMSG). Posting requires `chat:edit` — tokens without it (pre-scope-change) are detected via `validateStoredAuthToken().hasChatEditScope` and skip with a once-per-worker re-auth WARN; never log a lurk post as sent when the scope is missing
- The app fabricates no data anywhere — every displayed value comes from real Twitch API responses; manual live-state overrides were removed

## Code rules (enforced)

- **No `any`** — use `unknown` + narrowing
- **No comments/docstrings** — the `omp-comment-checker` hook mechanically blocks writes containing them; make code self-documenting (see existing code for the style)
- **No tiny wrapper functions** unless they encode a durable contract
- i18n: every user-facing string needs keys in **both** `en` and `de` in `src/i18n.ts`

### Auth & user model

- All `/api` routes except `health`, `auth/*`, `twitch/device/*`, `twitch/status` and `status` require a session (`miner_session` httpOnly cookie, Session table, 30-day expiry) — the global gate middleware in `server.ts` enforces this
- Local accounts: register hashes passwords with scrypt (`hashPassword` in `server.ts`, format salt-hex(32) + key-hex(128)); login verifies with `verifyPassword`. No auto-provisioning — registration is the only way to create a local account; Google OAuth creates accounts with `provider: 'google'` and no password
- `.env` is required by `docker-compose.yaml` (`env_file`): `TWITCH_CLIENT_ID`, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, `APP_URL` (must be a real origin, e.g. `http://localhost:3000` — OAuth redirects break otherwise)
- `prisma/dev.db` (plus `-journal`/`-wal`/`-shm`) and `backups/` are gitignored — never commit the live DB
- Dockerfile uses `oven/bun:1` for both stages (native WebSocket, `bun install --frozen-lockfile`, `bun dist/server.cjs` runtime); the `"prepare": "husky || true"` script keeps production installs green without devDeps

## Conventions

- Deploy cadence: every change → commit, push to `origin/main`, `docker compose build && docker compose up -d --build`
- Merge gate: `tsc --noEmit` on the merged tree before proceeding
- Runtime i18n audit (when checking keys): walk `resources.en.translation` via `bun -e` import of `src/i18n.ts` — regex-parsing the file produces false positives

<!-- wiki-agent -->

## Wiki Agent

This repository is managed by [wiki-agent](https://github.com/nx-solutions-ug/wiki-agent).
Documentation is generated under `.wiki/` and kept in sync via `wiki --update`.
Do not hand-edit files under `.wiki/` — regenerate them with `wiki --update` instead.

```yaml
version: 1.20.0
wiki-path: .wiki/
initialized: 2026-09-10T08:41:46.457Z
```
