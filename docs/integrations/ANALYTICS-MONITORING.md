# 📈 Analytics & Monitoring Setup (PostHog + Better Stack)

> Use this guide to provision PostHog (product analytics) and Better Stack (logs/uptime) for the iwishbag-store platform. Complete each checklist item and record credentials in `docs/secrets/README.md`.

---

## 1. PostHog (Product Analytics)

### 1.1 Create Account / Project
- [ ] Sign up at https://posthog.com/ (cloud) or plan self-host deployment.
- [ ] Create an organization and project named **iwishbag-store**.
- [ ] Copy **Project API Key** and **Host URL** (cloud example: `https://app.posthog.com`).

### 1.2 Configure Environment
- [ ] Copy `docs/examples/env/web.env.local.example` to `apps/web/.env.local` (and merchant app if applicable).
- [ ] Copy `docs/examples/env/api.dev.vars.example` to `api/.dev.vars` and fill in secret placeholders.
- [ ] Add server-side key to API (`POSTHOG_API_KEY`) for backend instrumentation (Workers).
- [ ] Add client-side key (`NEXT_PUBLIC_POSTHOG_KEY`) for frontend analytics.
- [ ] Update GitHub/Cloudflare secrets with matching names.
- [ ] Update `docs/secrets/README.md` with vault locations and GitHub secret names.

### 1.3 Instrumentation
- [ ] Install PostHog SDKs:
  ```bash
  pnpm add posthog-js @posthog/node
  ```
- [ ] Initialize PostHog in frontend entry points and merchant dashboard.
- [ ] Wrap API event tracking (orders created, onboarding steps, etc.).
- [ ] Enable autocapture/heatmaps if desired (toggle in PostHog settings).
- [ ] Configure feature flags/experiments (optional for later phases).

### 1.4 Data Hygiene & Privacy
- [ ] Set up EU data residency if required (PostHog EU cloud or self-host).
- [ ] Anonymize IPs or disable storing personal data as needed.
- [ ] Create event naming conventions (`merchant_*`, `storefront_*`).
- [ ] Configure cohorts/dashboards for KPIs (merchant activation, conversion).

---

## 2. Better Stack (Logs & Uptime)

### 2.1 Account Setup
- [ ] Sign up at https://betterstack.com/ (Better Uptime + Better Logs).
- [ ] Create organization/project **iwishbag-store**.
- [ ] Retrieve API tokens:
  - Better Logs Ingestion Token (for Workers log streaming).
  - Better Uptime API key.
- [ ] Store tokens in vault + GitHub secrets (`BETTERSTACK_TOKEN`, `BETTERSTACK_LOGS_TOKEN`, etc.).

### 2.2 Log Streaming
- [ ] Import the helper below (drop into `api/src/lib/logging.ts`) and call `logToBetterStack`.

  ```ts
  // api/src/lib/logging.ts
  export async function logToBetterStack(
    env: { BETTERSTACK_LOGS_TOKEN: string; BETTERSTACK_LOGS_ENDPOINT?: string },
    payload: Record<string, unknown>
  ) {
    const endpoint = env.BETTERSTACK_LOGS_ENDPOINT ?? 'https://in.logs.betterstack.com';

    await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.BETTERSTACK_LOGS_TOKEN}`,
      },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        ...payload,
      }),
    });
  }
  ```

- [ ] Call the helper inside your request pipeline, e.g. after handling a Worker request:

  ```ts
  await logToBetterStack(env, {
    level: 'info',
    event: 'request.completed',
    tenantId,
    userId,
    path: req.url,
    status: res.status,
    requestId: crypto.randomUUID(),
  });
  ```

- [ ] Add structured logging (JSON) with `request_id`, `tenant_id`, `user_id`.
- [ ] Create log pipelines/alerts (error rate >1%, auth failures, etc.).

### 2.3 Uptime Monitoring
- [ ] Make the helper executable (`chmod +x scripts/monitoring/create_betterstack_monitors.sh`).
- [ ] Export `BETTERSTACK_TOKEN` (and optionally `PAGERDUTY_POLICY_ID`) then run `scripts/monitoring/create_betterstack_monitors.sh`.
- [ ] Verify monitors exist for:
  - `https://iwishbag.store` (storefront)
  - `https://merchant.iwishbag.store` (merchant dashboard)
  - `https://api.iwishbag.store/health` (API heartbeat)
- [ ] Set check frequency (30s) and escalation to PagerDuty/Slack/email.
- [ ] Configure maintenance windows for planned deployments.

### 2.4 Incident Response
- [ ] Integrate Better Uptime incidents with PagerDuty (webhook) or Slack.
- [ ] Document on-call rotation and acknowledgement procedures.
- [ ] Create runbooks inside Better Uptime for common failures (API 5xx, database issues).

---

## 3. Secret Management Summary

| Service      | Secret Name (GitHub/Cloudflare) | Vault Item                                 | Notes                          |
|--------------|----------------------------------|---------------------------------------------|--------------------------------|
| PostHog      | `POSTHOG_API_KEY`, `POSTHOG_HOST`, `NEXT_PUBLIC_POSTHOG_KEY` | 1Password → `PostHog – iwishbag-store` | Keep separate keys for client/server. |
| Better Stack | `BETTERSTACK_TOKEN`, `BETTERSTACK_LOGS_TOKEN` | 1Password → `Better Stack – iwishbag-store` | Distinguish logs vs uptime tokens. |

---

## 4. Verification Checklist
- [ ] PostHog dashboard receiving events from dev/staging environments.
- [ ] Feature flag toggles working (test with staging).
- [ ] Better Uptime monitors show “UP” status.
- [ ] Better Logs ingesting Worker/API logs with search enabled.
- [ ] Alert test triggers (simulate outage) send notifications to PagerDuty/Slack.
- [ ] Update `docs/PROJECT-TODO.md` and sprint tracker with completion status.

---

*Last updated:* 2025-10-14  
*Owner:* Analytics & DevOps teams
