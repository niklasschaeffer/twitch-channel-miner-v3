---
type: reference
title: CI & Release
description: Lint/typecheck gate, husky hooks, semantic-release pipeline, and
  the scheduled wiki update workflow.
tags: [ci, release, semantic-release, husky, github-actions]
last_updated: 2026-09-10T08:41:09.037Z
updated_by: Niklas Schäffer
---

# CI & Release

## Pre-commit and merge gates

- Husky pre-commit (`.husky/pre-commit`) runs **oxlint + `tsc --noEmit`**; `npm run lint` _is_ `tsc --noEmit`
- `tsc --noEmit` MUST pass before any commit/merge; CI re-runs it (`bun run lint`) on every push to `main` (`.github/workflows/release.yml`, Bun setup)
- There is no full test suite — see [Development → Testing](../development/index.md)

## Release pipeline

- **semantic-release** on pushes to `main` (plus `beta` and `alpha` prerelease branches per `.releaserc.json`)
- Workflow: `lint` job first, then `release` job (needs lint) with contents/issues/pull-requests write permissions
- Plugins: commit-analyzer, release-notes-generator, changelog (writes `CHANGELOG.md`), npm publish **disabled**, git/github
- Release commits are `[skip ci]`-tagged (see `chore(release): …` history); releases ran on a Node runner until `ede327b` migrated to Bun for lockfile consistency
- Current release: **1.12.0** (2026-09-10)

## Wiki update workflow

`.github/workflows/update-wiki.yml` runs daily (`0 0 * * *`) and on `workflow_dispatch`: creates a GitHub App token, checks out the repo, sets up Bun + Node 25, and runs the wiki agent, which opens a `wiki/staging-<unix-timestamp>` pull request with regenerated `.wiki/` content. Concurrency group `wiki-update-${{ github.ref }}` cancels superseded runs.

## Renovate

`renovate.json` manages dependency updates; combined with semantic-release, dependency PRs that merge to `main` can trigger patch releases.
