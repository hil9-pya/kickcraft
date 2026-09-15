# Owner Admin Panel — Design Spec

**Date:** 2026-09-12
**Status:** Awaiting user review

## Purpose

Give the KickCraft owner a single-page admin panel to upload 3D shoe models, configure customizable parts and color palettes, manage stock and status, and publish shoes to the customer shop — all without touching code.

## Scope

### Included

- Owner authentication gate (existing login UI, `role: 'owner'`)
- Folder drag-and-drop upload of GLB files with auto-detection
- `<model-viewer>`-based material auto-detection via `model.materials`
- Material-to-part mapping with visual highlight confirmation
- Per-shoe color palette definition
- Shoe metadata: name, description, price, categories, status, stock count
- Thumbnail image upload per shoe
- Charm toggle per shoe (fixed charm set: Star, Lightning, K-tag)
- Shoe list with status badges, stock counts, and quick actions
- Edit and delete existing shoes, including restocking
- Status management: Available / Coming Soon / Out of Stock
- Customer shop dynamically driven by owner-published shoes
- PHP API endpoints for CRUD operations
- MySQL `shoes` table with JSON columns for parts, colors, categories

### Excluded

- New charm model uploads (charm set stays fixed)
- Customer account management from admin
- Reservation management (separate future feature per AGENTS.md)
- Payment, delivery, or inventory beyond stock count
- Multi-owner / role-based permissions beyond single owner

## Architecture

The admin panel is a new view state (`view = 'admin'`) in the existing Vue SPA. It lives in a dedicated component to keep `App.vue` manageable.

```
src/
  App.vue                      ← adds 'admin' view routing, passes props
  components/
    AdminPanel.vue              ← shoe list + shoe editor (two internal states)
  admin.js                      ← admin state helpers, API fetch wrappers
  customization.js              ← existing, will be read by admin for CATEGORIES

api/
  admin/
    upload.php                  ← handles GLB + thumbnail file uploads
    shoes.php                   ← CRUD endpoints for shoe records
  shoes.php                     ← public read-only endpoint for customers

public/
  uploads/
    models/                     ← stored GLB files (owner uploads)
    thumbnails/                 ← stored thumbnail images (owner uploads)
```

### View Routing

| `view` value | Who sees it | Component |
|---|---|---|
| `'shop'` | Everyone | Inline in App.vue |
| `'studio'` | Everyone | Inline in App.vue |
| `'login'` | Everyone | Inline in App.vue |
| `'register'` | Everyone | Inline in App.vue |
| `'admin'` | Owner only | `<AdminPanel>` component |

Owner login → auto-redirect to `view = 'admin'`. Header shows "Admin" tab when owner is logged in.

## Admin Panel — Internal States

The `AdminPanel.vue` component has two internal states:

### State 1: Shoe List (default)

- Grid of shoe cards, each showing:
  - Thumbnail image (or placeholder if none)
  - Shoe name
  - Status badge (colored): 🟢 Available · 🟡 Coming Soon · 🔴 Out of Stock
  - Stock count
  - Price
  - Category tags
- Quick action buttons per card: **Edit** · **Delete** · **Status cycle**
- Search bar to filter by shoe name
- Status filter tabs: All · Available · Coming Soon · Out of Stock
- **"+ Add New Shoes"** button → opens drag-drop upload zone

### State 2: Shoe Editor (create + edit)

Two-column layout:

**Left column:** `<model-viewer>` preview displaying the GLB with interaction controls (rotate, zoom). Used for material highlight previews.

**Right column — configuration form:**

#### Metadata Fields

| Field | Type | Validation |
|---|---|---|
| Shoe name | Text input | Required, max 100 chars |
| Description | Textarea | Required, max 500 chars |
| Price | Number input (₱) | Required, positive number |
| Categories | Checkbox group | At least one required |
| Status | Dropdown select | Required (Available / Coming Soon / Out of Stock) |
| Stock count | Number input | Required, non-negative integer |
| Thumbnail | Image file input | Required for publish, accepts jpg/png/webp |
| Charms enabled | Toggle switch | Default: off |

Available categories: Sneakers, Basketball Shoes, Running Shoes, Fashion, KickCraft Original.

#### Material Mapping Section

1. When the GLB loads in `<model-viewer>`, call `modelViewer.model.materials` to get all material objects.
2. Display each material name as a button in a list.
3. Owner clicks a material button → system calls `setBaseColorFactor([1, 0, 0, 1])` on that material (turns it bright red) and resets the previously highlighted material to white.
4. Owner sees which part of the shoe turned red.
5. Owner types a label for that material (e.g., "Upper", "Heel Panel").
6. Owner can toggle a material as "not customizable" to exclude it from customer options.
7. Part mapping is stored as a JSON array: `[{ "id": "upper", "label": "Upper", "material": "UpperMaterial" }]`.

The `id` is auto-generated from the label (lowercased, spaces → hyphens).

#### Color Palette Section

1. Owner clicks "Add Color" → a color picker + name text field appears.
2. Owner picks a color and names it (e.g., "Ocean Blue", `#245fa8`).
3. Color appears as a swatch in the palette list with a remove button.
4. All colors apply to all customizable parts of this shoe.
5. Palette stored as JSON: `[{ "name": "Ocean Blue", "value": "#245fa8" }]`.
6. Minimum 1 color required to publish.

## Folder Upload & GLB Detection

1. Owner clicks "+ Add New Shoes" → drag-drop zone appears.
2. Zone uses the `webkitdirectory` attribute on a hidden file input to accept folders.
3. JavaScript filters dropped files for `.glb` extension (case-insensitive).
4. Each detected GLB appears as a mini card showing the filename.
5. Owner clicks a GLB card → system creates a temporary `<model-viewer>` to load it → enters Shoe Editor state with that GLB loaded.
6. Non-GLB files are silently ignored.
7. If no GLB files found, show a message: "No 3D model files (.glb) found in this folder."

## Database Schema

```sql
CREATE TABLE shoes (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100)    NOT NULL,
  description VARCHAR(500)    NOT NULL,
  price       DECIMAL(10,2)   NOT NULL,
  status      ENUM('available','coming_soon','out_of_stock') NOT NULL DEFAULT 'coming_soon',
  stock       INT             NOT NULL DEFAULT 0,
  glbPath     VARCHAR(255)    NOT NULL,
  thumbnailPath VARCHAR(255)  NOT NULL,
  charmsEnabled TINYINT(1)    NOT NULL DEFAULT 0,
  categories  JSON            NOT NULL,
  parts       JSON            NOT NULL,
  colors      JSON            NOT NULL,
  createdAt   TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
  updatedAt   TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### JSON Column Schemas

**`categories`:**
```json
["sneakers", "basketball"]
```

**`parts`:**
```json
[
  { "id": "upper", "label": "Upper", "material": "UpperMaterial" },
  { "id": "midsole", "label": "Midsole", "material": "MidsoleMaterial" }
]
```

**`colors`:**
```json
[
  { "name": "Ocean Blue", "value": "#245fa8" },
  { "name": "Sunset Rust", "value": "#b94d27" }
]
```

## PHP API

All admin endpoints require owner authentication (session-based). Public endpoints are read-only.

### Admin Endpoints (authenticated)

#### `POST /api/admin/upload`

Accepts multipart form data with GLB file and/or thumbnail image. Stores files to `public/uploads/models/` and `public/uploads/thumbnails/`. Returns the stored file paths.

**Request:** `multipart/form-data` with fields `glb` (file) and/or `thumbnail` (file).

**Response:**
```json
{ "glbPath": "/uploads/models/shoe-abc.glb", "thumbnailPath": "/uploads/thumbnails/shoe-abc.png" }
```

#### `POST /api/admin/shoes`

Creates a new shoe record.

**Request body:**
```json
{
  "name": "KickCraft Stride",
  "description": "Road running · responsive cushion",
  "price": 5490,
  "status": "available",
  "stock": 50,
  "glbPath": "/uploads/models/shoe-abc.glb",
  "thumbnailPath": "/uploads/thumbnails/shoe-abc.png",
  "charmsEnabled": true,
  "categories": ["kickcraft", "running"],
  "parts": [{ "id": "upper", "label": "Upper", "material": "UpperMaterial" }],
  "colors": [{ "name": "Ocean Blue", "value": "#245fa8" }]
}
```

**Response:** `201` with `{ "id": 1, ...shoe }`.

#### `GET /api/admin/shoes`

Returns all shoes (all statuses) for the admin list.

#### `PUT /api/admin/shoes/:id`

Updates any shoe field. Partial updates accepted. Used for restocking, status changes, re-editing details.

#### `DELETE /api/admin/shoes/:id`

Deletes the shoe record and its uploaded files.

### Public Endpoints

#### `GET /api/shoes`

Returns shoes with `status = 'available'` or `status = 'coming_soon'` for the customer shop. Out-of-stock shoes with `stock = 0` are returned with their status so the frontend can show the badge.

Response includes all fields needed for the customer studio: `parts`, `colors`, `glbPath`, `charmsEnabled`.

## Customer Integration

Once the API is live, the customer side changes from hardcoded arrays to API-driven data:

1. **Shop view:** Fetches `GET /api/shoes` on mount → populates the catalog grid.
2. **Catalog cards:** Status field drives the badge and button state:
   - `available` → "Customize & Order" button active
   - `coming_soon` → "Coming Soon" badge, button disabled
   - `out_of_stock` → "Out of Stock" badge, button disabled
3. **Studio view:** When a customer opens a shoe, the studio reads `parts` and `colors` from the shoe record instead of hardcoded `PARTS` and `colors` arrays.
4. **Charms:** If `charmsEnabled` is true, charm selector appears. Otherwise hidden.
5. **Stock:** After an order, stock decrements (handled by the reservation API, not the admin panel).

### Backward Compatibility

During the transition (before PHP API is deployed), the existing hardcoded `SHOES`, `CATALOG`, and `PARTS` arrays continue to work. The API integration is additive — the frontend checks if API data is available, otherwise falls back to static data.

## Validation Rules

### Frontend (Vue)

- All required fields must be filled before "Publish" button enables
- Price must be a positive number
- Stock must be a non-negative integer
- At least one category selected
- At least one material mapped as customizable
- At least one color in the palette
- Thumbnail image must be uploaded
- GLB file must be loaded and materials detected

### Backend (PHP)

- Re-validate all fields server-side (never trust the browser)
- Sanitize file uploads: only accept `.glb` for models, `.jpg`/`.png`/`.webp` for thumbnails
- Enforce max file sizes (GLB: 20MB, thumbnail: 5MB)
- Verify owner session before any admin endpoint
- Return proper HTTP status codes and error messages

## Error & Empty States

| State | What the user sees |
|---|---|
| No shoes yet | "No shoes published yet. Upload a folder to get started." + drag-drop zone |
| Folder has no GLB files | "No 3D model files (.glb) found in this folder." |
| GLB fails to load in model-viewer | "This 3D model could not be loaded. Check the file and try again." |
| No materials detected | "No materials found in this model. The file may not have named materials." |
| API save fails | "Could not save the shoe. Please try again." with retry button |
| Delete confirmation | "Delete [shoe name]? This cannot be undone." with Cancel / Delete buttons |
