---
type: reference
title: Frontend
description: React 19 + Vite + Tailwind 4 app — component map, data flow over
  SSE and REST, theming, and i18n (en/de).
tags: [ frontend, react, vite, tailwind, i18n ]
last_updated: 2026-09-10T08:41:22.934Z
updated_by: Niklas Schäffer
---

# Frontend

`src/` — React 19 + Vite + Tailwind 4. Entry: `src/main.tsx` (StrictMode) → `App.tsx`. Vite config (`vite.config.ts`) wires the React and Tailwind plugins, aliases `@` to the repo root, and honors `DISABLE_HMR` to disable hot reload/watching for agent-editing environments.

## App shell and data flow

`App.tsx` holds the state machine:

- Auth gate: `authChecked` → `AuthModal` when `GET /api/auth/me` returns 401, dashboard when a user exists
- Three tabs: `dashboard` / `analytics` / `settings` (settings opens as a modal)
- Live updates arrive via **SSE** on `/api/logs/stream`, dispatched by event type (`connected`, `streamers`, `status`, `log`, `chat`, `settings`)
- REST fills the rest: `/api/status`, `/api/streamers`, `/api/settings`, `/api/analytics`, `/api/miner/*` for engine control
- Live translation: language switches re-render immediately (fixed in 1.9.4)

## Component map (`src/components/`)

| Component | Role |
| --- | --- |
| `Header` | App title, engine state badge, simulation badge when `isSimulationMode`, theme toggle (class-based dark variant), language switcher, auth/user menu |
| `MetricsOverview` | Top-level counters: total points, today, hourly rate, claims, raids, drops |
| `ActiveSlotsCard` | Which channels currently occupy watch slots |
| `StreamerList` | The watchlist: live status, viewers, points, streak badges, lurk toggle, chat/console filter, remove, manual reordering (persisted via priority, 1.9.5), priority-mode selector |
| `AddStreamerModal` | Add a channel by username/URL (sanitized client-side via `extractTwitchUsername` in `src/lib/twitch.ts`) |
| `SlotIrcChat` | IRC chat panel; channel bar scrolls sideways; bots/broadcaster filtered |
| `LiveConsole` | Real-time event log with per-channel and per-level filters (Claims / Watch / Raids / Predictions / Drops) |
| `AnalyticsView` | Charts (recharts): hourly history, channel distribution, category breakdown |
| `SettingsModal` | Engine controls, concurrency, toggles, prediction strategy + max bet, client-id field, Twitch connect/disconnect |
| `TwitchConnect` | Device-flow widget: code + `twitch.tv/activate` link, polls `/api/twitch/device/poll` up to a minute, shows Connected with login name, stale-token banner |
| `AuthModal` | Login/register (and Google button when configured) |

Helpers in `src/lib/`: `badges.ts` (`formatSubTier` maps `1000/2000/3000/prime`), `gravatar.ts` (md5 for identicons, shared with the server), `twitch.ts` (username extraction), `prismaClient.ts`.

## i18n

`src/i18n.ts` holds **all** translation resources (`en` + `de`) in one `resources` object consumed by react-i18next (`defaultNS: "translation"`). Rules:

- Every user-facing string needs keys in both languages ([Conventions](./conventions.md))
- Audit keys by walking `resources.en.translation` through a Bun import — never regex the file
- Keys are namespaced (`nav.*`, `status.*`, `stats.*`, …); the German block must mirror the English structure exactly

## Theming

Dark/light mode uses a **class-based dark variant** (fixed in `0a9ed72`): the dark class toggles on the root element rather than relying on media queries; components style with Tailwind `dark:` variants accordingly.