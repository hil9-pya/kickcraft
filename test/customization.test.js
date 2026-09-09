import test from 'node:test'
import assert from 'node:assert/strict'
import { PARTS, setMaterialColor } from '../src/customization.js'

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
