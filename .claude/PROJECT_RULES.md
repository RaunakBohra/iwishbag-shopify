# AI Agent Access Control - Nepal E-Commerce Platform (iWishBag)

## Read/Write Permissions

### @PM (Product Manager)
- **Write Access**: `.claude/docs/`, `.claude/tasks/`
- **Read Access**: All project directories
- **Purpose**: Requirements, documentation, task management

### @Architect (Software Architect)
- **Write Access**: `.claude/docs/specs/`
- **Read Access**: `.claude/docs/`, `.claude/tasks/`, `frontend/`, `api/`, `shared/`
- **Purpose**: Technical specifications, architecture decisions

### @Coder (Code Generator)
- **Write Access**: `.claude/generated/`
- **Read Access**: `.claude/tasks/`, `.claude/docs/specs/`
- **Purpose**: Implementation of features

### @QA (Quality Assurance)
- **Write Access**: `.claude/tests/`
- **Read Access**: `.claude/generated/`, `frontend/`, `api/`, `shared/`, `tests/`
- **Purpose**: Test creation, quality validation

### @Integrator (Integration Specialist)
- **Write Access**: `.claude/workflows/`
- **Read Access**: `.claude/tasks/`, `.claude/docs/specs/`, `api/`
- **Purpose**: External service integrations (Nepal services: eSewa, Khalti, Pathao, Tootle)

## Agent Aliases
- `@PM` = Product Manager
- `@Architect` = Software Architect
- `@Coder` = Code Generator
- `@QA` = Quality Assurance
- `@Integrator` = Integration Specialist

## Project-Specific Rules

### Critical Constraints
1. **Database**: NEVER reset DB - tenant data is sacred (single shared database with tenant_id)
2. **Multi-Tenancy**: Single shared Neon PostgreSQL with Row-Level Security (RLS)
3. **Theme**: Indigo/Pink Modern Design (NO teal or amber colors)
   - Primary: Indigo #3730a3 (`bg-primary-600`)
   - Primary dark: Deep Indigo #1e3a8a (`bg-primary-800`)
   - Primary light: Light Indigo #eef2ff (`bg-primary-50`)
   - Accent: Pink #db2777 (`bg-accent-600`)
   - Neutral: Slate shades (`bg-neutral-100`, `text-neutral-900`)
4. **i18n**: All content must support English/Nepali (EN/NE)
5. **Nepal-First**: eSewa, Khalti, IME Pay, Pathao, Tootle, Sparrow SMS
6. **Backend Standards**: Controllers 200-500 lines, SRP over line count

### Technology Stack
- **Frontend**: Next.js 15 (static export), React 19, TailwindCSS 4
- **API**: Hono.js on Cloudflare Workers
- **Database**: Neon PostgreSQL 16 (single shared DB with tenant_id + RLS)
- **ORM**: Prisma 6
- **Storage**: Cloudflare R2
- **Images**: Cloudflare Images
- **Cache**: Cloudflare KV
- **Background Jobs**: Cloudflare Queues
- **Real-time**: Cloudflare Durable Objects
- **Deployment**: Cloudflare Pages (frontend) + Workers (API)
- **Email**: AWS SES
- **SMS**: Sparrow SMS (Nepal)
- **Search**: MeiliSearch (self-hosted on Fly.io)

### Cost Optimization Goals
- Target: $15-1,058/month for 0-1000 merchants
- Single shared database (NOT database-per-tenant)
- Cloudflare-first architecture
- Migration path: Neon → AWS RDS at 10k+ users

### Workflow Rules
1. All new code goes to `.claude/generated/` first
2. Human reviews before integration into main codebase
3. All features must be bilingual (EN/NE)
4. Follow existing patterns in the codebase
5. Maintain merchant dashboard consistency with indigo/pink theme
6. Always use tenant_id filtering for multi-tenant queries
7. Use PostgreSQL RLS for data isolation
8. Never expose tenant data across boundaries

### Nepal-Specific Requirements
- Support Nepali language (Devanagari script)
- Nepal timezone (Asia/Kathmandu, UTC+5:45)
- Nepal currency (NPR, रू)
- Nepal provinces and districts data
- Nepal payment gateways (eSewa, Khalti, IME Pay, ConnectIPS, FonePay)
- Nepal logistics (Pathao, Tootle, Nepal Post)
- Nepal phone numbers (+977)
- Nepal address format
