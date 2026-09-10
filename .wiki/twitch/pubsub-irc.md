---
type: reference
title: PubSub & IRC
description: Twitch PubSub topics and event handling, the IRC chat websocket,
  and the auto-lurk feature with its two-layer dedupe.
tags: [twitch, pubsub, irc, chat, lurk, raid]
last_updated: 2026-09-10T08:40:49.239Z
updated_by: Niklas Schäffer
---

# PubSub & IRC

The worker runs two native WebSockets: PubSub for events, IRC for chat.

## PubSub (`wss://pubsub-edge.twitch.tv/v1`)

Connected only when a validated token exists (`connectPubsub` requires `authToken` + `pubsubUserId`). On `ws.onopen` a `LISTEN` is sent with:

- `community-points-user-v1.{pubsubUserId}` — always (balance events, chest events, `WATCH_STREAK` awards)
- For each streamer that `isMining && isLive && enabled` **and** is present in the `channelIds` map: `raid.{channelId}`, `predictions-channel-v1.{channelId}`, `community-points-channel-v1.{channelId}`

**Ordering caveat:** topics are built at `ws.onopen` from `channelIds`, which `checkAllStreamersOnlineStatus()` populates (it runs every 2 ticks). After boot or a PubSub reconnect, a status-check cycle must run before raid/prediction topics go live.

Keepalive and resilience: `PING` sent every 120s, reconnect timer on close, and a 5-minute `fetchBalanceSnapshot()` GQL fallback reconciles balances if PubSub events were missed.

### Topic handling

| Topic                                     | Handling                                                                                                                                                                                                                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `community-points-user-v1.*`              | Balance sync per channel; chest claimable → claim flow; `points-earned` with `reason_code: WATCH_STREAK` → advance local streak                                                                                                                                           |
| `raid.{channelId}`                        | On `raid_go_v2`: resolve the watched channel by reverse-looking up the topic id through `channelIds`, join via `JoinRaid`, record `raidsCount` for the **watched** channel. Never attribute to `raid.target_login` — that's the raid destination, not the watched channel |
| `predictions-channel-v1.{channelId}`      | When an event goes ACTIVE: place a `MakePrediction` bet (see [Drops & predictions](./drops-predictions.md))                                                                                                                                                               |
| `community-points-channel-v1.{channelId}` | Per-channel points context for mining channels                                                                                                                                                                                                                            |

## IRC (`wss://irc-ws.chat.twitch.tv:443`)

- Anonymous-capable read connection per open slot chat: PASS/NICK with the OAuth token when a token exists, otherwise unauthenticated read-only
- Incoming `PRIVMSG`s fill per-streamer `ChatMessage[]` buffers; `KNOWN_CHAT_BOTS` (streamelements, nightbot, fossabot, moobot, soundalerts, wizebot, streamlabs) and the broadcaster are filtered out of the UI
- The UI sends chat via `POST /api/streamers/:username/chat` → `handleUserChatMessage` → IRC `PRIVMSG`; the sent message is echoed into the local chat buffer because **Twitch does not echo own PRIVMSGs back**
- Chat events fan out over SSE as `chat` events (`{ channel, message }`)

## Auto-lurk

Per-streamer `lurkEnabled` / `lurkMessage` (default `!lurk`) posts the message into the channel's chat the moment it transitions offline→live:

1. **Scope check first:** posting requires `chat:edit`. `validateStoredAuthToken().hasChatEditScope` detects legacy tokens; without the scope the lurk is skipped with a once-per-worker WARN — and **never logged as sent**
2. **Two-layer dedupe:**
   - Durable: `Streamer.lastLurkDay` (UTC `YYYY-MM-DD`) — one post per day, survives restarts
   - In-memory: the self-echoed chat-buffer check (searches the channel's buffer for the already-posted message)
3. The `PRIVMSG` is sent with a 500ms grace timer; if the IRC socket didn't open in time the log reads `Lurk message not sent … IRC socket did not open in time` (WARN)
4. On success the message is self-echoed into the chat buffer (purple `#9146FF` highlight) and logged as INFO

The trigger is the live-status transition detected in the tick loop's status refresh — the same place `isLive`/viewer/game updates hit Prisma and SSE.
