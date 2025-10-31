# Feature: Faceted Product Search

**Document Version**: 1.0.0  
**Status**: Proposed  
**Created**: 2025-10-08  
**Author**: Gemini

---

## 1. Objective

To significantly enhance the product discovery experience on the storefront by implementing **faceted search**. This will allow customers to refine and filter product collections using multiple attributes (like price, brand, size, color) simultaneously, helping them find exactly what they are looking for quickly and efficiently.

This is a standard, must-have feature for any modern e-commerce platform and a major driver of conversion rates.

---

## 2. Key Features

### 2.1. Dynamic Filtering UI

- **Filter Sidebar:** A sidebar will be added to collection and search results pages.
- **Facets:** The sidebar will display a list of available filters (facets) based on the products in the current view.
- **Filter Types:**
  - **Checkboxes:** For categorical attributes (e.g., Brand, Color, Category).
  - **Price Range Slider:** A slider with two handles to select a min/max price range.
  - **Swatches:** Visual color swatches for color filtering.
- **Active Filters Display:** A section at the top of the product list will show all currently applied filters, with an option to remove each one individually or clear all.

### 2.2. Real-Time Results

- **Instant Updates:** The product grid will update instantly via API calls as filters are applied or removed, without requiring a full page reload.
- **Result Counts:** Each filter option will display the number of matching products in parentheses (e.g., `Red (15)`).

### 2.3. Configurable Facets

- **Merchant Configuration:** In the merchant dashboard, under `Settings > Search & Discovery`, merchants will be able to select which product attributes they want to make available for filtering.
- **Available Attributes:**
  - Price
  - Product Type (Category)
  - Vendor (Brand)
  - Product Tags
  - Product Options (e.g., Size, Color, Material) - *This is the most powerful feature.*
  - Product Metafields (for advanced custom attributes).

---

## 3. Technical Implementation

This feature relies on Prisma-powered queries against Postgres rather than an external search engine. Catalog data stays inside the primary database, and we project facets with aggregate queries.

### 3.1. Backend (Data Shape & Indexes)

- Ensure product relations (`ProductTag`, `ProductCollectionAssignment`, variants) remain in sync through existing services.
- Add composite indexes that support the most common filters (`ProductTagging` on `(productId, tagId)`, `ProductCollectionAssignment` on `(collectionId, productId)`), already present in the Prisma schema.
- Inventory totals come from the catalog worker so storefront responses can surface `available` quantity without recomputing inside the request.
- Optional enhancement: add a `GIN` index with `to_tsvector('simple', title || ' ' || coalesce(description, ''))` if we need better full-text matching. For now we use case-insensitive `contains` filters which already perform well under Neon scale tiers.

### 3.2. Backend (API)

- The existing `/v1/storefront/:tenantSlug/products` route calls `searchStorefrontProducts`.
- We build a Prisma `where` clause composed of:
  - `tenantId`, `status = ACTIVE`, `deletedAt = null`
  - Optional `contains` filters for `title`, `description`, variant names
  - Join filters for tags (`tags.some.tag.name`) and collections (`collections.some.collection.slug`)
  - Numeric comparisons for `price` plus stock checks using variant aggregates.
- Facets are computed via `groupBy` on `productCollectionAssignment` and `productTagging` tables, and then hydrated with human-readable labels.

```typescript
const filters = buildFilters(tenant.id, params)
const where = filters.length ? { AND: filters } : {}

const [products, total, facets] = await Promise.all([
  prisma.product.findMany({
    where,
    include: { variants: true, images: true, tags: { include: { tag: true } }, collections: { include: { collection: true } } },
    orderBy: buildOrderBy(params),
    skip: (params.page - 1) * params.pageSize,
    take: params.pageSize
  }),
  prisma.product.count({ where }),
  buildFacets(prisma, filters)
])
```

- The response mirrors Shopify-style storefront payloads: `data` with mapped products and `meta.facets.collections/tags`, plus pagination info.

### 3.3. Frontend (Storefront)

- **State Management:** Continue to use a local store (Zustand or `useReducer`) for active filters.
- **API Calls:** Debounce requests to `/v1/storefront/:tenantSlug/products`, passing query params such as `tags[]=cotton` and `collection=summer`.
- **UI Components:**
  - `FilterSidebar.tsx`: Renders `meta.facets.collections` and `meta.facets.tags`.
  - `PriceSlider.tsx`: Binds to `priceMin`/`priceMax`.
  - `ActiveFilters.tsx`: Shows applied filters using the same payload shape returned by the API.

---

## 5. Priority & Sprint Assignment

- **Priority:** **P1 (Launch)**. This is a fundamental e-commerce feature and is critical for stores with more than a handful of products. Its absence would be a significant competitive disadvantage.
- **Proposed Sprint:** Sprint 9.
