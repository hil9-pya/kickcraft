import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const modelPath = new URL('../public/models/nike-air-max-custom.glb', import.meta.url)

test('Air Max model is a valid GLB with editable materials and a charm anchor', async () => {
  const buffer = await readFile(modelPath)

  assert.equal(buffer.toString('ascii', 0, 4), 'glTF')
  assert.equal(buffer.readUInt32LE(4), 2)

  const jsonLength = buffer.readUInt32LE(12)
  const json = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString().trim())
  const materialNames = new Set(json.materials.map(material => material.name))
  const nodeNames = new Set(json.nodes.map(node => node.name))

  assert.ok(materialNames.has('UpperMaterial'))
  assert.ok(materialNames.has('LacesMaterial'))
  assert.ok(materialNames.has('MidsoleMaterial'))
  assert.ok(nodeNames.has('CharmAnchor'))
  assert.equal(json.animations?.length || 0, 0)
})

test('Air Max charms use local anchor transforms', async () => {
  for (const file of ['star-charm.glb', 'lightning-charm.glb', 'k-tag-charm.glb']) {
    const buffer = await readFile(new URL(`../public/models/charms/air-max/${file}`, import.meta.url))
    assert.equal(buffer.toString('ascii', 0, 4), 'glTF')

    const jsonLength = buffer.readUInt32LE(12)
    const json = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString().trim())
    const root = json.nodes.find(node => node.name === 'CharmRoot')

    assert.deepEqual(root?.translation, [0, 0, 0])
    assert.deepEqual(root?.rotation, [-0.7071068, 0, 0, 0.7071068])
  }
})
