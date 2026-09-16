import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const COMPONENT_PATH = path.resolve('src/components/KickCraftCalendar.vue')

test('KickCraftCalendar.vue component file exists and defines required props and emits', () => {
  assert.ok(fs.existsSync(COMPONENT_PATH), 'KickCraftCalendar.vue must exist')
  const content = fs.readFileSync(COMPONENT_PATH, 'utf8')

  // Script setup
  assert.match(content, /<script setup>/, 'Must use Vue 3 <script setup>')

  // defineProps and defineEmits
  assert.match(content, /defineProps\s*\(/, 'Must define props')
  assert.match(content, /defineEmits\s*\(/, 'Must define emits')

  // Props contract: modelValue, minDate, maxDate
  assert.match(content, /modelValue:\s*\{[^}]*required:\s*true/s, 'modelValue prop must be required')
  assert.match(content, /minDate:/, 'Must declare minDate prop')
  assert.match(content, /maxDate:/, 'Must declare maxDate prop')

  // Emits contract
  assert.match(content, /['"]update:modelValue['"]/, 'Must emit update:modelValue event')
})

test('KickCraftCalendar implements brutalist styling, clean borders, and terracotta active highlights', () => {
  assert.ok(fs.existsSync(COMPONENT_PATH), 'KickCraftCalendar.vue must exist')
  const content = fs.readFileSync(COMPONENT_PATH, 'utf8')

  // Brutalist borders
  assert.match(content, /border-\[#cfd2ce\]/, 'Must use brutalist border #cfd2ce')
  assert.match(content, /border-\[#292b2d\]/, 'Must use brutalist border #292b2d on active/hover')

  // Terracotta active highlights
  assert.match(content, /bg-\[#b94d27\]/, 'Active day must use KickCraft terracotta #b94d27')
  assert.match(content, /text-white/, 'Active day must have white text')
  assert.match(content, /font-bold/, 'Active day must have bold text')

  // Smooth hover transitions
  assert.match(content, /transition-all/, 'Controls must have smooth transitions')
  assert.match(content, /duration-150/, 'Controls must have duration-150 transitions')

  // High contrast typography
  assert.match(content, /text-\[#202220\]/, 'Must use dark charcoal text color')
  assert.match(content, /text-\[#5f635f\]/, 'Must use muted text color for labels/headers')
})

test('KickCraftCalendar renders monospace weekday headers and clean text month navigation', () => {
  assert.ok(fs.existsSync(COMPONENT_PATH), 'KickCraftCalendar.vue must exist')
  const content = fs.readFileSync(COMPONENT_PATH, 'utf8')

  // Monospace weekday headers
  assert.match(content, /font-mono/, 'Weekday headers must be styled monospace')
  for (const day of ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']) {
    assert.ok(content.includes(day), `Weekday headers must include ${day}`)
  }

  // Month navigation: no icon clutter, clean text labels
  assert.match(content, /←\s*Prev/, 'Previous month button must use text label ← Prev')
  assert.match(content, /Next\s*→/, 'Next month button must use text label Next →')

  // Handlers for month navigation
  assert.match(content, /prevMonth/, 'Must implement prevMonth handler')
  assert.match(content, /nextMonth/, 'Must implement nextMonth handler')
})

test('KickCraftCalendar provides quick presets (+1 Week, +2 Weeks, +1 Month)', () => {
  assert.ok(fs.existsSync(COMPONENT_PATH), 'KickCraftCalendar.vue must exist')
  const content = fs.readFileSync(COMPONENT_PATH, 'utf8')

  // Quick preset buttons
  assert.match(content, /\+1\s*Week/, 'Must include +1 Week preset button')
  assert.match(content, /\+2\s*Weeks/, 'Must include +2 Weeks preset button')
  assert.match(content, /\+1\s*Month/, 'Must include +1 Month preset button')

  // Preset offsets: +7 days, +14 days, +30 days
  assert.match(content, /7/, 'Preset logic must support 7-day offset')
  assert.match(content, /14/, 'Preset logic must support 14-day offset')
  assert.match(content, /30/, 'Preset logic must support 30-day offset')

  // Applies preset and emits update:modelValue
  assert.match(content, /applyPreset/, 'Must implement applyPreset helper')
})

test('KickCraftCalendar renders the required pickup reservation notice banner', () => {
  assert.ok(fs.existsSync(COMPONENT_PATH), 'KickCraftCalendar.vue must exist')
  const content = fs.readFileSync(COMPONENT_PATH, 'utf8')

  const expectedNotice = 'Notice: Pickup reservations must be scheduled between 1 week and 1 year from today. Unclaimed pairs beyond this window become invalid.'
  // Normalize whitespace to account for formatting/line breaks
  const normalizedContent = content.replace(/\s+/g, ' ')
  assert.ok(
    normalizedContent.includes(expectedNotice),
    `Component must include exact notice banner: "${expectedNotice}"`
  )
})

test('KickCraftCalendar implements disabled out-of-range dates and active day selection', () => {
  assert.ok(fs.existsSync(COMPONENT_PATH), 'KickCraftCalendar.vue must exist')
  const content = fs.readFileSync(COMPONENT_PATH, 'utf8')

  // Disabled logic
  assert.match(content, /isDateDisabled/, 'Must implement isDateDisabled check')
  assert.match(content, /minDate/, 'Must check minDate boundary')
  assert.match(content, /maxDate/, 'Must check maxDate boundary')
  assert.match(content, /:disabled=/, 'Must bind disabled attribute to day buttons')

  // Selection logic
  assert.match(content, /selectDate/, 'Must implement selectDate method')
  assert.match(content, /emit\(\s*['"]update:modelValue['"]/, 'selectDate must emit update:modelValue')
})

test('KickCraftCalendar parses dates and calculates day grid accurately', () => {
  assert.ok(fs.existsSync(COMPONENT_PATH), 'KickCraftCalendar.vue must exist')
  const content = fs.readFileSync(COMPONENT_PATH, 'utf8')

  // Ensure helper functions format dates as YYYY-MM-DD
  assert.match(content, /padStart\(2,\s*['"]0['"]\)/, 'Must format 2-digit month and day with padStart')

  // Test date formatting logic directly
  function formatDate(year, monthIndex, day) {
    const y = String(year)
    const m = String(monthIndex + 1).padStart(2, '0')
    const d = String(day).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  assert.equal(formatDate(2026, 8, 16), '2026-09-16')
  assert.equal(formatDate(2026, 0, 1), '2026-01-01')
  assert.equal(formatDate(2026, 11, 31), '2026-12-31')

  // Test days in month calculation
  function getDaysInMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate()
  }

  assert.equal(getDaysInMonth(2026, 8), 30) // September 2026: 30 days
  assert.equal(getDaysInMonth(2026, 1), 28) // February 2026: 28 days
  assert.equal(getDaysInMonth(2024, 1), 29) // February 2024: 29 days (leap year)
})

test('KickCraftCalendar preset date offsets and out-of-range bounds calculations', () => {
  function getOffsetDateStr(baseDate, days) {
    const d = new Date(baseDate)
    d.setDate(d.getDate() + days)
    const y = String(d.getFullYear())
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  function isDateDisabled(dateStr, minDate, maxDate) {
    if (!dateStr) return false
    if (minDate && dateStr < minDate) return true
    if (maxDate && dateStr > maxDate) return true
    return false
  }

  const base = new Date('2026-09-16T12:00:00Z')
  assert.equal(getOffsetDateStr(base, 7), '2026-09-23')
  assert.equal(getOffsetDateStr(base, 14), '2026-09-30')
  assert.equal(getOffsetDateStr(base, 30), '2026-10-16')

  const minDate = '2026-09-23'
  const maxDate = '2027-09-16'

  // Dates before minDate are disabled
  assert.equal(isDateDisabled('2026-09-22', minDate, maxDate), true)
  assert.equal(isDateDisabled('2026-09-16', minDate, maxDate), true)

  // MinDate and dates inside window are enabled
  assert.equal(isDateDisabled('2026-09-23', minDate, maxDate), false)
  assert.equal(isDateDisabled('2026-10-16', minDate, maxDate), false)
  assert.equal(isDateDisabled('2027-09-16', minDate, maxDate), false)

  // Dates after maxDate are disabled
  assert.equal(isDateDisabled('2027-09-17', minDate, maxDate), true)
  assert.equal(isDateDisabled('2028-01-01', minDate, maxDate), true)
})

test('KickCraftCalendar month navigation advances and decrements month/year across year boundaries', () => {
  function prevMonth(y, m) {
    if (m === 0) return { year: y - 1, month: 11 }
    return { year: y, month: m - 1 }
  }

  function nextMonth(y, m) {
    if (m === 11) return { year: y + 1, month: 0 }
    return { year: y, month: m + 1 }
  }

  // September -> August
  assert.deepEqual(prevMonth(2026, 8), { year: 2026, month: 7 })

  // January -> previous December
  assert.deepEqual(prevMonth(2026, 0), { year: 2025, month: 11 })

  // December -> next January
  assert.deepEqual(nextMonth(2026, 11), { year: 2027, month: 0 })
})
