## Seed Script Plan

- `prisma/seeds/index.ts` as orchestrator
- Modules: `plans.ts`, `permissions.ts`, `geography.ts`, `themes.ts`, `feature-flags.ts`, `demo-tenant.ts`
- Use idempotent upserts
- Accept env (dev/staging/prod) to toggle sample data
