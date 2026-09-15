# Owner Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the single-page Owner Admin Panel allowing the KickCraft owner to upload 3D shoe models (folder/files), auto-detect materials from GLB models in `<model-viewer>`, map parts with 3D highlight confirmation, configure color palettes, restock and update status, and publish shoes dynamically to the customer shop, backed by a persistent data store and PHP/MySQL API.

**Architecture:** 
- A dedicated Vue 3 single-page component (`src/components/AdminPanel.vue`) managing shoe inventory list and the 3D shoe editor.
- Client state and API synchronization layer (`src/admin.js`) providing reactive shoe store, localStorage fallback, validation, and PHP API communication.
- Integration in `src/App.vue` adding `view = 'admin'`, owner session routing, and dynamic shop catalog binding.
- Backend PHP API (`api/admin/shoes.php`, `api/admin/upload.php`, `api/shoes.php`) and MySQL database schema (`api/schema.sql`, `api/db.php`).

**Tech Stack:** Vue 3, `<model-viewer>`, Tailwind CSS, Node.js (test runner), PHP (PDO), MySQL.

**Spec:** [docs/superpowers/specs/2026-09-12-owner-admin-panel-design.md](file:///c:/Users/kinglebron/Desktop/Git%20uploads/kickcraft/docs/superpowers/specs/2026-09-12-owner-admin-panel-design.md)

## Global Constraints

- No third-party or copyrighted branding (Nike, New Balance, etc.) in new models or admin assets; preserve original KickCraft identity.
- Preserve existing material naming conventions and mesh compatibility.
- Vue customer and admin interfaces communicate with MySQL through the PHP API; direct database access from frontend is prohibited.
- Frontend must maintain local fallback (seed data + localStorage) so Vite development runs smoothly even when Apache/MySQL is not active.
- Single-page application architecture: no page reloads when switching between shop, studio, and admin panel.
- All tests run via `npm.cmd test` using Node.js native test runner.

---

### Task 1: Admin Data Store and Inventory Logic (`src/admin.js` & `test/admin.test.js`)

**Files:**
- Create: `test/admin.test.js`
- Create: `src/admin.js`

**Interfaces:**
- Consumes: `SHOES`, `CATALOG` from `src/customization.js`
- Produces: 
  - `loadShoes(): Shoe[]`
  - `saveShoe(shoeData): Shoe`
  - `updateShoe(id, updates): Shoe`
  - `deleteShoe(id): boolean`
  - `restockShoe(id, newStock): Shoe`
  - `validateShoe(shoeData): { valid: boolean, errors: string[] }`
  - `slugify(text): string`
  - `highlightMaterial(model, materialName, highlightColor): void`

- [ ] **Step 1: Write the failing tests for admin data store and validation**

```javascript
// test/admin.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  loadInitialShoes,
  validateShoe,
  slugify,
  createShoeRecord,
  updateShoeRecord,
  deleteShoeRecord,
  restockShoeRecord,
} from '../src/admin.js'

test('slugify generates kebab-case IDs from part and shoe names', () => {
  assert.equal(slugify('Upper Material'), 'upper-material')
  assert.equal(slugify('Toe Cap'), 'toe-cap')
  assert.equal(slugify('Side Accents #2'), 'side-accents-2')
})

test('validateShoe validates required fields according to spec', () => {
  const invalid = validateShoe({})
  assert.equal(invalid.valid, false)
  assert.ok(invalid.errors.includes('Shoe name is required.'))
  assert.ok(invalid.errors.includes('Description is required.'))
  assert.ok(invalid.errors.includes('Valid price is required.'))
  assert.ok(invalid.errors.includes('At least one category is required.'))
  assert.ok(invalid.errors.includes('At least one customizable part is required.'))
  assert.ok(invalid.errors.includes('At least one color is required in the palette.'))

  const valid = validateShoe({
    name: 'KickCraft Stride',
    description: 'Road running shoe',
    price: 5490,
    stock: 25,
    categories: ['kickcraft', 'running'],
    status: 'available',
    glbPath: '/models/shoe-soleview-final.glb',
    parts: [{ id: 'upper', label: 'Upper', material: 'UpperMaterial' }],
    colors: [{ name: 'Ocean Blue', value: '#245fa8' }],
  })
  assert.equal(valid.valid, true)
  assert.equal(valid.errors.length, 0)
})

test('createShoeRecord creates a valid shoe and seeds initial shoes', () => {
  const initial = loadInitialShoes()
  assert.ok(initial.length >= 3, 'seeds at least 3 existing shoes')
  assert.ok(initial.some(s => s.id === 'kickcraft-one'))

  const newShoe = createShoeRecord(initial, {
    name: 'KickCraft Pace',
    description: 'Trail running runner',
    price: 5390,
    stock: 15,
    categories: ['kickcraft', 'running'],
    status: 'available',
    glbPath: '/models/shoe-soleview-final.glb',
    thumbnailPath: '/images/pace.png',
    charmsEnabled: true,
    parts: [{ id: 'upper', label: 'Upper', material: 'UpperMaterial' }],
    colors: [{ name: 'Cobalt', value: '#245fa8' }],
  })

  assert.equal(newShoe.id, 'kickcraft-pace')
  assert.equal(newShoe.stock, 15)
  assert.equal(newShoe.status, 'available')
  assert.equal(newShoe.charmsEnabled, true)
})

test('updateShoeRecord updates properties and handles restock and deletion', () => {
  const list = [
    {
      id: 'test-shoe',
      name: 'Test Shoe',
      price: 4000,
      stock: 5,
      status: 'available',
      parts: [],
      colors: [],
    },
  ]

  const updated = updateShoeRecord(list, 'test-shoe', { price: 4200, status: 'coming_soon' })
  assert.equal(updated.find(s => s.id === 'test-shoe').price, 4200)
  assert.equal(updated.find(s => s.id === 'test-shoe').status, 'coming_soon')

  const restocked = restockShoeRecord(list, 'test-shoe', 20)
  assert.equal(restocked.find(s => s.id === 'test-shoe').stock, 20)

  const deleted = deleteShoeRecord(list, 'test-shoe')
  assert.equal(deleted.length, 0)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/admin.test.js`
Expected: FAIL with Cannot find module `../src/admin.js`

- [ ] **Step 3: Implement minimal code in `src/admin.js`**

```javascript
// src/admin.js
import { CATALOG, SHOES } from './customization.js'

const STORAGE_KEY = 'kickcraft_admin_shoes'

export function slugify(text) {
  if (!text) return ''
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function validateShoe(shoe) {
  const errors = []
  if (!shoe.name || !shoe.name.trim()) errors.push('Shoe name is required.')
  if (!shoe.description || !shoe.description.trim()) errors.push('Description is required.')
  if (shoe.price === undefined || shoe.price === null || isNaN(Number(shoe.price)) || Number(shoe.price) <= 0) {
    errors.push('Valid price is required.')
  }
  if (shoe.stock !== undefined && (isNaN(Number(shoe.stock)) || Number(shoe.stock) < 0)) {
    errors.push('Stock cannot be negative.')
  }
  if (!Array.isArray(shoe.categories) || shoe.categories.length === 0) {
    errors.push('At least one category is required.')
  }
  if (!Array.isArray(shoe.parts) || shoe.parts.length === 0) {
    errors.push('At least one customizable part is required.')
  }
  if (!Array.isArray(shoe.colors) || shoe.colors.length === 0) {
    errors.push('At least one color is required in the palette.')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export function loadInitialShoes() {
  const defaultColors = [
    { name: 'Chalk', value: '#f1efe8' },
    { name: 'Graphite', value: '#292b2d' },
    { name: 'Cobalt', value: '#245fa8' },
    { name: 'Rust', value: '#b94d27' },
    { name: 'Moss', value: '#52684f' },
    { name: 'Burgundy', value: '#713741' },
  ]

  return SHOES.map(shoe => {
    const catalogEntry = CATALOG.find(c => c.id === shoe.id)
    const priceNum = parseInt(String(shoe.price || '4890').replace(/[^0-9]/g, ''), 10) || 4890
    return {
      id: shoe.id,
      name: shoe.name,
      description: shoe.description || shoe.summary || '',
      price: priceNum,
      formattedPrice: `₱${priceNum.toLocaleString()}`,
      status: catalogEntry?.status === 'live' ? 'available' : 'coming_soon',
      stock: 50,
      glbPath: shoe.src,
      thumbnailPath: shoe.image || catalogEntry?.image || '/images/kickcraft-one-card.png',
      charmsEnabled: true,
      charmOffset: shoe.charmOffset || null,
      charmScale: shoe.charmScale || '1 1 1',
      charmDir: shoe.charmDir || null,
      categories: catalogEntry?.categories || ['kickcraft', 'sneakers'],
      parts: shoe.parts || [],
      colors: defaultColors,
    }
  })
}

export function createShoeRecord(list, shoeData) {
  const id = slugify(shoeData.name) || `shoe-${Date.now()}`
  const priceNum = Number(shoeData.price) || 0
  const newShoe = {
    id,
    name: shoeData.name.trim(),
    description: (shoeData.description || '').trim(),
    price: priceNum,
    formattedPrice: `₱${priceNum.toLocaleString()}`,
    status: shoeData.status || 'coming_soon',
    stock: Number(shoeData.stock) >= 0 ? Number(shoeData.stock) : 0,
    glbPath: shoeData.glbPath || '',
    thumbnailPath: shoeData.thumbnailPath || '/images/kickcraft-one-card.png',
    charmsEnabled: Boolean(shoeData.charmsEnabled),
    charmOffset: shoeData.charmOffset || null,
    charmScale: shoeData.charmScale || '1 1 1',
    charmDir: shoeData.charmDir || null,
    categories: Array.isArray(shoeData.categories) ? shoeData.categories : ['kickcraft'],
    parts: Array.isArray(shoeData.parts) ? shoeData.parts : [],
    colors: Array.isArray(shoeData.colors) ? shoeData.colors : [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  return newShoe
}

export function updateShoeRecord(list, shoeId, updates) {
  return list.map(shoe => {
    if (shoe.id !== shoeId) return shoe
    const priceNum = updates.price !== undefined ? Number(updates.price) : shoe.price
    return {
      ...shoe,
      ...updates,
      price: priceNum,
      formattedPrice: `₱${priceNum.toLocaleString()}`,
      updatedAt: new Date().toISOString(),
    }
  })
}

export function restockShoeRecord(list, shoeId, newStock) {
  const stockNum = Math.max(0, Number(newStock) || 0)
  return updateShoeRecord(list, shoeId, {
    stock: stockNum,
    status: stockNum > 0 && shoe.status === 'out_of_stock' ? 'available' : shoe.status,
  })
}

export function deleteShoeRecord(list, shoeId) {
  return list.filter(shoe => shoe.id !== shoeId)
}

export function getStoredShoes() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return loadInitialShoes()
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const initial = loadInitialShoes()
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial))
      return initial
    }
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length ? parsed : loadInitialShoes()
  } catch (err) {
    console.error('Failed to parse admin shoes from localStorage:', err)
    return loadInitialShoes()
  }
}

export function setStoredShoes(shoes) {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(shoes))
    } catch (err) {
      console.error('Failed to save admin shoes to localStorage:', err)
    }
  }
}

export function highlightMaterial(model, materialName, highlightColor = '#ff2222') {
  if (!model) return
  const materials = model.materials || []
  for (const mat of materials) {
    if (mat.name === materialName) {
      mat.pbrMetallicRoughness?.setBaseColorFactor(highlightColor)
    } else {
      mat.pbrMetallicRoughness?.setBaseColorFactor('#ffffff')
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/admin.test.js`
Expected: PASS 4/4 tests

- [ ] **Step 5: Commit**

```bash
git add test/admin.test.js src/admin.js
git commit -m "feat(admin): add admin data store, validation, and shoe management logic"
```

---

### Task 2: Build the Single-Page Admin Panel Component (`src/components/AdminPanel.vue`)

**Files:**
- Create: `src/components/AdminPanel.vue`

**Interfaces:**
- Props:
  - `currentUser: { email: string, role: string }`
- Emits:
  - `backToShop: void`
  - `openStudio: (shoeId: string) => void`
  - `shoesChanged: (shoes: Shoe[]) => void`
- Consumes:
  - `src/admin.js` functions: `getStoredShoes`, `setStoredShoes`, `validateShoe`, `createShoeRecord`, `updateShoeRecord`, `deleteShoeRecord`, `highlightMaterial`, `slugify`
  - `CATEGORIES` from `src/customization.js`

- [ ] **Step 1: Create `src/components/AdminPanel.vue` with Shoe List and Editor Views**

The component will include:
1. **Shoe List Mode**:
   - Header with stats (Total Shoes, Available, Coming Soon, Out of Stock).
   - Filter bar with search query and status tabs (`all`, `available`, `coming_soon`, `out_of_stock`).
   - "Upload & Add Shoes" action button toggling folder upload area.
   - Shoe grid showing thumbnail, name, price, stock counter, status pill, and actions (`Edit`, `Restock`, `Delete`, `Preview in Studio`).
   - Quick restock modal or inline prompt to update inventory stock count.
2. **Folder / Model Upload Dropzone**:
   - Accepts directory drop or browse via `<input type="file" webkitdirectory directory multiple />`.
   - Filters `.glb` files and presents detected models as cards.
   - Owner can click a model to immediately open it in the Shoe Editor.
3. **Shoe Editor Mode**:
   - Two-column layout:
     - Left: `<model-viewer>` running the active model GLB (supports local File object URLs via `URL.createObjectURL` as well as path strings).
     - Right: Form with:
       - Name, description, price, stock, status, category checkboxes, charm toggle.
       - Thumbnail image file picker with image preview.
       - **Auto-detected materials section**:
         - Listens to `@load` event on `<model-viewer>`.
         - Reads `model.materials`, maps each material to a part item.
         - Click material -> calls `highlightMaterial` so the user sees that exact part light up red on the 3D model!
         - Label input for each part and checkbox "Customizable".
       - **Color Palette Builder**:
         - Color picker + name input + "Add Color" button.
         - Swatch tags with remove button.
       - Action buttons: "Save Shoe", "Cancel".

- [ ] **Step 2: Verify component compiles with Vite**

Run: `npm.cmd run build`
Expected: PASS with 0 build errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/AdminPanel.vue
git commit -m "feat(admin): create AdminPanel component with shoe management and 3D editor"
```

---

### Task 3: Integrate Admin Panel & Dynamic Catalog into `src/App.vue`

**Files:**
- Modify: `src/App.vue`
- Modify: `src/customization.js` (sync export helper for dynamic shoes)

**Interfaces:**
- Updates `view` ref to support `'admin'`
- When owner logs in via `handleLoginSubmit()`, sets `currentUser.value = { email: loginEmail.value, role: 'owner' }` and switches `view.value = 'admin'`
- Navbar displays "Admin" navigation button when logged in as owner
- Navbar displays "Logout" button when any user is logged in
- Shop catalog and Studio view consume dynamic shoes from `admin.js`, allowing newly created shoes to be customized and ordered in real-time

- [ ] **Step 1: Update `src/customization.js` if needed to support dynamic catalog retrieval**

Ensure `SHOES` and `CATALOG` can be augmented or overridden by `getStoredShoes()` so that newly added shoes immediately appear in the customer shop and design studio.

- [ ] **Step 2: Integrate `AdminPanel` into `src/App.vue`**

Add:
- `import AdminPanel from './components/AdminPanel.vue'`
- `import { getStoredShoes } from './admin.js'`
- Dynamic shoes ref `const dynamicShoes = ref(getStoredShoes())`
- Update `filteredCatalog` and `selectedShoe` to look inside `dynamicShoes.value`
- Add `goToAdmin()` handler
- Add `handleLogout()` handler
- Render `<AdminPanel v-if="view === 'admin'" ... />`

- [ ] **Step 3: Run existing and new test suites**

Run: `npm.cmd test`
Expected: All tests pass.

- [ ] **Step 4: Verify production build**

Run: `npm.cmd run build`
Expected: Build succeeds with `dist/` cleanly generated.

- [ ] **Step 5: Commit**

```bash
git add src/App.vue src/customization.js
git commit -m "feat(app): integrate AdminPanel, owner session routing, and dynamic catalog"
```

---

### Task 4: PHP API and MySQL Persistence Scripts (`api/`)

**Files:**
- Create: `api/db.php`
- Create: `api/schema.sql`
- Create: `api/shoes.php`
- Create: `api/admin/shoes.php`
- Create: `api/admin/upload.php`
- Test: `test/api-contracts.test.js`

**Interfaces:**
- `GET /api/shoes` -> JSON array of customer-facing shoes
- `GET /api/admin/shoes` -> JSON array of all shoes with stock and status
- `POST /api/admin/shoes` -> Creates shoe, returns inserted shoe with ID
- `PUT /api/admin/shoes.php?id={id}` -> Updates shoe fields
- `DELETE /api/admin/shoes.php?id={id}` -> Deletes shoe
- `POST /api/admin/upload.php` -> Multipart upload for `.glb` and thumbnail images

- [ ] **Step 1: Write API contract tests in `test/api-contracts.test.js`**

Verify that the PHP endpoints return the expected JSON structure and conform to the MySQL schema defined in the design spec.

- [ ] **Step 2: Create `api/schema.sql` and `api/db.php`**

Implement PDO MySQL connection script with environment / config fallback and the exact `shoes` table schema from the design spec.

- [ ] **Step 3: Create `api/shoes.php`, `api/admin/shoes.php`, and `api/admin/upload.php`**

Write standard, secure PHP scripts with input validation, JSON decoding/encoding, and proper HTTP response codes.

- [ ] **Step 4: Run tests and build check**

Run: `npm.cmd test` and `npm.cmd run build`
Expected: All tests pass and build succeeds.

- [ ] **Step 5: Commit**

```bash
git add api/ test/api-contracts.test.js
git commit -m "feat(api): add PHP API endpoints and MySQL schema for shoe inventory management"
```

---

### Task 5: End-to-End Verification and Documentation

**Files:**
- Modify: `docs/superpowers/specs/2026-09-12-owner-admin-panel-design.md` (mark as Implemented)
- Create: walkthrough documentation

- [ ] **Step 1: Run full test suite**

Run: `npm.cmd test`
Expected: 100% tests passing.

- [ ] **Step 2: Run build**

Run: `npm.cmd run build`
Expected: 0 errors.

- [ ] **Step 3: Manual flow verification**
  - Sign in as Owner / Admin -> redirected to Admin Panel.
  - View shoe inventory, filter by status, search by name.
  - Test restock on a shoe.
  - Open 3D model editor, inspect material highlight when clicking parts.
  - Add custom colors.
  - Save shoe and verify it appears in both Admin Panel and the Shop catalog.
  - Sign out.

- [ ] **Step 4: Commit and finalize**

```bash
git add docs/
git commit -m "docs: finalize owner admin panel implementation plan and specifications"
```
