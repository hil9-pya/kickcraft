# Customer Reservation Flow, Guest Persistence & History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform customer ordering into an in-store pickup reservation workflow with customer-facing "reserve" terminology, streamlined navbar navigation, guest "Remember Me" local persistence, custom brutalist calendar datepicker with 1-week to 1-year pickup window, celebratory success animation, and a dedicated "My Reservations" history dashboard for registered customers.

**Architecture:** Frontend Vue 3 + Tailwind CSS with localized state and component modularity, backed by session-isolated PHP endpoints with PDO prepared statements. Guest persistence via `localStorage` (`kickcraft_guest_profile`), custom date picker component with preset shortcuts and bounds checking, and role-aware querying in `api/reservations/list.php`.

**Tech Stack:** Vue 3 (Composition API, `<script setup>`), Tailwind CSS, Node.js test runner (`node:test`), PHP 8.x + MySQL PDO prepared statements, Vite.

**Spec:** `docs/superpowers/specs/2026-09-16-customer-reservation-flow-design.md`

## Global Constraints

- No physical `DELETE FROM` statements.
- 100% PDO prepared statements with zero variable interpolation in SQL strings.
- All customer-facing language must use "reserve" / "reservation" instead of "order".
- Do not trust browser prices or roles; keep authoritative price in database.
- Registration remains 100% optional; guest reservations must be seamless.
- Maintain KickCraft brutalist aesthetic: bold borders, high contrast, clean typography, smooth transitions, and zero icon clutter in panels.
- All existing 121 tests must continue to pass throughout and after execution.

---

### Task 1: Backend Role-Based Reservation Listing & Pickup Window Validation

**Files:**
- Modify: `api/reservations/list.php:8-42`
- Modify: `api/reservations/create.php:23-27`
- Modify: `test/backend-reservations.test.js`

**Interfaces:**
- Consumes: `api/helpers.php` (`requireAuth`, `requireMethod`, `jsonResponse`, `jsonError`, `formatReservationRow`).
- Produces:
  - `api/reservations/list.php`: Returns `{ reservations: [...] }`. When `$_SESSION['user_role'] === 'customer'`, filters strictly by `email = $_SESSION['user_email']`. When owner, allows full list.
  - `api/reservations/create.php`: Validates that `pickupDate` is between 1 week (+7 days) and 1 year (+365 days) from current timestamp.

- [ ] **Step 1: Write failing unit test in test/backend-reservations.test.js**
Add tests asserting:
1. `list.php` allows authenticated customer sessions and filters query by customer session email.
2. `create.php` validates pickup date between 1 week and 1 year from today, returning HTTP 400 if pickup date is too soon or too far.

- [ ] **Step 2: Run test to verify it fails**
Run: `npm.cmd test`
Expected: FAIL due to `requireAdmin` blocking customer in `list.php` or missing pickup date window checks.

- [ ] **Step 3: Implement changes in api/reservations/list.php and api/reservations/create.php**
In `api/reservations/list.php`:
Replace `requireAdmin()` with:
```php
requireAuth();
$isOwner = isset($_SESSION['user_role']) && $_SESSION['user_role'] === 'owner';
$userEmail = $_SESSION['user_email'] ?? '';

if (!$isOwner) {
    $where[] = 'email = ?';
    $params[] = $userEmail;
}
```
In `api/reservations/create.php`:
Add pickup date window validation:
```php
$pickupTimestamp = strtotime($pickupDate);
$minTimestamp = strtotime('+6 days 00:00:00'); // allows leeway for timezone / same-week booking
$maxTimestamp = strtotime('+366 days 23:59:59');

if ($pickupTimestamp < $minTimestamp || $pickupTimestamp > $maxTimestamp) {
    jsonError('Pickup date must be between 1 week and 1 year from today', 400);
}
```

- [ ] **Step 4: Run tests to verify they pass**
Run: `npm.cmd test`
Expected: PASS (all tests green).

- [ ] **Step 5: Commit**
```bash
git add api/reservations/list.php api/reservations/create.php test/backend-reservations.test.js
git commit -m "feat(reservations): add customer role list isolation and pickup date window validation"
```

---

### Task 2: KickCraft Custom Calendar Picker Component

**Files:**
- Create: `src/components/KickCraftCalendar.vue`
- Create: `test/calendar-picker.test.js`

**Interfaces:**
- Consumes: None (pure component).
- Produces: `KickCraftCalendar` Vue component accepting:
  - Props: `modelValue` (string, YYYY-MM-DD), `minDate` (string, YYYY-MM-DD), `maxDate` (string, YYYY-MM-DD).
  - Emits: `update:modelValue` (string, YYYY-MM-DD).
  - Quick Presets: `+1 Week`, `+2 Weeks`, `+1 Month`.
  - Interactive brutalist month grid with previous/next month controls and disabled invalid dates.

- [ ] **Step 1: Write failing unit test in test/calendar-picker.test.js**
Test that `src/components/KickCraftCalendar.vue` exists, defines props (`modelValue`, `minDate`, `maxDate`), emits `update:modelValue`, and disables dates outside range.

- [ ] **Step 2: Run test to verify it fails**
Run: `npm.cmd test`
Expected: FAIL because `KickCraftCalendar.vue` does not exist yet.

- [ ] **Step 3: Implement src/components/KickCraftCalendar.vue**
Build clean brutalist calendar with:
- Month / year header with prev/next buttons.
- Monospace weekday headers (`Su Mo Tu We Th Fr Sa`).
- Grid of day buttons calculating days in month, disabled if `< minDate` or `> maxDate`.
- Active day with terracotta highlight (`bg-[#b94d27] text-white`).
- 1-click preset buttons for `+1 Week (Default)`, `+2 Weeks`, `+1 Month`.
- Notice banner informing users about the 1-week to 1-year pickup window.

- [ ] **Step 4: Run test to verify it passes**
Run: `npm.cmd test`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/components/KickCraftCalendar.vue test/calendar-picker.test.js
git commit -m "feat(ui): create custom KickCraftCalendar picker component with brutalist styling and presets"
```

---

### Task 3: Customer Terminology, Studio Navigation & Guest "Remember Me" Persistence in src/App.vue

**Files:**
- Modify: `src/App.vue`
- Create: `test/customer-reservation-flow.test.js`

**Interfaces:**
- Consumes: `src/components/KickCraftCalendar.vue`, `localStorage` (`kickcraft_guest_profile`).
- Produces:
  - Updated navbar: "Back to shop" and "Order" removed; "Shop" preserved; "My Reservations" added for logged-in customers.
  - In-studio breadcrumb: `← Catalog / [Shoe Name]`.
  - Terminology updated across all catalog cards, studio CTA, how-it-works, dialogs, and footer from "order" to "reserve".
  - Guest "Remember Me" checkbox reactive binding with auto-population of `customerName` and `customerEmail`.
  - Integration of `KickCraftCalendar` component into the reservation dialog.

- [ ] **Step 1: Write failing unit test in test/customer-reservation-flow.test.js**
Test that:
1. Navbar does not contain "Back to shop" or "Order" buttons.
2. Studio contains breadcrumb navigating to shop.
3. Catalog cards and studio buttons use "reserve" / "reservation" terminology.
4. Guest profile persistence logic handles save and pre-fill.
5. Reservation dialog mounts `KickCraftCalendar`.

- [ ] **Step 2: Run test to verify it fails**
Run: `npm.cmd test`
Expected: FAIL due to existing "order" buttons and missing breadcrumb/guest persistence.

- [ ] **Step 3: Implement changes in src/App.vue**
1. Remove "Back to shop" and "Order" buttons from `<header>`.
2. Add in-studio breadcrumb above the shoe title row:
```html
<nav class="mb-4 flex items-center gap-2 text-xs font-bold text-[#5f635f]" aria-label="Studio Breadcrumb">
  <button type="button" class="transition-colors hover:text-[#202220] hover:underline" @click="goToShop">
    ← Back to Catalog
  </button>
  <span class="text-[#cfd2ce]">/</span>
  <span class="text-[#202220]">{{ selectedShoe.name }}</span>
</nav>
```
3. Update all copy: "Customize & Order" to "Customize & Reserve"; "Order this design" to "Reserve this design"; "3. Order" to "3. Reserve".
4. Add `rememberGuestProfile` state and localStorage getter/setter:
```javascript
const rememberGuestProfile = ref(false)

function loadGuestProfile() {
  try {
    const saved = localStorage.getItem('kickcraft_guest_profile')
    if (saved) {
      const parsed = JSON.parse(saved)
      if (parsed.name) customerName.value = parsed.name
      if (parsed.email) customerEmail.value = parsed.email
      rememberGuestProfile.value = true
    }
  } catch (_) {}
}
```
5. In `openReservation()`, pre-fill from `currentUser` if logged in, or from `kickcraft_guest_profile` if guest.
6. Mount `<KickCraftCalendar v-model="pickupDate" :min-date="minPickupDate" :max-date="maxPickupDate" />` inside the reservation modal.

- [ ] **Step 4: Run test to verify it passes**
Run: `npm.cmd test`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/App.vue test/customer-reservation-flow.test.js
git commit -m "feat(customer): update reserve terminology, studio breadcrumb, guest persistence, and calendar picker"
```

---

### Task 4: Celebratory Reservation Success Animation & Brutalist Verification Stamp

**Files:**
- Modify: `src/App.vue`
- Modify: `test/customer-reservation-flow.test.js`

**Interfaces:**
- Consumes: Reservation receipt object from `api('reservations/create.php')`.
- Produces: Enhanced animated reservation confirmation dialog with spring scale pop badge, brutalist "RESERVED FOR STORE PICKUP" verification stamp, and contextual navigation buttons.

- [ ] **Step 1: Write failing unit test in test/customer-reservation-flow.test.js**
Test that confirmation dialog contains the animated success badge class, the brutalist reservation stamp, receipt ID display, and action buttons.

- [ ] **Step 2: Run test to verify it fails**
Run: `npm.cmd test`
Expected: FAIL due to missing animation classes or stamp elements.

- [ ] **Step 3: Implement animation and confirmation in src/App.vue**
1. Add CSS keyframe animation for success pop:
```css
@keyframes popIn {
  0% { transform: scale(0.4); opacity: 0; }
  70% { transform: scale(1.15); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
.animate-pop-in {
  animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
}
```
2. Update the `v-else` confirmation screen in `#reservation-dialog`:
- Spring-loaded green checkmark badge (`animate-pop-in`).
- Brutalist stamp banner: `[ ✓ RESERVATION CONFIRMED · HELD FOR STORE PICKUP ]`.
- Staggered details: receipt ID, scheduled pickup date, size, and store address.
- Dual action buttons: `Continue Designing` and `View in My Reservations` (or registration prompt for guests).

- [ ] **Step 4: Run test to verify it passes**
Run: `npm.cmd test`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/App.vue test/customer-reservation-flow.test.js
git commit -m "feat(ui): add celebratory spring pop animation and brutalist verification stamp to reservation modal"
```

---

### Task 5: Registered Customer "My Reservations" History View

**Files:**
- Modify: `src/App.vue`
- Create: `test/customer-reservations-view.test.js`

**Interfaces:**
- Consumes: `api('reservations/list.php')`, `currentUser`.
- Produces: Dedicated `view === 'reservations'` screen displaying customer pickup reservation history cards with live status badges, customized part color swatches, receipt references, and empty state.

- [ ] **Step 1: Write failing unit test in test/customer-reservations-view.test.js**
Test that:
1. Navbar displays "My Reservations" tab when `currentUser.role === 'customer'`.
2. Clicking tab navigates to `view = 'reservations'`.
3. Customer reservations view renders reservation cards with receipt ID, shoe name, status badge, and pickup date.
4. Empty state is rendered if customer has no reservations.

- [ ] **Step 2: Run test to verify it fails**
Run: `npm.cmd test`
Expected: FAIL due to missing reservations view and navbar tab.

- [ ] **Step 3: Implement customer reservations view in src/App.vue**
1. Add `'reservations'` to allowed views in `getInitialView()`.
2. Add "My Reservations" button to global header navbar when `currentUser?.role === 'customer'`:
```html
<button
  v-if="currentUser?.role === 'customer'"
  type="button"
  class="transition-colors hover:text-[#b94d27] focus-visible:outline-2 focus-visible:outline-[#245fa8]"
  :class="view === 'reservations' ? 'border-b-2 border-[#b94d27] py-5 text-[#202220]' : 'text-[#5f635f]'"
  @click="goToMyReservations"
>
  My Reservations
</button>
```
3. Implement `goToMyReservations()` which sets `view.value = 'reservations'` and calls `fetchMyReservations()`.
4. Implement `fetchMyReservations()` calling `api('reservations/list.php')`.
5. Add `<main v-else-if="view === 'reservations'">` section:
- Page Header: "My Pickup Reservations".
- Grid of reservation cards displaying: Receipt #, scheduled pickup date, shoe thumbnail & name, US size, total price, 3D part color swatches, charm accessory, and live status badge.
- Pickup instructions notice: "Present this receipt reference at 123 Craft Studio Way, Manila on or before your pickup date."
- Clean empty state with "Start Designing in 3D Studio" button.

- [ ] **Step 4: Run test to verify it passes**
Run: `npm.cmd test`
Expected: PASS (all tests green).

- [ ] **Step 5: Run production build**
Run: `npm.cmd run build`
Expected: Build succeeds with 0 errors.

- [ ] **Step 6: Commit**
```bash
git add src/App.vue test/customer-reservations-view.test.js
git commit -m "feat(customer): add My Reservations history dashboard for registered customer accounts"
```
