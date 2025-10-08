# Task: Merchant Authentication System

**ID**: NP-001
**Priority**: P0 (Critical - MVP blocker)
**Sprint**: Sprint 1 (MVP - Month 1)
**Status**: TODO
**Created**: 2025-10-08
**Assigned**: @Architect

---

## Business Value

- **Revenue Impact**: HIGH (blocks all revenue - merchants can't sign up)
- **User Impact**: 100% of merchants (everyone needs to login)
- **Nepal-Specific**: Yes (Nepal phone numbers, timezone)
- **Competitive Advantage**: Fast onboarding (< 5 minutes)

---

## User Story

**As a** Nepal-based merchant,
**I want** to create an account and login securely,
**So that** I can set up my online store and start selling.

---

## Acceptance Criteria

### Authentication Features
- [ ] Email/password signup
- [ ] Phone number verification (Nepal +977)
- [ ] OTP via Sparrow SMS
- [ ] Email verification link
- [ ] Secure password requirements (8+ chars, uppercase, number, symbol)
- [ ] JWT token-based sessions
- [ ] Remember me functionality
- [ ] Password reset flow

### Multi-Tenancy
- [ ] Each signup creates unique tenant_id
- [ ] Tenant record created in shared database
- [ ] Subdomain auto-assigned (store-name.nepshop.com)
- [ ] Tenant context set in JWT claims
- [ ] User associated with tenant

### Security
- [ ] Passwords hashed with bcrypt (cost 12)
- [ ] JWT secrets from environment
- [ ] Session tokens stored in Cloudflare KV
- [ ] Rate limiting on login/signup (5 attempts/15min)
- [ ] HTTPS only cookies
- [ ] XSS/CSRF protection

### UI/UX
- [ ] Bilingual forms (EN/NE)
- [ ] Indigo/pink theme
- [ ] Mobile responsive
- [ ] Loading states
- [ ] Error messages (EN/NE)
- [ ] Success confirmations
- [ ] Redirect to onboarding after signup

### Nepal-Specific
- [ ] Nepal phone number validation (+977-XXXXXXXXX)
- [ ] Nepal timezone (Asia/Kathmandu UTC+5:45)
- [ ] Nepali language option
- [ ] Store name in English and Nepali

---

## Technical Notes

*To be filled by @Architect*

### Architecture Decisions Needed
1. NextAuth.js v5 vs custom JWT implementation?
2. Cloudflare KV vs PostgreSQL for sessions?
3. Email verification required or optional?
4. Social login (Google) in MVP or later?

### Database Schema
```sql
-- Tenants table (shared database)
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  name_ne VARCHAR(255),
  slug VARCHAR(100) UNIQUE NOT NULL,
  subdomain VARCHAR(100) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  plan_id UUID REFERENCES subscription_plans(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users table (merchants)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  role VARCHAR(20) DEFAULT 'owner',
  email_verified BOOLEAN DEFAULT FALSE,
  phone_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_isolation_policy ON users
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

### API Endpoints
```
POST /api/auth/signup          - Create account
POST /api/auth/login           - Login
POST /api/auth/logout          - Logout
POST /api/auth/verify-email    - Verify email
POST /api/auth/verify-phone    - Verify phone (OTP)
POST /api/auth/forgot-password - Request reset
POST /api/auth/reset-password  - Reset password
GET  /api/auth/me              - Get current user
```

### Technology Stack
- **Frontend**: Next.js 15 (static export), React Hook Form, Zod validation
- **API**: Hono on Cloudflare Workers
- **Database**: Neon PostgreSQL (shared with tenant_id)
- **Auth**: Custom JWT (RS256) or NextAuth.js v5
- **Sessions**: Cloudflare KV (7-day TTL)
- **SMS**: Sparrow SMS for OTP
- **Email**: AWS SES for verification

---

## Dependencies

### Blocking
- None (this is the first feature)

### Blocked By This
- NP-002: Merchant Onboarding Flow
- NP-003: Admin Dashboard
- NP-004: Product Management
- All other features require authentication

---

## Estimated Effort

*To be provided by @Architect*

- **Design**: ___ hours
- **Implementation**: ___ hours
- **Testing**: ___ hours
- **Integration**: ___ hours
- **Total**: ___ hours

---

## Risks & Mitigations

### Risks
1. **OTP delivery delays** (Sparrow SMS)
   - Mitigation: Fallback to email OTP, show user-friendly message

2. **Subdomain availability** (name conflicts)
   - Mitigation: Suggest alternatives, allow custom slugs

3. **Session management complexity** (KV vs DB)
   - Mitigation: Start with KV, migrate if needed

4. **Nepal phone number validation** (format variations)
   - Mitigation: Support multiple formats, normalize on save

---

## Testing Requirements

### Unit Tests
- [ ] Password hashing/verification
- [ ] JWT generation/validation
- [ ] Phone number normalization
- [ ] Email validation
- [ ] OTP generation

### Integration Tests
- [ ] Signup flow end-to-end
- [ ] Login flow with valid/invalid credentials
- [ ] Email verification
- [ ] Phone verification (OTP)
- [ ] Password reset
- [ ] Session management

### Security Tests
- [ ] SQL injection attempts
- [ ] XSS attempts
- [ ] CSRF protection
- [ ] Rate limiting enforcement
- [ ] Weak password rejection
- [ ] JWT tampering detection

### Multi-Tenant Tests
- [ ] Tenant isolation (users can't access other tenant data)
- [ ] Subdomain uniqueness
- [ ] tenant_id in JWT claims

---

## Documentation Needed

- [ ] API documentation (OpenAPI/Swagger)
- [ ] Environment variables guide
- [ ] Deployment checklist
- [ ] Security best practices
- [ ] Troubleshooting guide

---

## Notes

- This is the foundation for the entire platform
- Must be production-ready (no shortcuts)
- Security is paramount (Nepal merchant data)
- User experience must be seamless (<5 min signup)
- Test thoroughly with Nepal phone numbers and timezones

---

## Related Documentation

- Master Plan: `docs/00-MASTER-PLAN.md` (Feature #1)
- Auth Spec: `docs/features/AUTHENTICATION.md`
- Database Schema: `docs/database/DATABASE-SCHEMA.md`
- Nepal Services: `docs/integrations/NEPAL-SERVICES.md`

---

**Next Steps**:
1. @Architect to review and create technical specification
2. @Architect to delegate to @Integrator for Sparrow SMS setup
3. @Architect to delegate to @Coder for implementation
4. @QA to create comprehensive test suite
