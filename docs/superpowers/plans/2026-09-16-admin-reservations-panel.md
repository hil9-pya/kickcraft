# Admin Reservations Panel, Live Alerts & Inspection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the KickCraft Owner/Admin Panel by removing the Financial Tracker and sales metrics, implementing a dedicated Reservations Management Hub with real-time popup alerts, comprehensive 3D design inspection with color swatches, customer self-cancellation, owner cancellation with out-of-stock color explanation, and owner soft-deletion.

**Architecture:** Vue 3 Composition API with Tailwind CSS, browser `BroadcastChannel` cross-tab eventing, backed by session-isolated PHP API endpoints with MySQL PDO prepared statements and zero physical `DELETE FROM` statements.

**Tech Stack:** Vue 3 (`<script setup>`), Tailwind CSS, Node.js test runner (`node:test`), PHP 8.x + MySQL PDO prepared statements, Vite.

**Spec:** `docs/superpowers/specs/2026-09-16-admin-reservations-panel-design.md`

## Global Constraints

- No physical `DELETE FROM` statements across any PHP endpoints.
- 100% PDO prepared statements with bound parameters; zero SQL injection vulnerability.
- Maintain KickCraft brutalist aesthetic: bold borders, high contrast, clean typography, smooth transitions, zero icon clutter in panels.
- Strict customer session isolation: customer accounts can only view/cancel their own reservations; owners retain full management privileges.
- All existing 143 tests must continue to pass throughout and after execution.

---

### Task 1: Backend Support for 'arrived' Status, Cancellation Explanations, Soft-Delete & Stock Restoral

**Files:**
- Modify: `api/database/setup.sql`
- Modify: `api/reservations/update-status.php`
- Create: `api/reservations/delete.php`
- Modify: `api/reservations/list.php`
- Modify: `test/backend-reservations.test.js`

**Interfaces:**
- Consumes: `api/helpers.php` (`requireAuth`, `requireAdmin`, `requireMethod`, `jsonResponse`, `jsonError`).
- Produces:
  - `update-status.php`: Allows `'arrived'` status. Accepts `notes` parameter for cancellation explanation. When status changes to `'cancelled'`, restores shoe stock (`stock = stock + 1`). Allows customer sessions to cancel their own `pending` reservation.
  - `delete.php`: Soft-deletes reservation record (`SET deleted_at = NOW(), permanently_deleted = 1`).
  - `list.php`: Filters out records where `deleted_at IS NOT NULL OR permanently_deleted = 1`.

- [ ] **Step 1: Write failing unit test in test/backend-reservations.test.js**
Add tests asserting:
1. `update-status.php` allows `'arrived'` status and persists `notes` cancellation explanation.
2. `update-status.php` allows customer session to cancel their own pending reservation and restores shoe stock.
3. `delete.php` requires owner session, rejects physical DELETE, and updates `permanently_deleted = 1`.
4. `list.php` excludes deleted reservations.

- [ ] **Step 2: Run test to verify it fails**
Run: `npm.cmd test`
Expected: FAIL due to missing `delete.php` and unaccepted `'arrived'` status.

- [ ] **Step 3: Implement database schema and backend endpoints**
1. In `api/database/setup.sql`: add `deleted_at` and `permanently_deleted` columns; update status enum to allow `'arrived'`.
2. In `api/reservations/update-status.php`:
   - Add `'arrived'` to `$allowedStatuses`.
   - Allow customer sessions to cancel their own `pending` reservation.
   - Accept `$notes = sanitizeString($body['notes'] ?? '');` and update `notes` column.
   - If `$status === 'cancelled'`, increment shoe stock back (`UPDATE shoes SET stock = stock + 1`).
3. In `api/reservations/delete.php`:
   - Implement soft delete endpoint with `requireAdmin()`.
4. In `api/reservations/list.php`:
   - Add `deleted_at IS NULL AND permanently_deleted = 0` to where clause.

- [ ] **Step 4: Run tests to verify they pass**
Run: `npm.cmd test`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add api/database/setup.sql api/reservations/ test/backend-reservations.test.js
git commit -m "feat(backend): support arrived status, cancellation notes, stock restoral, and soft deletion"
```

---

### Task 2: Customer Self-Cancellation and Store Cancellation Reason Display in src/App.vue

**Files:**
- Modify: `src/App.vue`
- Modify: `test/customer-reservations-view.test.js`

**Interfaces:**
- Consumes: `api('reservations/update-status.php')`, `ConfirmModal`.
- Produces:
  - "Cancel Reservation" action button on `pending` customer reservations.
  - Store cancellation reason callout on cards where `status === 'cancelled'` and `notes` exists.
  - Broadcasts `RESERVATION_CANCELLED` event across `BroadcastChannel`.

- [ ] **Step 1: Write failing unit test in test/customer-reservations-view.test.js**
Test that:
1. Reservation cards render "Cancel Reservation" button only when `status === 'pending'`.
2. Clicking "Cancel Reservation" triggers `ConfirmModal`.
3. Cancelled cards with `notes` render "Store Cancellation Reason: [notes]".

- [ ] **Step 2: Run test to verify it fails**
Run: `npm.cmd test`
Expected: FAIL due to missing cancel button and reason display.

- [ ] **Step 3: Implement cancellation and reason display in src/App.vue**
1. Add `requestCancelCustomerReservation(reservation)` calling `confirmModal`.
2. Add template button in `<main v-else-if="view === 'reservations'">`:
```html
<button
  v-if="reservation.status === 'pending'"
  type="button"
  class="border border-[#b94d27] px-3 py-1.5 text-xs font-bold text-[#b94d27] hover:bg-[#b94d27] hover:text-white transition-colors"
  @click="requestCancelCustomerReservation(reservation)"
>
  Cancel Reservation
</button>
```
3. Render cancellation reason callout if `reservation.status === 'cancelled' && reservation.notes`:
```html
<div v-if="reservation.status === 'cancelled' && reservation.notes" class="mt-3 border-l-2 border-[#b94d27] bg-[#fdf2ef] p-2.5 text-xs text-[#963a20]">
  <span class="font-bold block uppercase tracking-wider text-[10px]">Store Cancellation Reason:</span>
  {{ reservation.notes }}
</div>
```

- [ ] **Step 4: Run test to verify it passes**
Run: `npm.cmd test`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/App.vue test/customer-reservations-view.test.js
git commit -m "feat(customer): add reservation self-cancellation and store explanation notice"
```

---

### Task 3: Admin Panel Financial Tracker Removal & Reservations Management Hub

**Files:**
- Modify: `src/components/AdminPanel.vue`
- Create: `test/admin-reservations.test.js`

**Interfaces:**
- Consumes: `orders` reactive state, `api('reservations/list.php')`.
- Produces:
  - Cleaned `AdminPanel.vue` without financial KPI cards, silhouette breakdown, or walk-in sales.
  - Renamed tab `reservations` ("Pickup Reservations") with counter badge `{{ pendingReservationsCount }} pending`.
  - Filter tabs (`All`, `Pending`, `Arrived`, `Completed`, `Cancelled`).
  - Search bar and reservations data table with status badges and quick action buttons.

- [ ] **Step 1: Write failing unit test in test/admin-reservations.test.js**
Test that:
1. AdminPanel does not render revenue metric cards (*Realized Revenue*, *AOV*) or *Record Walk-in Sale* button.
2. Tab is renamed to "Pickup Reservations" with section key `'reservations'`.
3. Status filter tabs include `All`, `Pending`, `Arrived`, `Completed`, and `Cancelled`.
4. Reservations table renders customer info, shoe model, pickup date, and status badges.

- [ ] **Step 2: Run test to verify it fails**
Run: `npm.cmd test`
Expected: FAIL due to existing financials cards and missing reservations tab.

- [ ] **Step 3: Refactor AdminPanel.vue**
1. Remove four financial cards, silhouette breakdown section, and walk-in sales modal.
2. Rename `adminSection = 'financials'` to `adminSection = 'reservations'`.
3. Update tab label to "Pickup Reservations" with pending counter badge.
4. Update filter tabs: `all`, `pending`, `arrived`, `completed`, `cancelled`.
5. Update table rows with quick actions: "View Details", "Mark as Arrived", "Mark as Completed".

- [ ] **Step 4: Run test to verify it passes**
Run: `npm.cmd test`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/components/AdminPanel.vue test/admin-reservations.test.js
git commit -m "feat(admin): replace financial tracker with reservations management hub"
```

---

### Task 4: Real-Time Floating Owner Alert & Reservation Inspection Modal with 3D Color Swatches

**Files:**
- Modify: `src/App.vue`
- Modify: `src/components/AdminPanel.vue`
- Modify: `test/admin-reservations.test.js`

**Interfaces:**
- Consumes: `BroadcastChannel('kickcraft_reservations_channel')`.
- Produces:
  - Event broadcast in `App.vue` on reservation submission.
  - Floating top-right notification toast in `AdminPanel.vue` with "View Details" action.
  - Comprehensive Reservation Inspection Modal displaying customer info, pickup date, shoe thumbnail & specs, and complete 3D custom part color swatches.

- [ ] **Step 1: Write failing unit test in test/admin-reservations.test.js**
Test that:
1. `AdminPanel.vue` defines `reservationAlert` state and renders floating alert banner.
2. `AdminPanel.vue` renders the detailed inspection modal with 3D part color swatches (hex swatch, part label, color name).
3. Status action buttons transition reservation to `arrived` and `completed`.

- [ ] **Step 2: Run test to verify it fails**
Run: `npm.cmd test`
Expected: FAIL due to missing alert toast and inspection modal.

- [ ] **Step 3: Implement live alert and inspection modal in src/components/AdminPanel.vue and broadcast in src/App.vue**
1. In `src/App.vue`: broadcast `{ type: 'NEW_RESERVATION', reservation: res.reservation }` in `submitReservation()`.
2. In `src/components/AdminPanel.vue`:
   - Set up `BroadcastChannel('kickcraft_reservations_channel')` listener in `onMounted`.
   - Add `reservationAlert` reactive ref and `triggerReservationAlert(reservation)`.
   - Add floating notification toast template fixed in top-right corner with "View Details" button.
   - Implement `showReservationInspectionModal` and `selectedInspectionReservation`.
   - Build inspection modal with:
     - Customer contact info & reference ID.
     - Scheduled pickup date countdown.
     - Silhouette thumbnail, name, US size, charm accessory.
     - Zone-by-zone color swatches (Upper, Toe Cap, Laces, Midsole, Outsole, etc.).
     - Status action buttons (`Mark as Arrived`, `Mark as Completed`).

- [ ] **Step 4: Run test to verify it passes**
Run: `npm.cmd test`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/App.vue src/components/AdminPanel.vue test/admin-reservations.test.js
git commit -m "feat(admin): add live reservation floating alert and 3D design inspection modal with color swatches"
```

---

### Task 5: Owner Cancellation Explanation Modal & Soft-Delete Workflow

**Files:**
- Modify: `src/components/AdminPanel.vue`
- Modify: `test/admin-reservations.test.js`

**Interfaces:**
- Consumes: `api('reservations/update-status.php')`, `api('reservations/delete.php')`, `ConfirmModal`.
- Produces:
  - Owner Cancellation Explanation Modal with out-of-stock color presets.
  - Soft-delete execution for cancelled reservations.

- [ ] **Step 1: Write failing unit test in test/admin-reservations.test.js**
Test that:
1. Clicking "Cancel Reservation" opens explanation modal with reason presets.
2. Submitting cancellation calls `update-status.php` with status `cancelled` and `notes`.
3. Cancelled reservations display "Delete Record" button, which triggers `ConfirmModal` and calls `delete.php`.

- [ ] **Step 2: Run test to verify it fails**
Run: `npm.cmd test`
Expected: FAIL due to missing cancellation explanation modal and delete action.

- [ ] **Step 3: Implement owner cancellation modal and delete workflow in src/components/AdminPanel.vue**
1. Add `showOwnerCancelModal`, `cancelReservationTarget`, `cancellationReason`.
2. Add preset buttons:
   - "Selected custom color / material is currently unavailable"
   - "Silhouette size out of stock"
   - "Custom craftsmanship constraint"
3. Handle cancellation submit: sends `status: 'cancelled'` and `notes: cancellationReason` to `api/reservations/update-status.php`.
4. Add `requestDeleteReservation(reservation)` triggering `adminConfirm` modal and calling `api('reservations/delete.php')`.

- [ ] **Step 4: Run test to verify it passes**
Run: `npm.cmd test`
Expected: PASS (all tests green).

- [ ] **Step 5: Run production build**
Run: `npm.cmd run build`
Expected: Build succeeds with 0 errors.

- [ ] **Step 6: Commit**
```bash
git add src/components/AdminPanel.vue test/admin-reservations.test.js
git commit -m "feat(admin): add owner cancellation explanation modal and soft-delete workflow"
```
