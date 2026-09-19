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

test('AdminPanel.vue defines owner cancellation modal with quick presets and reason textarea', () => {
  const content = fs.readFileSync(ADMIN_PANEL_PATH, 'utf8')

  // Reactive state
  assert.match(content, /const\s+showOwnerCancelModal\s*=\s*ref\(false\)/, 'AdminPanel must define showOwnerCancelModal ref')
  assert.match(content, /const\s+cancelReservationTarget\s*=\s*ref\(null\)/, 'AdminPanel must define cancelReservationTarget ref')
  assert.match(content, /const\s+cancellationReason\s*=\s*ref\(['"]['"]\)/, 'AdminPanel must define cancellationReason ref')

  // Preset buttons in template
  assert.match(content, /Selected custom color \/ material is currently unavailable/, 'Modal must offer custom color unavailable preset')
  assert.match(content, /Silhouette size out of stock/, 'Modal must offer size out of stock preset')
  assert.match(content, /Custom craftsmanship constraint/, 'Modal must offer craftsmanship constraint preset')

  // Textarea & actions
  assert.match(content, /v-model="cancellationReason"/, 'Modal must provide cancellationReason textarea')
  assert.match(content, /Confirm Cancellation/, 'Modal must provide Confirm Cancellation button')
  assert.match(content, /submitOwnerCancellation/, 'Modal must call submitOwnerCancellation on confirm')
  assert.match(content, /Keep Active|closeOwnerCancelModal/, 'Modal must provide dismiss / Keep Active action')
})

test('AdminPanel.vue submitOwnerCancellation persists cancellation with reason notes, restores stock, and broadcasts', () => {
  const content = fs.readFileSync(ADMIN_PANEL_PATH, 'utf8')

  assert.match(content, /async\s+function\s+submitOwnerCancellation/, 'AdminPanel must define submitOwnerCancellation')
  assert.match(content, /api\(['"]reservations\/update-status\.php['"][\s\S]*?status:\s*['"]cancelled['"][\s\S]*?notes:/, 'submitOwnerCancellation must call update-status.php with cancelled and notes')
  assert.match(content, /BroadcastChannel\(['"]kickcraft_reservations_channel['"]\)[\s\S]*?RESERVATION_CANCELLED/, 'submitOwnerCancellation must broadcast RESERVATION_CANCELLED')
  assert.match(content, /targetShoe\.stock/, 'submitOwnerCancellation must restore shoe stock locally')
})

test('AdminPanel.vue renders Delete Record button for cancelled reservations in table and inspection modal', () => {
  const content = fs.readFileSync(ADMIN_PANEL_PATH, 'utf8')

  // Table row delete button
  assert.match(content, /order\.status\s*===\s*['"]cancelled['"][\s\S]*?Delete Record/, 'Table row must render Delete Record for cancelled reservations')
  assert.match(content, /requestDeleteReservation\(order\)/, 'Table row Delete Record must call requestDeleteReservation(order)')

  // Inspection modal delete button
  assert.match(content, /selectedInspectionReservation\.status\s*===\s*['"]cancelled['"][\s\S]*?Delete Record/, 'Inspection modal must render Delete Record for cancelled reservations')
  assert.match(content, /requestDeleteReservation\(selectedInspectionReservation\)/, 'Inspection modal Delete Record must call requestDeleteReservation')
})

test('AdminPanel.vue implements requestDeleteReservation with adminConfirm and soft delete API', () => {
  const content = fs.readFileSync(ADMIN_PANEL_PATH, 'utf8')

  assert.match(content, /function\s+requestDeleteReservation\s*\(\s*order\s*\)/, 'AdminPanel must define requestDeleteReservation(order)')
  assert.match(content, /title:\s*['"]Delete Cancelled Reservation\?['"]/, 'requestDeleteReservation must set adminConfirm title')
  assert.match(content, /confirmText:\s*['"]Delete Record['"]/, 'requestDeleteReservation must set confirmText to Delete Record')
  assert.match(content, /cancelText:\s*['"]Keep in Archive['"]/, 'requestDeleteReservation must set cancelText to Keep in Archive')
  assert.match(content, /api\(['"]reservations\/delete\.php['"]/, 'requestDeleteReservation must call reservations/delete.php on confirmation')
  assert.match(content, /setStoredOrders/, 'requestDeleteReservation must persist updated orders list')
})

test('AdminPanel.vue handleOrderStatusChange persists on the server before broadcasting', () => {
  const content = fs.readFileSync(ADMIN_PANEL_PATH, 'utf8')

  assert.match(
    content,
    /async\s+function\s+handleOrderStatusChange\s*\(\s*orderId,\s*newStatus\s*\)/,
    'AdminPanel must define handleOrderStatusChange'
  )
  assert.doesNotMatch(content, /updateOrderStatus\s*\(\s*orders\.value,\s*orderId,\s*newStatus\s*\)/, 'status changes must not claim success before the API responds')
  assert.match(
    content,
    /persistOrders\s*\(\s*\)/,
    'handleOrderStatusChange must persist orders'
  )
  assert.match(
    content,
    /BroadcastChannel\(['"]kickcraft_reservations_channel['"]\)[\s\S]*?RESERVATION_STATUS_UPDATED/,
    'handleOrderStatusChange must broadcast RESERVATION_STATUS_UPDATED on kickcraft_reservations_channel'
  )
})

test('AdminPanel.vue prompts confirmation modal when marking reservation as arrived or completed', () => {
  const content = fs.readFileSync(ADMIN_PANEL_PATH, 'utf8')

  assert.match(
    content,
    /function\s+requestOrderStatusChange\s*\(\s*(?:order|reservation),\s*newStatus\s*\)/,
    'AdminPanel must define requestOrderStatusChange'
  )
  assert.match(
    content,
    /requestOrderStatusChange\(order,\s*['"]arrived['"]\)/,
    'Table row Mark Arrived button must call requestOrderStatusChange with arrived'
  )
  assert.match(
    content,
    /requestOrderStatusChange\(order,\s*['"]completed['"]\)/,
    'Table row Mark Completed button must call requestOrderStatusChange with completed'
  )
  assert.match(
    content,
    /requestOrderStatusChange\(selectedInspectionReservation,\s*['"]arrived['"]\)/,
    'Inspection modal Mark as Arrived button must call requestOrderStatusChange with arrived'
  )
  assert.match(
    content,
    /requestOrderStatusChange\(selectedInspectionReservation,\s*['"]completed['"]\)/,
    'Inspection modal Mark as Completed button must call requestOrderStatusChange with completed'
  )
  assert.match(
    content,
    /Mark Reservation as Arrived\?/,
    'requestOrderStatusChange must set Arrived modal title'
  )
  assert.match(
    content,
    /Mark Reservation as Completed\?/,
    'requestOrderStatusChange must set Completed modal title'
  )
})

