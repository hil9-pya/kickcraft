import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const charms = [
  ['star-charm.glb', 'StarCharm'],
  ['lightning-charm.glb', 'LightningCharm'],
  ['k-tag-charm.glb', 'KTagCharm'],
]

async function readGlb(file) {
  const buffer = await readFile(new URL(`../public/models/charms/${file}`, import.meta.url))
  assert.equal(buffer.toString('ascii', 0, 4), 'glTF')
  assert.equal(buffer.readUInt32LE(4), 2)
  const jsonLength = buffer.readUInt32LE(12)
  const json = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString().trim())
  return { buffer, json }
}

test('generated charms are small valid GLBs with named geometry', async () => {
  for (const [file, expectedName] of charms) {
    const { buffer, json } = await readGlb(file)
    const triangles = json.meshes
      .flatMap(mesh => mesh.primitives)
      .reduce((sum, primitive) => sum + json.accessors[primitive.indices].count / 3, 0)

    assert.ok(json.nodes.some(node => node.name === expectedName), `${file} is missing ${expectedName}`)
    assert.ok(json.meshes.length > 0, `${file} has no mesh`)
    assert.ok(json.materials.some(material => material.name === 'CharmMetal'), `${file} has no CharmMetal`)
    assert.ok(triangles > 0 && triangles < 5000, `${file} has ${triangles} triangles`)
    assert.ok(buffer.length < 200_000, `${file} is ${buffer.length} bytes`)
  }
})

test('K tag has a visible mark on both faces', async () => {
  const { json } = await readGlb('k-tag-charm.glb')
  const nodeNames = new Set(json.nodes.map(node => node.name))

  assert.ok(json.materials.some(material => material.name === 'CharmMark'))
  assert.ok(nodeNames.has('KFrontStem'))
  assert.ok(nodeNames.has('KBackStem'))
})
