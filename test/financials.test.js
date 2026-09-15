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

test('generateReceiptId creates standard KC-2026-XXXX format', () => {
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
    { id: 'KC-2026-0001', price: 5000, status: 'pending' },
  ]
  orders = updateOrderStatus(orders, 'KC-2026-0001', 'paid')
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

test('createOrder adds a new order with generated receipt ID and default pending status', () => {
  const list = []
  const newOrder = createOrder(list, {
    customerName: 'Maria Santos',
    customerEmail: 'maria@example.com',
    shoeId: 'kickcraft-one',
    shoeName: 'KickCraft One',
    size: 8,
    price: 4890,
  })

  assert.ok(newOrder.id.startsWith('KC-2026-'))
  assert.equal(newOrder.status, 'pending')
  assert.equal(newOrder.customerName, 'Maria Santos')
  assert.equal(list.length, 1)
})
