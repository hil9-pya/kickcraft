# Financial Tracker & Sales History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Financial Tracker, Sales History, and Digital Receipt feature inside the Owner Admin Panel, automatically syncing with customer studio reservations and providing comprehensive revenue and inventory metrics.

**Architecture:**
- `src/financials.js`: Pure JavaScript module handling order persistence (`localStorage`), statistics computation (realized revenue, pending revenue, AOV, units sold, silhouette breakdown), and status toggling.
- `src/components/AdminPanel.vue`: Adds view navigation (`inventory` | `financials`), KPI cards, silhouette revenue breakdown, searchable order history table, walk-in sale modal, and digital receipt modal with print styling.
- `src/App.vue`: Connects customer reservation submission to `createOrder()`, immediately decrementing stock and recording a pending order in the owner's ledger.
- `test/financials.test.js`: Unit tests verifying calculation accuracy, order creation, status progression (`pending` → `paid`), and silhouette analytics.

**Tech Stack:** Vue 3, Tailwind CSS, Node.js test runner.

**Spec:** [docs/superpowers/specs/2026-09-15-financial-tracker-design.md](file:///c:/Users/kinglebron/Desktop/Git%20uploads/kickcraft/docs/superpowers/specs/2026-09-15-financial-tracker-design.md)

## Global Constraints

- No external backend or database calls (frontend state + `localStorage` persistence).
- Realized revenue must only sum orders with `status === 'paid'`.
- Customer orders must default to `status: 'pending'` until marked paid.
- Ensure all tests pass with `npm.cmd test` and build with `npm.cmd run build`.

---

### Task 1: Financial Logic, Order Store, and Unit Tests (`src/financials.js` & `test/financials.test.js`)

**Files:**
- Create: `test/financials.test.js`
- Create: `src/financials.js`

**Interfaces:**
- Produces:
  - `loadInitialOrders(): OrderRecord[]`
  - `getStoredOrders(): OrderRecord[]`
  - `setStoredOrders(orders: OrderRecord[]): void`
  - `createOrder(orderData: Partial<OrderRecord>): OrderRecord`
  - `updateOrderStatus(orders: OrderRecord[], orderId: string, status: 'pending' | 'paid' | 'cancelled'): OrderRecord[]`
  - `calculateFinancialStats(orders: OrderRecord[]): FinancialStats`
  - `calculateSilhouetteBreakdown(orders: OrderRecord[], shoes: Shoe[]): SilhouetteStat[]`
  - `generateReceiptId(): string`

- [ ] **Step 1: Write failing unit tests in `test/financials.test.js`**

```javascript
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateFinancialStats,
  calculateSilhouetteBreakdown,
  createOrder,
  generateReceiptId,
  loadInitialOrders,
  updateOrderStatus,
} from '../src/financials.js'

test('generateReceiptId creates standard KC-YYYY-XXXX format', () => {
  const id = generateReceiptId()
  assert.match(id, /^KC-2026-\d{4}$/)
})

test('calculateFinancialStats correctly calculates paid vs pending revenue', () => {
  const sampleOrders = [
    { id: '1', price: 4890, status: 'paid' },
    { id: '2', price: 4890, status: 'paid' },
    { id: '3', price: 5490, status: 'pending' },
    { id: '4', price: 4890, status: 'cancelled' },
  ]

  const stats = calculateFinancialStats(sampleOrders)
  assert.equal(stats.realizedRevenue, 9780)
  assert.equal(stats.pendingRevenue, 5490)
  assert.equal(stats.paidUnits, 2)
  assert.equal(stats.pendingUnits, 1)
  assert.equal(stats.cancelledUnits, 1)
  assert.equal(stats.aov, 4890)
})

test('updateOrderStatus transitions order from pending to paid and recalculates', () => {
  let orders = [
    { id: 'KC-1', price: 5000, status: 'pending' },
  ]
  orders = updateOrderStatus(orders, 'KC-1', 'paid')
  assert.equal(orders[0].status, 'paid')
  const stats = calculateFinancialStats(orders)
  assert.equal(stats.realizedRevenue, 5000)
  assert.equal(stats.pendingRevenue, 0)
})

test('calculateSilhouetteBreakdown aggregates sales per shoe model', () => {
  const sampleOrders = [
    { shoeId: 'kickcraft-one', shoeName: 'KickCraft One', price: 4890, status: 'paid' },
    { shoeId: 'kickcraft-one', shoeName: 'KickCraft One', price: 4890, status: 'paid' },
    { shoeId: 'nike-air-max', shoeName: 'Nike Air Max', price: 4890, status: 'paid' },
    { shoeId: 'nike-dunk', shoeName: 'Nike Dunk', price: 4890, status: 'pending' },
  ]

  const breakdown = calculateSilhouetteBreakdown(sampleOrders)
  const kickcraftOne = breakdown.find(b => b.shoeId === 'kickcraft-one')
  assert.equal(kickcraftOne.paidUnits, 2)
  assert.equal(kickcraftOne.revenue, 9780)

  const dunk = breakdown.find(b => b.shoeId === 'nike-dunk')
  assert.equal(dunk.paidUnits, 0)
  assert.equal(dunk.pendingUnits, 1)
})
```

- [ ] **Step 2: Run test to verify failure**

Run: `node --test test/financials.test.js`
Expected: FAIL (Cannot find module `../src/financials.js`)

- [ ] **Step 3: Implement `src/financials.js`**

Implement seed orders, storage helpers, ID generator, status updater, and analytical aggregation functions.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/financials.test.js`
Expected: PASS 4/4 tests.

- [ ] **Step 5: Commit**

```bash
git add test/financials.test.js src/financials.js
git commit -m "feat(financials): add sales order store, KPI statistics, and receipt logic"
```

---

### Task 2: Build the Financials & Sales History View in `AdminPanel.vue`

**Files:**
- Modify: `src/components/AdminPanel.vue`

**Interfaces:**
- Consumes: `src/financials.js` (orders, stats, receipt generation, status updater)
- Features:
  - Top navigation bar in Admin Panel: `Shoe Catalog & Inventory` (tab 1) vs `Financials & Sales History` (tab 2).
  - KPI metric cards: Realized Revenue, Pending Receivables, Pairs Sold, Average Order Value.
  - Revenue by Silhouette breakdown bars.
  - Searchable & filterable Order History table.
  - Digital Receipt modal with full shoe part color swatches, status dropdown/buttons (`Mark as Paid`), and `@media print` print styling.
  - Walk-in sale modal for manual owner entries.

- [ ] **Step 1: Implement UI tabs and Financials view in `AdminPanel.vue`**
- [ ] **Step 2: Run build to verify compilation**
- [ ] **Step 3: Commit**

```bash
git add src/components/AdminPanel.vue
git commit -m "feat(admin): add financial dashboard, order history table, and digital receipt modal"
```

---

### Task 3: Integrate Customer Orders with the Financial Ledger in `src/App.vue`

**Files:**
- Modify: `src/App.vue`

**Interfaces:**
- Consumes: `createOrder` from `./financials.js`
- Behavior:
  - When customer clicks "Confirm & Order", automatically invoke `createOrder()` with the customer's name, email, pickup date, selected shoe, customized part colors, and selected charm.
  - Decrement stock by 1 pair for the ordered shoe.
  - The new order is logged with `status: 'pending'`, so the owner immediately sees it in the Financials table and can view the digital receipt or mark it as paid upon pickup.

- [ ] **Step 1: Update `submitReservation()` in `App.vue` to record the order**
- [ ] **Step 2: Run tests and build check**
- [ ] **Step 3: Commit**

```bash
git add src/App.vue
git commit -m "feat(app): connect customer reservations to owner financial tracker"
```

---

### Task 4: Full Verification and Documentation

**Files:**
- Modify: `walkthrough.md`

- [ ] **Step 1: Run complete automated test suite (`npm.cmd test`)**
- [ ] **Step 2: Run production build (`npm.cmd run build`)**
- [ ] **Step 3: Update `walkthrough.md` with instructions for testing the financial tracker and receipt voucher**
