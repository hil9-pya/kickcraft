# KickCraft PHP + MySQL Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a complete, secure, and persistent backend for KickCraft using PHP (XAMPP Apache compatible) and MySQL (`kickcraft_db`), replacing all frontend localStorage stores with API endpoints, PDO prepared statements, native session auth, soft/hard deletion, and real database persistence.

**Architecture:** 
- Database: MySQL running locally (XAMPP `kickcraft_db`) with tables `users`, `shoes`, `reservations`.
- API: Flat PHP endpoints under `api/` with shared `config.php`, `db.php` (PDO singleton, emulated prepares disabled), and `helpers.php`.
- Security: PDO prepared statements on 100% of queries, bcrypt passwords, PHP native sessions (`httponly`, `SameSite=Lax`), server-side price lookup and field validation.
- Deletion: Soft delete (`deleted_at`) and hard delete (`permanently_deleted = 1`) with zero physical `DELETE FROM` operations.
- Frontend: `src/api.js` fetch wrapper, Vite dev proxy, full integration in `src/App.vue` and `src/components/AdminPanel.vue`.

**Tech Stack:** PHP 8.x, MySQL, PDO, Vue 3 `<script setup>`, Vite, Tailwind CSS, Node.js test runner.

**Spec:** [docs/superpowers/specs/2026-09-16-backend-api-design.md](file:///c:/Users/kinglebron/Desktop/Git%20uploads/kickcraft/docs/superpowers/specs/2026-09-16-backend-api-design.md)

## Global Constraints
- Zero physical SQL `DELETE FROM` statements across the codebase. All deletion must use `deleted_at` and `permanently_deleted`.
- 100% of database queries MUST use PDO prepared statements with parameter binding. Zero SQL string interpolation.
- Emulated prepared statements MUST be disabled (`PDO::ATTR_EMULATE_PREPARES => false`).
- Passwords must be hashed with `password_hash(..., PASSWORD_BCRYPT)`.
- Admin endpoints must call `requireAdmin()` verifying `$_SESSION['user_role'] === 'owner'`.
- Never trust client-sent prices or statuses: unit prices must be verified against the `shoes` table in MySQL during reservation creation.
- `npm test` must continue to pass with all existing and new test suites.
- `npm run build` must build cleanly without errors.

---

### Task 1: Database Setup Script & Shared PHP Infrastructure

**Files:**
- Create: `api/database/setup.sql`
- Create: `api/.env.example`
- Create: `api/.env`
- Create: `api/config.php`
- Create: `api/db.php`
- Create: `api/helpers.php`
- Create: `api/.htaccess`
- Test: `test/backend-infra.test.js`

**Interfaces:**
- `getDb()` in `api/db.php` returns a `PDO` instance configured with `ERRMODE_EXCEPTION` and `EMULATE_PREPARES => false`.
- `jsonResponse($data, $statusCode = 200)` in `api/helpers.php`
- `jsonError($message, $statusCode = 400)` in `api/helpers.php`
- `requireMethod($method)` in `api/helpers.php`
- `requireAuth()` in `api/helpers.php`
- `requireAdmin()` in `api/helpers.php`
- `getJsonBody()` in `api/helpers.php`

- [ ] **Step 1: Write failing automated tests for backend infrastructure**

Create `test/backend-infra.test.js`:
```javascript
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('Database setup SQL exists and defines tables with soft delete columns', () => {
  const sqlPath = path.resolve('api/database/setup.sql')
  assert.ok(fs.existsSync(sqlPath), 'setup.sql must exist')
  const sql = fs.readFileSync(sqlPath, 'utf8')
  assert.match(sql, /CREATE TABLE (IF NOT EXISTS )?users/i)
  assert.match(sql, /CREATE TABLE (IF NOT EXISTS )?shoes/i)
  assert.match(sql, /CREATE TABLE (IF NOT EXISTS )?reservations/i)
  assert.match(sql, /deleted_at TIMESTAMP NULL/i)
  assert.match(sql, /permanently_deleted TINYINT/i)
  assert.doesNotMatch(sql, /DELETE FROM/i, 'Setup script should not perform physical deletes')
})

test('Shared PHP infrastructure files exist with prepared statement enforcement', () => {
  const dbPath = path.resolve('api/db.php')
  assert.ok(fs.existsSync(dbPath), 'api/db.php must exist')
  const dbCode = fs.readFileSync(dbPath, 'utf8')
  assert.match(dbCode, /ATTR_EMULATE_PREPARES/i)
  assert.match(dbCode, /ATTR_ERRMODE/i)

  const helpersPath = path.resolve('api/helpers.php')
  assert.ok(fs.existsSync(helpersPath), 'api/helpers.php must exist')
  const helpersCode = fs.readFileSync(helpersPath, 'utf8')
  assert.match(helpersCode, /function jsonResponse/i)
  assert.match(helpersCode, /function jsonError/i)
  assert.match(helpersCode, /function requireAdmin/i)
  assert.match(helpersCode, /function getJsonBody/i)
})
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npm.cmd test`
Expected: FAIL (missing `api/database/setup.sql` and `api/db.php`)

- [ ] **Step 3: Implement `api/database/setup.sql`**
Write schema with `users`, `shoes`, `reservations` tables, soft delete columns, and initial seed data (3 initial shoes with JSON parts/colors/categories and 4 sample reservations). Bootstrap the owner account from ignored `api/.env` using `database/create-owner.php`.

- [ ] **Step 4: Implement `api/config.php`, `api/db.php`, `api/helpers.php`, and `api/.env.example`**
Ensure `api/config.php` starts session with secure cookie flags, parses `api/.env`, sets CORS headers for `http://localhost:5173`. Ensure `api/db.php` exports singleton PDO with real prepared statements. Ensure `api/helpers.php` implements auth check, json response, and body parsing.

- [ ] **Step 5: Run tests and commit Task 1**
Run: `npm.cmd test`
Expected: PASS
Commit:
```bash
git add api/ test/backend-infra.test.js
git commit -m "feat(backend): add database schema, config, PDO singleton, and shared helpers"
```

---

### Task 2: Authentication & User Management Endpoints

**Files:**
- Create: `api/auth/login.php`
- Create: `api/auth/logout.php`
- Create: `api/auth/session.php`
- Create: `api/auth/register.php`
- Create: `api/auth/users.php`
- Create: `api/auth/delete-user.php`
- Create: `api/auth/restore-user.php`
- Test: `test/backend-auth.test.js`

**Interfaces:**
- `POST /api/auth/login.php`: Body `{ email, password }` -> Returns `{ success: true, user: { id, name, email, role } }`
- `POST /api/auth/logout.php`: Returns `{ success: true }`
- `GET /api/auth/session.php`: Returns `{ authenticated: boolean, user?: object }`
- `POST /api/auth/register.php`: Body `{ name, email, password }` -> Returns `{ success: true }`
- `GET /api/auth/users.php`: Query `?include_archived=1` -> Admin only, returns `{ users: [...] }`
- `POST /api/auth/delete-user.php`: Body `{ id, mode: 'soft'|'hard' }` -> Admin only, sets `deleted_at` or `permanently_deleted`
- `POST /api/auth/restore-user.php`: Body `{ id }` -> Admin only, clears `deleted_at`

- [ ] **Step 1: Write failing automated tests for auth endpoints**

Create `test/backend-auth.test.js`:
```javascript
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('Auth endpoints exist and use prepared statements and bcrypt', () => {
  const loginPath = path.resolve('api/auth/login.php')
  assert.ok(fs.existsSync(loginPath), 'login.php must exist')
  const loginCode = fs.readFileSync(loginPath, 'utf8')
  assert.match(loginCode, /password_verify/i)
  assert.match(loginCode, /prepare\(/i)
  assert.match(loginCode, /session_regenerate_id/i)

  const registerPath = path.resolve('api/auth/register.php')
  assert.ok(fs.existsSync(registerPath), 'register.php must exist')
  const registerCode = fs.readFileSync(registerPath, 'utf8')
  assert.match(registerCode, /password_hash/i)
  assert.match(registerCode, /PASSWORD_BCRYPT/i)
  assert.match(registerCode, /prepare\(/i)

  const usersPath = path.resolve('api/auth/users.php')
  assert.ok(fs.existsSync(usersPath), 'users.php must exist')
  const usersCode = fs.readFileSync(usersPath, 'utf8')
  assert.match(usersCode, /requireAdmin/i)
  assert.match(usersCode, /deleted_at/i)
})
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npm.cmd test`
Expected: FAIL (missing `api/auth/*.php`)

- [ ] **Step 3: Implement `api/auth/login.php`, `logout.php`, `session.php`, `register.php`**
Implement secure authentication flow:
- `login.php`: validate inputs, prepare `SELECT id, name, email, password_hash, role FROM users WHERE email = ? AND deleted_at IS NULL AND permanently_deleted = 0`, verify hash, regenerate session id, assign session variables.
- `logout.php`: destroy session, unset cookies.
- `session.php`: check `$_SESSION['user_id']`, return user object or unauthenticated.
- `register.php`: validate name, email, password length >= 6, hash with bcrypt, prepare `INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'customer')`.

- [ ] **Step 4: Implement `api/auth/users.php`, `delete-user.php`, `restore-user.php`**
- `users.php`: `requireAdmin()`, query non-permanently deleted users (include soft-deleted if `include_archived=1`).
- `delete-user.php`: `requireAdmin()`, prevent self-deletion, update `deleted_at = NOW()` for soft delete or `permanently_deleted = 1` for hard delete.
- `restore-user.php`: `requireAdmin()`, update `deleted_at = NULL WHERE id = ? AND permanently_deleted = 0`.

- [ ] **Step 5: Run tests and commit Task 2**
Run: `npm.cmd test`
Expected: PASS
Commit:
```bash
git add api/auth/ test/backend-auth.test.js
git commit -m "feat(auth): implement PHP session authentication and user management with soft delete"
```

---

### Task 3: Shoe Catalog Endpoints

**Files:**
- Create: `api/shoes/list.php`
- Create: `api/shoes/create.php`
- Create: `api/shoes/update.php`
- Create: `api/shoes/restock.php`
- Create: `api/shoes/delete.php`
- Create: `api/shoes/restore.php`
- Test: `test/backend-shoes.test.js`

**Interfaces:**
- `GET /api/shoes/list.php`: Query `?include_archived=1` -> Returns `{ shoes: [...] }`
- `POST /api/shoes/create.php`: Body `{ id, name, description, price, stock, status, glbPath, thumbnailPath, charmsEnabled, categories, parts, colors }` -> Admin only, returns `{ success: true, shoe: {...} }`
- `POST /api/shoes/update.php`: Body `{ id, ...updates }` -> Admin only, returns `{ success: true, shoe: {...} }`
- `POST /api/shoes/restock.php`: Body `{ id, amount }` -> Admin only, returns `{ success: true, stock: number }`
- `POST /api/shoes/delete.php`: Body `{ id, mode: 'soft'|'hard' }` -> Admin only, sets `deleted_at` or `permanently_deleted`
- `POST /api/shoes/restore.php`: Body `{ id }` -> Admin only, clears `deleted_at`

- [ ] **Step 1: Write failing automated tests for shoe endpoints**

Create `test/backend-shoes.test.js`:
```javascript
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('Shoe endpoints exist and enforce prepared statements and admin checks', () => {
  const listPath = path.resolve('api/shoes/list.php')
  assert.ok(fs.existsSync(listPath), 'shoes/list.php must exist')
  const listCode = fs.readFileSync(listPath, 'utf8')
  assert.match(listCode, /deleted_at IS NULL/i)

  const deletePath = path.resolve('api/shoes/delete.php')
  assert.ok(fs.existsSync(deletePath), 'shoes/delete.php must exist')
  const deleteCode = fs.readFileSync(deletePath, 'utf8')
  assert.match(deleteCode, /requireAdmin/i)
  assert.match(deleteCode, /deleted_at/i)
  assert.match(deleteCode, /permanently_deleted/i)
  assert.doesNotMatch(deleteCode, /DELETE FROM/i, 'Zero DELETE FROM statements allowed')

  const restockPath = path.resolve('api/shoes/restock.php')
  assert.ok(fs.existsSync(restockPath), 'shoes/restock.php must exist')
  const restockCode = fs.readFileSync(restockPath, 'utf8')
  assert.match(restockCode, /requireAdmin/i)
  assert.match(restockCode, /stock \+/i)
})
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npm.cmd test`
Expected: FAIL (missing `api/shoes/*.php`)

- [ ] **Step 3: Implement all 6 shoe endpoints**
Implement with PDO prepared statements, JSON encoding/decoding of `parts`, `colors`, `categories`, and soft/hard delete modes.

- [ ] **Step 4: Run tests and commit Task 3**
Run: `npm.cmd test`
Expected: PASS
Commit:
```bash
git add api/shoes/ test/backend-shoes.test.js
git commit -m "feat(shoes): implement PHP shoe catalog CRUD, restock, soft/hard delete and restore"
```

---

### Task 4: Reservation & Sales Endpoints

**Files:**
- Create: `api/reservations/create.php`
- Create: `api/reservations/list.php`
- Create: `api/reservations/update-status.php`
- Test: `test/backend-reservations.test.js`

**Interfaces:**
- `POST /api/reservations/create.php`: Body `{ customerName, email, pickupDate, shoeId, size, partColors, charmId, charmLabel, paymentMethod, notes, status }` -> Validates server-side, queries shoe price from DB, decrements stock in transaction, returns `{ success: true, reservation: {...} }`
- `GET /api/reservations/list.php`: Query `?status=...&search=...` -> Admin only, returns `{ reservations: [...] }`
- `POST /api/reservations/update-status.php`: Body `{ id, status }` -> Admin only, updates status

- [ ] **Step 1: Write failing automated tests for reservation endpoints**

Create `test/backend-reservations.test.js`:
```javascript
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('Reservation endpoints exist with transaction and validation logic', () => {
  const createPath = path.resolve('api/reservations/create.php')
  assert.ok(fs.existsSync(createPath), 'reservations/create.php must exist')
  const createCode = fs.readFileSync(createPath, 'utf8')
  assert.match(createCode, /beginTransaction/i)
  assert.match(createCode, /commit/i)
  assert.match(createCode, /SELECT price.*FROM shoes/i, 'Price must be checked from database')
  assert.match(createCode, /UPDATE shoes SET stock/i, 'Stock must be decremented on reservation')

  const listPath = path.resolve('api/reservations/list.php')
  assert.ok(fs.existsSync(listPath), 'reservations/list.php must exist')
  const listCode = fs.readFileSync(listPath, 'utf8')
  assert.match(listCode, /requireAdmin/i)
})
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npm.cmd test`
Expected: FAIL (missing `api/reservations/*.php`)

- [ ] **Step 3: Implement reservation endpoints**
Implement with full database transaction in `create.php`, receipt ID formatting (`KC-YYYY-XXXX`), shoe price lookup, stock decrement, and admin filters in `list.php`.

- [ ] **Step 4: Run tests and commit Task 4**
Run: `npm.cmd test`
Expected: PASS
Commit:
```bash
git add api/reservations/ test/backend-reservations.test.js
git commit -m "feat(reservations): implement transaction-safe reservation creation, listing, and status updates"
```

---

### Task 5: Frontend API Client & Vite Dev Proxy

**Files:**
- Create: `src/api.js`
- Modify: `vite.config.js`
- Test: `test/frontend-api.test.js`

**Interfaces:**
- `api(endpoint, options)` in `src/api.js` wraps `fetch('/api/' + endpoint)` with `credentials: 'include'` and JSON error handling.

- [ ] **Step 1: Write failing test for `src/api.js` and `vite.config.js`**

Create `test/frontend-api.test.js`:
```javascript
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('src/api.js exports api fetch wrapper with credentials include', () => {
  const apiPath = path.resolve('src/api.js')
  assert.ok(fs.existsSync(apiPath), 'src/api.js must exist')
  const code = fs.readFileSync(apiPath, 'utf8')
  assert.match(code, /credentials:\s*['"]include['"]/i)
  assert.match(code, /export async function api/i)
})

test('vite.config.js contains /api proxy configuration', () => {
  const vitePath = path.resolve('vite.config.js')
  const code = fs.readFileSync(vitePath, 'utf8')
  assert.match(code, /proxy:\s*\{/i)
  assert.match(code, /['"]\/api['"]/i)
})
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npm.cmd test`
Expected: FAIL

- [ ] **Step 3: Implement `src/api.js` and update `vite.config.js`**
Write `src/api.js` and add `/api` proxy target `http://localhost/kickcraft` in `vite.config.js`.

- [ ] **Step 4: Run tests and commit Task 5**
Run: `npm.cmd test`
Expected: PASS
Commit:
```bash
git add src/api.js vite.config.js test/frontend-api.test.js
git commit -m "feat(frontend): create api fetch client and configure Vite dev proxy for PHP backend"
```

---

### Task 6: Frontend Integration - Customer & Auth Flows (`src/App.vue`)

**Files:**
- Modify: `src/App.vue`
- Test: `test/app-backend-integration.test.js`

**Interfaces:**
- On mount: call `api('auth/session.php')` to restore logged in user session.
- On mount: call `api('shoes/list.php')` to populate catalog and studio shoes.
- Login: `handleLoginSubmit()` calls `api('auth/login.php', { method: 'POST', body: { email, password } })`.
- Register: `handleRegisterSubmit()` calls `api('auth/register.php', { method: 'POST', body: { name, email, password } })`.
- Logout: `handleLogout()` calls `api('auth/logout.php', { method: 'POST' })`.
- Reservation: `submitReservation()` calls `api('reservations/create.php', { method: 'POST', body: {...} })`.

- [ ] **Step 1: Write integration tests for App.vue backend calls**
Create `test/app-backend-integration.test.js` asserting `App.vue` imports `api` from `'./api.js'` and connects login, register, session check, catalog loading, and reservation submission to the API.

- [ ] **Step 2: Run test to verify it fails**
Run: `npm.cmd test`
Expected: FAIL

- [ ] **Step 3: Update `src/App.vue`**
Replace mock auth and mock submission with async API calls, error feedback states, loading states, and session persistence.

- [ ] **Step 4: Run tests and verify build**
Run: `npm.cmd test` and `npm.cmd run build`
Expected: PASS

- [ ] **Step 5: Commit Task 6**
```bash
git add src/App.vue test/app-backend-integration.test.js
git commit -m "feat(app): connect customer catalog, reservations, and authentication to PHP API"
```

---

### Task 7: Frontend Integration - Admin Panel Flows (`src/components/AdminPanel.vue`)

**Files:**
- Modify: `src/components/AdminPanel.vue`
- Test: `test/admin-backend-integration.test.js`

**Interfaces:**
- `loadData()`: fetches `api('shoes/list.php?include_archived=1')` and `api('reservations/list.php')`.
- `handleSaveShoe()`: calls `api('shoes/create.php')` or `api('shoes/update.php')`.
- `confirmRestock()`: calls `api('shoes/restock.php')`.
- `deleteShoe()`: modal gives options for soft delete (`api('shoes/delete.php', { mode: 'soft' })`) and hard delete (`api('shoes/delete.php', { mode: 'hard' })`).
- `restoreShoe()`: calls `api('shoes/restore.php')`.
- `handleOrderStatusChange()`: calls `api('reservations/update-status.php')`.
- `submitWalkInSale()`: calls `api('reservations/create.php')` with `status: 'paid'`.

- [ ] **Step 1: Write integration tests for AdminPanel.vue backend calls**
Create `test/admin-backend-integration.test.js` asserting `AdminPanel.vue` uses `api` client for shoes list, save, delete (soft/hard), restore, reservations list, status update, and walk-in sales.

- [ ] **Step 2: Run test to verify it fails**
Run: `npm.cmd test`
Expected: FAIL

- [ ] **Step 3: Update `src/components/AdminPanel.vue`**
Wire all admin panel operations to the API client, adding the Archived/Active toggle filter, soft/hard delete modal choices, and restore actions.

- [ ] **Step 4: Run tests and verify build**
Run: `npm.cmd test` and `npm.cmd run build`
Expected: PASS

- [ ] **Step 5: Commit Task 7**
```bash
git add src/components/AdminPanel.vue test/admin-backend-integration.test.js
git commit -m "feat(admin): wire admin panel shoe CRUD, soft/hard delete, restore, and sales ledger to PHP API"
```

---

### Task 8: Full Verification, Documentation & Walkthrough

**Files:**
- Modify: `walkthrough.md`
- Modify: `README.md`

- [ ] **Step 1: Run full automated test suite**
Run: `npm.cmd test` (ensure all tests pass).

- [ ] **Step 2: Run production build**
Run: `npm.cmd run build` (ensure clean compilation).

- [ ] **Step 3: Update walkthrough artifact and README with XAMPP setup instructions**
Document how to run `setup.sql` in phpMyAdmin or command line, configure Apache/MySQL in XAMPP, and test the full customer-to-admin workflow.

- [ ] **Step 4: Commit and finalize**
```bash
git add README.md
git commit -m "docs: add XAMPP backend setup guide and update walkthrough"
```
