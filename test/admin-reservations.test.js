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
