---
type: reference
title: Authentication
description: Session model, local and Google accounts, the Twitch device flow,
  and which API routes are public.
tags: [ auth, sessions, oauth, device-flow, security ]
last_updated: 2026-09-10T08:40:24.287Z
updated_by: Niklas Schäffer
---

# Authentication

## Session model

- Cookie: `miner_session`, httpOnly, `Path=/`, `SameSite=Lax`, 30-day `Max-Age`
- Session row: random 32-byte id (64 hex chars), `userId`, `expiresAt` — SQLite-backed, so sessions survive restarts
- Middleware loads the session (with user) and attaches `req.user`; expired or unknown cookies yield no user

## Global API gate

A gate middleware in `server.ts` protects everything under `/api/*` except:

- `GET /api/health`
- `/api/auth/*` (register, login, logout, me, google start/callback)
- `/api/twitch/device/*` (device flow start/poll — must be reachable pre-login)
- `GET /api/twitch/status`
- `GET /api/status`

Anything else under `/api/` returns `401 { error: "Authentication required" }` without a session. Unauthenticated frontend visitors get the login screen (`AuthModal`) instead of a broken dashboard.

## Local accounts

- `POST /api/auth/register` requires email, username, and a password of at least 8 characters; duplicate emails get `409`
- Passwords are hashed with scrypt (`hashPassword`, format salt-hex(32) + key-hex(128), 64-byte key) and verified with `verifyPassword` using `timingSafeEqual`
- Avatars default to Gravatar identicons (`md5(email)` via `src/lib/gravatar.ts`)
- **No auto-provisioning** — registration is the only way to create a local account
- Login verifies with scrypt, then issues a session cookie; logout deletes the Session row and clears the cookie

## Google OAuth

- `GET /api/auth/google/start` redirects to Google's authorization endpoint (server-side authorization-code flow)
- `GET /api/auth/google/callback` exchanges the code, upserts a user with `provider: 'google'` and **no password**, and issues a session
- Requires `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in `.env`; the redirect URI is `<APP_URL>/api/auth/google/callback` and must be registered in Google Cloud credentials
- `APP_URL` must be a real origin (e.g. `http://localhost:3000`) — OAuth redirects break otherwise

## Twitch device flow

Twitch's device-code OAuth, orchestrated server-side with an in-memory `twitchLoginSessions` map:

1. `POST /api/twitch/device/start` — requests a device/user code from Twitch, stores the pending session **capturing the caller's userId as `ownerUserId`**, returns the code + verification URI
2. The user opens `twitch.tv/activate`, enters the code, approves on Twitch
3. `POST /api/twitch/device/poll` — polls Twitch's token endpoint; on success the token is persisted **only with an owning session** (pre-login grants without `ownerUserId` are refused)
4. `GET /api/twitch/status` — public route reporting connection state + login name (the token itself never leaves the server)
5. `POST /api/twitch/disconnect` — clears the stored token

Key properties:

- Scopes requested: `user_read chat:read chat:edit channel_read`
- Tokens pair with the **TV client id** (`TWITCH_CLIENT_ID` = `ue6666qo983tsx6so1t0vnawi233wa`) — required for authenticated GQL viewer context; see [Twitch integration](../twitch/index.md)
- The token is stored in `MinerSettings.authToken` server-side only; the API surface exposes `hasAuthToken`, never the token
- Tokens paired before `chat:edit` was added lack the scope; `validateStoredAuthToken()` detects this (`hasChatEditScope`) and lurk posting skips with a once-per-worker WARN instead of pretending to send
- Stale tokens surface as a red reconnect banner in the UI; disconnecting (`authToken: ""`) disposes the worker via `MinerEngine.updateSettings`

## Threat-model notes

- The Twitch OAuth token is the crown jewel: never sent to the frontend, never logged, cleared with the disconnect action
- Session fixation is mitigated by fresh random ids and httpOnly cookies; the gate middleware means no `/api` data route is reachable anonymously
- Every data route resolves ownership through the session's `userId` — cross-user access is not possible by URL manipulation (streamer lookups are scoped inside the worker)
- Device-flow grants are refused when no app session owns the pairing attempt, preventing anonymous token squatting