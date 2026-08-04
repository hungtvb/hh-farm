# GitHub Pages playable deployment

## Purpose

GitHub Pages is HH Farm's quota-independent playable host while Vercel or another primary host is unavailable. It publishes only a `main` commit that has already passed the repository's `Verify` workflow.

## Deployment contract

1. `Verify` completes successfully for a same-repository push to `main`.
2. `Deploy GitHub Pages` checks out the exact `workflow_run.head_sha`.
3. The app is built with production metadata and the repository Pages URL.
4. Production-bundle validation runs before upload and source maps are removed.
5. GitHub Pages receives the `dist` artifact through the official Pages actions.
6. The live URL returned by `deploy-pages` is checked for the application shell, exact `version.json` SHA, farm map and referenced JS/CSS assets.
7. The workflow summary records the verified playable URL and source SHA.

## URL

The expected repository Pages URL is:

```text
https://hungtvb.github.io/hh-farm/
```

Treat the URL as ready only after the deployment job's live smoke test passes. Browser/gameplay correctness remains covered by the preceding `Verify` workflow.

## Relationship to other hosts

- GitHub Pages: official quota-independent playable fallback.
- Cloudflare Pages/Vercel: preferred production hosts when healthy and within quota.
- `playable` branch/raw CDN: artifact fallback only; not an endorsed live game URL.
