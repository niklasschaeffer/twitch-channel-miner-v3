---
type: reference
title: Conventions & Code Rules
description: Enforced code style — no any, no comments, no tiny wrappers, i18n
  in en+de, comment-checker hook, merge discipline.
tags: [ conventions, code-style, i18n, rules ]
last_updated: 2026-09-10T08:41:17.066Z
updated_by: Niklas Schäffer
---

# Conventions & Code Rules

Rules enforced in this repository (by hooks/CI, not just style preference):

1. **No `any`** — use `unknown` + narrowing. (Existing `catch (err: any)` call sites predate the rule; new code narrows with `err instanceof Error` / typed error shapes.)
2. **No comments/docstrings** — the `omp-comment-checker` hook mechanically blocks writes containing them; make code self-documenting. Existing comments are grandfathered; don't add new ones.
3. **No tiny wrapper functions** unless they encode a durable contract (e.g. `extractTwitchUsername` exists in both `server/minerEngine.ts` and `src/lib/twitch.ts` because it is a real shared contract, not a one-liner wrapper).
4. **i18n:** every user-facing string needs keys in **both** `en` and `de` in `src/i18n.ts`.
5. **`tsc --noEmit` before every commit/merge** — husky pre-commit runs it with oxlint; CI re-runs it on `main`. The merged tree must typecheck before proceeding.
6. **Never commit the live DB** — `prisma/dev.db` (+ sidecars) and `backups/` are gitignored.

## Formatting and lint config

- `.oxlintrc.json` / `.oxfmtrc.json` — oxlint + oxfmt rules (oxfmt formatting landed in `adef747`)
- `.editorconfig` — baseline whitespace settings
- `bun.lock` is the lockfile of record (npm `package-lock.json` was removed in `ae63c93`)

## Runtime i18n audit

When checking translation keys, walk `resources.en.translation` via a Bun import of `src/i18n.ts`:

```bash
bun -e "import('./src/i18n.ts').then(m => { const r = m.resources.en.translation; console.log(Object.keys(r)) })"
```

Regex-parsing the file produces false positives.

## Twitch ground rules (from AGENTS.md)

These are behavioral invariants, not suggestions — see [Twitch integration](../twitch/index.md) for the full map:

- Client-id policy (TV id for authenticated GQL, web id for anonymous telemetry; custom ids → HTTP 400)
- Token stays server-side; `getSettings()` returns `hasAuthToken`
- Watch earning via spade heartbeats (204 = accepted); URL from settings.js assets
- Raids attributed to the watched channel via `channelIds` reverse lookup, never to `raid.target_login`
- Streaks tracked locally (`lastWatchDay`), never hardcoded
- Lurk requires `chat:edit`; never log a lurk as sent when the scope is missing
- Simulation gated behind `isSimulationMode`; production must never fabricate earnings or connection state

## Merge discipline

- Commit → push to `origin/main` → `docker compose build && docker compose up -d --build`
- `tsc --noEmit` on the merged tree before proceeding
- semantic-release derives versions from conventional commits (`feat:` → minor, `fix:` → patch)