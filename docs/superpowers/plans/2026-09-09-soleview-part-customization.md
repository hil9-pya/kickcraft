# SoleView Part Customization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the temporary shoe with the verified SoleView GLB and let customers recolor its eight named parts before reserving it for pickup.

**Architecture:** Keep the existing single-page Vue prototype and installed `<model-viewer>` dependency. `App.vue` owns the selected part, selected colors, model loading state, and reservation UI; one small framework-free module maps the eight UI parts to GLB material names and applies colors through model-viewer's public Scene Graph API. A built-in Node test checks that mapping and material updates without adding a test framework.

**Tech Stack:** Vue 3, Tailwind CSS 4, Vite, `@google/model-viewer`, Node's built-in test runner

**Spec:** `docs/superpowers/specs/2026-09-09-soleview-part-customization-design.md`

## Global Constraints

- Preserve the existing size picker and reservation dialog flow.
- Use `public/models/shoe-soleview-final.glb`; do not alter the source GLB.
- Use these exact material names: `UpperMaterial`, `ToeCapMaterial`, `TongueMaterial`, `LacesMaterial`, `HeelPanelMaterial`, `SideAccentsMaterial`, `MidsoleMaterial`, `OutsoleMaterial`.
- Keep the grayscale textures, normal maps, and ORM maps active by changing only each material's base color factor.
- Add no dependencies and no speculative keychain, account, admin, or backend code.
- Keep keyboard focus states, semantic fieldsets, text labels, model loading feedback, and a readable model error message.

---

### Task 1: Add and verify the final GLB asset

**Files:**
- Create: `public/models/shoe-soleview-final.glb`

- [ ] Copy `C:\Users\Ariel\Documents\antigravity\delightful-babbage\shoe-soleview-final.glb` to `public/models/shoe-soleview-final.glb`.
- [ ] Compare the source and destination SHA-256 hashes.

Run:

```powershell
Get-FileHash "C:\Users\Ariel\Documents\antigravity\delightful-babbage\shoe-soleview-final.glb" -Algorithm SHA256
Get-FileHash "public\models\shoe-soleview-final.glb" -Algorithm SHA256
```

Expected: both hashes are identical and the destination size is 2,759,216 bytes.

- [ ] Commit the asset.

```powershell
git add public/models/shoe-soleview-final.glb
git commit -m "feat: add customizable SoleView shoe model"
```

### Task 2: Add the smallest tested material helper

**Files:**
- Create: `src/customization.js`
- Create: `test/customization.test.js`
- Modify: `package.json`

- [ ] Add a failing Node test that checks all eight material mappings, a successful color update, and a safe `false` result for a missing material.

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { PARTS, setMaterialColor } from '../src/customization.js'

test('maps all shoe parts and updates only the requested material', () => {
  assert.deepEqual(PARTS.map(({ material }) => material), [
    'UpperMaterial', 'ToeCapMaterial', 'TongueMaterial', 'LacesMaterial',
    'HeelPanelMaterial', 'SideAccentsMaterial', 'MidsoleMaterial', 'OutsoleMaterial',
  ])

  const calls = []
  const material = { pbrMetallicRoughness: { setBaseColorFactor: color => calls.push(color) } }
  const model = { getMaterialByName: name => name === 'UpperMaterial' ? material : null }

  assert.equal(setMaterialColor(model, 'UpperMaterial', '#245fa8'), true)
  assert.deepEqual(calls, ['#245fa8'])
  assert.equal(setMaterialColor(model, 'MissingMaterial', '#ffffff'), false)
})
```

- [ ] Add `"test": "node --test"` to `package.json`, run `npm test`, and confirm it fails because `src/customization.js` does not exist.
- [ ] Implement only the mapping and guarded material setter.

```js
export const PARTS = [
  { id: 'upper', label: 'Upper', material: 'UpperMaterial' },
  { id: 'toe-cap', label: 'Toe cap', material: 'ToeCapMaterial' },
  { id: 'tongue', label: 'Tongue', material: 'TongueMaterial' },
  { id: 'laces', label: 'Laces', material: 'LacesMaterial' },
  { id: 'heel-panel', label: 'Heel panel', material: 'HeelPanelMaterial' },
  { id: 'side-accents', label: 'Side accents', material: 'SideAccentsMaterial' },
  { id: 'midsole', label: 'Midsole', material: 'MidsoleMaterial' },
  { id: 'outsole', label: 'Outsole', material: 'OutsoleMaterial' },
]

export function setMaterialColor(model, materialName, color) {
  const material = model?.getMaterialByName(materialName)
  if (!material) return false
  material.pbrMetallicRoughness.setBaseColorFactor(color)
  return true
}
```

- [ ] Run `npm test` and confirm one test passes.
- [ ] Commit the helper and its check.

```powershell
git add package.json src/customization.js test/customization.test.js
git commit -m "test: cover shoe material customization"
```

### Task 3: Build the part and color customization interface

**Files:**
- Modify: `src/App.vue`

- [ ] Replace the old three whole-shoe variants with:
  - a `modelViewer` template ref;
  - `PARTS` and `setMaterialColor` imports;
  - six named colors: Chalk `#f1efe8`, Graphite `#292b2d`, Cobalt `#245fa8`, Rust `#b94d27`, Moss `#52684f`, Burgundy `#713741`;
  - `selectedPart`, `partColors`, `modelReady`, and `modelError` state.
- [ ] On the model's `load` event, verify that every required material exists before enabling controls. If one is missing, show `This shoe model cannot be customized because a required part is missing.`
- [ ] On a color choice, update only the selected part with `setMaterialColor(modelViewer.value.model, selectedPart.material, color.value)` and record that part's color name/value in `partColors`.
- [ ] Implement Reset design by setting all eight base color factors to `#ffffff`, clearing recorded choices, and retaining the current selected part.
- [ ] Update `<model-viewer>`:

```vue
<model-viewer
  ref="modelViewer"
  src="/models/shoe-soleview-final.glb"
  alt="Interactive customizable 3D SoleView concept shoe"
  camera-controls
  touch-action="pan-y"
  shadow-intensity="1"
  shadow-softness="1"
  environment-image="neutral"
  @load="handleModelLoad"
  @error="handleModelError"
/>
```

- [ ] Add an overlaid loading label while `!modelReady && !modelError`, and an overlaid error panel when `modelError` is set.
- [ ] Replace the old Color fieldset with two semantic fieldsets:
  - `Customize part`: eight text buttons in a compact two-column grid, with the active part visibly selected.
  - `Choose color`: six swatches with visible color names/tooltips, an active state for the selected part's current color, and disabled controls until the model is ready.
- [ ] Show `Editing: <part>` and a compact design summary above the size selector. Keep native buttons, visible focus rings, and at least 44px touch targets.
- [ ] Update the reservation summary to `Custom SoleView · Size <size> · <number> customized parts` so the current design is carried into the existing pickup flow.
- [ ] Remove the non-functional Shopping bag and whole-shoe variant bindings. Rename the product to `SoleView One` and describe it as the original customizable concept shoe.
- [ ] Run `npm test` and confirm it still passes.
- [ ] Commit the functional UI.

```powershell
git add src/App.vue
git commit -m "feat: customize individual shoe parts"
```

### Task 4: Apply the approved workbench visual direction

**Files:**
- Modify: `src/App.vue`
- Modify: `src/style.css`

- [ ] Reshape the product area into a design workbench: large 3D canvas left, restrained controls right, stacked on mobile.
- [ ] Use paper white, cool gray, graphite, rubber orange, and focus blue; avoid gradients and excessive card nesting.
- [ ] Use a Bahnschrift-first display stack for headings and the existing Manrope/system stack for body text.
- [ ] Keep borders square or lightly rounded and reserve the orange accent for price, primary action, and limited status emphasis.
- [ ] Add only the CSS that cannot be expressed clearly with current Tailwind utilities: font variables, `<model-viewer>` sizing/progress color, dialog backdrop, and hidden scrollbar.
- [ ] Verify keyboard tab order, focus visibility, labels, and mobile layout at approximately 375px width.
- [ ] Commit the styling.

```powershell
git add src/App.vue src/style.css
git commit -m "style: shape SoleView customization workbench"
```

### Task 5: Verify the production prototype

**Files:**
- Modify only if verification reveals an issue: `src/App.vue`, `src/style.css`, `src/customization.js`

- [ ] Run the unit check.

```powershell
npm test
```

Expected: one test passes and zero fail.

- [ ] Run the production build.

```powershell
npm run build
```

Expected: Vite exits successfully and writes `dist`; a chunk-size warning from the existing model-viewer dependency is acceptable.

- [ ] Start the Vite development server and inspect the page in a browser.

```powershell
npm run dev -- --host 127.0.0.1
```

- [ ] Confirm all acceptance criteria manually:
  1. the final shoe loads and rotates/zooms;
  2. each of eight part buttons can be selected;
  3. recoloring one part leaves the others unchanged and retains texture detail;
  4. Reset design returns every part to neutral;
  5. model loading and failure states are readable;
  6. size selection and reservation confirmation still work;
  7. the layout remains usable on desktop and mobile.
- [ ] If verification required changes, rerun both commands and commit the fix.

```powershell
git add src/App.vue src/style.css src/customization.js test/customization.test.js package.json
git commit -m "fix: complete SoleView customization verification"
```

## Plan Review Checklist

- [ ] Every requirement in the approved spec maps to a task or is explicitly deferred under Global Constraints.
- [ ] No task includes keychain attachment, backend persistence, account management, or admin model creation.
- [ ] Material names match the verified GLB exactly.
- [ ] The model-viewer API calls use the public `model.getMaterialByName()` and `pbrMetallicRoughness.setBaseColorFactor()` interfaces.
- [ ] Tests use only Node's standard library and the project gains no dependency.
- [ ] A scan for unfinished-marker terms returns no matches.
