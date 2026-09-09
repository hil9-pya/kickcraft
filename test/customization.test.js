import test from 'node:test'
import assert from 'node:assert/strict'
import { CHARMS, PARTS, charmScale, setMaterialColor } from '../src/customization.js'

test('maps all shoe parts and updates only the requested material', () => {
  assert.deepEqual(PARTS.map(({ material }) => material), [
    'UpperMaterial',
    'ToeCapMaterial',
    'TongueMaterial',
    'LacesMaterial',
    'HeelPanelMaterial',
    'SideAccentsMaterial',
    'MidsoleMaterial',
    'OutsoleMaterial',
  ])

  const calls = []
  const upper = {
    pbrMetallicRoughness: {
      setBaseColorFactor: color => calls.push(color),
    },
  }
  const model = {
    getMaterialByName: name => name === 'UpperMaterial' ? upper : null,
  }

  assert.equal(setMaterialColor(model, 'UpperMaterial', '#245fa8'), true)
  assert.deepEqual(calls, ['#245fa8'])
  assert.equal(setMaterialColor(model, 'MissingMaterial', '#ffffff'), false)
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
