# Nepal E-Commerce Platform Sub-Agents Guide

## Overview

This project uses Claude Code sub-agents to manage the development of Nepal's first affordable Shopify alternative. Five specialized agents work together to deliver a production-ready multi-tenant e-commerce platform.

**Agents**:
1. **@PM** - Product Manager (business priorities, roadmap)
2. **@Architect** - Software Architect (technical design, multi-tenancy)
3. **@Coder** - Code Generator (implementation)
4. **@QA** - Quality Assurance (testing, tenant isolation)
5. **@Integrator** - Integration Specialist (Nepal services, Cloudflare)

## Sub-Agents Location

All sub-agent configurations are stored in:
```
.claude/agents/
├── pm.md
├── architect.md
├── coder.md
├── qa.md
└── integrator.md
```

## How to Invoke Sub-Agents

### Direct Invocation

Simply mention the agent by name:

```
"@PM, create a task for merchant onboarding"
"@Architect, how should we implement multi-tenant product catalog?"
"@Coder, implement the product CRUD API"
"@QA, test tenant isolation"
"@Integrator, set up eSewa payment gateway"
```

### Workflow Chains

Chain agents for complete feature development:

```
"@PM, create P1 task for eSewa payment integration.
Then @Architect, design the payment flow.
Then @Integrator, implement eSewa API.
Then @Coder, create the payment UI.
Finally @QA, test the complete payment flow."
```

---

## Sub-Agent Details

### 1. @PM - Product Manager

**Purpose:** Business decisions, roadmap management, task prioritization

**When to Use:**
- Creating new feature tasks
- Prioritizing work
- Understanding business requirements
- Checking roadmap status
- Revenue/cost analysis

**Triggers:**
- "Create a task for..."
- "What's the priority for..."
- "Is [feature] in the roadmap?"
- "What should we build next?"

**What it does:**
- Creates tasks in `.claude/tasks/active/`
- Prioritizes based on business value
- Manages 145-feature roadmap (24 sprints)
- Tracks progress toward 1,000 merchant goal
- Ensures Nepal-specific requirements met

**Example:**
```
You: "@PM, create a task for merchant onboarding flow"

PM: "PM here. Creating task NP-001 for merchant onboarding.

Task: Merchant Onboarding Flow
Priority: P0 (Critical - MVP blocker)
Sprint: Sprint 1
Business Value: HIGH (onboarding is revenue-critical)

Requirements:
- 6-step wizard (signup → store → payment → shipping → theme → launch)
- Email verification
- Business details collection
- Payment method setup (eSewa/Khalti)
- Shipping integration selection (Pathao/Tootle)

Delegating to @Architect for technical design."
```

---

### 2. @Architect - Software Architect

**Purpose:** Technical design, multi-tenancy architecture, code review

**When to Use:**
- Designing new features
- Reviewing code for quality
- Making technical decisions
- Ensuring multi-tenant isolation
- Performance optimization

**Triggers:**
- "Design the architecture for..."
- "Review this code..."
- "How should we implement..."
- "Is this multi-tenant safe?"

**What it does:**
- Creates technical specifications
- Ensures tenant_id filtering
- Reviews implementations
- Validates RLS policies
- Delegates to sub-agents
- Enforces coding standards

**Example:**
```
You: "@Architect, design the product catalog API"

Architect: "Architect here. Designing product catalog for multi-tenant SaaS.

Technical Spec:
- Single shared database with tenant_id column
- PostgreSQL RLS policies for isolation
- Prisma ORM with middleware
- Cloudflare Workers (Hono API)
- Indexes on (tenant_id, status, created_at)

API Endpoints:
GET /api/:tenantId/products - List products (tenant-filtered)
POST /api/:tenantId/products - Create product
PUT /api/:tenantId/products/:id - Update product
DELETE /api/:tenantId/products/:id - Delete product

Security:
- JWT authentication required
- Verify user.tenantId matches :tenantId param
- RLS automatically filters by tenant_id
- Test with 2+ tenants

Delegating to @Coder for implementation."
```

---

### 3. @Coder - Code Generator

**Purpose:** Implementation following specs from @Architect

**When to Use:**
- Implementing features
- Creating UI components
- Writing API endpoints
- Database queries
- Bilingual content

**Triggers:**
- "Implement..."
- "Create a component for..."
- "Write the API for..."
- "Generate code for..."

**What it does:**
- Writes code in `.claude/generated/`
- Follows indigo/pink theme
- Implements tenant isolation
- Adds EN/NE support
- Includes error handling
- Uses TypeScript

**Example:**
```
You: "@Coder, implement product CRUD API"

Coder: "COMPLETE: Created .claude/generated/api/products.ts

Status: Working
Tenant-Isolation: Verified

Features:
✅ List products (tenant-filtered)
✅ Create product with validation
✅ Update product (ownership check)
✅ Delete product (ownership check)
✅ Bilingual support (title/titleNe)
✅ Image uploads to Cloudflare R2
✅ Error handling
✅ TypeScript types

Files created:
- .claude/generated/api/products.ts (Hono API)
- .claude/generated/types/product.ts (TypeScript types)
- .claude/generated/middleware/tenant-context.ts (RLS helper)

Ready for @QA testing."
```

---

### 4. @QA - Quality Assurance

**Purpose:** Testing, multi-tenant isolation verification, quality checks

**When to Use:**
- Testing implementations
- Verifying tenant isolation
- Security testing
- Performance testing
- Nepal service testing

**Triggers:**
- "Test this feature..."
- "Verify tenant isolation..."
- "Check if this is secure..."
- "Run tests for..."

**What it does:**
- Creates test suites in `.claude/tests/`
- Tests with multiple tenants
- Verifies RLS policies
- Checks cross-tenant leakage
- Tests Nepal integrations
- Performance benchmarks

**Example:**
```
You: "@QA, test the product API for tenant isolation"

QA: "QA here. Testing product API multi-tenant isolation.

Test Results:
✅ Unit Tests: 12/12 passing
✅ Tenant Isolation: VERIFIED
✅ Cross-tenant access: BLOCKED
✅ RLS policies: ENABLED
✅ Performance: <50ms p95

Issues Found:
NONE - All tests passing

Tenant Isolation Tests:
✅ Tenant A cannot see Tenant B products
✅ Tenant A cannot update Tenant B products
✅ Tenant A cannot delete Tenant B products
✅ URL tampering blocked (tenantId mismatch)
✅ Database queries include tenant_id filter

Test files created:
- .claude/tests/api/products.test.ts
- .claude/tests/integration/tenant-isolation.test.ts

APPROVED: Ready for production deployment."
```

---

### 5. @Integrator - Integration Specialist

**Purpose:** External service integrations (Nepal APIs, Cloudflare)

**When to Use:**
- Integrating payment gateways
- Setting up logistics APIs
- Configuring SMS service
- Cloudflare services setup
- Database connections

**Triggers:**
- "Integrate..."
- "Set up..."
- "Configure..."
- "Connect to..."

**What it does:**
- Creates integration modules
- Implements Nepal service APIs
- Sets up Cloudflare services
- Handles webhooks
- Error handling & retry logic
- Documentation

**Example:**
```
You: "@Integrator, integrate eSewa payment gateway"

Integrator: "Integrator here. Integrating eSewa for Nepal merchants.

Implementation:
✅ Payment initiation (form-based)
✅ Payment verification (API-based)
✅ Success/failure callbacks
✅ Webhook handling
✅ Transaction logging
✅ Error handling with retries

Files created:
- .claude/generated/integrations/esewa.ts
- .claude/workflows/esewa-payment-flow.md

Environment Variables Needed:
ESEWA_MERCHANT_ID=your_merchant_id
ESEWA_SECRET_KEY=your_secret_key
APP_URL=https://yourdomain.com

Testing:
✅ Sandbox test passed
✅ Payment flow verified
✅ Webhook callbacks working
⏳ Production credentials needed

Next Steps:
1. Obtain production eSewa credentials
2. Configure webhooks in eSewa dashboard
3. Test with small real transactions (Rs 10)
4. Monitor for 24 hours
5. Full merchant rollout

Ready for @QA testing."
```

---

## Typical Workflows

### Complete Feature Development

**Workflow: Add Product Reviews**

```
1. "@PM, create task for customer product reviews"

2. "@Architect, design the reviews system with tenant isolation"

3. "@Coder, implement review CRUD API and UI components"

4. "@QA, test review system including tenant isolation"

5. "Deploy the feature"
```

### Nepal Service Integration

**Workflow: Add Khalti Payments**

```
1. "@PM, create task for Khalti payment integration"

2. "@Architect, design payment flow for Khalti"

3. "@Integrator, implement Khalti API integration"

4. "@Coder, create payment UI for merchants and customers"

5. "@QA, test Khalti payment flow end-to-end"
```

### Bug Fix

**Workflow: Fix Cross-Tenant Data Leak**

```
1. "@QA, I found a bug where Tenant A can see Tenant B orders"

2. "@Architect, review the orders API and identify the issue"

3. "@Coder, fix the tenant isolation bug"

4. "@QA, verify the fix with comprehensive tenant isolation tests"
```

---

## Critical Guardrails

### Multi-Tenancy Protection

All agents ENFORCE:
- ❌ **NEVER** query without tenant_id filter
- ❌ **NEVER** expose tenant_id in URLs
- ❌ **NEVER** skip RLS policies
- ❌ **NEVER** allow cross-tenant access
- ✅ **ALWAYS** test with 2+ tenants
- ✅ **ALWAYS** verify data isolation

### Database Safety

All agents ENFORCE:
- ❌ **NEVER** reset database
- ❌ **NEVER** delete tenant data
- ❌ **NEVER** skip backups
- ✅ **ALWAYS** use safe migrations
- ✅ **ALWAYS** test before deploy

### Code Quality

All agents ENFORCE:
- ✅ TypeScript strict mode
- ✅ Error handling
- ✅ Bilingual support (EN/NE)
- ✅ Indigo/pink theme (no teal/amber)
- ✅ File size guidelines (200-500 lines)
- ✅ Single Responsibility Principle

---

## Agent Communication

Agents communicate via structured formats:

**@PM → @Architect**:
```json
{
  "task_id": "NP-XXX",
  "priority": "P0-P3",
  "business_value": "High|Medium|Low",
  "requirements": []
}
```

**@Architect → @Coder**:
```json
{
  "task_id": "NP-XXX",
  "specification": {},
  "constraints": [
    "Must include tenant_id filtering",
    "Use RLS policies"
  ]
}
```

**@Coder → @QA**:
```json
{
  "implementation": "path/to/code",
  "tenant_isolation": "Verified",
  "ready_for_testing": true
}
```

---

## Best Practices

### When to Use Which Agent

| Scenario | Agent | Example |
|----------|-------|---------|
| Business decision | @PM | "Should we build X or Y first?" |
| Technical design | @Architect | "How should we architect this?" |
| Implementation | @Coder | "Build this feature" |
| Testing | @QA | "Test this implementation" |
| External API | @Integrator | "Integrate Pathao shipping" |

### Agent Chains

**Simple Feature**:
```
@PM → @Architect → @Coder → @QA
```

**Complex Integration**:
```
@PM → @Architect → @Integrator → @Coder → @QA
```

**Bug Fix**:
```
@QA (reports) → @Architect (analyzes) → @Coder (fixes) → @QA (verifies)
```

---

## Summary

✅ **@PM** manages business priorities and roadmap (1,000 merchant goal)
✅ **@Architect** designs multi-tenant architecture (single shared DB with RLS)
✅ **@Coder** implements features with tenant isolation (indigo/pink theme)
✅ **@QA** ensures quality and data isolation (no cross-tenant leakage)
✅ **@Integrator** connects Nepal services (eSewa, Khalti, Pathao, Tootle)

These agents work together to build a production-ready, multi-tenant e-commerce platform for Nepal merchants, with strong tenant isolation, Nepal-specific integrations, and cost-efficient Cloudflare infrastructure.

**Total Project**: 145 features across 24 sprints, targeting 1,000 merchants @ Rs 1,999-4,999/month.
