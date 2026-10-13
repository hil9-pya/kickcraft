# KickCraft UI/UX design

Date: 2026-10-13
Status: Approved by user; implemented in this worktree. See implementation ledger for final decisions and verification.
Workspace: existing `codex/photo-scanning` worktree.
Execution: one agent; no subagents.

## Outcome and boundaries

Make KickCraft easier to browse, customize, reserve, sell through, and moderate, with one coherent visual language. Preserve Vue 3, Tailwind, PHP/MySQL, local GLBs, model-viewer/extra-model, guest reservations, seller approval and existing scan workflows. This is a presentation and interaction redesign, not a backend rewrite.

The user-supplied current project guide takes precedence over the older worktree AGENTS.md where seller/marketplace scope differs. Existing implemented behavior remains the source for routes and API names. Do not invent a separate orders architecture or a creation method that this checkout does not implement.

No shipping, online payments, mandatory customer accounts, social features, new dashboards for invented metrics, automatic publication, or paid generation during UI verification. Retain original KickCraft assets; do not add third-party branded assets.

## Audit and evidence

Read source: App.vue, style.css, seller.css, ConfirmModal.vue, SellerAccess.vue, SellerDashboard.vue, SellerProductEditor.vue, SellerModeration.vue, SharedTemplateLibrary.vue, AdminPanel.vue, PhotoScanner.vue and current UI checks. Live localhost:5174 inspected through the existing owner session: inventory view, customer catalog, and an existing original template in the studio. No records were changed.

Baseline before redesign: 269 Node tests passed and production build passed. Tests require XAMPP PHP on PATH and write access for temporary fixtures. Vite warns about the current main bundle size.

Priority | Finding | Proposed change | Evidence
--- | --- | --- | ---
P1 | Admin navigation wraps into two rows at the inspected width, above a five-card statistics grid. | Compact section navigation and a single functional count/filter strip; put the active task first. | Live admin view and AdminPanel.vue.
P1 | Studio uses a 500px preview below desktop, followed by the entire control panel. Important editing controls start below the initial view. | Adaptive preview height and compact control sections on smaller screens; desktop keeps a large preview beside the inspector. | Live studio and App.vue fixed heights.
P1 | Controls, focus colors and borders are repeated in Tailwind literals, seller.css and scoped scanner CSS. | Shared semantic tokens and a small shadcn-vue primitive set, migrated deliberately at each call site. | Source; no measured usability claim.
P1 | Reservation dialog summarizes customization but does not show the pickup store/address in its pre-submit summary. | Show exact pickup location, payment method and saved design summary before confirmation; retain entered data after errors. | App.vue reservation-dialog markup.
P2 | Studio heading and explanatory sections compete with the actual product name and controls. | Use the shoe name as the working title; collapse repeated explanation into contextual help. | Live studio and App.vue.
P2 | Seller lists emphasize uppercase status/metadata and repeated boxed panels. | Sentence-case status, consistent product metadata, clear review notes and a next action per record. | Source only; seller login states not yet visually verified.
P2 | Confirmation, success, calendar and tracking presentation have separate visual conventions. | Common buttons, form styles, headings and feedback treatment; keep existing calendar behavior. | Source only; dialog interaction audit remains in implementation verification.
P2 | Scan tools have separate button/input styles and dense guidance. | Apply common controls and stage grouping without hiding consent, masks, likeness checks or recovery actions. | Source only; actual scan manipulation not exercised during audit.

Do not treat automated source assertions as proof of visual quality. Existing tests asserting old decorative styling must be revised where the design intentionally replaces it, while preserving behavioral assertions.

## Selected direction

Recommendation: a light, practical footwear studio. Shoes and editable color choices carry the personality. Graphite structure, rust actions, pale gray work surfaces, deliberate type, and restrained borders unify all roles.

Alternatives considered: a dark-first studio increases dark-product contrast risk and introduces a broader theme migration; preserving every current layout and only changing colors leaves the navigation and mobile control issues unresolved. Neither is selected.

One light theme for this change. No theme switcher. Keep the existing local Bahnschrift display face and Segoe UI body face, with current fallbacks; no remote font dependency. Use sentence case, clear nouns and action verbs. Avoid decorative labels, gradients, glows, floating shells, excessive pills, hero banners inside tools, and statistic-card grids as default navigation.

## Design tokens

Role | Value
--- | ---
Page background | #f5f6f4
Surface/card | #ffffff
Viewer background | #e9ece9
Foreground | #292b2d
Muted foreground | #626662
Primary/action | #b94d27
Primary foreground | #ffffff
Border | #cfd2ce
Interactive input border | #8e938e
Success text | #315c40
Success surface | #f1f7f2
Destructive text | #963a20
Destructive surface | #fdf2ef
Focus ring | #b94d27 with visible offset

Calculated WCAG contrast: white on brand rust 5.06:1; graphite on page background 13.11:1; muted foreground on white 5.84:1. These verify those exact color pairs only. Check every remaining state, swatch edge, icon and input boundary during implementation. Pale borders are decorative separators, not the sole indicator of an interactive control.

Spacing: 4/8/12/16/24/32/48px. Body: 15px with 1.5 line height; working labels 14px; secondary text 13px. Page titles 28-36px, section headings 18-22px. Avoid forcing uppercase through CSS. Controls generally 40px desktop with at least 44px touch targets. Radius: 6px controls, 8px dialogs and content surfaces; do not round the overall application shell. No routine card shadows. Modal/popover shadows subtle only. Motion: 120-180ms color/opacity transitions with reduced-motion support.

Use shadcn-vue semantic CSS variables (`background`, `foreground`, `primary`, `muted`, `border`, `input`, `ring`, etc.) and Tailwind mappings. Adopt components in JavaScript mode to match this project. Install only the dependencies selected component source actually imports. Keep existing dependency versions unless compatibility requires a specific change.

References:
- https://www.shadcn-vue.com/docs/installation/vite
- https://www.shadcn-vue.com/docs/theming
- https://www.shadcn-vue.com/docs/components/button

## 1080p desktop requirements

1920x1080 is the primary desktop target, not an assumption that every user has that CSS viewport. Test a 1920x1080 CSS viewport, a realistic 1920x950 browser content area, and a 1536x760 viewport approximating the usable workspace on a 1080p display at 125% scaling. Also check 200% browser zoom for reflow and keyboard access. Keep the mobile acceptance checks.

- Header approximately 56-64px high. Main customer/studio content maximum 1440px, centered with 24-32px side padding; admin record tables may use up to 1600px. Do not stretch paragraph text across the screen.
- At 100% scale on the primary target, show studio product identity, price, large preview, inspector and reserve action together without requiring page scrolling merely to find the main action. The inspector uses a 360-400px column; the preview receives remaining width.
- Adapt the preview height to the actual viewport, using an approximately 480-680px range. Avoid a fixed full-screen canvas, browser/device pixel assumptions, and unconditional overflow:hidden on the page.
- Keep the inspector action footer visible while long control content can scroll with the keyboard. Do not obscure focused controls; preserve visible scroll affordances. On short windows, let the document scroll rather than clipping the inspector.
- Body text remains 15-16px and labels at least 14px; do not shrink the whole interface to fit 1080p. Long shoe/store names wrap without pushing actions outside their column.
- Seller editor and admin comparison place model and source photo side by side. Source thumbnails and notes remain reachable without nested full-page scrolling.
- Admin desktop tables use compact 44-52px rows, clear column hierarchy, readable statuses and a nearby filter/action toolbar. At scaled or narrower widths, preserve record details through responsive wrapping or a deliberately scrollable table region, with no whole-page horizontal overflow.
- Preserve the 3D renderer's existing pixel-ratio limits. Do not increase rendering resolution, mount additional live viewers or force continuous camera animation for the larger display.

Acceptance: inspect all three desktop viewports for overflow, clipped controls, excessive empty space, readable text and primary-action visibility; confirm 3D gestures, keyboard focus, dialog fit and 200% zoom reflow. A monitor resolution alone is not evidence of the browser's CSS dimensions.
## Layouts and journeys

### Customer catalog and marketplace

Keep a simple top navigation: shop, marketplace, track reservation, and appropriate account entry. Show active navigation clearly. Retain a compact product-focused shop introduction with the existing original shoe preview. Catalog cards use thumbnails, consistent image proportions, name, seller where relevant, price, customization capability and one action. Do not mount a live viewer in every card.

Search and filters sit together, with clear selected states and one reset action. Empty and error states suggest a concrete recovery. Stock and availability come from current API data. Existing original/seller filtering remains intact.

### Studio desktop

```text
KickCraft     Shop     Marketplace     Track reservation
Back to catalog / Shoe name
Shoe name                                  Price
+--------------------------------+------------------------+
|                                | Customize              |
| Large local 3D shoe             | Part + colors          |
|                                | Charms                 |
| Controls help                  | Size                   |
|                                | Design summary         |
+--------------------------------+------------------------+
| Drag to rotate                 | Reserve for pickup     |
+--------------------------------+------------------------+
```

At >=1024px, use a flexible preview and a 360-400px inspector within a 1440px maximum content width. Viewer height adapts to available space, approximately 480-680px; inspector overflow must not hide the final action. At intermediate widths, preview height is capped relative to the viewport rather than a fixed 500px before all controls.

Keep model-viewer mounted when switching parts, colors, charms and control sections. Preserve material mapping, highlights, anchor transforms, model-ready/error states and reset behavior. Capability-driven controls explain charm-only products only where existing data supports that mode.

### Studio mobile

```text
KickCraft                        Menu
Back / Shoe name                 Price
+-------------------------------------+
| 3D shoe, roughly 35-42dvh            |
+-------------------------------------+
Parts       Charms       Size
Selected section controls
Selected design summary
+-------------------------------------+
| Size / price        Reserve pickup  |
+-------------------------------------+
```

Use actual accessible section controls with selected state. Section switching does not reset the design or viewer. The reserve bar has safe-area padding and matching bottom content padding; it must not obscure fields or intercept model gestures. Allow the page to scroll on small-height and landscape screens; do not trap scrolling inside the whole application. Help remains reopenable.

### Checkout and tracking

Retain the current guest form and pickup calendar. The checkout summary shows shoe, price, size, charm, styled parts, exact pickup store/address and pay-at-pickup wording before submission. No fabricated multi-step progress: show the actual current stage, with success only after API persistence. Field labels remain visible; errors have alert semantics and focus guidance. Name/email/date remain after a failed submission. Prevent duplicate submission while pending without stranding the dialog on failure.

Keep existing receipt-and-email lookup and allowed cancellation behavior. Tracking uses clear status text and meaningful milestones; color never carries status alone.

### Seller product editor desktop/mobile

```text
Seller Studio / Products / Product name       Back
Current review status + review note
+-----------------------------+---------------------------+
| Model + part/color preview  | Name / description        |
| Original texture reset      | Price / stock / sizes     |
|                             | Part labels / palette     |
+-----------------------------+---------------------------+
Saved model sharing permission, when eligible
Save draft                             Submit for review
```

On mobile use one column with a compact preview followed by details; retain source-specific limitations beside relevant controls. Keep product actions in a clear final toolbar. Sharing is separate from listing approval and explicitly opt-in. Shared-template reuse still requires the recipient's photo and match confirmation.

Seller dashboard keeps its existing products/templates/orders/settings information architecture, with a compact action toolbar and useful empty states. Approval status and review notes appear before unavailable actions. Tutorials stay dismissible and reopenable. Do not silently clear unsaved fields through navigation or dialog migration.

### Admin review desktop/mobile

```text
Admin     Catalog | Reservations | Accounts | Sellers | Products | Templates
Review queue                         Status filter / search
+-----------------------------+---------------------------+
| Selected model              | Original source photo     |
| Part selector + test colors | Comparison choices        |
+-----------------------------+---------------------------+
Photo confirmation + tested-part count
Review note
Reject / withdraw                                Approve
```

Preserve the existing separate product and template review contracts. Navigation becomes a compact horizontal row on desktop and a labeled section selector on narrow screens. Inventory counts remain available in filters instead of dominating the page. On mobile stack the two comparison panes and keep decision controls in normal document flow. Source-photo access stays restricted to existing authorized routes. Never auto-approve a listing or template.

### Scanning and region editing

Unify control styling across photo capture, video capture, cloud-generation consent, mask review, shape comparison, and region editing. Show actual stage and completed requirements. Keep reviewed masks, resume identity, explicit cloud/cost consent, experimental alignment warnings and recovery actions visible. Never invent a progress percentage.

Preserve fullscreen, multi-fill, undo, selected-part clearing, middle-drag rotation, right-drag pan, keyboard region selection, native canvas focus and finalization checks. Theme CSS must not alter canvas sizing calculations, red mask overlays or product color values.

## Component adoption map

Component | Existing callers | Migration rule
--- | --- | ---
Button | App, seller screens, AdminPanel, scanner toolbars | shadcn-vue variants; retain type, disabled, aria-pressed, events and form submission.
Input / Textarea / Label | Guest form, tracking, seller auth/settings/product details, admin editors | Preserve v-model modifiers, validation, autocomplete and accessible names.
Alert | Existing error/success/notice regions | Keep actionable copy and role/live semantics; use restrained semantic colors.
Dialog / AlertDialog | ConfirmModal and current reservation flow | Preserve public props/events and native form behavior; verify focus trap, Escape, initial focus and focus restoration before replacement.
Separator / Badge | Tool sections and meaningful record status | Use sparingly; status remains readable text, not color alone.
Native select / checkbox / radio | Existing filters and simple choices | Retain where sufficient; use shared visual treatment and native accessibility.
Existing KickCraftCalendar | Guest pickup date | Theme existing component; do not add a new calendar dependency.
Existing model-viewer / extra-model | Public studio, seller previews, moderation | Preserve refs, load handlers, local sources and anchor transforms.

Do not add a table framework, chart package, router, form framework, icon package or wrapper library merely to restyle existing screens. Add a mobile sheet only if actual navigation needs it; otherwise use existing responsive navigation patterns.

## Rollout and acceptance

1. Shared foundations: shadcn-vue configuration, minimal primitives, semantic theme, common focus/disabled/motion treatment. Check buttons in forms, caller attribute forwarding, contrast and scanner CSS isolation.
2. Customer flow: catalog, marketplace, adaptive studio, checkout, tracking, calendar and confirmation feedback. Check desktop/mobile layout, search reset, color/charm/size persistence, viewer identity across edits, failed request recovery, keyboard traversal and reservation summary.
3. Seller flow: access/application, dashboard, product editing, shared templates, orders and settings. Check pending/rejected/suspended states, draft/review notes, permissions, photo confirmation, creation-method limits, tutorial restart and unsaved form protection.
4. Admin and scan tools: navigation/count strip, record lists and filters, product/template review and scan controls. Check side-by-side comparison, approval prerequisites, rejection note validation, mask review, fullscreen/undo/multi-fill and narrow-screen control access.

For each phase, add focused checks for changed non-trivial interactions and adjust obsolete style-only tests intentionally. Run the relevant checks during development. Before completion run full npm test with XAMPP PHP on PATH and npm run build, and inspect live screens at desktop and mobile sizes. Verify local data-changing flows only with isolated synthetic fixtures; do not reserve real stock or spend AI credits.

Report any unauthenticated/unavailable workflow honestly. Browser screenshots must demonstrate the final presentation; passing source checks alone is insufficient. No push, deployment or schema application is included in the visual redesign. Commit only when requested or covered by explicit existing authorization.

## Open verification points

- Seller states and scanner manipulation were source-inspected, not visually exercised in this audit.
- Existing calendar and custom confirmation focus behavior require hands-on keyboard verification.
- The current main JavaScript chunk is large; this change must avoid importing unused component sets. Broader 3D bundle optimization is separate work.
- Existing source-only visual assertions can block intentional improvements; preserve behavior rather than blindly preserving old markup.
