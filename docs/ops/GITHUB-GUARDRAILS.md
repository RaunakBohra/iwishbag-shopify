# 🔒 GitHub Guardrails

> Define repository protection rules so CI/CD and release automation can rely on consistent branch hygiene.

## Branch Protections

| Branch | Required Reviews | Required Checks | Merge Strategy | Notes |
|--------|------------------|-----------------|----------------|-------|
| `dev` | 0 (recommended review) | `ci` (lint/test/type), optional coverage | Allow squash/merge; disable force pushes | Use for feature integration; keep history clean via squash. |
| `staging` | 1 approving review | `ci`, `playwright-smoke` | Squash/merge only; no force pushes | Gate staging deploys; require linear history. |
| `main` | 2 approving reviews | `ci`, `playwright-smoke`, `coverage` (Codecov) | Merge queue (once enabled) or squash with admin bypass disabled | Treat as production release branch; require status checks to pass. |

## Environment Approvals

| GitHub Environment | Applicable Branches | Required Reviewers | Notes |
|--------------------|---------------------|--------------------|-------|
| `staging` | `staging` | Platform Eng on-call | Blocks `deploy-web.yml` / `deploy-api.yml` until approved. |
| `production` | `main` | Platform Eng + SRE | Requires two-person rule before production deploy workflows proceed. |

## Secrets & Tokens

- Maintain secrets via documented sync scripts (`pnpm secrets:sync`, manual `gh secret set` + `wrangler secret put`).
- Review secret access quarterly; revoke unused tokens promptly.

## Status Check Policy

- `ci`: runs linting, unit tests, type checks; must pass on all branches.
- `playwright-smoke`: minimal UI regression suite; required on `staging`/`main`.
- `coverage`: Codecov gate to ensure coverage does not regress.

## Merge Queue Adoption (Future)

- Enable GitHub merge queue for `main` once CI runtime stays under 15 minutes.
- Until then, enforce required checks and reviews manually; no direct pushes.

## Implementation Steps
1. In repository settings, configure branch protection rules using the table above (`Settings → Branches → Add rule`).
2. Enable required status checks (`ci`, `playwright-smoke`, `coverage`) via branch protection settings; install/configure the Codecov app so the `coverage` check reports status.
3. Turn on “Require approvals” per branch (none for `dev`, one for `staging`, two for `main`) and disable force pushes.
4. Configure GitHub environments (`staging`, `production`) with the required reviewers list to gate `deploy-*` workflows.
5. (Optional) Activate merge queue for `main` once CI cycle times fall under the target threshold.
