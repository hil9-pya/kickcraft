# Nike Dunk 3D Model Integration Plan

Integrate the 3D modeled Nike Dunk Low from `C:\Users\kinglebron\Downloads\Nike Dunk\Nike Dunk.blend` into KickCraft with 3 customizable zones (Upper, Laces, Midsole), a lace-attached keychain anchor (`CharmAnchor`), and full catalog integration.

## Proposed Changes

### 3D Asset Pipeline
- `tools/blender/export_nike_dunk.py`: Automated Blender script to convert, optimize, align, assign PBR materials, attach CharmAnchor at the laces, export `public/models/nike-dunk.glb` (~403 KB), and render `public/images/nike-dunk-card.png`.
- `public/models/nike-dunk.glb`: Lightweight model-viewer compatible GLB.
- `public/images/nike-dunk-card.png`: Catalog card image.

### Data Model & Catalog Configuration
- `src/customization.js`:
  - Export `DUNK_PARTS` with 3 customizable zones (`upper`, `laces`, `midsole`).
  - Add `nike-dunk` entry into `SHOES`.
  - Add `nike-dunk` card into `CATALOG` with `status: 'live'`.

### Automated Verification
- `test/nike-dunk.test.js`:
  - Test `DUNK_PARTS` schema.
  - Test `SHOES` entry.
  - Test `CATALOG` entry.
  - Test GLB existence, size (< 5 MB), material names, and `CharmAnchor` node presence.

## Verification
- Run `npm test`
- Run `npm run build`
