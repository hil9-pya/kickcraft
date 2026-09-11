# Catalog Search, Category Filters, and Coming Soon Shoes Spec

## 1. Overview
Enhance the KickCraft shop landing view by providing:
- A responsive search bar for searching shoes by name and description.
- Category filters covering **All**, **KickCraft Original**, **Fashion**, **Sneakers**, **Basketball Shoes**, and **Running Shoes**.
- Multi-tag matching allowing shoes (such as KickCraft One) to appear under both brand filters ("KickCraft Original") and style filters ("Sneakers").
- "Coming Soon" catalog cards alongside live customizable 3D shoes.

---

## 2. Catalog Data Model

The catalog is defined with structured metadata for each shoe:

```javascript
export const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'kickcraft', label: 'KickCraft Original' },
  { id: 'fashion', label: 'Fashion' },
  { id: 'sneakers', label: 'Sneakers' },
  { id: 'basketball', label: 'Basketball Shoes' },
  { id: 'running', label: 'Running Shoes' },
]

export const CATALOG = [
  {
    id: 'kickcraft-one',
    name: 'KickCraft One',
    subtitle: 'Original concept · 8 customizable parts',
    price: '₱4,890',
    categories: ['kickcraft', 'sneakers'],
    image: '/images/kickcraft-one-card.png',
    shoeId: 'kickcraft-one',
    status: 'live',
  },
  {
    id: 'nike-air-max',
    name: 'Nike Air Max',
    subtitle: 'Air Max model · 3 customizable parts',
    price: '₱4,890',
    categories: ['sneakers', 'running', 'fashion'],
    image: '/images/nike-air-max-card.png',
    shoeId: 'nike-air-max',
    status: 'live',
  },
  {
    id: 'hoop-one',
    name: 'KickCraft Hoop',
    subtitle: 'High-top basketball · ankle support',
    price: '₱5,290',
    categories: ['kickcraft', 'basketball'],
    image: null,
    shoeId: null,
    status: 'soon',
  },
  {
    id: 'hoop-two',
    name: 'KickCraft Court',
    subtitle: 'Low-cut basketball · lightweight grip',
    price: '₱5,190',
    categories: ['kickcraft', 'basketball'],
    image: null,
    shoeId: null,
    status: 'soon',
  },
  {
    id: 'run-one',
    name: 'KickCraft Stride',
    subtitle: 'Road running · responsive cushion',
    price: '₱5,490',
    categories: ['kickcraft', 'running'],
    image: null,
    shoeId: null,
    status: 'soon',
  },
  {
    id: 'run-two',
    name: 'KickCraft Pace',
    subtitle: 'Trail running · rugged outsole',
    price: '₱5,390',
    categories: ['kickcraft', 'running'],
    image: null,
    shoeId: null,
    status: 'soon',
  },
  {
    id: 'fashion-one',
    name: 'KickCraft Luxe',
    subtitle: 'Fashion · premium leather upper',
    price: '₱6,290',
    categories: ['kickcraft', 'fashion'],
    image: null,
    shoeId: null,
    status: 'soon',
  },
  {
    id: 'fashion-two',
    name: 'KickCraft Drift',
    subtitle: 'Fashion · canvas slip-on silhouette',
    price: '₱5,890',
    categories: ['kickcraft', 'fashion'],
    image: null,
    shoeId: null,
    status: 'soon',
  },
]
```

---

## 3. Filtering & Search Logic

A helper function `filterCatalog(catalog, query, category)` filters items:

1. **Category Filter**:
   - `category === 'all'`: Matches all cards.
   - `category === 'kickcraft'`: Matches cards where `card.categories.includes('kickcraft')` or `card.name.toLowerCase().includes('kickcraft')`.
   - Any other `category`: Matches cards where `card.categories.includes(category)`.
2. **Search Query**:
   - Case-insensitive search against `card.name` and `card.subtitle`.
   - Empty or whitespace-only queries match all cards.
3. Combined using logical `AND`: A card must satisfy both the active category filter and the search query.

---

## 4. UI Design & Layout

### 4.1 Search & Filter Toolbar
- **Search input**: Full-width on mobile, max-w-sm on desktop, with magnifying glass icon and clear button.
- **Filter pills**: Horizontal scrollable list of category buttons.
  - Active pill: `#292b2d` background, white text.
  - Inactive pill: `#fcfdfb` background, `#5f635f` text, hover `#292b2d` border.
- **Results counter**: Small badge / label indicating number of results (e.g. "Showing 8 styles").

### 4.2 Grid Cards
- **Live Cards (`status: 'live'`):**
  - Displays thumbnail image, "Customize" badge in top-left corner.
  - On hover: "Open studio →" action pill appears; clicking triggers `goToStudio(card.shoeId)` to open the 3D customizer.
  - Shows price, name, and subtitle.
- **Coming Soon Cards (`status: 'soon'`):**
  - Displays elegant placeholder thumbnail with "Coming Soon" badge.
  - Subdued card styling with "Notify Me / Coming Soon" disabled indicator.
  - Shows estimated price, name, and subtitle.
- **Empty State:**
  - Shown when `filteredCatalog.length === 0`.
  - Displays search icon, "No shoes found" text, and a "Clear filters" button.

---

## 5. Verification Plan

1. **Unit Tests (`test/catalog.test.js`)**:
   - Verify filtering by `all` returns all shoes.
   - Verify filtering by `kickcraft` returns only shoes with the KickCraft brand.
   - Verify filtering by `fashion`, `sneakers`, `basketball`, and `running` return matching shoes.
   - Verify search query filters by name and subtitle.
   - Verify combined search + category filtering.
2. **Regression Tests**:
   - Run `test/customization.test.js` and `test/nike-air-max.test.js` to ensure existing 3D studio tests pass.
3. **Build Verification**:
   - Run `npm run build` to ensure clean Vite compilation.
