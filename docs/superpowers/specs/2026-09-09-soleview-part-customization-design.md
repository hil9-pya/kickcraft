# SoleView Part Customization Design

Date: 2026-09-09

## Objective

Replace the temporary shoe model in the existing Vue and Tailwind prototype with `shoe-soleview-final.glb` and let customers recolor individual shoe parts in the live 3D viewer.

This first implementation proves the professor's requested innovation: customers customize specific parts instead of only rotating a fixed model.

## Scope

### Included

- Copy `shoe-soleview-final.glb` into the application's public model directory.
- Load the new model through the existing `@google/model-viewer` component.
- Let the customer select one of eight parts: Upper, Toe Cap, Tongue, Laces, Heel Panel, Side Accents, Midsole, or Outsole.
- Let the customer apply a named preset color to the selected part.
- Preserve the model's neutral diffuse, normal, and surface-detail textures while applying color.
- Show the current color for each part.
- Reset every part to its initial neutral color.
- Preserve the existing size selection and pickup reservation flow.
- Keep the interface responsive and keyboard accessible.

### Excluded

- Keychain or charm attachment.
- Backend persistence.
- Admin product upload.
- Multiple shoe models.
- Custom color picker.
- Saving or sharing a design.
- Price changes based on customization.

These features can follow after the part recoloring test works reliably.

## Verified Model Contract

Source file:

`C:\Users\Ariel\Documents\antigravity\delightful-babbage\shoe-soleview-final.glb`

The GLB contains eight independent meshes and materials:

| Customer label | Material name |
| --- | --- |
| Upper | `UpperMaterial` |
| Toe Cap | `ToeCapMaterial` |
| Tongue | `TongueMaterial` |
| Laces | `LacesMaterial` |
| Heel Panel | `HeelPanelMaterial` |
| Side Accents | `SideAccentsMaterial` |
| Midsole | `MidsoleMaterial` |
| Outsole | `OutsoleMaterial` |

The model also contains `CharmAnchor`, parented to `Shoe_Root`. The anchor remains unused in this phase.

The neutral diffuse texture allows base-color tinting. Normal and occlusion/roughness/metallic textures remain attached to each material.

## User Flow

1. The customer opens the product page.
2. SoleView loads the GLB and initializes its material references.
3. The customer selects a shoe part.
4. The customer selects a named color.
5. Vue updates the selected material through the model-viewer Scene Graph API.
6. The 3D shoe immediately shows the change.
7. The customer repeats the process for other parts or resets the design.
8. The customer selects a size and continues to pickup reservation.

## Interface Design

The page uses a shoe-design-studio composition rather than a standard product-card layout.

```text
+--------------------------------+-------------------------+
|                                | Design your pair        |
|                                |                         |
|          Live 3D shoe          | Shoe parts              |
|          rotate / zoom         | [Upper] [Toe Cap] ...   |
|                                |                         |
|                                | Colors                  |
|                                | [named color swatches]  |
|                                |                         |
|                                | [Reset design]          |
+--------------------------------+-------------------------+
```

On wide screens, the viewer occupies the larger left column and the controls occupy the right column. On small screens, controls move below the viewer.

### Visual tokens

- Workshop gray: `#E7E8E3`
- Paper white: `#F8F8F4`
- Graphite: `#1B1D1B`
- Secondary text: `#666A65`
- Rubber orange: `#C45120`
- Focus blue: `#245FA8`

Headings use a Bahnschrift-first technical font stack. Body text uses the platform sans-serif stack for readability. The interface uses square or slightly rounded controls, visible borders, and no decorative gradients.

### Design critique

The earlier warm cream storefront resembled a common generated-commerce layout. This design changes the page into a cool gray product workbench and makes the live shoe the single memorable element. The controls remain quiet and functional so the customization, rather than decoration, carries the visual identity.

## Vue State

The existing component keeps the implementation local because only one product exists.

- `selectedPart`: material key for the active shoe part.
- `partColors`: reactive object mapping each material key to a color value.
- `parts`: static list of customer labels and GLB material names.
- `palette`: static list of accessible color names and hexadecimal values.
- `modelReady`: whether model materials are available.
- `modelError`: user-readable load or compatibility error.

No store, composable, router, or additional state dependency is needed.

## 3D Integration

The existing `model-viewer` element receives a Vue template ref. After its `load` event:

1. Read `viewer.model.materials`.
2. Match materials by the verified names in the model contract.
3. Record the original base-color factors for reset.
4. Mark the customizer ready only when all required materials exist.

When a customer selects a color, call the selected material's PBR base-color setter. The neutral texture remains attached, so the selected color multiplies through the grayscale texture instead of replacing its detail.

The implementation must use the public model-viewer Scene Graph API. It must not reach into private renderer internals.

## Error Handling

- While loading, show `Loading 3D shoe` and disable part/color controls.
- If the model fails to load, show `The 3D shoe could not be loaded. Refresh the page to try again.`
- If any required material is missing, show `This shoe is not ready for part customization.` and disable customization.
- Color selection must not throw when the model is unavailable.
- Reset must restore all verified materials and the Vue color state.

## Accessibility

- Use native buttons for part and color selection.
- Expose selected state with `aria-pressed`.
- Every color swatch includes a visible name or accessible label.
- Preserve visible keyboard focus.
- Do not rely on color alone to indicate the active part or color.
- Keep existing model alt text and touch controls.

## Verification

The smallest useful automated check covers the state-to-material mapping and reset behavior without adding a test framework.

Manual verification covers the rendered model:

1. Start the Vite development server.
2. Confirm the new model loads.
3. Change every part individually and verify unrelated parts retain their colors.
4. Reset and verify every part returns to neutral.
5. Test keyboard selection.
6. Test desktop and mobile layouts.
7. Complete the existing reservation flow after customization.
8. Confirm the browser console contains no errors.

## Future Extension

The next phase may attach separate charm GLBs at `CharmAnchor`. That work requires validating accessory scale, rotation, and placement and does not belong in the first recoloring test.
