# 🚀 Execution Plan (Weeks 1–4)

> Working schedule to activate the remaining roadmap. Owners refer to functional leads; adjust as team members are assigned.

## Week 1: Platform & Database Foundations

| Area | Task | Owner | Target Date | Notes |
|------|------|-------|-------------|-------|
| Platform | Confirm supporting service owners + credential status (`docs/ops/SUPPORTING-SERVICES-CHECKLIST.md`) | Platform Lead | Week 1 Fri | Kickoff meeting; verify `.env.example` + GitHub secrets coverage. |
| Platform | Publish manual secrets SOP + examples | DevOps Lead | Week 1 Fri | Share `docs/secrets/README.md` + `.env.example` files with team. |
| Platform | Schedule Prisma production migration window + send Slack notice | Platform Lead | Week 1 Thu 10:00 NPT | Use template in `docs/database/IMPLEMENTATION-CHECKLIST.md`; calendar invite `NepShop Prisma Prod Migration #000_init`. |
| Platform | Configure Postmark sender + sync secrets for auth emails | Platform Lead | Week 1 Thu | Align with supporting services checklist; ensure `PASSWORD_RESET_EMAIL_FROM` verified. |
| Database | Generate Prisma baseline migration & apply to dev | Backend Lead | Week 1 Wed | Follow `docs/database/IMPLEMENTATION-CHECKLIST.md` §1. |
| Database | Draft RLS SQL script + review | Backend Lead | Week 1 Fri | Store under `prisma/rls/`. |

## Week 2: Database Hardening & Auth APIs

| Area | Task | Owner | Target Date | Notes |
|------|------|-------|-------------|-------|
| Database | Seed automation script + fixtures | Backend Lead | Week 2 Wed | `prisma/seeds/seed.ts`. |
| Database | Tenant provisioning transaction + worker draft | Backend Lead | Week 2 Fri | Coordinate with Platform for queue config. |
| Backend API | Auth/session lifecycle endpoints completion | API Lead | Week 2 Fri | Checklist `docs/architecture/API-IMPLEMENTATION-CHECKLIST.md` §1. |
| Backend API | Tenant/staff management endpoints | API Lead | Week 2 Fri | Checklist §2; ensure plan limits enforced. |

## Week 3: Catalog UI & Integrations Kickoff

| Area | Task | Owner | Target Date | Notes |
|------|------|-------|-------------|-------|
| Frontend | Merchant onboarding wizard implementation | Frontend Lead | Week 3 Fri | Checklist `docs/frontend/IMPLEMENTATION-CHECKLIST.md` §1. |
| Frontend | Merchant dashboard shell & notifications | Frontend Lead | Week 3 Fri | Checklist §2. |
| Integrations | eSewa + Khalti integration sprint planning | Integrations Lead | Week 3 Mon | Map sandbox creds, timeline. |
| Integrations | Pathao logistics API spike | Integrations Lead | Week 3 Fri | Checklist `docs/integrations/IMPLEMENTATION-CHECKLIST.md` §2. |

## Week 4: DevOps, QE, Security Alignment

| Area | Task | Owner | Target Date | Notes |
|------|------|-------|-------------|-------|
| DevOps | Implement CI workflow (`ci.yml`) + branch protections | DevOps Lead | Week 4 Wed | Checklist `docs/deployment/IMPLEMENTATION-CHECKLIST.md` §§1–2. |
| DevOps | Configure staging/production env scripts | DevOps Lead | Week 4 Fri | Checklist §4. |
| QE | Vitest configs + integration harness setup | QA Lead | Week 4 Wed | Checklist `docs/guides/QE-IMPLEMENTATION-CHECKLIST.md` §§1–2. |
| QE | Playwright project scaffolding | QA Lead | Week 4 Fri | Checklist §3. |
| Security | Argon2id adoption + rate limiting middleware | Security Champ | Week 4 Fri | Checklist `docs/guides/SECURITY-IMPLEMENTATION-CHECKLIST.md` §§1–2. |
| Program Mgmt | Publish roadmap & schedule reviews | Program Lead | Week 4 Fri | Checklist `docs/ops/PROGRAM-MANAGEMENT-CHECKLIST.md` §§2–3. |

## Ongoing Cadence
- Bi-weekly sync to update checklist statuses and adjust targets.
- Track completion in `docs/PROJECT-TODO.md` and mirror into ticketing tool.
- Surface risks/blockers in weekly leadership updates.
