---
type: Documentation Index
title: "Architecture"
description: "Files and subdirectories in Architecture."
last_updated: "2026-09-10T08:41:46.460Z"
updated_by: "Niklas Schäffer"
---

# Files

- [Authentication](authentication.md) - Session model, local and Google accounts, the Twitch device flow, and which API routes are public.
- [Data Model](data-model.md) - Prisma SQLite schema — users, streamers, settings, sessions, log and statistical records; ownership scoping and analytics integrity rules.
- [Architecture Overview](overview.md) - Server entrypoint, miner engine manager, and per-user miner worker — the three layers that run the mining engine and expose the API.
