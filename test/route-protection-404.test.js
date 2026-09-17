import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve('.')

test('Task 1: Favicon assets exist and are linked in index.html', () => {
  const svgPath = path.join(ROOT, 'public', 'favicon.svg')
  const icoPath = path.join(ROOT, 'public', 'favicon.ico')
  const htmlPath = path.join(ROOT, 'index.html')

  assert.ok(fs.existsSync(svgPath), 'public/favicon.svg must exist')
  assert.ok(fs.existsSync(icoPath), 'public/favicon.ico must exist')

  const svgContent = fs.readFileSync(svgPath, 'utf8')
  assert.match(svgContent, /<svg/i, 'favicon.svg must be a valid SVG document')
  assert.match(svgContent, /#202220|#292b2d/i, 'favicon.svg must use KickCraft dark brand color')
  assert.match(svgContent, /#b94d27/i, 'favicon.svg must feature KickCraft terracotta accent')

  const htmlContent = fs.readFileSync(htmlPath, 'utf8')
  assert.match(htmlContent, /<link[^>]+rel=["']icon["'][^>]+href=["']\/favicon\.svg["']/i, 'index.html must link favicon.svg')
  assert.match(htmlContent, /<link[^>]+href=["']\/favicon\.ico["']/i, 'index.html must link favicon.ico as fallback')
})

test('Task 2: Show/Hide Password toggles in App.vue and AdminPanel.vue', () => {
  const appVuePath = path.join(ROOT, 'src', 'App.vue')
  const adminVuePath = path.join(ROOT, 'src', 'components', 'AdminPanel.vue')

  const appContent = fs.readFileSync(appVuePath, 'utf8')
  const adminContent = fs.readFileSync(adminVuePath, 'utf8')

  // App.vue login password toggle
  assert.match(appContent, /const\s+showLoginPassword\s*=\s*ref\(false\)/, 'App.vue must define showLoginPassword ref')
  assert.match(appContent, /showLoginPassword\s*\?\s*['"]text['"]\s*:\s*['"]password['"]/, 'Login password input must toggle type')
  assert.match(appContent, /aria-label=".*(show|hide)\s+password/i, 'Login password field must provide accessible toggle button')

  // App.vue registration password toggles
  assert.match(appContent, /const\s+showRegisterPassword\s*=\s*ref\(false\)/, 'App.vue must define showRegisterPassword ref')
  assert.match(appContent, /const\s+showRegisterConfirmPassword\s*=\s*ref\(false\)/, 'App.vue must define showRegisterConfirmPassword ref')
  assert.match(appContent, /showRegisterPassword\s*\?\s*['"]text['"]\s*:\s*['"]password['"]/, 'Register password input must toggle type')
  assert.match(appContent, /showRegisterConfirmPassword\s*\?\s*['"]text['"]\s*:\s*['"]password['"]/, 'Register confirm password input must toggle type')

  // AdminPanel.vue user password toggle
  assert.match(adminContent, /const\s+showUserPassword\s*=\s*ref\(false\)/, 'AdminPanel.vue must define showUserPassword ref')
  assert.match(adminContent, /showUserPassword\s*\?\s*['"]text['"]\s*:\s*['"]password['"]/, 'AdminPanel user password input must toggle type')
})

