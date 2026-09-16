<?php
// KickCraft Reservation & Walk-in Sale Creation Endpoint

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../helpers.php';

requireMethod('POST');

$body = getJsonBody();

// 1. Server-side input validations
$customerName = sanitizeString($body['customerName'] ?? '');
if (strlen($customerName) < 2) {
    jsonError('Customer name must be at least 2 characters', 400);
}

$email = validateEmail($body['email'] ?? '');
if (!$email) {
    jsonError('Valid email address is required', 400);
}

$pickupDate = trim((string)($body['pickupDate'] ?? ''));
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $pickupDate) || !strtotime($pickupDate)) {
    jsonError('Valid pickup date (YYYY-MM-DD) is required', 400);
}

$shoeId = trim((string)($body['shoeId'] ?? ''));
if ($shoeId === '') {
    jsonError('Shoe ID is required', 400);
}

$rawSize = $body['size'] ?? null;
if (!is_numeric($rawSize) || (int)$rawSize < 5 || (int)$rawSize > 15) {
    jsonError('Valid shoe size between 5 and 15 is required', 400);
}
$size = (int)$rawSize;

// 2. Optional fields with safe defaults
$charmId = sanitizeString($body['charmId'] ?? 'none') ?: 'none';
$charmLabel = sanitizeString($body['charmLabel'] ?? 'None') ?: 'None';
$paymentMethod = sanitizeString($body['paymentMethod'] ?? 'in_store') ?: 'in_store';
$notes = sanitizeString($body['notes'] ?? '');

$partColors = $body['partColors'] ?? [];
if (!is_array($partColors) && !is_object($partColors)) {
    $partColors = [];
}
$partColorsJson = json_encode($partColors, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

// 3. Status handling: owner walk-in can set paid, otherwise default pending
$isOwner = isset($_SESSION['user_role']) && $_SESSION['user_role'] === 'owner';
$requestedStatus = strtolower(trim((string)($body['status'] ?? '')));
$status = ($isOwner && $requestedStatus === 'paid') ? 'paid' : 'pending';

// 4. Database Transaction & Stock / Price Integrity
$db = getDb();
$db->beginTransaction();

try {
    // Select shoe price & stock directly from database with row lock
    $stmtShoe = $db->prepare('SELECT id, name, price, stock, status FROM shoes WHERE id = ? AND deleted_at IS NULL AND permanently_deleted = 0 FOR UPDATE');
    $stmtShoe->execute([$shoeId]);
    $shoe = $stmtShoe->fetch();

    if (!$shoe || (int)$shoe['stock'] <= 0) {
        $db->rollBack();
        jsonError('Shoe is out of stock or unavailable', 400);
    }

    $price = (float)$shoe['price'];
    $shoeName = (string)$shoe['name'];

    // Generate unique receipt ID (KC-YYYY-XXXX)
    $reservationId = generateReceiptId($db);

    // Insert reservation record with prepared statement
    $stmtInsert = $db->prepare('INSERT INTO reservations (id, customer_name, email, pickup_date, shoe_id, shoe_name, size, price, part_colors, charm_id, charm_label, status, payment_method, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $stmtInsert->execute([
        $reservationId,
        $customerName,
        $email,
        $pickupDate,
        $shoeId,
        $shoeName,
        $size,
        $price,
        $partColorsJson,
        $charmId,
        $charmLabel,
        $status,
        $paymentMethod,
        $notes,
    ]);

    // Decrement stock; mark out_of_stock if stock <= 0
    $stmtStock = $db->prepare("UPDATE shoes SET stock = stock - 1, status = CASE WHEN stock - 1 <= 0 THEN 'out_of_stock' ELSE status END WHERE id = ?");
    $stmtStock->execute([$shoeId]);

    $db->commit();

    $now = date('Y-m-d H:i:s');
    $reservationRow = [
        'id' => $reservationId,
        'customer_name' => $customerName,
        'email' => $email,
        'pickup_date' => $pickupDate,
        'shoe_id' => $shoeId,
        'shoe_name' => $shoeName,
        'size' => $size,
        'price' => $price,
        'part_colors' => $partColorsJson,
        'charm_id' => $charmId,
        'charm_label' => $charmLabel,
        'status' => $status,
        'payment_method' => $paymentMethod,
        'notes' => $notes,
        'created_at' => $now,
        'updated_at' => $now,
    ];

    jsonResponse([
        'success' => true,
        'reservation' => formatReservationRow($reservationRow),
    ], 201);
} catch (Exception $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    jsonError('Failed to create reservation: ' . $e->getMessage(), 500);
}
