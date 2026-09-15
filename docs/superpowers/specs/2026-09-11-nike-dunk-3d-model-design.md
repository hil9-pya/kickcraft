# Nike Dunk 3D Model Integration Design Spec

## 1. Overview
Integrate the 3D modeled Nike Dunk Low from `C:\Users\kinglebron\Downloads\Nike Dunk\Nike Dunk.blend` into the KickCraft interactive customizer and catalog alongside the existing `KickCraft One` and `Nike Air Max` models.

## 2. Requirements & Constraints
- **Model Compatibility:** Lightweight GLB (< 5 MB, target < 1 MB) compatible with Google `<model-viewer>`.
- **High Visual Quality:** Preserve authentic Dunk Low silhouette, lace curves, overlays, and Swoosh geometry.
- **Customizable Zones:** Exactly 3 customizable parts:
  1. **Upper** (`UpperMaterial`)
  2. **Laces** (`LacesMaterial`)
  3. **Midsole** (`MidsoleMaterial`)
  *(Swoosh and Overlays use fixed high-quality styling).*
- **Charm / Keychain Anchor:** Dedicated empty node `CharmAnchor` placed directly at the top-outer lace eyelet where laces thread through the collar/eyestay.
- **Orientation & Dimensions:** Aligned with `shoe-soleview-final.glb` (length = 2.0 along X axis, width ˜ 0.78 along Y axis, height ˜ 0.88 along Z axis, centered at origin).
- **Catalog Integration:** Live catalog card with category tags (`sneakers`, `fashion`, `basketball`) and price `?4,890`.

## 3. 3D Model Pipeline

### Source Objects
- Body: `Plane.010` (split into `Upper`, `Overlays`, and `Midsole`)
- Swooshes: `Plane.011` (`Swoosh`)
- Laces: `BezierCurve.000`, `BezierCurve.004`, `BezierCurve.005` (converted to mesh, joined as `Laces`)

### Materials Specification
| Part ID | Mesh Name | Material Name | Role | Base Color Default |
| :--- | :--- | :--- | :--- | :--- |
| `upper` | `Upper` | `UpperMaterial` | Customizable | Crimson Red `#c92a2a` |
| `laces` | `Laces` | `LacesMaterial` | Customizable | Off-white / Silver `#d9d9d9` |
| `midsole` | `Midsole` | `MidsoleMaterial` | Customizable | Crisp White `#f1f1f1` |
| *static* | `Overlays` | `OverlaysMaterial` | Static Base | Dark Slate `#1e1e24` |
| *static* | `Swoosh` | `SwooshMaterial` | Static Accent | Dark Slate `#1e1e24` |

### Charm Anchor
- Node name: `CharmAnchor`
- Location: `[-0.05, -0.35, 0.32]` (top lateral lace eyelet)
- Compatible with existing star, lightning, and K-tag charms.

## 4. Code & Configuration Architecture

### Data Model (`src/customization.js`)
```javascript
export const DUNK_PARTS = [
  { id: 'upper', label: 'Upper', material: 'UpperMaterial' },
  { id: 'laces', label: 'Laces', material: 'LacesMaterial' },
  { id: 'midsole', label: 'Midsole', material: 'MidsoleMaterial' },
]
```

### Catalog Card (`CATALOG`)
```javascript
{
  id: 'nike-dunk',
  name: 'Nike Dunk',
  subtitle: 'Dunk Low · 3 customizable parts',
  price: '?4,890',
  categories: ['sneakers', 'fashion', 'basketball'],
  image: '/images/nike-dunk-card.png',
  shoeId: 'nike-dunk',
  status: 'live',
}
```

## 5. Verification Plan
- Unit tests in `test/nike-dunk.test.js` validating:
  - `DUNK_PARTS` export and schema
  - `SHOES` entry for `nike-dunk`
  - `CATALOG` entry with `status: 'live'`
  - File existence and size (< 5 MB) for `public/models/nike-dunk.glb`
  - Required materials and `CharmAnchor` presence in exported model
- Automated test suite passing: `npm test`
- Production build passing: `npm run build`
