# Quick Reference - Nepal E-Commerce Platform (iWishBag)

## Agent Commands

### Call Specific Agent
```
@PM - For product/business decisions
@Architect - For technical design
@Coder - For implementation
@QA - For testing
@Integrator - For Nepal service integrations
```

### Common Workflows

**Start New Feature**:
```
"@PM, create task for [feature name]"
"@Architect, spec out the implementation"
"@Coder, implement the feature"
"@QA, test this implementation"
```

**Nepal Service Integration**:
```
"@Integrator, integrate eSewa payment gateway"
"@Integrator, set up Pathao shipping"
"@Integrator, configure Sparrow SMS"
```

**Code Review**:
```
"@Architect, review the code in .claude/generated/"
"@QA, test multi-tenant isolation"
```

## Project Structure

```
iwishbag-shopify/
├── .claude/                    # Agent workspace
│   ├── agents/                 # Agent definitions
│   ├── docs/                   # Agent documentation
│   ├── tasks/                  # Task queue
│   ├── generated/              # Generated code
│   ├── tests/                  # QA test files
│   └── workflows/              # Integration workflows
├── docs/                       # Project documentation
│   ├── 00-MASTER-PLAN.md      # 145 features, 24 sprints
│   ├── architecture/           # Tech stack, architecture
│   ├── database/               # Schema, multi-tenancy
│   ├── features/               # Feature specs
│   ├── integrations/           # Nepal services
│   └── guides/                 # Setup guides
├── frontend/                   # Next.js 15 (static export)
├── api/                        # Hono on Cloudflare Workers
├── shared/                     # Shared types and utilities
└── prisma/                     # Database schema (single shared DB)
```

## Tech Stack Quick Reference

**Frontend**: Next.js 15 static export, React 19, TailwindCSS 4
**API**: Hono on Cloudflare Workers
**Database**: Neon PostgreSQL (shared with tenant_id + RLS)
**Deployment**: Cloudflare Pages + Workers
**Language**: TypeScript, bilingual (EN/NE)

## Theme Colors

```typescript
// Primary (Indigo)
bg-primary-600   // #3730a3 - Main buttons
bg-primary-800   // #1e3a8a - Dark nav/headers
bg-primary-50    // #eef2ff - Light backgrounds

// Accent (Pink)
bg-accent-600    // #db2777 - Badges, highlights

// Neutral (Slate)
bg-neutral-100   // Backgrounds
text-neutral-900 // Text

// Status
bg-success-500   // Green
bg-danger-500    // Red
```

## Critical Rules

1. **NEVER reset database** - 1000+ tenants depend on data
2. **ALWAYS filter by tenant_id** - Multi-tenant isolation
3. **ALWAYS use RLS policies** - PostgreSQL security
4. **NO teal/amber colors** - Use indigo/pink only
5. **Support EN/NE** - All features bilingual
6. **Nepal-first** - eSewa, Khalti, Pathao, Tootle

## Common Commands

**Create Task**:
```
"@PM, create P1 task for merchant onboarding"
```

**Implement Feature**:
```
"@Architect, spec out product catalog API"
"@Coder, implement according to spec"
```

**Test Feature**:
```
"@QA, test multi-tenant isolation for products"
"@QA, verify eSewa payment flow"
```

**Integrate Service**:
```
"@Integrator, integrate Khalti payments"
"@Integrator, set up Cloudflare R2 storage"
```

## Multi-Tenancy Checklist

Every feature MUST:
- [ ] Filter queries by tenant_id
- [ ] Use RLS policies
- [ ] Test with 2+ tenants
- [ ] No tenant_id in URLs
- [ ] Use subdomain/slug for tenant
- [ ] Verify no cross-tenant data leakage

## Nepal Service Checklist

- [ ] eSewa payment integration
- [ ] Khalti payment integration
- [ ] IME Pay integration
- [ ] Pathao shipping integration
- [ ] Tootle delivery integration
- [ ] Sparrow SMS integration
- [ ] Nepal provinces/districts data
- [ ] NPR currency formatting (रू)
- [ ] Nepal timezone (UTC+5:45)
- [ ] Nepali language support (Devanagari)

## Useful File Paths

**Documentation**:
- Master plan: `docs/00-MASTER-PLAN.md`
- Tech stack: `docs/architecture/TECH-STACK-CLOUDFLARE.md`
- Database: `docs/database/DATABASE-SCHEMA.md`
- Nepal services: `docs/integrations/NEPAL-SERVICES.md`

**Agent Files**:
- Project rules: `.claude/PROJECT_RULES.md`
- Active tasks: `.claude/tasks/active/`
- Generated code: `.claude/generated/`
- Test files: `.claude/tests/`

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://...
DATABASE_POOLED_URL=postgresql://...-pooler

# Cloudflare
CLOUDFLARE_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...

# Nepal Payments
ESEWA_MERCHANT_ID=...
KHALTI_SECRET_KEY=...
IME_PAY_MERCHANT_CODE=...

# Nepal Logistics
PATHAO_API_KEY=...
TOOTLE_API_KEY=...

# Nepal SMS
SPARROW_SMS_TOKEN=...

# Email
AWS_SES_ACCESS_KEY=...
AWS_SES_SECRET_KEY=...
```

## Cost Targets

- **MVP (0-50 merchants)**: $15/month
- **Launch (50-200 merchants)**: $264/month
- **Growth (200-1000 merchants)**: $600/month
- **Scale (1000+ merchants)**: $550-1,058/month

## Revenue Targets

- **Target**: 1,000 merchants in 18 months
- **Pricing**: Rs 1,999-4,999/month
- **Revenue at 600 paying**: Rs 15,59,400/month (~$18,900)
- **Profit margin**: 92-97%

## Quick Agent Examples

**PM Creating Task**:
> "@PM, create P1 task for merchant onboarding flow"

**Architect Designing**:
> "@Architect, design the multi-tenant product catalog API with RLS"

**Coder Implementing**:
> "@Coder, implement product CRUD with tenant isolation"

**QA Testing**:
> "@QA, verify no cross-tenant data leakage in product API"

**Integrator Connecting**:
> "@Integrator, integrate eSewa payment gateway for Nepal merchants"
