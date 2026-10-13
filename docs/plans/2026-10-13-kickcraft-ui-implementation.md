# KickCraft UI Implementation Plan

> Execution: native in this session, no subagents, following the approved design. User approved proceeding on 2026-10-13.

**Goal:** Consistent shadcn-vue controls and clearer customer, seller and admin workflows, optimized for 1080p and mobile.
**Architecture:** Keep current Vue views, PHP APIs and 3D refs. Add only needed shadcn-vue primitives and semantic CSS tokens. Change presentation at existing call sites; retain local model assets and trust boundaries.
**Spec:** docs/plans/2026-10-13-kickcraft-ui-design.md

## Constraints

No subagents, paid generation, schema changes, push or deployment. Preserve current user changes and original shoe geometry. Existing calendar stays. New components use JavaScript. UI text stays plain and sentence case. Test 1920x1080, 1920x950, 1536x760 and mobile; check keyboard and 200% zoom.

## Task 1: Shared foundations

Files: components.json, package.json/package-lock.json, vite.config.js, jsconfig.json, src/lib/utils.js, src/components/ui/, src/style.css, src/components/ConfirmModal.vue, focused UI tests.
Interfaces: shared Button forwards type/disabled/ARIA/events; Input/Textarea preserve v-model; Dialog retains ConfirmModal show/title/message/variant/icon/confirm/cancel contract.
- [x] Add a focused failing check for button semantics, form field values and confirmation focus behavior.
- [x] Add the minimum official shadcn-vue source/dependencies, semantic tokens and accessible confirmation dialog.
- [x] Run focused checks; verify keyboard focus and confirm/cancel in browser.

## Task 2: Customer journey

Files: src/App.vue, src/components/KickCraftCalendar.vue, shared styles, test/studio-ux.test.js and outdated style-only UI assertions.
Interfaces: keep studio modelViewer ref/load callbacks and all reservation/track handlers unchanged; new responsive section selection does not remount the viewer.
- [x] Add a failing check for section selection preserving mounted content and the pre-submit pickup summary.
- [x] Update navigation/catalog, adaptive studio inspector, checkout/receipt/tracking and common feedback.
- [x] Verify resizing, model identity across edits, selected states, errors and form values.

## Task 3: Seller journey

Files: src/seller.css, SellerAccess.vue, SellerDashboard.vue, SellerProductEditor.vue, SharedTemplateLibrary.vue, related rendering checks.
Interfaces: retain existing API calls, status gating, sourceTemplateId provenance and permission consent; consume Task 1 controls.
- [x] Keep existing permission/state checks, extend focused rendering checks only for changed behavior.
- [x] Migrate controls and improve headings, product rows/cards, review notes and action hierarchy.
- [x] Check approved/pending/rejected/suspended screens and product/template editing with synthetic local data where available.

## Task 4: Admin and scan tools; final verification

Files: AdminPanel.vue, SellerModeration.vue, scanner components and their scoped styles, relevant tests, README.md.
Interfaces: preserve template/product review contracts, stock/status behavior, scan progress and 3D input handlers; consume Task 1 tokens/components.
- [x] Add a failing focused check if compact section navigation introduces new branching.
- [x] Compact admin navigation/counts; style scan controls without replacing capture/mask/region logic.
- [x] Run full npm test (XAMPP PHP on PATH), npm run build, diff checks and self-review.
- [x] Inspect screenshots and overflow at desktop/mobile sizes; verify focus, dialog behavior and 3D interaction.

## Review focus

- Buttons inside forms must retain submit vs type=button semantics.
- Dialog replacement must trap focus, restore it, and avoid double confirm/cancel events.
- Mobile studio section switching must retain colors, size, charm and model instance.
- Seller/scanner CSS must not override shadcn variants or affect canvas/mask rendering.
- Narrow/short windows and 200% zoom must not clip the main action or focused control.

## Progress and rulings

Pre-flight: Tasks 2-4 consume Task 1 primitives/tokens; existing native handler contracts stay unchanged.
Ruling: Execute inline after the user's explicit proceed; no additional intermediate approval menus — design already approved and user prohibited subagents.
Ruling: Keep this ledger in the implementation plan — no separate scratch workspace needed for one implementer.

User steering: prioritize 1080p desktop; no further mobile design expansion.
Task 1: shared controls implemented; button/input/textarea checks green. Confirmation focus containment, Escape dismissal and trigger focus restoration verified live.
Task 2: responsive inspector uses sections on desktop too; optional presets collapse to leave parts/colors visible. Color, charm and size retained through live section changes. Checkout widened for desktop.
Ruling: retain baseline small-screen reflow but prioritize 1920x1080, 1920x950 and 1536x760 verification as requested.
Ruling: patch source-map-js only after npm reported its existing vulnerability; no broad dependency upgrade. Audit now reports zero vulnerabilities.


Self-review: generated dark variants followed the OS preference despite a light-only palette. Configure Tailwind dark variants by explicit class so this release stays light consistently.

Task 1: complete — shared JavaScript shadcn-vue Button/Input/Textarea/Alert/Dialog source, semantic light tokens, class-based dark variants, working native form attributes and accessible confirmation focus.
Task 2: complete — catalog refresh, desktop sectioned inspector, collapsed optional presets, stable model ref, desktop contact/calendar checkout, pending-approval receipt wording and shared form styles. Live invalid-email check blocked submission and retained entered name; no customer order created.
Task 3: complete — seller auth/dashboard/product/template/order/settings controls and typography migrated. Existing shared-template rendering checks exercise approval prerequisites and creator/recipient controls. Seller sign-in screens and all account statuses were not separately exercised live in this session.
Task 4: complete — compact admin navigation and inventory filters, common scan controls, desktop record typography and original-template review preview. Live independent-part test/reset verified. Core scan/mask/region functions unchanged; no new real capture or cloud generation performed.
Desktop verification: 1920x1080, 1920x950 and 1536x760 CSS viewports; studio reserve action visible and no page horizontal overflow. Confirmation initially focuses cancel, Shift+Tab wraps within it, Escape closes it, and trigger focus returns. Color/charm/size survive section switching. Desktop pickup form and its action fit the 1080p viewport.
Backend regression: existing guarded tools/test-shared-templates.php passed 50 isolated local workflow checks and retired its fixtures.
Self-review: no subagents, as requested. Corrected overly broad primary-button detection, restored input boundary contrast, removed unused generated components/icon dependency, and kept light styling independent of OS theme. No API/schema/GLB changes.
Known limit: the existing large model-viewer/Three.js bundle warning remains; new UI code adds approximately 36KB gzip to the main entry. No broader 3D bundle restructuring in this visual change.
Screenshots: saved separately in the task visualization directory, outside repository source.
