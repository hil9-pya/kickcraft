# Financial Tracker & Sales History Design Spec

**Date:** 2026-09-15  
**Status:** Approved

## Purpose

Provide the KickCraft store owner with a dedicated financial and inventory sales tracker inside the Owner Admin Panel. Store owners can track realized revenue, pending customer orders, average order values, sales breakdown by silhouette, and view or print detailed digital receipts for custom shoe orders.

## Scope

### Included

- Top-level view switcher in the Owner Admin Panel: **Shoe Catalog & Inventory** vs **Financials & Sales History**.
- Key Performance Indicators (KPIs):
  - **Realized Revenue (₱)**: Total sum from `paid` orders.
  - **Pending Revenue (₱)**: Total sum from `pending` reservations awaiting store pickup and payment.
  - **Total Shoes Sold**: Quantity of completed `paid` shoe sales.
  - **Average Order Value (AOV)**: Revenue per paid transaction.
- Silhouette Sales Breakdown: Units sold and revenue generated per shoe model.
- Sales & Order History Table:
  - Chronological list with Receipt/Order #, Date, Customer Name, Shoe Model, Size, Amount, and Payment Status (`paid`, `pending`, `cancelled`).
  - Search by customer name or receipt number.
  - Filter tabs by payment status (`all`, `paid`, `pending`, `cancelled`).
  - Quick action to toggle status (`Mark as Paid`).
- Customer Reservation Integration:
  - Submitting an order in the shop/studio dialog automatically creates a new order in `kickcraft_sales_orders` with status `'pending'` and decrements the shoe's stock count.
- Digital Receipt Modal:
  - Branded KickCraft receipt format (KickCraft Flagship Studio, address, date, receipt ID).
  - Customer details: Name, Email, Pickup Date.
  - Customization summary: Part-by-part color swatch list and charm accessory.
  - Status toggle (`Mark as Paid` / `Mark as Pending` / `Cancel Order`).
  - Print button with print-specific CSS styling for physical paper/PDF receipts.
- Manual Sale Logging:
  - "+ Record Walk-in Sale" form allowing the owner to log in-person purchases directly.
- Frontend Persistence:
  - `localStorage` persistence under `kickcraft_sales_orders`.
  - Initial seed data (4 realistic orders) for instant out-of-the-box demonstration.

### Excluded

- Online payment processing (Stripe, PayPal, etc. - in-store pickup model per AGENTS.md).
- Multi-store or enterprise accounting.
- External backend sync (omitted per user instruction "dont put any backend yet").

## Architecture & Data Schema

### Storage Key: `kickcraft_sales_orders`

```typescript
interface OrderRecord {
  id: string              // e.g. "KC-2026-0001"
  date: string            // ISO timestamp
  customerName: string
  customerEmail: string
  pickupDate: string      // "YYYY-MM-DD"
  shoeId: string          // e.g. "kickcraft-one"
  shoeName: string
  size: number
  price: number
  partColors: Record<string, { name: string, value: string }>
  charmId: string
  charmLabel: string
  status: 'pending' | 'paid' | 'cancelled'
  paymentMethod: 'in_store' | 'cash' | 'card' | 'gcash'
}
```

### Modules

1. `src/financials.js`:
   - `getStoredOrders(): OrderRecord[]`
   - `setStoredOrders(orders: OrderRecord[]): void`
   - `createOrder(orderData: Partial<OrderRecord>): OrderRecord`
   - `updateOrderStatus(orderId: string, status: 'pending' | 'paid' | 'cancelled'): OrderRecord[]`
   - `calculateFinancialStats(orders: OrderRecord[]): FinancialStats`
   - `calculateSilhouetteBreakdown(orders: OrderRecord[]): SilhouetteStat[]`
   - `generateReceiptId(): string`
2. `src/components/AdminPanel.vue`:
   - Hosts the tab bar (`catalog` | `financials`).
   - Renders financial dashboard, order history table, walk-in sale modal, and digital receipt modal.
3. `src/App.vue`:
   - In `submitReservation()` / `openReservation()`, automatically passes order details to `createOrder()` so that customer custom orders instantly show up in the owner's financial records.
