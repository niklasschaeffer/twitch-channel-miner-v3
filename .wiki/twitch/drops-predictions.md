---
type: reference
title: Drops & Predictions
description: Drop inventory polling and claim gating, plus prediction
  auto-betting strategy and caps.
tags: [ twitch, drops, predictions, betting ]
last_updated: 2026-09-10T08:40:53.272Z
updated_by: Niklas Schäffer
---

# Drops & Predictions

## Drops

- Toggle: `autoClaimDrops` in settings
- Inventory poll on a 10-minute cadence: fetches the user's drops inventory and claims every drop with `is_claimable` **and** a `dropInstanceID` via the persisted `DropsPage_ClaimDropRewards` mutation
- Each successful claim increments `totalDropsClaimed` / per-hour `dropsCount` and logs a `DROP` entry

**Known gaps** (upstream TwitchDropsMiner does more):

- This implementation checks `is_claimable` only; upstream also gates on `has_preconditions_met` and watched-minutes thresholds per campaign
- Inventory polling is fixed-cadence; upstream adapts to campaigns in progress

## Predictions

- Toggle: `autoBetPredictions`; strategy: `predictionStrategy` — `lowest_odds` / `highest_odds` / `smart_ratio` (default) / `conservative`
- PubSub `predictions-channel-v1.{channelId}` events are handled only for channels in the `channelIds` map (so a status-check cycle must run after boot before prediction topics are subscribed — see [PubSub & IRC](./pubsub-irc.md))
- When an event goes ACTIVE, the worker places a `MakePrediction` bet capped by `maxBetPoints` (default 100); per-event dedupe prevents double betting on the same prediction
- Outcomes feed `predictionsWon` / `predictionsLost` / `netPredictionPoints` stat records; the dashboard shows a dedicated raids/predictions overview card

**Known gap:** the strategy is outcome-index-based. Porting upstream's odds-ratio expected-value calculation (`Bet.calculate()`) would improve bet quality.

## Where counters land

| Event | Status counter | StatisticalRecord fields |
| --- | --- | --- |
| Chest claimed | `totalClaims` | `claimsCount`, `chestsPoints` |
| Raid joined | `totalRaids` | `raidsCount` (attributed to watched channel) |
| Drop claimed | `totalDropsClaimed` | `dropsCount` |
| Prediction placed/won/lost | `totalPredictionsPlaced`/`Won`, `netPredictionPoints` | `predictionsWon`, `predictionsLost`, `netPredictionPoints` |

All of these are zero in production unless a real Twitch event caused them — see [Development → Simulation mode](../development/simulation-mode.md) for the dev-only fabricated counterparts.