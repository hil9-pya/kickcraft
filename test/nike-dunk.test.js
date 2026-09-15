import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { DUNK_PARTS, SHOES, CATALOG, filterCatalog } from '../src/customization.js'

const modelPath = new URL('../public/models/nike-dunk.glb', import.meta.url)
const cardPath = new URL('../public/images/nike-dunk-card.png', import.meta.url)

test('DUNK_PARTS defines exactly 3 customizable zones', () => {
  assert.equal(DUNK_PARTS.length, 3)
  assert.deepEqual(
    DUNK_PARTS.map(p => p.id),
    ['upper', 'laces', 'midsole']
  )
  assert.deepEqual(
    DUNK_PARTS.map(p => p.material),
    ['UpperMaterial', 'LacesMaterial', 'MidsoleMaterial']
  )
})

test('SHOES contains nike-dunk configuration', () => {
  const dunk = SHOES.find(s => s.id === 'nike-dunk')
  assert.ok(dunk, 'nike-dunk should exist in SHOES')
  assert.equal(dunk.src, '/models/nike-dunk.glb')
  assert.equal(dunk.image, '/images/nike-dunk-card.png')
  assert.equal(dunk.parts, DUNK_PARTS)
})

test('CATALOG contains live nike-dunk card matching category filters', () => {
  const card = CATALOG.find(c => c.id === 'nike-dunk')
  assert.ok(card, 'nike-dunk should exist in CATALOG')
  assert.equal(card.status, 'live')
  assert.equal(card.shoeId, 'nike-dunk')
  assert.ok(card.categories.includes('sneakers'))
  assert.ok(card.categories.includes('fashion'))
  assert.ok(card.categories.includes('basketball'))

  // Filter testing
  const allResults = filterCatalog(CATALOG, 'dunk', 'all')
  assert.equal(allResults.length, 1)
  assert.equal(allResults[0].id, 'nike-dunk')

  const sneakerResults = filterCatalog(CATALOG, '', 'sneakers')
  assert.ok(sneakerResults.some(c => c.id === 'nike-dunk'))
})

test('Nike Dunk model is lightweight (< 5 MB) and valid GLB with CharmAnchor', async () => {
  const fileStat = await stat(modelPath)
  assert.ok(fileStat.size < 5 * 1024 * 1024, `GLB file should be under 5 MB, got ${(fileStat.size / 1024 / 1024).toFixed(2)} MB`)

  const buffer = await readFile(modelPath)
  assert.equal(buffer.toString('ascii', 0, 4), 'glTF')
  assert.equal(buffer.readUInt32LE(4), 2)

  const jsonLength = buffer.readUInt32LE(12)
  const json = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString().trim())
  const materialNames = new Set(json.materials.map(material => material.name))
  const nodeNames = new Set(json.nodes.map(node => node.name))

  assert.ok(materialNames.has('UpperMaterial'), 'Must contain UpperMaterial')
  assert.ok(materialNames.has('LacesMaterial'), 'Must contain LacesMaterial')
  assert.ok(materialNames.has('MidsoleMaterial'), 'Must contain MidsoleMaterial')
  assert.ok(nodeNames.has('CharmAnchor'), 'Must contain CharmAnchor node')
})

test('Nike Dunk card image exists and has valid size', async () => {
  const imgStat = await stat(cardPath)
  assert.ok(imgStat.size > 1000, 'Card image must not be empty')
})
