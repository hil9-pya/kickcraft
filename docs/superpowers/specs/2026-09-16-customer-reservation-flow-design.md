# KickCraft Customer Reservation Flow & History Design Spec

**Date:** 2026-09-16  
**Status:** Approved by User  
**Scope:** Customer Navigation, "Reserve" Terminology, Guest "Remember Me" Persistence, Custom Calendar Datepicker, and Registered Customer "My Reservations" History

---

## 1. Executive Summary

KickCraft operates as an interactive 3D shoe customizer with in-store pickup reservations. To eliminate confusion around e-commerce orders and online checkouts, this specification:
1. Standardizes all customer-facing terminology from **"order"** to **"reserve"**.
2. Streamlines customer navigation by removing redundant "Back to shop" and "Order" buttons from the global navbar and adding an in-studio breadcrumb.
3. Implements guest **"Remember Me"** local persistence so customers can submit reservations without repeatedly entering their contact details, keeping registration 100% optional.
4. Implements a custom KickCraft **Calendar Picker** adhering to the 1-week minimum and 1-year maximum pickup window with brutalist styling and clear guidance.
5. Introduces a dedicated **"My Reservations"** dashboard for registered customers as the primary account incentive, backed by secure, session-isolated queries in `api/reservations/list.php`.

---

## 2. Terminology & Content Refinements

### 2.1 Customer View Changes
- **Catalog Cards:**
  - Button text changed from `Customize & Order` to `Customize & Reserve`.
  - Accessible aria-label changed to `Customize and reserve [Shoe Name]`.
- **How It Works Strip:**
  - Step 3 updated from `3. Order` to `3. Reserve`.
  - Description updated to: `Place your custom pickup reservation for in-store inspection and pickup.`
- **Design Studio Pinned Bar:**
  - Primary button changed from `Order this design` to `Reserve this design`.
  - Subtitle updated to: `Pickup reservation · Your colors, accessory, and size are included.`
- **Reservation Dialog & Success State:**
  - Header: `Reserve [Shoe Name]`.
  - Submit Button: `Confirm pickup reservation` (loading: `Submitting reservation…`).
  - Confirmation Header: `Reservation placed!`.
  - Success note: `Status: Pending Payment · Reserved for in-store pickup.`
- **Footer:**
  - Navigation link updated from `Order` to `Reserve`.

### 2.2 Celebratory Success Animation & Confirmation Experience
When the customer submits the reservation and the API completes:
1. **Spring Scale & Pop Checkmark Badge:**
   The confirmation screen reveals an animated success badge that pops into view using a CSS keyframe spring animation (`scale(0.4) opacity(0)` -> `scale(1.15)` -> `scale(1)`).
2. **Brutalist "RESERVED" Verification Stamp:**
   A bold, stamped verification badge displaying:
   `[ ✓ RESERVATION CONFIRMED · HELD FOR STORE PICKUP ]`
3. **Staggered Receipt Reveal:**
   The receipt number (`KC-YYYY-XXXX`), pickup date, and in-store pickup instructions slide in with staggered fade-in transitions.
4. **Contextual Action Buttons:**
   - `Continue Designing`: Returns to 3D studio.
   - `View in My Reservations`: (If logged in as customer) jumps directly to the customer's reservation history; (if guest) offers a subtle invitation to create an account if they want to track past pairs.

---

## 3. Navigation & Breadcrumb Structure

### 3.1 Global Header Navbar
- Remove the redundant `Back to shop` link from the header.
- Remove the redundant `Order` button from the header.
- Header items:
  - **Left:** KickCraft Brand Logo (navigates to `Shop`).
  - **Right Navigation:**
    - `Shop` (visible on all customer views)
    - `My Reservations` (visible when logged in as customer: `currentUser?.role === 'customer'`)
    - `Admin Portal` (visible when logged in as owner or in admin view)
    - Session Controls: `[Email]` + `Sign out` (when authenticated) OR `Log in` + `Register` (when guest).

### 3.2 3D Design Studio In-Workspace Breadcrumb
Directly above the shoe title row in the 3D studio, a clean brutalist breadcrumb provides natural navigation back to the catalog:
```html
<nav class="mb-4 flex items-center gap-2 text-xs font-bold text-[#5f635f]" aria-label="Studio Breadcrumb">
  <button type="button" class="transition-colors hover:text-[#202220] hover:underline" @click="goToShop">
    Catalog
  </button>
  <span class="text-[#cfd2ce]">/</span>
  <span class="text-[#202220]">{{ selectedShoe.name }}</span>
</nav>
```

---

## 4. Guest "Remember Me" Persistence

### 4.1 Storage & Keys
- Storage mechanism: `localStorage` key `kickcraft_guest_profile`.
- Payload format:
  ```json
  {
    "name": "Maria Santos",
    "email": "maria@example.com",
    "remember": true
  }
  ```

### 4.2 UI Controls & Interaction
- A checkbox is located directly above the studio `Reserve this design` button:
  ```html
  <label class="mb-2 flex items-center gap-2 text-xs text-[#5f635f] cursor-pointer select-none">
    <input v-model="rememberGuestProfile" type="checkbox" class="size-4 accent-[#292b2d]" />
    <span>Remember my contact details on this device</span>
  </label>
  ```
- A matching checkbox appears inside the reservation dialog form.
- Upon clicking **"Reserve this design"** (`openReservation()`):
  1. If `currentUser` is present: pre-fills `customerName = currentUser.name` and `customerEmail = currentUser.email`.
  2. Else if `kickcraft_guest_profile` exists in `localStorage`: loads saved name/email and sets `rememberGuestProfile = true`.
- Upon submitting reservation:
  - If `rememberGuestProfile` is `true`: saves current name and email to `localStorage`.
  - If `rememberGuestProfile` is `false`: removes `kickcraft_guest_profile` from `localStorage`.

---

## 5. Custom KickCraft Calendar & Pickup Date Window

### 5.1 Business Rules
- **Minimum Pickup Date:** Exactly 7 days (1 week) from today (`today + 7 days`).
- **Maximum Pickup Date:** Exactly 365 days (1 year) from today (`today + 365 days`).
- **Default Value:** Initialized to `today + 7 days`.
- **Validation Rule:** Dates strictly outside `[today + 7 days, today + 365 days]` are rejected both on client and server.

### 5.2 Calendar Component & Picker
To ensure visual consistency with KickCraft's brutalist aesthetic and avoid awkward browser popups:
- **Display Trigger:** Shows formatted date string with quick status (e.g. `Sep 23, 2026 · In 1 week`).
- **Quick Preset Buttons:**
  - `+1 Week (Default)`
  - `+2 Weeks`
  - `+1 Month`
- **Brutalist Month Grid:**
  - Header with month/year and navigation (`← Prev`, `Next →`).
  - Days of week (`Su Mo Tu We Th Fr Sa`).
  - Active/valid days are selectable with dark hover effects.
  - Selected day is highlighted in terracotta (`bg-[#b94d27] text-white`).
  - Invalid days (< 7 days or > 1 year) are disabled (`opacity-25 cursor-not-allowed pointer-events-none`).
- **Notice Banner:**
  `Notice: Pickup reservations must be scheduled between 1 week and 1 year from today. Unclaimed pairs beyond this window become invalid.`

### 5.3 Server-Side API Enforcement (`api/reservations/create.php`)
- Validate format `YYYY-MM-DD`.
- Validate that timestamp is between `strtotime('+7 days 00:00:00')` and `strtotime('+1 year 23:59:59')`. If outside, return HTTP 400 with `Pickup date must be between 1 week and 1 year from today`. (Allows appropriate leeway for automated unit test suites).

---

## 6. Registered Customer "My Reservations" History View

### 6.1 View Routing
- State: `view === 'reservations'`.
- Supported in URL hash (`#reservations`) and saved in `localStorage.getItem('kickcraft_view')`.
- Accessible from global navbar via `My Reservations` tab when `currentUser?.role === 'customer'`.

### 6.2 Customer View Content
- Page Title: **My Pickup Reservations**
- Subtitle: *Track the status of your customized pairs reserved for in-store pickup.*
- Grid/List of reservation cards:
  - **Header:** Receipt Reference (`KC-YYYY-XXXX`), creation date, and scheduled pickup date.
  - **Product Summary:** Shoe Silhouette name, US Size, Price (`₱4,890`), and accessory label.
  - **Color Palette Breakdown:** Swatches and labels for each customized zone (Upper, ToeCap, etc.).
  - **Status Badge:**
    - `pending` -> Pending Payment (amber `#c97d1e`)
    - `paid` -> Paid & Confirmed (green `#3f7652`)
    - `approved` -> Processing (blue `#245fa8`)
    - `ready` -> Ready for Store Pickup (emerald `#2a593a`)
    - `completed` -> Completed (dark `#292b2d`)
    - `cancelled` -> Cancelled (terracotta `#b94d27`)
  - **Store Instructions:** Reminder to present the receipt reference at `123 Craft Studio Way, Manila`.
- **Empty State:** Clean card inviting the user to start their first design in the 3D studio.

### 6.3 API Endpoint Updates (`api/reservations/list.php`)
- Replace unconditional `requireAdmin()` with role-aware authorization:
  ```php
  requireMethod('GET');
  requireAuth(); // Ensures a valid session exists

  $isOwner = ($_SESSION['user_role'] ?? '') === 'owner';
  $userEmail = $_SESSION['user_email'] ?? '';

  if ($isOwner) {
      // Owner can view all or filter by status/search
  } else {
      // Customer can ONLY view their own records:
      $where[] = 'email = ?';
      $params[] = $userEmail;
  }
  ```
- Result: 100% data isolation; zero risk of customers accessing other users' reservations or owner analytics.

---

## 7. Testing & Verification Plan

1. **Unit Tests (`npm test`):**
   - Customer view terminology checks ("reserve" instead of "order").
   - Navbar button presence/absence checks (no "Back to shop" or "Order" in header).
   - Studio breadcrumb presence check.
   - Guest "Remember Me" localStorage persistence tests.
   - Pickup date validation tests (1 week to 1 year window, default date calculation).
   - Customer reservation listing tests (`api/reservations/list.php` customer session isolation).
2. **Build Verification (`npm run build`):**
   - Ensure clean bundle compilation without Vite warnings or errors.
