import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('ConfirmModal component file exists and defines required props and emits', () => {
  const filePath = path.resolve('src/components/ConfirmModal.vue')
  assert.ok(fs.existsSync(filePath), 'ConfirmModal.vue must exist')
  const content = fs.readFileSync(filePath, 'utf8')

  // Script setup
  assert.match(content, /<script setup>/, 'Must use Vue 3 <script setup>')

  // defineProps and defineEmits
  assert.match(content, /defineProps/, 'Must define props')
  assert.match(content, /defineEmits/, 'Must define emits')

  // Props contract
  assert.match(content, /show:/, 'Must declare show prop')
  assert.match(content, /title:/, 'Must declare title prop')
  assert.match(content, /message:/, 'Must declare message prop')
  assert.match(content, /confirmText:/, 'Must declare confirmText prop')
  assert.match(content, /cancelText:/, 'Must declare cancelText prop')
  assert.match(content, /variant:/, 'Must declare variant prop')
  assert.match(content, /icon:/, 'Must declare icon prop')

  // Emits contract
  assert.match(content, /['"]confirm['"]/, 'Must emit confirm event')
  assert.match(content, /['"]cancel['"]/, 'Must emit cancel event')
})

test('ConfirmModal implements KickCraft brutalist styling and layout structure', () => {
  const filePath = path.resolve('src/components/ConfirmModal.vue')
  assert.ok(fs.existsSync(filePath), 'ConfirmModal.vue must exist')
  const content = fs.readFileSync(filePath, 'utf8')

  // Backdrop overlay styling
  assert.match(content, /fixed inset-0/, 'Backdrop must have fixed inset-0')
  assert.match(content, /z-50/, 'Backdrop must have high z-index (z-50)')
  assert.match(content, /bg-black\/60/, 'Backdrop must have translucent black background')
  assert.match(content, /backdrop-blur-sm/, 'Backdrop must have blur effect')

  // Modal card container styling
  assert.match(content, /border-\[#8e938e\]/, 'Modal card must have KickCraft border color #8e938e')
  assert.match(content, /bg-\[#fcfdfb\]/, 'Modal card must have KickCraft background color #fcfdfb')
  assert.match(content, /max-w-md/, 'Modal card must be max-w-md')
  assert.match(content, /shadow-2xl/, 'Modal card must have shadow-2xl')

  // Typography
  assert.match(content, /font-display/, 'Title must use KickCraft display font')
  assert.match(content, /text-\[#202220\]/, 'Title must use dark charcoal text color')
  assert.match(content, /text-\[#5f635f\]/, 'Body message must use muted text color')

  // Action buttons
  assert.match(content, /border-\[#bfc3bf\]/, 'Cancel button must use border #bfc3bf')
  assert.match(content, /bg-\[#b94d27\]/, 'Danger confirm button must use terracotta color #b94d27')
  assert.match(content, /bg-\[#292b2d\]/, 'Default confirm button must use charcoal color #292b2d')
})

test('ConfirmModal implements contextual iconography badges', () => {
  const filePath = path.resolve('src/components/ConfirmModal.vue')
  assert.ok(fs.existsSync(filePath), 'ConfirmModal.vue must exist')
  const content = fs.readFileSync(filePath, 'utf8')

  // Contextual icon badges
  assert.match(content, /logout/, 'Must handle logout icon')
  assert.match(content, /trash/, 'Must handle trash icon')
  assert.match(content, /reset/, 'Must handle reset icon')
  assert.match(content, /warning/, 'Must handle warning icon')
  assert.match(content, /<svg/i, 'Must render SVG icons')
})

test('ConfirmModal handles Escape key and backdrop dismissal', () => {
  const filePath = path.resolve('src/components/ConfirmModal.vue')
  assert.ok(fs.existsSync(filePath), 'ConfirmModal.vue must exist')
  const content = fs.readFileSync(filePath, 'utf8')

  // Keyboard navigation
  assert.match(content, /Escape/, 'Must listen for Escape key')
  assert.match(content, /addEventListener|keydown/, 'Must attach keydown listener for keyboard accessibility')
  assert.match(content, /removeEventListener/, 'Must remove keydown listener on unmount')
})
