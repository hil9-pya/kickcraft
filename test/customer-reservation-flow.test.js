import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const APP_PATH = path.resolve('src/App.vue')

test('Header navbar is cleaned: does not render "Back to shop" or "Order" buttons', () => {
  assert.ok(fs.existsSync(APP_PATH), 'src/App.vue must exist')
  const content = fs.readFileSync(APP_PATH, 'utf8')

  // Extract <header>...</header> section
  const headerMatch = content.match(/<header[\s\S]*?<\/header>/)
  assert.ok(headerMatch, 'src/App.vue must contain a <header> element')
  const headerContent = headerMatch[0]

  // Header should NOT contain "Back to shop" button
  assert.doesNotMatch(
    headerContent,
    /Back to shop/,
    '<header> navbar must not contain "Back to shop" button'
  )

  // Header should NOT contain standalone "Order" button
  assert.doesNotMatch(
    headerContent,
    />\s*Order\s*<\/button>/,
    '<header> navbar must not contain "Order" button'
  )

  // Header still retains Shop link, brand logo, and navigation
  assert.match(headerContent, /goToShop/, '<header> must retain brand/shop navigation')
  assert.match(headerContent, /Admin Portal/, '<header> must retain Admin Portal link')
})

test('Studio view renders breadcrumb with "← Back to Catalog" and shoe name', () => {
  const content = fs.readFileSync(APP_PATH, 'utf8')

  // Breadcrumb nav exists with aria-label
  assert.match(
    content,
    /<nav[^>]*aria-label="Studio Breadcrumb"/,
    'Studio view must include a nav element with aria-label="Studio Breadcrumb"'
  )

  // Breadcrumb button calls goToShop and says "← Back to Catalog"
  assert.match(
    content,
    /<button[^>]*@click="goToShop"[^>]*>[\s\S]*?← Back to Catalog[\s\S]*?<\/button>/,
    'Breadcrumb must include a button with "← Back to Catalog" that triggers goToShop'
  )

  // Breadcrumb displays separator and selectedShoe.name
  assert.match(
    content,
    /aria-label="Studio Breadcrumb"[\s\S]*?selectedShoe\.name[\s\S]*?<\/nav>/,
    'Breadcrumb must display selectedShoe.name'
  )
})

test('Customer-facing copy is updated from "order" to "reserve" / "reservation"', () => {
  const content = fs.readFileSync(APP_PATH, 'utf8')

  // Catalog card CTA
  assert.match(
    content,
    /Customize\s+(&amp;|&)\s+Reserve/,
    'Catalog cards must use "Customize & Reserve" instead of "Customize & Order"'
  )
  assert.doesNotMatch(
    content,
    /Customize\s+(&amp;|&)\s+Order/,
    'Catalog cards must not use "Customize & Order"'
  )

  // Studio CTA button
  assert.match(
    content,
    />\s*Reserve this design\s*<\/button>/,
    'Studio action button must say "Reserve this design"'
  )
  assert.doesNotMatch(
    content,
    />\s*Order this design\s*<\/button>/,
    'Studio action button must not say "Order this design"'
  )

  // How it works step 3
  assert.match(
    content,
    /3\.\s*Reserve/,
    'How it works step 3 must be "3. Reserve"'
  )
  assert.doesNotMatch(
    content,
    /3\.\s*Order/,
    'How it works step 3 must not be "3. Order"'
  )

  // Studio pinned bar notice
  assert.match(
    content,
    /Pickup reservation\s*·/,
    'Studio pinned bar must say "Pickup reservation ·"'
  )
  assert.doesNotMatch(
    content,
    /Pickup order\s*·/,
    'Studio pinned bar must not say "Pickup order ·"'
  )

  // Modal close aria-label
  assert.match(
    content,
    /aria-label=["']Close reservation modal["']/,
    'Reservation modal close button must have aria-label="Close reservation modal"'
  )

  // Footer Reserve button
  assert.match(
    content,
    /<button[^>]*@click="openReservation"[^>]*>\s*Reserve\s*<\/button>/,
    'Footer link must say "Reserve" instead of "Order"'
  )
})

test('Guest profile persistence manages kickcraft_guest_profile and pre-fills reservation fields', () => {
  const content = fs.readFileSync(APP_PATH, 'utf8')

  // Reactive state for guest remember checkbox
  assert.match(
    content,
    /const\s+rememberGuestProfile\s*=\s*ref\(/,
    'App.vue must define rememberGuestProfile ref'
  )

  // References kickcraft_guest_profile localStorage key
  assert.match(
    content,
    /['"]kickcraft_guest_profile['"]/,
    'App.vue must use "kickcraft_guest_profile" localStorage key'
  )

  // Helper functions or logic for loading and saving guest profile
  assert.match(
    content,
    /loadGuestProfile|getGuestProfile/,
    'App.vue must implement guest profile loader function'
  )
  assert.match(
    content,
    /saveGuestProfile|setGuestProfile/,
    'App.vue must implement guest profile saver function'
  )

  // openReservation pre-fills from currentUser or guest profile
  assert.match(
    content,
    /function\s+openReservation\s*\(/,
    'openReservation function must be defined'
  )
  const openReservationBlock = content.match(/function\s+openReservation\s*\([\s\S]*?\n\}/)?.[0] || ''
  assert.ok(openReservationBlock, 'openReservation function body must exist')
  assert.match(
    openReservationBlock,
    /currentUser/,
    'openReservation must check currentUser for pre-filling'
  )
  assert.match(
    openReservationBlock,
    /customerName|customerEmail/,
    'openReservation must prefill customerName and customerEmail'
  )

  // Studio pinned bar and modal include "Remember my contact details on this device" checkbox
  assert.match(
    content,
    /Remember my contact details on this device/,
    'App.vue must render "Remember my contact details on this device" checkbox label'
  )
  assert.match(
    content,
    /v-model=["']rememberGuestProfile["']/,
    'Checkbox must bind to rememberGuestProfile'
  )
})

test('Reservation dialog integrates KickCraftCalendar with minPickupDate and maxPickupDate', () => {
  const content = fs.readFileSync(APP_PATH, 'utf8')

  // Imports KickCraftCalendar
  assert.match(
    content,
    /import\s+KickCraftCalendar\s+from\s+['"]\.\/components\/KickCraftCalendar\.vue['"]/,
    'App.vue must import KickCraftCalendar component'
  )

  // Calculates minPickupDate (+7d) and maxPickupDate (+365d)
  assert.match(
    content,
    /const\s+minPickupDate\s*=\s*computed\(/,
    'App.vue must define minPickupDate computed property'
  )
  assert.match(
    content,
    /const\s+maxPickupDate\s*=\s*computed\(/,
    'App.vue must define maxPickupDate computed property'
  )

  // Reservation dialog mounts KickCraftCalendar
  const dialogMatch = content.match(/id="reservation-dialog"[\s\S]*?<\/dialog>/)
  assert.ok(dialogMatch, 'Reservation dialog must exist')
  const dialogContent = dialogMatch[0]

  assert.match(
    dialogContent,
    /<KickCraftCalendar[\s\S]*?v-model="pickupDate"/,
    'Reservation dialog must mount KickCraftCalendar with v-model="pickupDate"'
  )
  assert.match(
    dialogContent,
    /:min-date="minPickupDate"/,
    'KickCraftCalendar must bind :min-date="minPickupDate"'
  )
  assert.match(
    dialogContent,
    /:max-date="maxPickupDate"/,
    'KickCraftCalendar must bind :max-date="maxPickupDate"'
  )

  // Native input[type="date"] should no longer be present in the reservation dialog
  assert.doesNotMatch(
    dialogContent,
    /<input[^>]*type="date"/,
    'Reservation dialog must not contain native type="date" input'
  )
})
