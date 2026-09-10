---
type: reference
title: Database
description: SQLite via Prisma — schema-first db push workflow, seed behavior,
  and the single-file bind-mount WAL hazard.
tags: [sqlite, prisma, wal, backup, database]
last_updated: 2026-09-10T08:41:05.159Z
updated_by: Niklas Schäffer
---

# Database

SQLite through Prisma. Schema: `prisma/schema.prisma`; live DB: `prisma/dev.db` (gitignored, along with its `-journal`/`-wal`/`-shm` sidecars and `backups/` — never commit them). In the container the file is `/app/data/miner.db`.

## Schema-first workflow

- **No migration files.** `npm run db:push` applies `prisma/schema.prisma` straight to the DB
- The container runs `bunx prisma db push --skip-generate` at every boot, so schema changes deploy with the image
- `prisma/seed.ts` populates demo data only when `NODE_ENV=development` and auto-runs `db push` if tables are missing (P2021 detection)
- `npm run db:migrate` (`prisma migrate dev`) exists in scripts but the established workflow is push

## Single-file bind-mount WAL hazard

⚠️ **The one operational rule that matters most.** The compose volume mounts a _single file_ (`./prisma/dev.db:/app/data/miner.db`), so the `-wal` and `-shm` sidecars live **inside the container only**:

- **Host-side reads/copies of `dev.db` see stale data** — recent writes are still in the container's WAL, not yet checkpointed into the main file
- **A host-side `prisma db push` while the container runs corrupts the DB** (`invalid rootpage`) — the host and container write competing page layouts through different sidecar state

Rules:

1. **Stop the container before any host-side DB operation** (`docker compose down`, then `db push`/copy, then start again)
2. **To inspect or back up live data, do it from inside the container** (or checkpoint the WAL there first), not by copying the host file
3. A corrupt backup exists as a warning shot: `prisma/dev_corrupt_backup.db`

## Inspecting data

```bash
# inside the running container
docker compose exec twitch-miner sqlite3 /app/data/miner.db
# or, with the container stopped:
sqlite3 prisma/dev.db
```

Useful tables: `User`, `Session`, `Streamer` (watchlist state), `MinerSetting` (contains `authToken` — treat output as secret), `LogRecord`, `StatisticalRecord`.

## Backup guidance

- The live DB changes continuously (balances, logs, stats every tick); take backups from inside the container or with it stopped
- `backups/` is gitignored — never commit DB files
- Sessions and tokens live in the same file; a leaked `dev.db` leaks both
