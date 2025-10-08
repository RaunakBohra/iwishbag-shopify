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

This feature will heavily leverage the capabilities of our chosen search engine, **MeiliSearch**.

### 3.1. Backend (Indexing)

- **Update MeiliSearch Indexing:** When a product is created or updated, we will send a more detailed data structure to MeiliSearch.
- **Mark Filterable Attributes:** In the MeiliSearch index settings, we must explicitly define which attributes are `filterableAttributes`.

```typescript
// Example of updating MeiliSearch index settings
import { MeiliSearch } from 'meilisearch'

const client = new MeiliSearch({ host: '...', apiKey: '...' });
const index = client.index('products_tenant_xyz');

await index.updateFilterableAttributes([
  'price',
  'vendor',
  'product_type',
  'tags',
  'options.Size', // Facet by specific options
  'options.Color'
]);
```

- **Product Data Structure for Indexing:**

```json
{
  "id": "prod_123",
  "title": "Stylish Cotton T-Shirt",
  "vendor": "Nepali Threads",
  "product_type": "Apparel",
  "price": 1200,
  "tags": ["casual", "summer", "cotton"],
  "options": {
    "Color": ["Red", "Blue", "Black"],
    "Size": ["S", "M", "L"]
  }
}
```

### 3.2. Backend (API)

- **New Search Endpoint:** A new API endpoint, `/api/search`, will be created to handle faceted search queries.
- **Facet Distribution:** The API will use MeiliSearch's `facets` search parameter to get the list of available filters and their counts along with the product results.

```typescript
// Example API call to MeiliSearch
app.post('/api/search', async (c) => {
  const { query, filters, facets } = await c.req.json();
  
  const searchResults = await meiliSearchIndex.search(query, {
    filter: filters, // e.g., ['vendor = "Nepali Threads"', 'price 1000 TO 1500']
    facets: facets, // e.g., ['vendor', 'options.Color', 'price']
  });

  // The response will contain `hits` (products) and `facetDistribution` (filter options and counts)
  return c.json(searchResults);
});
```

### 3.3. Frontend (Storefront)

- **State Management:** The search page will use a state management solution (like Zustand or React's `useReducer`) to manage the active filters.
- **API Calls:** A debounced `useEffect` hook will trigger an API call to the `/api/search` endpoint whenever the filters or search query change.
- **UI Components:**
  - `FilterSidebar.tsx`: Renders the `facetDistribution` data from the API.
  - `ProductGrid.tsx`: Renders the `hits` (products).
  - `ActiveFilters.tsx`: Displays the currently selected filters.

---

## 5. Priority & Sprint Assignment

- **Priority:** **P1 (Launch)**. This is a fundamental e-commerce feature and is critical for stores with more than a handful of products. Its absence would be a significant competitive disadvantage.
- **Proposed Sprint:** Sprint 9.
