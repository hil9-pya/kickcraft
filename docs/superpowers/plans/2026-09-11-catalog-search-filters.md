# Catalog Search, Category Filters, and Coming Soon Shoes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a search bar, category filters (All, KickCraft Original, Fashion, Sneakers, Basketball Shoes, Running Shoes), and Coming Soon shoes to the KickCraft shop view.

**Architecture:** Define catalog items and a pure `filterCatalog` function in `src/customization.js`, tested via Node test runner in `test/catalog.test.js`. Wire reactive search and filter state in `src/App.vue` with responsive filter pills, search input, live 3D cards, and styled "Coming Soon" cards.

**Tech Stack:** Vue 3 (Composition API `<script setup>`), Tailwind CSS, Node test runner (`node --test`).

**Spec:** `docs/superpowers/specs/2026-09-11-catalog-search-filters-design.md`

## Global Constraints
- Preserve all existing 3D customization capabilities and tests for KickCraft One and Nike Air Max.
- Do not introduce external state management libraries or packages.
- Keep `node --test` suite fast and free of external dependencies.
- Ensure all commands work reliably on Windows PowerShell / Command Prompt.

---

### Task 1: Catalog Data Model & Filter Logic (TDD)

**Files:**
- Create: `test/catalog.test.js`
- Modify: `src/customization.js`

**Interfaces:**
- Produces:
  - `CATEGORIES`: Array of `{ id: string, label: string }`
  - `CATALOG`: Array of shoe cards `{ id: string, name: string, subtitle: string, price: string, categories: string[], image: string | null, shoeId: string | null, status: 'live' | 'soon' }`
  - `filterCatalog(catalog: Card[], query: string, category: string): Card[]`

- [ ] **Step 1: Write failing test in `test/catalog.test.js`**

```javascript
import test from 'node:test'
import assert from 'node:assert/strict'
import { CATALOG, CATEGORIES, filterCatalog } from '../src/customization.js'

test('defines all 6 required categories', () => {
  assert.deepEqual(CATEGORIES.map(c => c.id), [
    'all',
    'kickcraft',
    'fashion',
    'sneakers',
    'basketball',
    'running',
  ])
})

test('filters catalog by category correctly', () => {
  const all = filterCatalog(CATALOG, '', 'all')
  assert.equal(all.length, CATALOG.length)

  const kickcraftOnly = filterCatalog(CATALOG, '', 'kickcraft')
  assert.ok(kickcraftOnly.length > 0)
  assert.ok(kickcraftOnly.every(shoe => shoe.categories.includes('kickcraft') || shoe.name.toLowerCase().includes('kickcraft')))
  assert.ok(kickcraftOnly.some(shoe => shoe.id === 'kickcraft-one'))
  assert.ok(!kickcraftOnly.some(shoe => shoe.id === 'nike-air-max'))

  const basketball = filterCatalog(CATALOG, '', 'basketball')
  assert.ok(basketball.every(shoe => shoe.categories.includes('basketball')))

  const running = filterCatalog(CATALOG, '', 'running')
  assert.ok(running.some(shoe => shoe.id === 'nike-air-max'))
  assert.ok(running.some(shoe => shoe.id === 'run-one'))
})

test('filters catalog by search query across name and subtitle', () => {
  const searchAir = filterCatalog(CATALOG, 'air max', 'all')
  assert.equal(searchAir.length, 1)
  assert.equal(searchAir[0].id, 'nike-air-max')

  const searchBasketball = filterCatalog(CATALOG, 'basketball', 'all')
  assert.ok(searchBasketball.length >= 2)
  assert.ok(searchBasketball.every(shoe => shoe.name.toLowerCase().includes('basketball') || shoe.subtitle.toLowerCase().includes('basketball') || shoe.categories.includes('basketball')))
})

test('combines search query and category filters', () => {
  const result = filterCatalog(CATALOG, 'running', 'kickcraft')
  assert.ok(result.every(shoe => shoe.categories.includes('kickcraft') && (shoe.name.toLowerCase().includes('running') || shoe.subtitle.toLowerCase().includes('running') || shoe.categories.includes('running'))))
  assert.ok(!result.some(shoe => shoe.id === 'nike-air-max'))
})

test('returns empty array when nothing matches', () => {
  const result = filterCatalog(CATALOG, 'nonexistent shoe xyz', 'all')
  assert.deepEqual(result, [])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd /c node --test test/catalog.test.js`
Expected: FAIL (Cannot find export 'CATEGORIES' / 'filterCatalog')

- [ ] **Step 3: Implement `CATEGORIES`, `CATALOG`, and `filterCatalog` in `src/customization.js`**

Add exports to `src/customization.js`:
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

export function filterCatalog(catalog, query = '', category = 'all') {
  const q = query.trim().toLowerCase()
  return catalog.filter(card => {
    const matchesCategory =
      category === 'all'
        ? true
        : category === 'kickcraft'
          ? card.categories.includes('kickcraft') || card.name.toLowerCase().includes('kickcraft')
          : card.categories.includes(category)

    const matchesSearch =
      !q ||
      card.name.toLowerCase().includes(q) ||
      card.subtitle.toLowerCase().includes(q) ||
      card.categories.some(c => c.toLowerCase().includes(q))

    return matchesCategory && matchesSearch
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd /c npm test`
Expected: PASS all tests including `test/catalog.test.js`, `test/customization.test.js`, and `test/nike-air-max.test.js`.

- [ ] **Step 5: Commit**

```bash
git add test/catalog.test.js src/customization.js
git commit -m "feat: add catalog data and filterCatalog helper with tests"
```

---

### Task 2: Search Bar, Category Filter Pills & Coming Soon UI in `src/App.vue`

**Files:**
- Modify: `src/App.vue`

**Interfaces:**
- Consumes:
  - `CATEGORIES`, `CATALOG`, `filterCatalog` from `./customization.js`

- [ ] **Step 1: Wire reactive state and computed properties in `src/App.vue`**

Import `CATEGORIES`, `CATALOG`, and `filterCatalog` from `./customization.js`:
```javascript
const searchQuery = ref('')
const activeCategory = ref('all')

const filteredCatalog = computed(() => {
  return filterCatalog(CATALOG, searchQuery.value, activeCategory.value)
})

function clearFilters() {
  searchQuery.value = ''
  activeCategory.value = 'all'
}
```

- [ ] **Step 2: Add Search Bar and Category Pills UI above the Catalog Grid**

In `<main v-if="view === 'shop'">`:
- Search input with placeholder "Search styles by name or description…", with magnifying glass SVG and clear button when not empty.
- Category filter buttons (`v-for="cat in CATEGORIES"`):
  - Pill styling with active states (`bg-[#292b2d] text-white` vs `bg-[#fcfdfb] text-[#5f635f] border-[#bfc3bf]`).
- Results counter (`Showing {{ filteredCatalog.length }} shoes`).

- [ ] **Step 3: Update Catalog Grid to display Live cards and Coming Soon cards**

- When `filteredCatalog.length === 0`: render friendly empty state with search icon and "Clear filters" button.
- Live cards (`card.status === 'live'`):
  - Clickable button calling `goToStudio(card.shoeId)`.
  - Image thumbnail or fallback 3D box.
  - "Customize" badge in corner.
  - Hover overlay and "Open studio →" pill.
  - Shoe name, subtitle, price, and CTA.
- Coming Soon cards (`card.status === 'soon'`):
  - Visual card with "Coming Soon" badge.
  - Subtle grayscale or textured placeholder thumbnail.
  - Shoe name, subtitle, estimated price.
  - Disabled "Available Soon" indicator button.

- [ ] **Step 4: Verify UI and regression tests**

Run: `cmd /c npm test`
Run: `cmd /c npm run build`
Expected: All tests pass, build completes cleanly without errors.

- [ ] **Step 5: Commit**

```bash
git add src/App.vue
git commit -m "feat: add search bar, category filter pills, and coming soon cards to shop view"
```
