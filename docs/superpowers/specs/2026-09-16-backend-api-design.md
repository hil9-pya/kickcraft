# KickCraft PHP + MySQL Backend Design Specification

**Date:** 2026-09-16
**Topic:** Full backend persistence — PHP API, MySQL database, secure authentication
**Status:** Approved by user

---

## 1. Executive Summary

KickCraft is transitioning from a frontend-only localStorage prototype to a fully persistent backend powered by PHP (served via XAMPP Apache) and MySQL. This specification covers:

- MySQL database schema for users, shoes, and reservations
- PHP REST API with flat-file endpoint structure and shared helpers
- Secure authentication via PHP native sessions with bcrypt password hashing
- SQL injection prevention through PDO prepared statements (zero string concatenation)
- Soft delete and hard delete for shoes and user accounts (no physical row deletion)
- Frontend integration replacing all localStorage calls with API fetch requests
- Vite dev proxy for seamless local development

---

## 2. Architecture

```text
┌──────────────────────────────┐
│  Vue 3 Frontend (Vite)       │
│  Tailwind · model-viewer     │
│  src/api.js fetch wrapper    │
└──────────┬───────────────────┘
           │ HTTP JSON (credentials: include)
           │ PHPSESSID cookie
           ▼
┌──────────────────────────────┐
│  PHP API (Apache / XAMPP)    │
│  api/config.php              │
│  api/db.php (PDO singleton)  │
│  api/helpers.php             │
│  api/auth/*.php              │
│  api/reservations/*.php      │
│  api/shoes/*.php             │
└──────────┬───────────────────┘
           │ PDO Prepared Statements
           ▼
┌──────────────────────────────┐
│  MySQL (XAMPP)               │
│  kickcraft_db                │
│  Tables: users, shoes,       │
│          reservations        │
└──────────────────────────────┘
```

---

## 3. MySQL Database Schema

### 3.1 `users` Table

```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('customer', 'owner') NOT NULL DEFAULT 'customer',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  permanently_deleted TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 3.2 `shoes` Table

```sql
CREATE TABLE shoes (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL DEFAULT 4890.00,
  stock INT NOT NULL DEFAULT 0,
  status ENUM('available', 'coming_soon', 'out_of_stock') NOT NULL DEFAULT 'available',
  glb_path VARCHAR(500) NOT NULL,
  thumbnail_path VARCHAR(500) DEFAULT '/images/kickcraft-one-card.png',
  charms_enabled TINYINT(1) NOT NULL DEFAULT 1,
  charm_offset VARCHAR(100) DEFAULT NULL,
  charm_scale VARCHAR(100) DEFAULT '1 1 1',
  charm_dir VARCHAR(500) DEFAULT NULL,
  categories JSON NOT NULL,
  parts JSON NOT NULL,
  colors JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  permanently_deleted TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 3.3 `reservations` Table

```sql
CREATE TABLE reservations (
  id VARCHAR(64) PRIMARY KEY,
  customer_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  pickup_date DATE NOT NULL,
  shoe_id VARCHAR(100) NOT NULL,
  shoe_name VARCHAR(255) NOT NULL,
  size INT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  part_colors JSON NOT NULL,
  charm_id VARCHAR(50) NOT NULL DEFAULT 'none',
  charm_label VARCHAR(50) NOT NULL DEFAULT 'None',
  status ENUM('pending', 'paid', 'approved', 'ready', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
  payment_method VARCHAR(50) NOT NULL DEFAULT 'in_store',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

Reservations are never deleted — they are historical records. The `cancelled` status serves the equivalent purpose.

### 3.4 Soft Delete & Hard Delete Behavior

| Action | `deleted_at` | `permanently_deleted` | Visible? | Restorable? |
|--------|-------------|----------------------|----------|-------------|
| Active | `NULL` | `0` | Yes | N/A |
| Archived (soft delete) | Timestamp | `0` | No | Yes |
| Permanently deleted | Timestamp | `1` | No | No |

- All public `SELECT` queries filter with `WHERE deleted_at IS NULL AND permanently_deleted = 0`.
- Admin panel provides an "Archived" filter to view and restore soft-deleted shoes and accounts.
- No row is ever physically removed with `DELETE FROM`.

### 3.5 Seed Data

The `setup.sql` script inserts:

1. **Owner account**: created once from `api/.env` with `database/create-owner.php`; no password is stored in the repository.
2. **3 shoes**: KickCraft One (8 parts, 50 stock), Nike Air Max (3 parts, 50 stock), Nike Dunk (3 parts, 50 stock) — with full parts JSON, colors JSON, and categories JSON matching current `customization.js` definitions.
3. **4 sample reservations**: Matching the current `loadInitialOrders()` seed data in `financials.js` (KC-2026-1041 through KC-2026-1044).

---

## 4. PHP API Endpoints

### 4.1 Shared Infrastructure

#### `api/config.php`
- Loads credentials from `api/.env` (git-ignored).
- Calls `session_start()` with secure cookie settings (`httponly`, `SameSite=Lax`).
- Sets CORS headers: `Access-Control-Allow-Origin: http://localhost:5173`, `Access-Control-Allow-Credentials: true`, `Access-Control-Allow-Headers: Content-Type`.
- Sets `Content-Type: application/json`.

#### `api/db.php`
- Returns a PDO singleton connection to `kickcraft_db`.
- `PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION`
- `PDO::ATTR_EMULATE_PREPARES => false` (forces real server-side prepared statements).
- `PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC`

#### `api/helpers.php`
- `jsonResponse($data, $statusCode = 200)` — sends JSON with HTTP status and exits.
- `jsonError($message, $statusCode = 400)` — sends error JSON and exits.
- `requireMethod($method)` — returns 405 if request method doesn't match.
- `requireAdmin()` — checks `$_SESSION['user_role'] === 'owner'`, returns 401 if no session or 403 if not owner.
- `requireAuth()` — checks any valid session exists, returns 401 if not.
- `getJsonBody()` — decodes `php://input` as JSON, returns associative array.
- `sanitizeString($input)` — `trim()` and `htmlspecialchars()`.
- `validateEmail($email)` — `filter_var(FILTER_VALIDATE_EMAIL)`.

### 4.2 Authentication Endpoints

#### `POST /api/auth/login.php`
- **Auth**: None
- **Body**: `{ email, password }`
- **Behavior**:
  1. Validate email format and non-empty password.
  2. Query `users` (excluding deleted) by email.
  3. Verify password with `password_verify()`.
  4. `session_regenerate_id(true)` to prevent session fixation.
  5. Store `$_SESSION['user_id']`, `$_SESSION['user_email']`, `$_SESSION['user_name']`, `$_SESSION['user_role']`.
  6. Return `{ success: true, user: { id, name, email, role } }`.
- **Errors**: 401 on invalid credentials.

#### `POST /api/auth/logout.php`
- **Auth**: Any
- **Behavior**: `session_unset()`, `session_destroy()`, clear cookie.
- **Returns**: `{ success: true }`.

#### `GET /api/auth/session.php`
- **Auth**: Any
- **Behavior**: If session exists, returns `{ authenticated: true, user: { id, name, email, role } }`. Otherwise `{ authenticated: false }`.

#### `POST /api/auth/register.php`
- **Auth**: None
- **Body**: `{ name, email, password }`
- **Behavior**:
  1. Validate name (non-empty), email (valid format, unique), password (min 6 chars).
  2. Hash password with `password_hash($password, PASSWORD_BCRYPT)`.
  3. Insert into `users` with `role = 'customer'`.
  4. Return `{ success: true, message: 'Account created' }`.
- **Errors**: 409 if email already exists.

### 4.3 Reservation Endpoints

#### `POST /api/reservations/create.php`
- **Auth**: None (customers don't need accounts per AGENTS.md)
- **Body**: `{ customerName, email, pickupDate, shoeId, size, partColors, charmId, charmLabel }`
- **Behavior**:
  1. Validate all fields server-side (name non-empty, email valid, pickupDate not in past, size in [7-11], shoeId exists and has stock).
  2. Generate receipt ID (`KC-YYYY-XXXX` format).
  3. Look up shoe name and price from `shoes` table (never trust browser-sent price).
  4. `INSERT INTO reservations` with prepared statement.
  5. `UPDATE shoes SET stock = stock - 1` (and auto-set `out_of_stock` if stock reaches 0).
  6. Both operations in a MySQL transaction.
  7. Return `{ success: true, reservation: { id, ... } }`.

#### `GET /api/reservations/list.php`
- **Auth**: Owner only
- **Query params**: Optional `?status=pending&search=alex`
- **Behavior**: Select all reservations with optional filtering. Return `{ reservations: [...] }`.

#### `POST /api/reservations/update-status.php`
- **Auth**: Owner only
- **Body**: `{ id, status }`
- **Behavior**:
  1. Validate status is one of `['pending', 'paid', 'approved', 'ready', 'completed', 'cancelled']`.
  2. `UPDATE reservations SET status = ? WHERE id = ?` with prepared statement.
  3. Return `{ success: true, reservation: { id, status } }`.

### 4.4 Shoe Endpoints

#### `GET /api/shoes/list.php`
- **Auth**: None (public catalog)
- **Query params**: Optional `?include_archived=1` (admin only — returns soft-deleted shoes)
- **Behavior**: Select all active shoes (`deleted_at IS NULL AND permanently_deleted = 0`). If `include_archived=1` and user is owner, also include soft-deleted. Return `{ shoes: [...] }`.

#### `POST /api/shoes/create.php`
- **Auth**: Owner only
- **Body**: `{ id, name, description, price, stock, status, glbPath, thumbnailPath, charmsEnabled, categories, parts, colors }`
- **Behavior**: Validate, slugify ID, insert with prepared statement.

#### `POST /api/shoes/update.php`
- **Auth**: Owner only
- **Body**: `{ id, ...fieldsToUpdate }`
- **Behavior**: Validate, update only provided fields.

#### `POST /api/shoes/restock.php`
- **Auth**: Owner only
- **Body**: `{ id, amount }`
- **Behavior**: `UPDATE shoes SET stock = stock + ? WHERE id = ?`. Auto-set status to `'available'` if was `'out_of_stock'`.

#### `POST /api/shoes/delete.php`
- **Auth**: Owner only
- **Body**: `{ id, mode }` where mode is `'soft'` or `'hard'`
- **Behavior**:
  - `soft`: `UPDATE shoes SET deleted_at = NOW() WHERE id = ?`
  - `hard`: `UPDATE shoes SET deleted_at = NOW(), permanently_deleted = 1 WHERE id = ?`

#### `POST /api/shoes/restore.php`
- **Auth**: Owner only
- **Body**: `{ id }`
- **Behavior**: `UPDATE shoes SET deleted_at = NULL WHERE id = ? AND permanently_deleted = 0`

### 4.5 User Management Endpoints (Admin)

#### `GET /api/auth/users.php`
- **Auth**: Owner only
- **Query params**: Optional `?include_archived=1`
- **Behavior**: List all users (excluding permanently deleted by default).

#### `POST /api/auth/delete-user.php`
- **Auth**: Owner only
- **Body**: `{ id, mode }` where mode is `'soft'` or `'hard'`
- **Behavior**: Same soft/hard delete pattern as shoes. Cannot delete own account.

#### `POST /api/auth/restore-user.php`
- **Auth**: Owner only
- **Body**: `{ id }`
- **Behavior**: Restore soft-deleted user.

---

## 5. Security Checklist

1. **SQL Injection**: PDO prepared statements on every query. `EMULATE_PREPARES = false`.
2. **Password Storage**: `password_hash(PASSWORD_BCRYPT)` / `password_verify()`.
3. **Session Fixation**: `session_regenerate_id(true)` on login.
4. **Session Hijacking**: `httponly`, `SameSite=Lax` cookie attributes.
5. **Authorization Bypass**: `requireAdmin()` gate on every admin endpoint.
6. **Price/Status Tampering**: Shoe price looked up from database, never from browser. Status validated against allowed enum.
7. **XSS in Stored Data**: `htmlspecialchars()` on string inputs before storage.
8. **CORS**: Restricted to known origins.
9. **Credentials in Code**: Database credentials in `api/.env`, git-ignored. Admin password bcrypt-hashed in seed SQL.
10. **No Physical Deletion**: All deletes are soft or hard (flag-based). Database rows always preserved.

---

## 6. Frontend Integration

### 6.1 New File: `src/api.js`
Thin `fetch()` wrapper that:
- Prepends `/api/` to endpoints.
- Sets `Content-Type: application/json` and `credentials: 'include'`.
- Parses JSON response and throws on HTTP errors.

### 6.2 Modified Files

| File | Changes |
|------|---------|
| `vite.config.js` | Add `/api` proxy to `http://localhost/kickcraft` for dev. |
| `src/App.vue` | Replace localStorage auth with real `POST /api/auth/login.php`. On mount, call `GET /api/auth/session.php`. `submitReservation()` calls `POST /api/reservations/create.php`. Shoe catalog fetched from `GET /api/shoes/list.php`. |
| `src/components/AdminPanel.vue` | All CRUD calls go through API. Orders loaded from `GET /api/reservations/list.php`. Status changes via `POST /api/reservations/update-status.php`. Shoe CRUD via shoes endpoints. Add archived tab for soft-deleted items. |
| `src/admin.js` | Remove `getStoredShoes()` / `setStoredShoes()` localStorage functions. Keep `validateShoe()`, `slugify()`, `adminShoeToCatalogCard()` as client-side utilities. |
| `src/financials.js` | Remove `getStoredOrders()` / `setStoredOrders()` / `loadInitialOrders()` localStorage functions. Keep `calculateFinancialStats()`, `calculateSilhouetteBreakdown()`, `generateReceiptId()` as pure computation helpers (receipt ID also generated server-side). |

### 6.3 UI States
- **Loading**: Spinner or skeleton shown while API requests are in-flight.
- **Error**: Toast or inline message for network failures and validation errors.
- **Empty**: "No reservations yet" / "No shoes in catalog" messages.
- **Success**: Confirmation messages after successful operations.

---

## 7. XAMPP Setup & Deployment

### 7.1 Development
```
npm run dev          → Vite on :5173, proxies /api to Apache
XAMPP Apache         → Serves api/ from htdocs/kickcraft/api/
XAMPP MySQL          → kickcraft_db on port 3306
```

### 7.2 Production
```
npm run build        → Outputs dist/
C:\xampp\htdocs\kickcraft\
├── api/             ← PHP backend
├── dist/            ← Built Vue app
└── .htaccess        ← Routes to dist/index.html for SPA
```

### 7.3 Git-Ignored Files
- `api/.env`
- `node_modules/`
- `dist/`
- `.superpowers/`

---

## 8. Verification Plan

1. **Database**: Run `setup.sql` in phpMyAdmin → verify 3 tables, seed data present.
2. **Auth flow**: Login as admin → session persists on reload → logout destroys session.
3. **Reservation flow**: Customer submits reservation → appears in admin panel → status updated.
4. **Shoe CRUD**: Create, edit, restock, soft-delete, restore, hard-delete shoe.
5. **SQL injection**: Attempt `' OR 1=1 --` in name/email fields → safely handled.
6. **Authorization**: Call admin endpoints without session → 401. Call as customer → 403.
7. **Soft/hard delete**: Verify archived items hidden from public, restorable by admin, hard-deleted items hidden permanently.
8. **Existing tests**: `npm test` passes (adjust localStorage-dependent tests).
9. **Production build**: `npm run build` compiles cleanly.
