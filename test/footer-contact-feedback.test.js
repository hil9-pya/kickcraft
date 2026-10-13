import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const APP_PATH = path.resolve('src/App.vue')

test('Feedback modal is defined and interactive in src/App.vue', () => {
  const content = fs.readFileSync(APP_PATH, 'utf8')

  // Script setup must define feedback state/handlers
  assert.match(content, /showFeedbackModal\s*=\s*ref\(/, 'Must define showFeedbackModal ref')
  assert.match(content, /feedbackForm\s*=\s*ref\(/, 'Must define feedbackForm ref')
  assert.match(content, /handleFeedbackSubmit/, 'Must define handleFeedbackSubmit function')

  // Template must render feedback modal dialog / backdrop
  assert.match(content, /v-if="showFeedbackModal"/, 'Template must render feedback modal when showFeedbackModal is true')
})
