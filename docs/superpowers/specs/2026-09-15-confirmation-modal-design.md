# KickCraft Branded Confirmation Modal System Design Specification

**Date:** 2026-09-15  
**Topic:** Branded Confirmation Modal Dialog System  
**Status:** Approved by user  
**Target File:** `docs/superpowers/specs/2026-09-15-confirmation-modal-design.md`  

---

## 1. Executive Summary

KickCraft currently uses immediate execution or browser-native `confirm()` dialogs for critical actions such as signing out, resetting custom 3D shoe designs, deleting shoes in the owner inventory, and cancelling customer sales orders. This specification introduces a branded, accessible, and responsive confirmation modal component (`ConfirmModal.vue`) styled strictly in accordance with KickCraft's industrial brutalist design language, completely eliminating primitive JavaScript browser alerts.

---

## 2. Visual & Architectural Design

### 2.1 Aesthetic Language
The modal mirrors KickCraft's signature studio visual identity:
- **Backdrop:** Full-viewport dark translucent overlay (`fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4`).
- **Container:** High-contrast, sharp container (`border border-[#8e938e] bg-[#fcfdfb] max-w-md w-full shadow-2xl p-6`).
- **Typography:** Bold uppercase headings (`font-display font-black text-lg text-[#202220]`), crisp body copy (`text-sm leading-6 text-[#5f635f]`).
- **Badges & Iconography:** Contextual icon badges in upper header:
  - `logout`: Charcoal badge (`bg-[#292b2d] text-white`) with exit door glyph.
  - `danger` (Delete shoe, cancel order): Terracotta badge (`bg-[#b94d27] text-white`) with warning shield / trash glyph.
  - `warning` (Reset design, discard editor): Amber badge (`bg-[#d97706] text-white`) with counterclockwise arrow / alert triangle glyph.
- **Buttons:**
  - **Cancel / Secondary:** `border border-[#bfc3bf] bg-white text-[#292b2d] hover:bg-[#f1f3f0] font-semibold h-11 px-5`
  - **Confirm / Primary (Danger):** `bg-[#b94d27] text-white hover:bg-[#963a20] font-bold h-11 px-5`
  - **Confirm / Primary (Default):** `bg-[#292b2d] text-white hover:bg-[#1a1b1c] font-bold h-11 px-5`

### 2.2 Accessibility & Interaction
- **Esc Key:** Pressing `Escape` while the modal is open closes/cancels it.
- **Backdrop Click:** Clicking the darkened backdrop dismisses/cancels the modal.
- **AutoFocus:** Focus is placed on the cancel button by default to prevent accidental destructive submission.

---

## 3. Targeted Confirmation Workflows

| # | Action | Host Component | Title | Message | Variant / Confirm Label |
|---|--------|----------------|-------|---------|-------------------------|
| 1 | **Sign Out** | `src/App.vue` | `Sign Out of KickCraft?` | `You will be signed out of your current session. You can sign back in at any time to access the Owner Portal or customer features.` | `default` / `Sign Out` |
| 2 | **Reset 3D Design** | `src/App.vue` | `Reset Custom Design?` | `This will reset all custom color choices back to original white/chalk. Your current combination will be lost.` | `warning` / `Reset to White` |
| 3 | **Delete Shoe Silhouette** | `src/components/AdminPanel.vue` | `Delete Shoe Silhouette?` | `Are you sure you want to delete "[Shoe Name]"? This silhouette will be permanently removed from the catalog.` | `danger` / `Delete Permanently` |
| 4 | **Discard 3D Editor Edits** | `src/components/AdminPanel.vue` | `Discard Unsaved Changes?` | `You have unsaved edits in the 3D shoe editor. Any customized materials or model settings will be discarded.` | `warning` / `Discard & Exit` |
| 5 | **Cancel Sales Order** | `src/components/AdminPanel.vue` | `Cancel Sales Order?` | `Are you sure you want to cancel order [KC-2026-XXXX] for [Customer Name]? This will mark the reservation as cancelled.` | `danger` / `Cancel Order` |

---

## 4. Component Interface (`src/components/ConfirmModal.vue`)

### Props
- `show` (`Boolean`, required): Controls modal visibility.
- `title` (`String`, required): Heading text.
- `message` (`String`, required): Explanatory body text.
- `confirmText` (`String`, default: `'Confirm'`): Label for primary button.
- `cancelText` (`String`, default: `'Cancel'`): Label for cancel button.
- `variant` (`String`, default: `'default'`): `'danger' | 'warning' | 'default'`.
- `icon` (`String`, default: `'warning'`): `'logout' | 'trash' | 'reset' | 'warning'`.

### Emits
- `confirm`: Emitted when user clicks confirm button.
- `cancel`: Emitted when user clicks cancel, backdrop, or presses `Escape`.

---

## 5. Verification Plan

1. **Unit Tests (`test/confirm-modal.test.js`)**:
   - Verify modal props, variants, and event triggers.
   - Verify that `AdminPanel.vue` no longer contains calls to `window.confirm`.
2. **Build Verification**:
   - Run `npm test` to ensure all tests pass (existing 28 + new modal tests).
   - Run `npm run build` to verify Vite bundle builds without errors.
