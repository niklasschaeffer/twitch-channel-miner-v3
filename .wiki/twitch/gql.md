---
type: reference
title: Client IDs & GQL
description: Which client id to use where, authenticated GQL headers, persisted
  mutations, and the settings probe that rejects custom client ids.
tags: [ twitch, gql, client-id, mutations ]
last_updated: 2026-09-10T08:40:35.819Z
updated_by: Niklas Schäffer
---

# Client IDs & GQL

## The two client ids

| Credential | Id | Used for |
| --- | --- | --- |
| TV client id | `ue6666qo983tsx6so1t0vnawi233wa` | Twitch device-flow token pairing (`TWITCH_CLIENT_ID`), **authenticated GQL viewer context** (balance binding — verified live 2026-09-08) |
| Public web client id | `kimne78kx3ncx6brgo4mv6wki5h1ko` | Anonymous GQL telemetry (status checks, channel lookups without a token); default value of `MinerSettings.clientId` |

Rules:

- Do not swap them, and do not invent custom ids — Twitch GQL answers HTTP 400 to custom client ids. `updateSettings` probes a changed `clientId` against GQL and rejects invalid values.
- `authenticatedGqlHeaders()` in `minerWorker.ts` hardcodes the TV id together with `Authorization: OAuth <token>` and an `X-Device-Id`.
- Anonymous calls (`fetchBalanceSnapshot`-style status lookups when no token is stored) strip the Authorization header and use `settings.clientId || <web id>`.

## GQL endpoints and shapes

All GraphQL goes to `https://gql.twitch.tv/gql` via POST, either as a single operation or an array (batched queries, e.g. the all-streamer status check that resolves `users(logins: …)` with roles and stream info).

Representative operations in `minerWorker.ts`:

- **Status check** — `users(logins: $logins) { id login displayName profileImageURL roles { isPartner isAffiliate } stream { id viewersCount game { name } … } }`; populates `channelIds` (username → channel id) for PubSub topics
- **Balance snapshot** — per-channel `user(login) { channel { self { communityPoints { balance } } } self { follower … subscriptionBenefit { tier } } }`
- **Claim fetch** — `user.channel.self.communityPoints.availableClaim.id` for a channel, then the claim mutation
- **Token validation** — `GET https://id.twitch.tv/oauth2/validate` (`validateStoredAuthToken`) → `{ login, user_id, scopes }`; drives `hasChatEdit` detection and `pubsubUserId`

## Persisted mutations

Claims/raids/drops/predictions use persisted-query GQL mutations (mirroring upstream TwitchDropsMiner's `Twitch.py`) with a `sha256Hash` in `extensions.persistedQuery` — e.g. `JoinRaid` with hash `c6a332a86d1087fbbb1a8623aa01bd1313d2386e7c63be60fdb2d1901f01a4ae`. No Client-Integrity token is needed for any of them.

| Action | Mutation |
| --- | --- |
| Bonus chest | `ClaimCommunityPoints` |
| Raid join | `JoinRaid` |
| Prediction bet | `MakePrediction` |
| Drop claim | `DropsPage_ClaimDropRewards` |

Chest claiming is additionally gated: the channel must be partner/affiliate (`roles` from the status check) and the claim id must be currently available; `claimsInFlight` prevents double-claims per channel and each fetch/mutation uses an 8s `AbortSignal.timeout`.

## What custom client ids break

`updateSettings` accepts a new `clientId` from the settings form. Before persisting it probes GQL; custom ids receive HTTP 400 and are rejected, keeping the working default. Symptom if bypassed: every authenticated call fails balance binding, status checks log `Streamer status check failed: GQL HTTP 400 (client id …)`.