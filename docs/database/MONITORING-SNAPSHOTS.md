# 📈 Monitoring & Snapshot Strategy

## 1. Neon Snapshots

- **Daily automation**
  - CLI: `neonctl branches snapshot create main --retention 7d --label nightly-backup`.
  - Schedule via GitHub Actions cron (`0 21 * * *`) using PAT with Neon scope.
  - Store snapshot metadata in `docs/database/SNAPSHOT-LOG.md` (date, id, operator).
- **Restore drill**
  - Command: `neonctl branches fork main --snapshot <snapshot-id> rescue-<ts>`.
  - Run `prisma migrate status` to verify schema drift.
  - Document switchover time and rollback steps.

## 2. Database Metrics

- **Better Stack dashboard**
  - Panels: active connections, query throughput, error rate, RLS violations, slow queries (>500ms).
  - Alerts:
    - Connections > 70% of pool capacity for 5 minutes.
    - RLS policy violations (>0 in 10 minutes).
    - Slow query count spikes (>25 in 15 minutes).
- **Data sources**
  - Neon `stats` API polled every minute via serverless cron.
  - Application logs structured JSON (`level=warn`/`error`).

## 3. Seeded Audit Checks

- Add scheduled worker `monitoring-nightly`:
  - Health check `/v1/health`.
  - Sample catalog query (limit 1) per tenant.
  - Verify `TenantProvisioningRun` status for failures in last 24h.

## 4. Operational Runbook

- Store runbook in `docs/ops/PLATFORM-SETUP.md`:
  1. Respond to alert → check Better Stack dashboard.
  2. If RLS violation triggered → query `pg_security_label` logs, notify security.
  3. Snapshot restore: follow Section 1 steps, update incident ticket.
  4. After incident, rotate credentials if compromised (`app_user`, `app_admin`).

## 5. Next Steps

1. Implement GitHub Action for nightly snapshot plus status Slack notification.
2. Build Better Stack dashboard JSON and link in docs.
3. Wire application log ingestion to include `tenantId`, `route`, `durationMs`.
4. Draft PagerDuty service + escalation policy for database incidents.
