import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const APP_PATH = path.resolve('src/App.vue')

test('App.vue defines reservations view routing, hash support, and persistence', () => {
  assert.ok(fs.existsSync(APP_PATH), 'src/App.vue must exist')
  const content = fs.readFileSync(APP_PATH, 'utf8')

  // getInitialView supports 'reservations'
  assert.match(
    content,
    /getInitialView[\s\S]*?reservations/,
    'getInitialView must include "reservations" in allowed views'
  )

  // window hashchange listener supports 'reservations'
  assert.match(
    content,
    /hashchange[\s\S]*?reservations/,
    'hashchange listener must include "reservations"'
  )

  // view ref comments or initial definition supports 'reservations'
  assert.match(
    content,
    /const view = ref\(getInitialView\(\)\)[\s\S]*?reservations/,
    'view ref must document or support "reservations"'
  )
})

test('Header navbar displays "My Reservations" tab only for customer sessions', () => {
  const content = fs.readFileSync(APP_PATH, 'utf8')
  const headerMatch = content.match(/<header[\s\S]*?<\/header>/)
  assert.ok(headerMatch, 'src/App.vue must contain a <header> element')
  const headerContent = headerMatch[0]

  // Button exists with v-if checking currentUser?.role === 'customer'
  assert.match(
    headerContent,
    /v-if="currentUser\?\.role === 'customer'"/,
    'Header must contain a button conditioned on currentUser?.role === "customer"'
  )

  // Tab label says "My Reservations"
  assert.match(
    headerContent,
    /My Reservations/,
    'Header must render "My Reservations" button label'
  )

  // Binds click to goToMyReservations
  assert.match(
    headerContent,
    /@click="goToMyReservations"/,
    '"My Reservations" button must trigger goToMyReservations'
  )

  // Active view highlight styling for reservations
  assert.match(
    headerContent,
    /view === 'reservations' \? '[^']*border-b-2[^']*' : '[^']*'/,
    '"My Reservations" button must toggle active border style when view === "reservations"'
  )
})

test('App.vue implements reactive reservation state and data fetching methods', () => {
  const content = fs.readFileSync(APP_PATH, 'utf8')

  // State refs
  assert.match(content, /const myReservations = ref\(\[\]\)/, 'Must declare myReservations ref')
  assert.match(content, /const isLoadingReservations = ref\(false\)/, 'Must declare isLoadingReservations ref')
  assert.match(content, /const reservationsError = ref\(['"]['"]\)/, 'Must declare reservationsError ref')

  // fetchMyReservations
  assert.match(content, /async function fetchMyReservations\(\)/, 'Must declare async function fetchMyReservations')
  assert.match(content, /api\(['"]reservations\/list\.php['"]\)/, 'fetchMyReservations must call reservations/list.php')
  assert.match(content, /getStoredOrders\(\)/, 'fetchMyReservations must include getStoredOrders() offline fallback')

  // goToMyReservations
  assert.match(content, /function goToMyReservations\(\)/, 'Must declare function goToMyReservations')
  assert.match(content, /view\.value = 'reservations'/, 'goToMyReservations must set view to reservations')
  assert.match(content, /fetchMyReservations\(\)/, 'goToMyReservations must trigger fetchMyReservations')
  assert.match(content, /scrollToTop\(\)/, 'goToMyReservations must call scrollToTop')
})

test('Reservations view renders header, empty state, and reservation cards with full details', () => {
  const content = fs.readFileSync(APP_PATH, 'utf8')

  // Main container conditioned on view === 'reservations'
  assert.match(
    content,
    /<main[^>]*v-else-if="view === 'reservations'"/,
    'Must declare <main v-else-if="view === \'reservations\'"'
  )

  // Header and title
  assert.match(content, /My Pickup Reservations/, 'Must render "My Pickup Reservations" title')

  // Empty state container with CTA to 3D studio
  assert.match(
    content,
    /You haven't reserved any custom shoes yet\./,
    'Must display empty state text "You haven\'t reserved any custom shoes yet."'
  )
  assert.match(
    content,
    /Start Designing in 3D Studio/,
    'Empty state must include "Start Designing in 3D Studio" button'
  )
  assert.match(
    content,
    /goToStudio\(/,
    'Empty state CTA must trigger goToStudio'
  )

  // Card details
  assert.match(content, /Receipt/i, 'Cards must show receipt label')
  assert.match(content, /pickupDate/i, 'Cards must display pickup date')
  assert.match(content, /partColors/i, 'Cards must display customized part colors')
  assert.match(content, /123 Craft Studio Way, Manila/, 'Cards must include the store pickup notice address')
})

test('Reservations view status badge supports pending, paid, approved, ready, completed, and cancelled statuses', () => {
  const content = fs.readFileSync(APP_PATH, 'utf8')

  // Status badges or helper mapping
  assert.match(content, /pending/, 'Status mapping must handle pending')
  assert.match(content, /paid/, 'Status mapping must handle paid')
  assert.match(content, /approved/, 'Status mapping must handle approved')
  assert.match(content, /ready/, 'Status mapping must handle ready')
  assert.match(content, /completed/, 'Status mapping must handle completed')
  assert.match(content, /cancelled/, 'Status mapping must handle cancelled')

  // Color tokens from brief: amber (#c97d1e), green (#3f7652), blue (#245fa8), emerald (#2a593a), dark (#292b2d), terracotta (#b94d27)
  assert.match(content, /c97d1e/, 'Status styling must include amber #c97d1e for pending')
  assert.match(content, /3f7652/, 'Status styling must include green #3f7652 for paid')
  assert.match(content, /245fa8/, 'Status styling must include blue #245fa8 for approved')
  assert.match(content, /2a593a/, 'Status styling must include emerald #2a593a for ready')
  assert.match(content, /292b2d/, 'Status styling must include dark #292b2d for completed')
  assert.match(content, /b94d27/, 'Status styling must include terracotta #b94d27 for cancelled')
})
