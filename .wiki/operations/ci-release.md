---
type: reference
title: CI & Release
description: Lint/typecheck/test gates, husky hooks, semantic-release pipeline
  with dual Bun/Node images, and the wiki update workflow (push + nightly).
tags: [ci, release, semantic-release, husky, github-actions]
last_updated: 2026-09-10T09:57:06.000Z
updated_by: Niklas Schäffer
---

# CI & Release

## Pre-commit and merge gates

- Husky pre-commit (`.husky/pre-commit`) runs `bunx oxlint --import-plugin --vitest-plugin --react-plugin`, then `bunx oxfmt`, then `npm run lint` — which _is_ `tsc --noEmit`
- `tsc --noEmit` MUST pass before any commit/merge; CI re-runs it (`bun run lint`) plus **`bun run test` (Vitest)** on every push to `main` (`.github/workflows/release.yml`, Bun setup)

## Test suite

A small Vitest suite lives in `tests/` (`chest.test.ts`, `gravatar.test.ts`, `twitch.test.ts`, `i18n.test.ts`) covering pure helpers, i18n en/de parity, and chest progress; run with `npm run test`. There is no full integration/E2E suite — live smoke tests against the running container remain part of verification.

## Release pipeline

- **semantic-release** on pushes to `main` (plus `beta` and `alpha` prerelease branches per `.releaserc.json`)
- Workflow: `lint` job first, then `release` job (needs lint) with contents/issues/pull-requests write permissions
- Plugins: commit-analyzer, release-notes-generator, changelog (writes `CHANGELOG.md`), npm publish **disabled**, git/github
- Release commits are `[skip ci]`-tagged (see `chore(release): …` history); releases ran on a Node runner until `ede327b` migrated to Bun for lockfile consistency
- After the release job publishes the Bun image, a second build-push step builds `Dockerfile.node` and pushes the same tags with a `-node` suffix (`:latest-node`, `:1.x.x-node`, `:v1.x.x-node`, `:sha-node`) — see [Deployment](./deployment.md)
- Current release: **1.16.0** (2026-09-10)

## Wiki update workflow

`.github/workflows/update-wiki.yml` runs on every push to `main`, daily at 08:00 UTC (`0 8 * * *`), and on `workflow_dispatch` (schedule and push triggers reshuffled in `8ae4510`): creates a GitHub App token, checks out the repo, sets up Bun + Node 25, and runs the wiki agent, which opens a `wiki/staging-<unix-timestamp>` pull request with regenerated `.wiki/` content. Concurrency group `wiki-update-${{ github.ref }}` cancels superseded runs.

## Renovate

`renovate.json` manages dependency updates; combined with semantic-release, dependency PRs that merge to `main` can trigger patch releases.
