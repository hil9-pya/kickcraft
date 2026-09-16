import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const ADMIN_PANEL_PATH = path.resolve('src/components/AdminPanel.vue')

test('AdminPanel.vue exists and does not render revenue metric cards, silhouette breakdown, or walk-in sale UI', () => {
  assert.ok(fs.existsSync(ADMIN_PANEL_PATH), 'AdminPanel.vue must exist')
  const content = fs.readFileSync(ADMIN_PANEL_PATH, 'utf8')

  // Financial metric KPI cards removed
  assert.doesNotMatch(content, /Realized Revenue/, 'AdminPanel must not render Realized Revenue card')
  assert.doesNotMatch(content, /Average Order Value/, 'AdminPanel must not render Average Order Value card')
  assert.doesNotMatch(content, /Pending Receivables/, 'AdminPanel must not render Pending Receivables card')
  assert.doesNotMatch(content, /Revenue &amp; Sales by Shoe Silhouette|Revenue & Sales by Shoe Silhouette/, 'AdminPanel must not render silhouette revenue breakdown')

  // Walk-in sale controls removed from template UI
  assert.doesNotMatch(content, /Record Walk-in Sale/, 'AdminPanel must not render Record Walk-in Sale button')
  assert.doesNotMatch(content, /Record Walk-in Store Sale/, 'AdminPanel must not render Walk-in Sale modal header')
})

test('AdminPanel.vue uses "reservations" as section key and renders "Pickup Reservations" tab with pending counter badge', () => {
  const content = fs.readFileSync(ADMIN_PANEL_PATH, 'utf8')

  // Section key updated to reservations
  assert.match(content, /adminSection\s*===\s*['"]reservations['"]/, 'AdminPanel must support adminSection === "reservations"')
  assert.match(content, /Pickup Reservations/, 'Tab label must be Pickup Reservations')
  assert.match(content, /pendingCount/, 'AdminPanel must compute pendingCount')
  assert.match(content, /{{\s*pendingCount\s*}}\s*pending/, 'Tab must display pending count badge')
})

test('AdminPanel.vue provides status filter tabs for all, pending, arrived, completed, and cancelled', () => {
  const content = fs.readFileSync(ADMIN_PANEL_PATH, 'utf8')

  // Status filter tabs in template
  assert.match(content, /orderStatusFilter\s*=\s*['"]all['"]/, 'Filter tabs must include "all"')
  assert.match(content, /orderStatusFilter\s*=\s*['"]pending['"]/, 'Filter tabs must include "pending"')
  assert.match(content, /orderStatusFilter\s*=\s*['"]arrived['"]/, 'Filter tabs must include "arrived"')
  assert.match(content, /orderStatusFilter\s*=\s*['"]completed['"]/, 'Filter tabs must include "completed"')
  assert.match(content, /orderStatusFilter\s*=\s*['"]cancelled['"]/, 'Filter tabs must include "cancelled"')
})

test('AdminPanel.vue reservations table renders columns, custom parts count, scheduled pickup date, status badges, and actions', () => {
  const content = fs.readFileSync(ADMIN_PANEL_PATH, 'utf8')

  // Table headers / columns
  assert.match(content, /Receipt/i, 'Table must display receipt column')
  assert.match(content, /Customer/i, 'Table must display customer column')
  assert.match(content, /Pickup Date|Scheduled Pickup/i, 'Table must display pickup date column')

  // Custom parts count in row
  assert.match(content, /partColors/, 'Table row must inspect partColors for custom parts count')

  // Status badges
  assert.match(content, /#c97d1e/, 'Pending status badge must use amber #c97d1e')
  assert.match(content, /#245fa8/, 'Arrived status badge must use blue #245fa8')
  assert.match(content, /#3f7652/, 'Completed status badge must use green #3f7652')
  assert.match(content, /#b94d27/, 'Cancelled status badge must use terracotta #b94d27')

  // Action buttons
  assert.match(content, /View Details/, 'Table row must provide "View Details" button')
  assert.match(content, /Mark Arrived/, 'Table row must provide "Mark Arrived" button')
  assert.match(content, /Mark Completed/, 'Table row must provide "Mark Completed" button')
})

const APP_PATH = path.resolve('src/App.vue')

test('App.vue broadcasts NEW_RESERVATION event on submitReservation success', () => {
  assert.ok(fs.existsSync(APP_PATH), 'App.vue must exist')
  const content = fs.readFileSync(APP_PATH, 'utf8')

  assert.match(
    content,
    /BroadcastChannel\(['"]kickcraft_reservations_channel['"]\)[\s\S]*?NEW_RESERVATION/,
    'App.vue must broadcast NEW_RESERVATION on kickcraft_reservations_channel'
  )
})

test('AdminPanel.vue defines reservationAlert reactive state and renders floating notification banner', () => {
  const content = fs.readFileSync(ADMIN_PANEL_PATH, 'utf8')

  // reservationAlert ref & trigger function
  assert.match(content, /const\s+reservationAlert\s*=\s*ref/, 'AdminPanel must define reservationAlert ref')
  assert.match(content, /triggerReservationAlert/, 'AdminPanel must define triggerReservationAlert function')

  // BroadcastChannel listener in onMounted
  assert.match(
    content,
    /BroadcastChannel\(['"]kickcraft_reservations_channel['"]\)[\s\S]*?NEW_RESERVATION/,
    'AdminPanel must listen for NEW_RESERVATION on kickcraft_reservations_channel'
  )

  // Floating notification alert banner template
  assert.match(content, /New Reservation Received/, 'Banner must display "New Reservation Received"')
  assert.match(content, /reservationAlert\.customerName/, 'Banner must display customer name')
  assert.match(content, /reservationAlert\.(shoeName|shoeId)/, 'Banner must display shoe model/name')
  assert.match(content, /reservationAlert\.id/, 'Banner must display receipt ID')
  assert.match(content, /12000/, 'Banner auto-dismisses after 12 seconds')

  // Action buttons on alert banner
  assert.match(content, /View Details/, 'Banner must include "View Details" button')
  assert.match(content, /Close|dismissReservationAlert/, 'Banner must include "Close" button or dismiss action')
})

test('AdminPanel.vue renders the inspection modal with 3D part color swatches', () => {
  const content = fs.readFileSync(ADMIN_PANEL_PATH, 'utf8')

  // Inspection modal state
  assert.match(content, /const\s+showInspectionModal\s*=\s*ref/, 'AdminPanel must define showInspectionModal ref')
  assert.match(content, /const\s+selectedInspectionReservation\s*=\s*ref/, 'AdminPanel must define selectedInspectionReservation ref')
  assert.match(content, /showInspectionModal\s*&&\s*selectedInspectionReservation/, 'Inspection modal must be conditioned on showInspectionModal && selectedInspectionReservation')

  // Customer & receipt info
  assert.match(content, /selectedInspectionReservation\.id/, 'Modal must display receipt ID')
  assert.match(content, /selectedInspectionReservation\.customerName/, 'Modal must display customer name')
  assert.match(content, /selectedInspectionReservation\.(customerEmail|email)/, 'Modal must display customer email')
  assert.match(content, /selectedInspectionReservation\.pickupDate/, 'Modal must display scheduled pickup date')

  // Shoe specs: name, size, charm, thumbnail
  assert.match(content, /selectedInspectionReservation\.(shoeName|shoeId)/, 'Modal must display shoe silhouette name')
  assert.match(content, /selectedInspectionReservation\.size/, 'Modal must display US size')
  assert.match(content, /selectedInspectionReservation\.(charmLabel|charmId)/, 'Modal must display charm accessory')

  // 3D Color Swatches iteration
  assert.match(content, /selectedInspectionReservation\.partColors/, 'Modal must iterate over partColors')
  assert.match(content, /backgroundColor:\s*(?:partColor|color)\.value/, 'Modal must render color swatch box with backgroundColor')
  assert.match(content, /(?:partColor|color)\.name/, 'Modal must render color name')
})

test('AdminPanel.vue inspection modal action buttons transition status to arrived and completed and filteredOrders handles completed/paid', () => {
  const content = fs.readFileSync(ADMIN_PANEL_PATH, 'utf8')

  // Action buttons
  assert.match(content, /Mark as Arrived|Mark Arrived/, 'Modal must render Mark as Arrived button')
  assert.match(content, /Mark as Completed|Mark Completed/, 'Modal must render Mark as Completed button')

  // Transitions
  assert.match(
    content,
    /['"]arrived['"]/,
    'Modal action must transition to arrived'
  )
  assert.match(
    content,
    /['"]completed['"]/,
    'Modal action must transition to completed'
  )

  // filteredOrders completed filter handles paid as well
  assert.match(
    content,
    /order\.status === ['"]completed['"]\s*\|\|\s*order\.status === ['"]paid['"]/,
    'filteredOrders must match completed or paid when status filter is completed'
  )
})

