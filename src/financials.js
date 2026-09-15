export const ORDERS_STORAGE_KEY = 'kickcraft_sales_orders'

let receiptCounter = 1000

export function generateReceiptId() {
  const randSuffix = Math.floor(1000 + Math.random() * 9000)
  return `KC-2026-${randSuffix}`
}

export function loadInitialOrders() {
  return [
    {
      id: 'KC-2026-1041',
      date: '2026-09-11T14:32:00.000Z',
      customerName: 'Alex Reyes',
      customerEmail: 'alex.reyes@example.com',
      pickupDate: '2026-09-18',
      shoeId: 'kickcraft-one',
      shoeName: 'KickCraft One',
      size: 9,
      price: 4890,
      partColors: {
        upper: { name: 'Cobalt', value: '#245fa8' },
        'toe-cap': { name: 'Chalk', value: '#f1efe8' },
        laces: { name: 'Rust', value: '#b94d27' },
        midsole: { name: 'Graphite', value: '#292b2d' },
      },
      charmId: 'star',
      charmLabel: 'Star',
      status: 'paid',
      paymentMethod: 'gcash',
      notes: 'Paid via GCash at studio counter.',
    },
    {
      id: 'KC-2026-1042',
      date: '2026-09-12T10:15:00.000Z',
      customerName: 'Bea Gomez',
      customerEmail: 'bea.gomez@example.com',
      pickupDate: '2026-09-19',
      shoeId: 'nike-air-max',
      shoeName: 'Nike Air Max',
      size: 8,
      price: 4890,
      partColors: {
        upper: { name: 'Burgundy', value: '#713741' },
        laces: { name: 'Chalk', value: '#f1efe8' },
        midsole: { name: 'Chalk', value: '#f1efe8' },
      },
      charmId: 'k-tag',
      charmLabel: 'K tag',
      status: 'paid',
      paymentMethod: 'card',
      notes: 'In-store credit card payment processed.',
    },
    {
      id: 'KC-2026-1043',
      date: '2026-09-13T16:45:00.000Z',
      customerName: 'Carlos Mendoza',
      customerEmail: 'carlos.m@example.com',
      pickupDate: '2026-09-20',
      shoeId: 'kickcraft-one',
      shoeName: 'KickCraft One',
      size: 10,
      price: 4890,
      partColors: {
        upper: { name: 'Moss', value: '#52684f' },
        laces: { name: 'Graphite', value: '#292b2d' },
        midsole: { name: 'Chalk', value: '#f1efe8' },
        outsole: { name: 'Rust', value: '#b94d27' },
      },
      charmId: 'lightning',
      charmLabel: 'Lightning',
      status: 'paid',
      paymentMethod: 'cash',
      notes: 'Cash receipt issued upon pickup.',
    },
    {
      id: 'KC-2026-1044',
      date: '2026-09-14T09:20:00.000Z',
      customerName: 'Danica Cruz',
      customerEmail: 'danica.cruz@example.com',
      pickupDate: '2026-09-21',
      shoeId: 'nike-dunk',
      shoeName: 'Nike Dunk',
      size: 7,
      price: 4890,
      partColors: {
        upper: { name: 'Cobalt', value: '#245fa8' },
        laces: { name: 'Chalk', value: '#f1efe8' },
        midsole: { name: 'Graphite', value: '#292b2d' },
      },
      charmId: 'none',
      charmLabel: 'None',
      status: 'pending',
      paymentMethod: 'in_store',
      notes: 'Customer reservation placed online. Payment upon store pickup.',
    },
  ]
}

export function getStoredOrders() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return loadInitialOrders()
  }
  try {
    const raw = window.localStorage.getItem(ORDERS_STORAGE_KEY)
    if (!raw) {
      const initial = loadInitialOrders()
      window.localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(initial))
      return initial
    }
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length ? parsed : loadInitialOrders()
  } catch (err) {
    console.error('Failed to parse orders from localStorage:', err)
    return loadInitialOrders()
  }
}

export function setStoredOrders(orders) {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders))
    } catch (err) {
      console.error('Failed to save orders to localStorage:', err)
    }
  }
}

export function createOrder(list, orderData) {
  const id = generateReceiptId()
  const priceNum = Number(orderData.price) || 4890
  const newOrder = {
    id,
    date: orderData.date || new Date().toISOString(),
    customerName: (orderData.customerName || 'Walk-in Customer').trim(),
    customerEmail: (orderData.customerEmail || 'walkin@kickcraft.local').trim(),
    pickupDate: orderData.pickupDate || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    shoeId: orderData.shoeId || 'kickcraft-one',
    shoeName: orderData.shoeName || 'KickCraft One',
    size: Number(orderData.size) || 9,
    price: priceNum,
    partColors: orderData.partColors || {},
    charmId: orderData.charmId || 'none',
    charmLabel: orderData.charmLabel || 'None',
    status: orderData.status || 'pending',
    paymentMethod: orderData.paymentMethod || 'in_store',
    notes: orderData.notes || 'Order received.',
  }

  list.unshift(newOrder)
  return newOrder
}

export function updateOrderStatus(list, orderId, status) {
  return list.map(order => {
    if (order.id !== orderId) return order
    return {
      ...order,
      status,
      updatedAt: new Date().toISOString(),
    }
  })
}

export function calculateFinancialStats(orders = []) {
  let realizedRevenue = 0
  let pendingRevenue = 0
  let paidUnits = 0
  let pendingUnits = 0
  let cancelledUnits = 0

  for (const order of orders) {
    const price = Number(order.price) || 0
    if (order.status === 'paid') {
      realizedRevenue += price
      paidUnits += 1
    } else if (order.status === 'pending') {
      pendingRevenue += price
      pendingUnits += 1
    } else if (order.status === 'cancelled') {
      cancelledUnits += 1
    }
  }

  const aov = paidUnits > 0 ? Math.round(realizedRevenue / paidUnits) : 0

  return {
    realizedRevenue,
    pendingRevenue,
    totalPotentialRevenue: realizedRevenue + pendingRevenue,
    paidUnits,
    pendingUnits,
    cancelledUnits,
    totalOrders: orders.length,
    aov,
  }
}

export function calculateSilhouetteBreakdown(orders = []) {
  const map = {}

  for (const order of orders) {
    const sId = order.shoeId || 'unknown'
    if (!map[sId]) {
      map[sId] = {
        shoeId: sId,
        shoeName: order.shoeName || sId,
        paidUnits: 0,
        pendingUnits: 0,
        revenue: 0,
      }
    }

    const price = Number(order.price) || 0
    if (order.status === 'paid') {
      map[sId].paidUnits += 1
      map[sId].revenue += price
    } else if (order.status === 'pending') {
      map[sId].pendingUnits += 1
    }
  }

  return Object.values(map).sort((a, b) => b.revenue - a.revenue)
}
