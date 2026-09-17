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
