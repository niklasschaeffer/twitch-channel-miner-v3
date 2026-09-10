---
type: reference
title: Deployment
description: Docker Compose setup, environment variables, container boot
  sequence, and health checks.
tags: [ docker, compose, env, deploy ]
last_updated: 2026-09-10T08:41:00.472Z
updated_by: Niklas Schäffer
---

# Deployment

## Docker Compose

`docker-compose.yaml` defines a single `twitch-miner` service:

- Ports `3000:3000`, `restart: unless-stopped`
- `env_file: .env` — **required**; compose fails without it
- `DATABASE_URL=file:/app/data/miner.db` and `NODE_ENV=production` set in the service environment
- Volume: `./prisma/dev.db:/app/data/miner.db` (single-file bind mount — see [Database](./database.md))
- Healthcheck: `curl -f http://localhost:3000/api/health` every 30s (10s timeout, 3 retries, 20s start period)

## Dockerfile

Two `oven/bun:1` stages (native WebSocket support):

1. **Builder:** installs openssl, `bun install --frozen-lockfile`, `bunx prisma generate`, `bun run build` (Vite frontend build + esbuild bundle of `server.ts` → `dist/server.cjs`)
2. **Runner:** `bun install --production`, copies Prisma client + `dist`, `EXPOSE 3000`, and boots with `bunx prisma db push --skip-generate && bun dist/server.cjs` — the schema is applied at every container start

The `"prepare": "husky || true"` script keeps production installs green without devDependencies.

## Environment variables (`.env`, documented in `.env.example`)

| Variable | Required | Notes |
| --- | --- | --- |
| `TWITCH_CLIENT_ID` | yes | TV client id `ue6666qo983tsx6so1t0vnawi233wa` — device-flow tokens pair with it for GQL viewer context; custom ids get HTTP 400 |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional | Enables Google login; redirect URI `<APP_URL>/api/auth/google/callback` |
| `APP_URL` | yes | Real origin, e.g. `http://localhost:3000` — OAuth redirects break otherwise |
| `DATABASE_URL` | yes | `file:./dev.db` locally; the container overrides to `file:/app/data/miner.db` |

## Update procedure

```bash
docker compose build
docker compose up -d --build
```

Add `--force-recreate` after compose file, `.env`, or volume changes. Because the container runs `prisma db push` at boot, schema changes ship without a separate migration step — but read [Database](./database.md) before touching the DB from the host.

## Running outside Docker

- Node ≥ 21 (Bun toolchain in dev too: `bun install`, `bunx prisma generate`)
- `npm run db:push`, then `npm run dev` (tsx, serves Vite middleware on port 3000) or `npm run build && npm start` (node `dist/server.cjs`)
- Set `DATABASE_URL` (defaults are resolved by `prisma/seed.ts` fallback logic when missing)