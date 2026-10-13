import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const content = fs.readFileSync(path.resolve('src/App.vue'), 'utf8')

test('studio adds guidance, presets, live summary, reservation progress, and skeletons', () => {
  assert.match(content, /kickcraft_3d_guide_seen/)
  assert.match(content, /v-if="modelReady && show3DGuide"/)
  assert.match(content, /COLORWAY_PRESETS/)
  assert.match(content, /function applyColorway\(preset\)/)
  assert.match(content, /function highlightSelectedPart\(part = selectedPart\.value\)/)
  assert.match(content, />Design summary</)
  assert.match(content, /aria-label="Reservation progress"/)
  assert.match(content, /aria-label="Loading 3D shoe preview"/)
  assert.match(content, /aria-label="Loading shoe catalog"/)
  assert.match(content, /aria-label="Loading customizable shoe"/)
})

test('checkout shows pickup location before submission and mobile sections retain their DOM', () => {
 const checkout=content.slice(content.indexOf('<dialog id="reservation-dialog"'),content.indexOf('<form class="checkout-form pt-5"'))
 assert.match(checkout, /aria-label="Pickup details"/)
 assert.match(checkout, /selectedShoe\.storeName/)
 assert.match(checkout, /selectedShoe\.pickupAddress/)
 assert.match(checkout, /Pay at pickup/)
 assert.match(content, /v-show="studioSection === 'parts'"/)
 assert.match(content, /v-show="studioSection === 'charms'"/)
 assert.match(content, /v-show="studioSection === 'size'"/)
 assert.equal((content.match(/ref="modelViewer"/g)||[]).length,1)
})
