# Shared Types Overview

> Last updated: 2025-01-16

## Purpose
- Provide a single source of truth for frontend/admin data contracts.
- Reduce duplicated interfaces (dashboard metrics, onboarding, storefront products).
- Prepare for auth/onboarding flows that span admin + storefront.

## Package Layout

```
shared/
├── package.json            # @iwishbag/shared metadata
├── tsconfig.json           # Strict TS config
└── src/
    ├── dashboard.ts        # Permissions, operator profile, dashboard metrics
    ├── onboarding.ts       # Onboarding status + card states
    ├── storefront.ts       # Storefront product/search DTOs
    └── index.ts            # Barrel export
```

## Usage

1. Path aliases have been added to `admin/tsconfig.json` and `frontend/tsconfig.json`:
   ```json
   {
     "paths": {
       "@iwishbag/shared": ["../shared/src/index.ts"],
       "@iwishbag/shared/*": ["../shared/src/*"]
     }
   }
   ```
2. Import whichever types you need:
   ```ts
   import type { DashboardOverview, StorefrontProduct } from '@iwishbag/shared'
   ```
3. Next.js automatically resolves these aliases during build/dev.

## Next Steps

1. Expand `shared/src` with:
   - Auth session + role DTOs once the API contract stabilizes.
   - Tenant + plan DTOs for onboarding wizard.
   - Worker payload types (queues, background jobs).
2. Update API route handlers (`api/src/routes`) to emit these DTOs so admin/front stay type-safe.
3. Add unit tests / type tests to ensure DTOs stay in sync with Prisma schema (e.g., using `zod` + `tsd`).
