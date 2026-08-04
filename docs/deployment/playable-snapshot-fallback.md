# Playable snapshot fallback

## Purpose

HH Farm keeps Cloudflare Pages and Vercel as preferred production hosts. When either host is unavailable or rate-limited, the repository also publishes a portable playable snapshot after the exact `main` commit passes `Verify`.

## Pipeline

1. `Verify` passes for a same-repository push to `main`.
2. `Publish Playable Snapshot` checks out that exact verified SHA.
3. The workflow builds with production metadata and relative asset URLs.
4. Source maps are removed from the published snapshot.
5. Static output is force-published to the dedicated `playable` branch.
6. An immutable raw.githack CDN URL using the snapshot commit is smoke-tested.
7. The workflow summary records the playable URL and source SHA.

## Verification boundary

The smoke test verifies the application shell, `version.json`, farm map and every JS/CSS asset referenced by `index.html`. The regular `Verify` workflow remains responsible for unit tests, browser regressions and the production game loop.

raw.githack is a free fallback CDN without a formal uptime SLA. It is suitable for review and playable demos, not a replacement for the primary production host.
