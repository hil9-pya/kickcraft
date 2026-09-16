# KickCraft Admin Reservations Panel, Live Alerts & Inspection Spec

**Date:** 2026-09-16  
**Status:** Approved by User  
**Scope:** Admin Panel Financial Tracker Removal, Reservations Management Hub, Real-Time Owner Notification Popup, 3D Design Inspection Modal, Customer Self-Cancellation, and Owner Record Deletion

---

## 1. Executive Summary

This specification removes the Financial Tracker and sales metrics from the KickCraft Admin Panel, replacing them with a dedicated **Reservations Management Hub**. It implements:
1. Complete removal of the four revenue cards (*Realized Revenue*, *Pending Receivables*, *Pairs Sold*, *AOV*), silhouette revenue breakdown, and walk-in sales from `AdminPanel.vue`.
2. A streamlined **Pickup Reservations Hub** with status filters (`All`, `Pending`, `Arrived`, `Completed`, `Cancelled`), search bar, and clean status controls.
3. Real-time **floating owner alerts** (via browser `BroadcastChannel` and polling) notifying the owner immediately when a customer confirms a reservation, with a 1-click "View Details" button.
4. A comprehensive **Reservation Inspection Modal** detailing customer contact information, scheduled pickup date, shoe silhouette specs, and a complete zone-by-zone 3D color palette breakdown.
5. Customer **self-cancellation** while in `Pending` status with inventory restoral, and owner **soft-deletion** of cancelled reservations adhering to the zero physical `DELETE FROM` rule.

---

## 2. Admin Panel Overhaul: Financial Tracker Removal

### 2.1 Removed Features & Components
- **Tab Update:** Navigation tab renamed from `financials` ("Financials & Sales History") to `reservations` ("Pickup Reservations"), showing active pending count badge.
- **Removed KPI Cards:**
  - Realized Revenue
  - Pending Receivables
  - Pairs Sold
  - Average Order Value (AOV)
- **Removed Silhouette Table:** All revenue aggregation tables and calculations removed from UI.
- **Removed Walk-in Sales:** "Record Walk-in Sale" button and walk-in modal removed from UI.

### 2.2 Reservations Hub Features
- **Status Filter Tabs:**
  - `All`
  - `Pending` (amber badge)
  - `Arrived` (blue badge)
  - `Completed` (green badge)
  - `Cancelled` (terracotta badge)
- **Search Bar:** Real-time filtering across Receipt ID (`KC-2026-XXXX`), Customer Name, Customer Email, and Shoe Silhouette Name.
- **Data Table:**
  - Columns: `Receipt #`, `Customer`, `Shoe Model & Size`, `Pickup Date`, `Status`, `Actions`.
  - Row Actions: `View Details`, `Mark Arrived`, `Mark Completed`, `Cancel`, and `Delete Record` (for cancelled items).

---

## 3. Real-Time Owner Notification Popup

### 3.1 Event Dispatch & Reception
- Native browser `BroadcastChannel('kickcraft_reservations_channel')` used for zero-latency, cross-tab communication.
- When a customer submits a reservation in `src/App.vue`:
  ```javascript
  const channel = new BroadcastChannel('kickcraft_reservations_channel')
  channel.postMessage({ type: 'NEW_RESERVATION', reservation: res.reservation })
  ```
- In `src/components/AdminPanel.vue`, listener prepends the reservation to the reactive list and triggers the floating alert.

### 3.2 Floating Alert Toast Component
- Positioned fixed in the top-right corner (`fixed right-6 top-6 z-50`).
- Brutalist high-contrast banner displaying:
  - Header: `NEW RESERVATION RECEIVED`
  - Content: `[Customer Name] reserved [Shoe Model]`
  - Subtitle: `Receipt Reference (KC-YYYY-XXXX) · Scheduled Pickup: [Date]`
  - Actions: `View Details` (opens inspection modal) and `Close` (dismisses alert).
- Auto-dismisses after 12 seconds if not interacted with.

---

## 4. Reservation Details & 3D Design Inspection Modal

### 4.1 Content Structure
- **Receipt & Status Header:** Reference ID (`KC-YYYY-XXXX`), date placed, and scheduled pickup date countdown.
- **Customer Information:** Full Name and Email Address.
- **Shoe Specifications:** Silhouette Name, Thumbnail, US Size, Price, and 3D Charm Accessory label.
- **3D Design Color Palette Breakdown:**
  Visual cards for each customized part (Upper, Toe Cap, Tongue, Laces, Heel Panel, Midsole, Outsole, etc.):
  - Part name
  - Exact hex color swatch
  - Color name (e.g., Cobalt, Chalk, Forest Green)
- **Status Workflow Actions:**
  - `Mark as Arrived`: Transitions status from `pending` to `arrived`.
  - `Mark as Completed`: Transitions status from `arrived` to `completed`.
  - `Cancel Reservation`: Transitions status to `cancelled`.
  - `Delete Record`: Only enabled when status is `cancelled`. Prompts `ConfirmModal` before calling soft-delete endpoint.

---

## 5. Customer Self-Cancellation & Owner Deletion

### 5.1 Customer Cancellation (`Pending` State Only)
- In customer's "My Reservations" dashboard (`src/App.vue`), reservations in `pending` status render a `Cancel Reservation` button.
- Triggers `ConfirmModal` before executing status change.
- Calls `api/reservations/update-status.php` with status `cancelled`.
- Increments shoe inventory stock back by 1.
- Broadcasts event to instantly update owner reservations panel.

### 5.2 Owner Record Deletion
- Only available for reservations marked `cancelled`.
- Triggers `ConfirmModal` before executing.
- Handled by `api/reservations/delete.php` using prepared statements:
  ```sql
  UPDATE reservations SET deleted_at = NOW(), permanently_deleted = 1 WHERE id = ?
  ```
- Zero physical `DELETE FROM` statements.
- The record is hidden from the active reservations list and archived in database.

---

## 6. Database & Backend API Updates

1. **`api/database/setup.sql`**:
   - Add `deleted_at` and `permanently_deleted` columns to `reservations` table:
     ```sql
     ALTER TABLE reservations ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL;
     ALTER TABLE reservations ADD COLUMN permanently_deleted TINYINT(1) NOT NULL DEFAULT 0;
     ```
   - Update `status` ENUM to include `'arrived'`:
     ```sql
     ALTER TABLE reservations MODIFY COLUMN status ENUM('pending', 'arrived', 'completed', 'cancelled', 'paid', 'approved', 'ready') NOT NULL DEFAULT 'pending';
     ```
2. **`api/reservations/list.php`**:
   - Filter out deleted records: `WHERE deleted_at IS NULL AND permanently_deleted = 0`.
3. **`api/reservations/update-status.php`**:
   - Add `'arrived'` to `$allowedStatuses`.
   - Allow customer sessions to set status to `'cancelled'` for their own reservations if current status is `'pending'`.
   - Restore stock on cancellation (`UPDATE shoes SET stock = stock + 1`).
4. **`api/reservations/delete.php` [NEW]**:
   - Requires owner session (`requireAdmin()`).
   - Soft deletes reservation with `permanently_deleted = 1` and `deleted_at = NOW()`.

---

## 7. Testing & Verification Plan

1. **Backend Tests (`test/backend-reservations.test.js`):**
   - Support for `'arrived'` status in `update-status.php`.
   - Customer self-cancellation of pending reservations and stock restoral.
   - Owner soft-delete of cancelled reservations with zero `DELETE FROM` statements.
2. **Admin Panel Tests (`test/admin-reservations.test.js`):**
   - Verify removal of revenue metric cards and silhouette breakdown.
   - Verify Reservations tab, status filters, and search bar.
   - Verify real-time notification banner and inspection modal rendering with 3D color swatches.
3. **Customer Cancellation Tests (`test/customer-reservations-view.test.js`):**
   - Verify `Cancel Reservation` button renders only for `pending` reservations.
   - Verify confirmation modal triggers and updates status.
4. **Full Test Suite & Build:**
   - Run `npm test` (all 143+ tests green).
   - Run `npm run build` (clean Vite bundle).
