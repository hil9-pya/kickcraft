import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const ROOT_DIR = path.resolve(import.meta.dirname, '..')
const RESERVATIONS_DIR = path.join(ROOT_DIR, 'api', 'reservations')

const REQUIRED_FILES = [
  'create.php',
  'list.php',
  'update-status.php',
]

test('all 3 reservation endpoint files exist', () => {
  for (const file of REQUIRED_FILES) {
    const filePath = path.join(RESERVATIONS_DIR, file)
    assert.ok(fs.existsSync(filePath), `Expected endpoint file to exist: api/reservations/${file}`)
  }
})

test('reservation endpoints are syntactically valid PHP files', () => {
  for (const file of REQUIRED_FILES) {
    const filePath = path.join(RESERVATIONS_DIR, file)
    assert.ok(fs.existsSync(filePath), `api/reservations/${file} must exist before checking syntax`)
    const output = execSync(`php -l "${filePath}"`, { encoding: 'utf8' })
    assert.match(output, /No syntax errors detected/i, `Syntax error in ${file}`)
  }
})

test('zero physical DELETE FROM statements in api/reservations/', () => {
  for (const file of REQUIRED_FILES) {
    const filePath = path.join(RESERVATIONS_DIR, file)
    if (!fs.existsSync(filePath)) continue
    const code = fs.readFileSync(filePath, 'utf8')
    assert.doesNotMatch(
      code,
      /\bDELETE\s+FROM\b/i,
      `Physical DELETE FROM found in api/reservations/${file} - reservation records must never be physically deleted`
    )
  }
})

test('all reservation endpoints require config, db, and helpers', () => {
  for (const file of REQUIRED_FILES) {
    const filePath = path.join(RESERVATIONS_DIR, file)
    if (!fs.existsSync(filePath)) continue
    const code = fs.readFileSync(filePath, 'utf8')
    assert.match(code, /config\.php/i, `${file} must include config.php`)
    assert.match(code, /db\.php/i, `${file} must include db.php`)
    assert.match(code, /helpers\.php/i, `${file} must include helpers.php`)
  }
})

test('all database queries in api/reservations/ use prepared statements and parameterized values', () => {
  for (const file of REQUIRED_FILES) {
    const filePath = path.join(RESERVATIONS_DIR, file)
    if (!fs.existsSync(filePath)) continue
    const code = fs.readFileSync(filePath, 'utf8')
    assert.match(code, /\$db->prepare\s*\(/i, `${file} must use PDO prepare`)
    assert.doesNotMatch(code, /\$db->query\s*\(/i, `${file} must not use unparameterized $db->query`)

    // Find all prepare("...") or prepare('...') calls and ensure no PHP variables are inside the SQL string
    const prepareCalls = code.matchAll(/\$db->prepare\s*\(\s*(['"])([\s\S]*?)\1\s*\)/gi)
    for (const match of prepareCalls) {
      const sql = match[2]
      assert.doesNotMatch(sql, /\$[a-zA-Z_]/, `SQL statement in ${file} must not interpolate PHP variables: "${sql}"`)
    }
  }
})


test('create.php enforces POST, transactions, DB price lookup, stock decrement, and 201 response', () => {
  const filePath = path.join(RESERVATIONS_DIR, 'create.php')
  assert.ok(fs.existsSync(filePath), 'create.php must exist')
  const code = fs.readFileSync(filePath, 'utf8')

  assert.match(code, /requireMethod\s*\(\s*['"]POST['"]\s*\)/i, 'Must enforce POST method')
  assert.doesNotMatch(code, /requireAdmin\s*\(/i, 'create.php must allow public customer submissions')
  assert.match(code, /beginTransaction\s*\(/i, 'Must wrap operations in a database transaction')
  assert.match(code, /commit\s*\(/i, 'Must commit transaction')
  assert.match(code, /rollBack\s*\(/i, 'Must rollback transaction on failure')
  assert.match(code, /SELECT\s+.*price.*FROM\s+shoes/i, 'Must query shoe price directly from DB')
  assert.match(code, /FOR\s+UPDATE/i, 'Must lock shoe record during stock check to prevent race conditions')
  assert.match(code, /UPDATE\s+shoes\s+SET\s+stock/i, 'Must decrement shoe stock')
  assert.match(code, /INSERT\s+INTO\s+reservations/i, 'Must insert reservation record')
  assert.match(code, /201/, 'Must return 201 Created on success')
  assert.match(code, /\$_SESSION\[['"]user_role['"]\]\s*===\s*['"]owner['"]/, 'Must verify owner role for walk-in paid status')
  assert.match(code, /paid/, 'Must allow paid status for owner walk-in sale')
  assert.match(code, /pending/, 'Must default to pending status for customer reservation')
})


test('list.php enforces GET, requireAdmin, prepared statements, and status/search filters', () => {
  const filePath = path.join(RESERVATIONS_DIR, 'list.php')
  assert.ok(fs.existsSync(filePath), 'list.php must exist')
  const code = fs.readFileSync(filePath, 'utf8')

  assert.match(code, /requireMethod\s*\(\s*['"]GET['"]\s*\)/i, 'Must enforce GET method')
  assert.match(code, /requireAdmin\s*\(\s*\)/i, 'Must require owner admin privileges')
  assert.match(code, /prepare\s*\(/i, 'Must use PDO prepare')
  assert.match(code, /status/i, 'Must support status filtering')
  assert.match(code, /search/i, 'Must support keyword search')
  assert.match(code, /reservations/i, 'Must return reservations list')
})

test('update-status.php enforces POST, requireAdmin, status validation, and prepared update', () => {
  const filePath = path.join(RESERVATIONS_DIR, 'update-status.php')
  assert.ok(fs.existsSync(filePath), 'update-status.php must exist')
  const code = fs.readFileSync(filePath, 'utf8')

  assert.match(code, /requireMethod\s*\(\s*['"]POST['"]\s*\)/i, 'Must enforce POST method')
  assert.match(code, /requireAdmin\s*\(\s*\)/i, 'Must require owner admin privileges')
  assert.match(code, /prepare\s*\(/i, 'Must use PDO prepare')
  assert.match(code, /UPDATE\s+reservations\s+SET\s+status/i, 'Must update reservation status')
  assert.match(code, /pending/i, 'Must validate against pending status')
  assert.match(code, /paid/i, 'Must validate against paid status')
  assert.match(code, /cancelled/i, 'Must validate against cancelled status')
})

test('runtime: list.php rejects POST method with 405', () => {
  if (!fs.existsSync(path.join(RESERVATIONS_DIR, 'list.php'))) return
  const runnerScript = path.join(RESERVATIONS_DIR, 'test_list_method.php')
  fs.writeFileSync(
    runnerScript,
    `<?php
$_SERVER['REQUEST_METHOD'] = 'POST';
require __DIR__ . '/list.php';
`
  )
  try {
    const output = execSync(`php "${runnerScript}"`, { encoding: 'utf8' })
    const json = JSON.parse(output)
    assert.equal(json.error, 'Method not allowed')
  } finally {
    if (fs.existsSync(runnerScript)) fs.unlinkSync(runnerScript)
  }
})

test('runtime: create.php rejects GET method with 405', () => {
  if (!fs.existsSync(path.join(RESERVATIONS_DIR, 'create.php'))) return
  const runnerScript = path.join(RESERVATIONS_DIR, 'test_create_method.php')
  fs.writeFileSync(
    runnerScript,
    `<?php
$_SERVER['REQUEST_METHOD'] = 'GET';
require __DIR__ . '/create.php';
`
  )
  try {
    const output = execSync(`php "${runnerScript}"`, { encoding: 'utf8' })
    const json = JSON.parse(output)
    assert.equal(json.error, 'Method not allowed')
  } finally {
    if (fs.existsSync(runnerScript)) fs.unlinkSync(runnerScript)
  }
})

test('runtime: admin reservation endpoints reject unauthenticated and customer requests', () => {
  const adminEndpoints = ['list.php', 'update-status.php']
  for (const ep of adminEndpoints) {
    const epPath = path.join(RESERVATIONS_DIR, ep)
    if (!fs.existsSync(epPath)) continue

    const method = ep === 'list.php' ? 'GET' : 'POST'

    // 1. Unauthenticated -> 401
    const runnerUnauth = path.join(RESERVATIONS_DIR, `test_${ep}_unauth.php`)
    fs.writeFileSync(
      runnerUnauth,
      `<?php
$_SERVER['REQUEST_METHOD'] = '${method}';
require __DIR__ . '/${ep}';
`
    )
    try {
      const output = execSync(`php "${runnerUnauth}"`, { encoding: 'utf8' })
      const json = JSON.parse(output)
      assert.equal(json.error, 'Authentication required', `${ep} must reject unauthenticated requests with 401`)
    } finally {
      if (fs.existsSync(runnerUnauth)) fs.unlinkSync(runnerUnauth)
    }

    // 2. Customer role -> 403
    const runnerCustomer = path.join(RESERVATIONS_DIR, `test_${ep}_customer.php`)
    fs.writeFileSync(
      runnerCustomer,
      `<?php
$_SERVER['REQUEST_METHOD'] = '${method}';
require_once __DIR__ . '/../config.php';
$_SESSION['user_id'] = 42;
$_SESSION['user_role'] = 'customer';
require __DIR__ . '/${ep}';
`
    )
    try {
      const output = execSync(`php "${runnerCustomer}"`, { encoding: 'utf8' })
      const json = JSON.parse(output)
      assert.equal(json.error, 'Owner privileges required', `${ep} must reject customer role with 403`)
    } finally {
      if (fs.existsSync(runnerCustomer)) fs.unlinkSync(runnerCustomer)
    }
  }
})

test('runtime: formatReservationRow maps all fields and decodes JSON partColors', () => {
  const runner = path.join(RESERVATIONS_DIR, 'test_format_reservation.php')
  if (!fs.existsSync(RESERVATIONS_DIR)) {
    fs.mkdirSync(RESERVATIONS_DIR, { recursive: true })
  }
  fs.writeFileSync(
    runner,
    `<?php
require_once __DIR__ . '/../helpers.php';

$mockRow = [
    'id' => 'KC-2026-1041',
    'customer_name' => 'Alex Reyes',
    'email' => 'alex.reyes@example.com',
    'pickup_date' => '2026-09-18',
    'shoe_id' => 'kickcraft-one',
    'shoe_name' => 'KickCraft One',
    'size' => '9',
    'price' => '4890.00',
    'part_colors' => '{"upper":{"name":"Cobalt","value":"#245fa8"},"toe-cap":{"name":"Chalk","value":"#f1efe8"}}',
    'charm_id' => 'star',
    'charm_label' => 'Star',
    'status' => 'paid',
    'payment_method' => 'gcash',
    'notes' => 'Paid via GCash at studio counter.',
    'created_at' => '2026-09-11 14:32:00',
    'updated_at' => '2026-09-11 14:32:00',
];

$formatted = formatReservationRow($mockRow);
echo json_encode($formatted);
`
  )
  try {
    const output = execSync(`php "${runner}"`, { encoding: 'utf8' })
    const res = JSON.parse(output)
    assert.equal(res.id, 'KC-2026-1041')
    assert.equal(res.customerName, 'Alex Reyes')
    assert.equal(res.email, 'alex.reyes@example.com')
    assert.equal(res.customerEmail, 'alex.reyes@example.com')
    assert.equal(res.pickupDate, '2026-09-18')
    assert.equal(res.shoeId, 'kickcraft-one')
    assert.equal(res.shoeName, 'KickCraft One')
    assert.equal(res.size, 9)
    assert.equal(res.price, 4890)
    assert.equal(res.formattedPrice, '₱4,890')
    assert.deepEqual(res.partColors, {
      upper: { name: 'Cobalt', value: '#245fa8' },
      'toe-cap': { name: 'Chalk', value: '#f1efe8' },
    })
    assert.equal(res.charmId, 'star')
    assert.equal(res.charmLabel, 'Star')
    assert.equal(res.status, 'paid')
    assert.equal(res.paymentMethod, 'gcash')
    assert.equal(res.notes, 'Paid via GCash at studio counter.')
    assert.equal(res.createdAt, '2026-09-11 14:32:00')
    assert.equal(res.updatedAt, '2026-09-11 14:32:00')
  } finally {
    if (fs.existsSync(runner)) fs.unlinkSync(runner)
  }
})

test('runtime: generateReceiptId produces format KC-YYYY-XXXX', () => {
  const runner = path.join(RESERVATIONS_DIR, 'test_receipt_id.php')
  if (!fs.existsSync(RESERVATIONS_DIR)) {
    fs.mkdirSync(RESERVATIONS_DIR, { recursive: true })
  }
  fs.writeFileSync(
    runner,
    `<?php
require_once __DIR__ . '/../helpers.php';
$id = generateReceiptId();
echo json_encode(['id' => $id]);
`
  )
  try {
    const output = execSync(`php "${runner}"`, { encoding: 'utf8' })
    const res = JSON.parse(output)
    assert.match(res.id, /^KC-\d{4}-\d{4}$/, 'Receipt ID must match KC-YYYY-XXXX format')
  } finally {
    if (fs.existsSync(runner)) fs.unlinkSync(runner)
  }
})

test('runtime: create.php validates required fields and formats before DB call', () => {
  const runCreate = (body) => {
    const runner = path.join(RESERVATIONS_DIR, 'test_create_tmp.php')
    fs.writeFileSync(
      runner,
      `<?php
$_SERVER['REQUEST_METHOD'] = 'POST';
$GLOBALS['__JSON_BODY__'] = '${JSON.stringify(body).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}';
require __DIR__ . '/create.php';
`
    )
    try {
      const out = execSync(`php "${runner}"`, { encoding: 'utf8' })
      return JSON.parse(out)
    } finally {
      if (fs.existsSync(runner)) fs.unlinkSync(runner)
    }
  }

  // 1. Missing / short name
  const res1 = runCreate({ customerName: 'A' })
  assert.equal(res1.error, 'Customer name must be at least 2 characters')

  // 2. Invalid email
  const res2 = runCreate({ customerName: 'Alex Reyes', email: 'not-an-email' })
  assert.equal(res2.error, 'Valid email address is required')

  // 3. Invalid pickup date
  const res3 = runCreate({ customerName: 'Alex Reyes', email: 'alex@example.com', pickupDate: '2026/09/20' })
  assert.equal(res3.error, 'Valid pickup date (YYYY-MM-DD) is required')

  // 4. Missing shoeId
  const res4 = runCreate({
    customerName: 'Alex Reyes',
    email: 'alex@example.com',
    pickupDate: '2026-09-20',
    shoeId: '',
  })
  assert.equal(res4.error, 'Shoe ID is required')

  // 5. Invalid size (< 5 or > 15)
  const res5 = runCreate({
    customerName: 'Alex Reyes',
    email: 'alex@example.com',
    pickupDate: '2026-09-20',
    shoeId: 'kickcraft-one',
    size: 4,
  })
  assert.equal(res5.error, 'Valid shoe size between 5 and 15 is required')

  const res6 = runCreate({
    customerName: 'Alex Reyes',
    email: 'alex@example.com',
    pickupDate: '2026-09-20',
    shoeId: 'kickcraft-one',
    size: 16,
  })
  assert.equal(res6.error, 'Valid shoe size between 5 and 15 is required')
})

test('runtime: update-status.php validates inputs with owner session', () => {
  const runUpdateStatus = (body) => {
    const runner = path.join(RESERVATIONS_DIR, 'test_status_tmp.php')
    fs.writeFileSync(
      runner,
      `<?php
$_SERVER['REQUEST_METHOD'] = 'POST';
require_once __DIR__ . '/../config.php';
$_SESSION['user_id'] = 1;
$_SESSION['user_role'] = 'owner';
$GLOBALS['__JSON_BODY__'] = '${JSON.stringify(body).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}';
require __DIR__ . '/update-status.php';
`
    )
    try {
      const out = execSync(`php "${runner}"`, { encoding: 'utf8' })
      return JSON.parse(out)
    } finally {
      if (fs.existsSync(runner)) fs.unlinkSync(runner)
    }
  }

  // Missing ID
  const res1 = runUpdateStatus({ status: 'approved' })
  assert.equal(res1.error, 'Reservation ID is required')

  // Invalid status
  const res2 = runUpdateStatus({ id: 'KC-2026-1041', status: 'shipped' })
  assert.match(res2.error, /Invalid status/i)
})
