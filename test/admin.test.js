import test from 'node:test'
import assert from 'node:assert/strict'
import {
  loadInitialShoes,
  validateShoe,
  slugify,
  createShoeRecord,
  updateShoeRecord,
  deleteShoeRecord,
  restockShoeRecord,
  highlightMaterial,
  adminShoeToCatalogCard,
} from '../src/admin.js'

test('slugify generates kebab-case IDs from part and shoe names', () => {
  assert.equal(slugify('Upper Material'), 'upper-material')
  assert.equal(slugify('Toe Cap'), 'toe-cap')
  assert.equal(slugify('Side Accents #2'), 'side-accents-2')
  assert.equal(slugify(''), '')
})

test('validateShoe validates required fields according to spec', () => {
  const invalid = validateShoe({})
  assert.equal(invalid.valid, false)
  assert.ok(invalid.errors.includes('Shoe name is required.'))
  assert.ok(invalid.errors.includes('Description is required.'))
  assert.ok(invalid.errors.includes('Valid price is required.'))
  assert.ok(invalid.errors.includes('At least one category is required.'))
  assert.ok(invalid.errors.includes('At least one customizable part is required.'))
  assert.ok(invalid.errors.includes('At least one color is required in the palette.'))

  const valid = validateShoe({
    name: 'KickCraft Stride',
    description: 'Road running shoe',
    price: 5490,
    stock: 25,
    categories: ['kickcraft', 'running'],
    status: 'available',
    glbPath: '/models/shoe-soleview-final.glb',
    parts: [{ id: 'upper', label: 'Upper', material: 'UpperMaterial' }],
    colors: [{ name: 'Ocean Blue', value: '#245fa8' }],
  })
  assert.equal(valid.valid, true)
  assert.equal(valid.errors.length, 0)
})

test('createShoeRecord creates a valid shoe and seeds initial shoes', () => {
  const initial = loadInitialShoes()
  assert.ok(initial.length >= 3, 'seeds at least 3 existing shoes')
  assert.ok(initial.some(s => s.id === 'kickcraft-one'))

  const newShoe = createShoeRecord(initial, {
    name: 'KickCraft Pace',
    description: 'Trail running runner',
    price: 5390,
    stock: 15,
    categories: ['kickcraft', 'running'],
    status: 'available',
    glbPath: '/models/shoe-soleview-final.glb',
    thumbnailPath: '/images/pace.png',
    charmsEnabled: true,
    parts: [{ id: 'upper', label: 'Upper', material: 'UpperMaterial' }],
    colors: [{ name: 'Cobalt', value: '#245fa8' }],
  })

  assert.equal(newShoe.id, 'kickcraft-pace')
  assert.equal(newShoe.stock, 15)
  assert.equal(newShoe.status, 'available')
  assert.equal(newShoe.charmsEnabled, true)
})

test('updateShoeRecord updates properties and handles restock and deletion', () => {
  const list = [
    {
      id: 'test-shoe',
      name: 'Test Shoe',
      price: 4000,
      stock: 5,
      status: 'available',
      parts: [],
      colors: [],
    },
  ]

  const updated = updateShoeRecord(list, 'test-shoe', { price: 4200, status: 'coming_soon' })
  assert.equal(updated.find(s => s.id === 'test-shoe').price, 4200)
  assert.equal(updated.find(s => s.id === 'test-shoe').status, 'coming_soon')

  const restocked = restockShoeRecord(list, 'test-shoe', 20)
  assert.equal(restocked.find(s => s.id === 'test-shoe').stock, 20)

  const deleted = deleteShoeRecord(list, 'test-shoe')
  assert.equal(deleted.length, 0)
})

test('highlightMaterial sets red highlight factor on target material and neutral on others', () => {
  const calls = []
  const mat1 = {
    name: 'UpperMaterial',
    pbrMetallicRoughness: {
      setBaseColorFactor: color => calls.push({ mat: 'UpperMaterial', color }),
    },
  }
  const mat2 = {
    name: 'MidsoleMaterial',
    pbrMetallicRoughness: {
      setBaseColorFactor: color => calls.push({ mat: 'MidsoleMaterial', color }),
    },
  }
  const mockModel = {
    materials: [mat1, mat2],
  }

  highlightMaterial(mockModel, 'UpperMaterial', '#ff0000')
  assert.deepEqual(calls, [
    { mat: 'UpperMaterial', color: '#ff0000' },
    { mat: 'MidsoleMaterial', color: '#ffffff' },
  ])
})

test('adminShoeToCatalogCard correctly maps admin shoes to customer catalog cards', () => {
  const availableShoe = {
    id: 'stride-shoe',
    name: 'KickCraft Stride',
    description: 'Road running sneaker',
    price: 5490,
    formattedPrice: '₱5,490',
    status: 'available',
    stock: 20,
    thumbnailPath: '/images/stride.png',
    categories: ['kickcraft', 'running'],
    parts: [{ id: 'upper', label: 'Upper', material: 'UpperMaterial' }],
  }
  const card1 = adminShoeToCatalogCard(availableShoe)
  assert.equal(card1.id, 'stride-shoe')
  assert.equal(card1.name, 'KickCraft Stride')
  assert.equal(card1.status, 'live')
  assert.equal(card1.shoeId, 'stride-shoe')
  assert.equal(card1.price, '₱5,490')

  const outOfStockShoe = {
    ...availableShoe,
    id: 'sold-out-shoe',
    status: 'out_of_stock',
    stock: 0,
  }
  const card2 = adminShoeToCatalogCard(outOfStockShoe)
  assert.equal(card2.status, 'out_of_stock')

  const comingSoonShoe = {
    ...availableShoe,
    id: 'future-shoe',
    status: 'coming_soon',
  }
  const card3 = adminShoeToCatalogCard(comingSoonShoe)
  assert.equal(card3.status, 'soon')
})
