# AGENTS.md

Twitch channel-points miner webapp: a self-hosted Bun/Node + Express + Vite/React dashboard that autonomously claims bonus chests, claims drops, joins raids, and places predictions on Twitch, with live IRC chat and per-channel point tracking backed by Prisma/SQLite.

## Commands

- `npm run dev` — run the server in dev mode (`tsx server.ts`); Vite dev assets are separate
- `npm run lint` — **`tsc --noEmit`**; this is the only automated check and MUST pass before any commit/merge
- `npm run build` — Vite frontend build + esbuild bundle of `server.ts` to `dist/server.cjs`
- `npm run db:push` — apply `prisma/schema.prisma` to the SQLite DB (no migration files; schema-first workflow)
- `docker compose build && docker compose up -d` — production deploy (add `--force-recreate` after compose/env/volume changes)

There is no test suite. Verification = `tsc --noEmit` plus live smoke tests against `http://localhost:3000` (health endpoint: `GET /api/health`).

## Architecture

- `server.ts` — Express app: auth routes (Twitch device flow, Google OAuth, local email login), streamer CRUD, SSE broadcast, session endpoints
- `server/minerEngine.ts` — engine manager: per-user `MinerWorker` registry (`ensureWorker`/`disposeWorker`), boot spawn from stored tokens (`spawnWorkersFromDb`, which also adopts legacy NULL-`userId` rows into the oldest account), SSE fan-out scoped per user, and a userId-threaded delegation API consumed by `server.ts`
- `server/minerWorker.ts` — one worker per user with a stored Twitch token: owns its state (tick loop, PubSub + IRC websockets, spade heartbeats, balances, chat buffers, logs/stats) and scopes every Prisma query by `userId`; `dispose()` is leak-free (guards the dispose-during-init race). Device flow persists tokens only with an owning session (`ownerUserId` captured at `/api/twitch/device/start`)
- `src/` — React 19 + Vite + Tailwind 4 frontend; `src/i18n.ts` holds all translation resources (en + de)
- `prisma/schema.prisma` — SQLite schema; the live DB is `prisma/dev.db` (gitignored, bind-mounted to `/app/data/miner.db` in the container)

### Twitch integration ground rules

- **Client-Id policy:** authenticated GQL (viewer context) uses the TV client id `ue6666qo983tsx6so1t0vnawi233wa`; anonymous GQL telemetry uses the public web id `kimne78kx3ncx6brgo4mv6wki5h1ko`. Custom client ids receive HTTP 400 from GQL — `updateSettings` probes and rejects them
- Device-flow OAuth token is stored server-side in `MinerSettings.authToken` only; never sent to the frontend (`getSettings()` returns `hasAuthToken` instead)
- Watch earning = POST base64 minute-watched event to `spade.twitch.tv/track` (spade URL extracted from `assets.twitch.tv/config/settings.*.js`, not channel HTML); 204 = accepted
- Claims/raids/drops/predictions are persisted GQL mutations mirroring upstream TwitchDropsMiner (`Twitch.py`); no Client-Integrity token needed
- Simulation (fake points, fake events) is gated behind `isSimulationMode` — production must never fabricate earnings or connection state

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
- Dockerfile pins `node:25-alpine` — Node ≥ 21 is required (global WebSocket)

## Conventions

- Deploy cadence: every change → commit, push to `origin/main`, `docker compose build && docker compose up -d --build`
- Merge gate: `tsc --noEmit` on the merged tree before proceeding
- Runtime i18n audit (when checking keys): walk `resources.en.translation` via `bun -e` import of `src/i18n.ts` — regex-parsing the file produces false positives