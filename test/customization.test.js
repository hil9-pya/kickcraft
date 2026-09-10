import test from 'node:test'
import assert from 'node:assert/strict'
import { CHARMS, PARTS, SHOES, charmScale, materialName, setMaterialColor } from '../src/customization.js'

test('maps all shoe parts and updates only the requested material', () => {
  // PARTS still has all 8 entries with id and label
  assert.deepEqual(PARTS.map(({ id }) => id), [
    'upper', 'toe-cap', 'tongue', 'laces',
    'heel-panel', 'side-accents', 'midsole', 'outsole',
  ])

  // shoe-one uses the "Material" suffix
  assert.deepEqual(PARTS.map(p => materialName(p.id, 'one')), [
    'UpperMaterial', 'ToeCapMaterial', 'TongueMaterial', 'LacesMaterial',
    'HeelPanelMaterial', 'SideAccentsMaterial', 'MidsoleMaterial', 'OutsoleMaterial',
  ])

  // shoe-two uses plain names (no suffix)
  assert.deepEqual(PARTS.map(p => materialName(p.id, 'two')), [
    'Upper', 'ToeCap', 'Tongue', 'Laces',
    'HeelPanel', 'SideAccents', 'Midsole', 'Outsole',
  ])

  // setMaterialColor still works the same way
  const calls = []
  const upper = { pbrMetallicRoughness: { setBaseColorFactor: color => calls.push(color) } }
  const model = { getMaterialByName: name => name === 'UpperMaterial' ? upper : null }

  assert.equal(setMaterialColor(model, 'UpperMaterial', '#245fa8'), true)
  assert.deepEqual(calls, ['#245fa8'])
  assert.equal(setMaterialColor(model, 'MissingMaterial', '#ffffff'), false)

  // SHOES catalog has both entries with correct paths
  assert.ok(SHOES.one.src.includes('shoe-soleview-final.glb'))
  assert.ok(SHOES.two.src.includes('shoe-kickcraft-ready.glb'))
})


test('shows only the selected charm and hides every charm for none', () => {
  assert.deepEqual(CHARMS, [
    { id: 'none', label: 'None', src: null },
    { id: 'star', label: 'Star', src: '/models/charms/star-charm.glb' },
    { id: 'lightning', label: 'Lightning', src: '/models/charms/lightning-charm.glb' },
    { id: 'k-tag', label: 'K tag', src: '/models/charms/k-tag-charm.glb' },
  ])

  assert.equal(charmScale('star', 'star'), '1 1 1')
  assert.equal(charmScale('lightning', 'star'), '0 0 0')
  assert.equal(charmScale('k-tag', 'none'), '0 0 0')
})
