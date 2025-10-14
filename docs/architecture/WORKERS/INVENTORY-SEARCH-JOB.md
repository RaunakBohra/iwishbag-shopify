# 🛠️ Inventory & Search Worker

> Cloudflare Queue + Worker pipeline that keeps product inventory snapshots and MeiliSearch documents synchronized with primary Postgres.

---

## 1. Problem Statement
- Write-side catalog services (product/variant/media) mutate Prisma models synchronously; we currently have no mechanism to:
  - Recompute aggregated inventory quantities per product.
  - Push search-friendly payloads into MeiliSearch.
- MeiliSearch favours near-real-time updates, but we must avoid blocking API requests on external calls.
- Inventory maths require cross-table reads (variants, allocations, reservations) that should run outside the request path.

**Goal:** Deliver an eventually consistent, observable worker that processes catalog mutations and fans out to inventory + search updates within seconds.

---

## 2. High-Level Architecture

```
Catalog API (Workers/Hono)
   ├─ enqueueCatalogEvent()  ──►  Cloudflare Queue: CATALOG_EVENTS
   └─ responds to client

Cloudflare Queue Consumer (CatalogWorker)
   ├─ Batch consume messages (max 10)
   ├─ Inventory Pipeline
   │     ├─ fetch latest product + variants
   │     ├─ recompute inventory snapshot (tx)
   │     └─ write to product_inventory table
   ├─ Search Pipeline
   │     ├─ serialize product document (multi-language support)
   │     └─ upsert into MeiliSearch index `products_<tenant>`
   └─ Ack + metrics

Failing messages ► Cloudflare Queue Dead Letter (CATALOG_EVENTS_DLQ)
```

---

## 3. Producers

| Trigger | Service Hook | Payload Fields |
|---------|--------------|----------------|
| Product create/update/delete | `catalog.service.ts` | `event: 'product.updated'`, `productId`, `tenantId`, `timestamp`, `initiator` (userId) |
| Variant create/update/delete | `variant.service.ts` | `event: 'variant.updated'`, plus `productId`, `variantId`, `deltaInventory?`, `recomputeInventory: true` |
| Media changes | `product-media.service.ts` | `event: 'product.media.updated'`, `productId` (search doc refresh) |

Helper `enqueueCatalogEvent(env, payload)` writes JSON to `CATALOG_EVENTS`.

**Payload Envelope**
```json
{
  "id": "evt_01H...",
  "tenantId": "tenant-1",
  "productId": "prod-1",
  "variantId": "var-4",
  "event": "variant.updated",
  "recomputeInventory": true,
  "source": "api",
  "initiator": "user-owner",
  "occurredAt": "2025-10-20T18:05:03.450Z",
  "retryCount": 0
}
```

---

## 4. Worker Flow

1. **Batch Pull:** Cloudflare Worker bound to queue `CATALOG_EVENTS`. Poll size ≤10, process concurrently with `Promise.allSettled`.
2. **Validation:** Schema-check payload (Zod) to guard against malformed messages. Invalid payloads ⇒ push to DLQ + Better Stack alert.
3. **Inventory Pipeline (if `recomputeInventory`):**
   - Execute `SELECT SUM(variants.inventory - variants.reserved) ...` using Prisma `$transaction`.
   - Update `product_inventory` table (upsert). Table holds `available`, `reserved`, `incoming`, `updatedAt`.
   - Emit metric `inventory_update_ms`.
4. **Search Pipeline:**
   - Fetch product with relations (variants, images, tags, collections) using `read replica`.
   - Build MeiliSearch document shape (Nepali/English titles, price range, facets).
   - Call `meiliClient.index(indexName).addDocuments([doc], { primaryKey: 'id' })`.
   - On deletion events, call `deleteDocument(productId)`.
5. **Acknowledgement:** Only ack message when both pipelines succeed.

---

## 5. Error Handling & Retries

- Use queue-level retry policy: max 5 attempts, exponential backoff (2^n seconds, capped at 60s).
- On failure:
  - Capture context (payload, error, attempt) via `logToBetterStack`.
  - After max attempts, forward to DLQ (`CATALOG_EVENTS_DLQ`).
  - DLQ handler (manual or scheduled worker) can replay after incident resolution.
- MeiliSearch-specific transient errors (e.g., 429) ⇒ respect `retry-after` header; requeue with incremental delay.

---

## 6. Observability

**Metrics (Workers Analytics Engine)**
- `catalog_events_processed_total` (labels: eventType, outcome)
- `inventory_update_duration_ms`
- `search_upsert_duration_ms`
- `catalog_events_inflight`

**Logs**
- Structured JSON via `logToBetterStack` with fields `event`, `tenantId`, `productId`, `status`, `durationMs`.

**Alerts**
- Better Stack: alert on `catalog_events_processed_total{outcome="failed"} > 0` in 5m.
- Dead Letter Queue length > 10 triggers PagerDuty (future).

---

## 7. Configuration & Bindings

| Binding | Type | Description |
|---------|------|-------------|
| `CATALOG_EVENTS` | Queue | Primary event stream |
| `CATALOG_EVENTS_DLQ` | Queue | Dead-letter storage |
| `MEILISEARCH_URL` / `MEILISEARCH_KEY` | Secrets | Search credentials |
| `DATABASE_URL` | Secret | Postgres connection (Neon read/write) |

Worker deployed via `wrangler.toml` under `[queues.consumers]`.

---

## 8. Next Implementation Steps

1. Add `enqueueCatalogEvent` helper + wire into product/variant/media services (within transactions post-commit).
2. Scaffold Cloudflare Worker (`workers/catalog-events/index.ts`) with queue consumer boilerplate.
3. Implement inventory recompute module shared between worker & API for reusability (`inventory.service.ts`).
4. Create MeiliSearch client wrapper with retry/backoff + index naming conventions.
5. Provision queues via Terraform/CLI; document runbooks for replays.
6. Extend Vitest with worker unit tests using queue payload fixtures + mocked Prisma/Meili clients.
7. Update `docs/api/CATALOG-SPRINT.md` & deployment checklist once worker is live.
