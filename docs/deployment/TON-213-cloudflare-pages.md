# TON-213 — Cloudflare Pages delivery runbook

## Verdict

Use the existing GitHub `Verify` workflow as the quality gate and run a separate `Deploy Pages` workflow only after that workflow completes successfully.

The deploy workflow uses Cloudflare Pages Direct Upload. Pull requests from branches in this repository deploy as previews. A verified `main` push deploys production.

## Pipeline

```text
pull request or main push
        │
        ▼
Verify
  npm ci
  generated-map drift
  typecheck + lint
  unit tests
  production build
  production diagnostics scan
  Chromium runtime/recovery/benchmark tests
        │ success
        ▼
Deploy Pages
  resolve the verified ref
  rebuild with release metadata
  upload dist through Wrangler
  verify deployed commit/environment
  verify index, map and referenced assets
  publish preview URL / deployment summary
```

The deploy workflow accepts same-repository pull requests only. It does not execute a fork's code with Cloudflare credentials.

## Cloudflare configuration

Project name: `hh-farm`

Production branch: `main`

Build command:

```bash
npm run build
```

Build output:

```text
dist
```

Wrangler configuration is committed in `wrangler.toml`. The workflow pins Wrangler `4.114.0` and creates the Pages project with production branch `main` when it does not already exist.

## Required repository secrets

Create these GitHub Actions repository secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

The API token requires Account → Cloudflare Pages → Edit for the target account. Do not use a Global API key.

Until both secrets exist, `Deploy Pages` exits successfully without publishing and writes an explicit skipped-deployment summary. This avoids blocking source work while preventing a false deployment claim.

## Required GitHub repository rule

The repository owner must configure a rule for `main` in GitHub Settings because the available automation connector does not expose repository rulesets.

Minimum rule:

1. Require a pull request before merging.
2. Require status checks to pass.
3. Select `Verify / verify` as required.
4. Require branches to be up to date before merging.
5. Block force pushes and branch deletion for `main`.

`Deploy Pages` should not be a required merge check: it runs after the verified workflow and depends on external Cloudflare availability. A failed preview deployment is still a release blocker for TON-213 acceptance and must be investigated before merge.

## Build identity

Every build emits `/version.json` and exposes the same values as attributes on the root HTML element:

- `appVersion`
- `gitSha`
- `gitRef`
- `builtAt`
- `deploymentEnvironment`
- `deploymentUrl`

For a preview, `deploymentEnvironment` is `preview`. For `main`, it is `production`.

The deployed smoke test rejects a Pages URL when `version.json.gitSha` differs from the exact checked-out commit.

## Preview flow

1. Open or update a pull request from a branch in `hungtvb/hh-farm`.
2. `Verify` runs against the merge candidate.
3. `Deploy Pages` checks out the same pull-request merge ref.
4. Wrangler uploads `dist` with the source branch name.
5. Cloudflare returns an immutable deployment URL and a branch alias.
6. The workflow verifies the deployed build and comments the verified URL on the pull request.

Preview aliases are branch-based and may change target as new commits are pushed. The immutable deployment URL remains useful as evidence for an exact build.

## Production flow

1. Merge a pull request after `Verify / verify` passes.
2. The push to `main` triggers `Verify` again.
3. A successful `main` verification triggers `Deploy Pages`.
4. Wrangler uploads the exact verified commit with branch `main`.
5. The deployment smoke test validates production metadata and assets.

## Deployment smoke checks

The script `scripts/verify-pages-deployment.mjs` verifies:

- root URL returns the HH Farm application shell;
- `/version.json` matches the expected commit and environment;
- `/maps/farm-test.json` loads;
- every `src` and `href` asset referenced by `index.html` loads successfully.

The repository does not yet contain production audio assets. Audio path verification is therefore not claimable in TON-213 today. When TON-221 adds the audio manifest/assets, the manifest must become a required deployment-smoke target before production release.

## Rollback

Cloudflare dashboard:

1. Open Workers & Pages.
2. Open the `hh-farm` Pages project.
3. Open Deployments.
4. Locate a previously successful production deployment.
5. Open its actions menu and choose **Rollback to this deployment**.
6. Re-run the deployment smoke script against the production URL and record the resulting `version.json`.

Only successful production deployments are valid rollback targets; preview deployments are not.

A rollback changes deployed assets only. It does not downgrade IndexedDB data. Save compatibility with an older build must be checked before rollback during the release-candidate drill in TON-227.

## Current acceptance status

Repository-side implementation is complete when PR #7 gates pass.

External evidence still required before TON-213 can be closed:

- Cloudflare secrets configured.
- Live preview URL generated for a pull request.
- Preview URL passes the deployment smoke script.
- A verified `main` commit deploys production.
- `main` repository rule requires `Verify / verify`.
- Audio-path check remains deferred until an audio asset exists; this limitation must remain visible in release planning.
