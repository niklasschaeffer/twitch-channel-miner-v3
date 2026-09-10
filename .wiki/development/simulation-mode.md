---
type: reference
title: Simulation Mode
description: What isSimulationMode gates, its dev-only default, and why
  production must never fabricate data.
tags: [ simulation, dev-mode, honesty, data-integrity ]
last_updated: 2026-09-10T08:41:26.700Z
updated_by: Niklas Schäffer
---

# Simulation Mode

`isSimulationMode` (a `MinerSetting`, default `true` in a fresh DB, but the effective default is `NODE_ENV === "development"`) is the single gate for all fabricated data.

## What it gates

When **on** (dev/sandbox):

- Seed status counters (`totalPointsMined: 7340`, `totalClaims: 48`, fake active slots `["tarik", "shroud"]`, etc.) so the UI has data to render
- Synthetic watch earnings: +10 points per mining channel every 60 seconds with `WATCH` log entries
- Synthetic chest countdowns: `nextChestEstimateSeconds` ticks down and fabricates a ready chest (+50)
- Fabricated live stats / connection state paths

When **off** (production): every counter, log entry, and analytics record comes from real Twitch responses only — spade heartbeats (HTTP 204), PubSub events, and persisted GQL mutations. Nothing is seeded and nothing is invented.

## Rules

- **Production must run with it off.** The UI flags "SANDBOX SIMULATION" in the header whenever it's on, so a misconfigured production deployment is visible at a glance
- The toggle lives in `SettingsModal` and persists in `MinerSetting.isSimulationMode`
- The tick loop skips the simulated accrual block entirely when off — there is no partial simulation
- Analytics honesty depends on it: claims/raids/drops/predictions counters must never be seeded with point totals or estimates (bugs fixed in 1.10.1 and 1.12.0)

## Why it exists

The engine is hard to develop against without data (it needs a paired Twitch token and live channels). Simulation mode lets the UI and engine paths be exercised offline — while keeping the product promise that the dashboard shows **only real Twitch data** in production.