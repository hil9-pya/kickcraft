<?php
// KickCraft Pickup Reservation Creation Endpoint

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../helpers.php';
require_once __DIR__.'/retries.php';

requireMethod('POST');

$body = getJsonBody();
foreach (['customerName'=>255,'email'=>254,'pickupDate'=>10,'shoeId'=>100,'charmId'=>50] as $field=>$maximum) {
    if (array_key_exists($field,$body) && (!is_string($body[$field]) || mb_strlen($body[$field])>$maximum)) jsonError('Invalid '.$field,400);
}


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
$dateObject = DateTime::createFromFormat('!Y-m-d', $pickupDate);
$dateErrors = DateTime::getLastErrors();
$hasDateErrors = is_array($dateErrors) && ($dateErrors['warning_count'] > 0 || $dateErrors['error_count'] > 0);
if (!$dateObject || $hasDateErrors || $dateObject->format('Y-m-d') !== $pickupDate) {
    jsonError('Valid pickup date (YYYY-MM-DD) is required', 400);
}


$shoeId = trim((string)($body['shoeId'] ?? ''));
if ($shoeId === '') {
    jsonError('Shoe ID is required', 400);
}

$rawSize = $body['size'] ?? null;
$parsedSize = filter_var($rawSize, FILTER_VALIDATE_INT, FILTER_NULL_ON_FAILURE);
if ($parsedSize === null || $parsedSize < 5 || $parsedSize > 15) {
    jsonError('Valid shoe size between 5 and 15 is required', 400);
}
$size = $parsedSize;

$charmId = strtolower(trim((string)($body['charmId'] ?? 'none'))) ?: 'none';
$charmLabels = ['none' => 'None', 'star' => 'Star', 'lightning' => 'Lightning', 'k-tag' => 'K tag'];
if (!array_key_exists($charmId, $charmLabels)) {
    jsonError('Unsupported charm selection', 400);
}
$partColors = $body['partColors'] ?? [];
if (!is_array($partColors) || count($partColors) > 16) {
    jsonError('Invalid customized part colors', 400);
}

$requestId=$body['requestId']??null;
if(!is_string($requestId)||!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/Di',$requestId))jsonError('A valid checkout request ID is required. Refresh the checkout and try again.',400);
$requestId=strtolower($requestId);$requestedColors=[];
foreach($partColors as $partId=>$color){
    if(!is_string($partId)||!is_array($color)||!is_string($color['value']??null))jsonError('Customization contains an invalid color',400);
    $value=strtolower(trim($color['value']));if(!preg_match('/^#[0-9a-f]{6}$/D',$value))jsonError('Customization contains an invalid color',400);
    $requestedColors[$partId]=$value;
}
ksort($requestedColors);
$requestHash=hash('sha256',json_encode([$customerName,strtolower($email),$pickupDate,$shoeId,$size,$charmId,$requestedColors],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES));

// 4. Database Transaction & Stock / Price Integrity
$db = getDb();
$db->beginTransaction();

try {
    // Select shoe price & stock directly from database with row lock
    $stmtShoe = $db->prepare('SELECT * FROM shoes WHERE id = ? AND deleted_at IS NULL AND permanently_deleted = 0 FOR UPDATE');
    $stmtShoe->execute([$shoeId]);
    $shoe = $stmtShoe->fetch();

    // Shoe lock serializes same-product retries, including the last available pair.
    if($saved=reservationRetry($db,$requestId,$requestHash)){
        $db->commit();jsonResponse(['success'=>true,'reservation'=>formatReservationRow($saved)],200);
    }
    $today = new DateTimeImmutable('today');
    $pickup = new DateTimeImmutable($pickupDate);
    if ($pickup < $today->modify('+7 days') || $pickup > $today->modify('+365 days')) {
        jsonError('Pickup date must be between 1 week and 1 year from today', 400);
    }

    if (!$shoe || (int)$shoe['stock'] <= 0 || !in_array($shoe['status'], ['available', 'in_stock'], true)) {
        $db->rollBack();
        jsonError('Shoe is out of stock or unavailable', 400);
    }

    $sellerId=$shoe['seller_user_id']===null?null:(int)$shoe['seller_user_id'];
    $pickupStore='KickCraft Flagship Studio';$pickupAddress='KickCraft Flagship Studio — contact pickup desk for directions';
    if($sellerId!==null){
        $sellerStmt=$db->prepare("SELECT sp.*,u.role,u.deleted_at,u.permanently_deleted FROM seller_profiles sp JOIN users u ON u.id=sp.user_id WHERE sp.user_id=? FOR UPDATE");$sellerStmt->execute([$sellerId]);$seller=$sellerStmt->fetch();
        if($shoe['publication_state']!=='approved' || !$seller || $seller['status']!=='approved' || $seller['role']!=='seller' || $seller['deleted_at']!==null || (int)$seller['permanently_deleted']!==0){$db->rollBack();jsonError('This seller listing is unavailable',400);}
        $pickupStore=$seller['store_name'];$pickupAddress=$seller['pickup_address'];
    }
    $availableSizes=json_decode($shoe['sizes']??'[7,8,9,10,11]',true)?:[7,8,9,10,11];
    if(!in_array($size,$availableSizes,true)){$db->rollBack();jsonError('This shoe is not available in that size',400);}

    $price = (float)$shoe['price'];
    $shoeName = (string)$shoe['name'];

    if (!(bool)$shoe['charms_enabled'] && $charmId !== 'none') {
        $db->rollBack();
        jsonError('This shoe does not support charms', 400);
    }

    $shoeParts = json_decode((string)$shoe['parts'], true) ?: [];
    $shoeColors = json_decode((string)$shoe['colors'], true) ?: [];
    $allowedParts = array_fill_keys(array_filter(array_column($shoeParts, 'id'), 'is_string'), true);
    $allowedColors = [];
    foreach ($shoeColors as $color) {
        $value = strtolower((string)($color['value'] ?? ''));
        if (preg_match('/^#[0-9a-f]{6}$/', $value)) {
            $allowedColors[$value] = (string)($color['name'] ?? $value);
        }
    }

    $validatedColors = [];
    foreach ($partColors as $partId => $color) {
        if (!is_string($partId) || !isset($allowedParts[$partId]) || !is_array($color)) {
            $db->rollBack();
            jsonError('Customization contains an unknown shoe part', 400);
        }
        if (!is_string($color['value'] ?? null)) { $db->rollBack(); jsonError('Customization contains an invalid color',400); }
        $value = strtolower(trim($color['value']));
        if (!preg_match('/^#[0-9a-f]{6}$/D', $value)) {
            $db->rollBack();
            jsonError('Customization contains an invalid color', 400);
        }
        $validatedColors[$partId] = ['name' => $allowedColors[$value] ?? ('Custom ' . strtoupper($value)), 'value' => $value];
    }
    $partColorsJson = json_encode($validatedColors, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($partColorsJson === false || strlen($partColorsJson) > 8192) {
        $db->rollBack();
        jsonError('Customized part colors are too large', 400);
    }

    // Generate unique receipt ID (KC-YYYY-XXXX)
    $reservationId = generateReceiptId($db);

    // Insert reservation record with prepared statement
    $stmtInsert = $db->prepare('INSERT INTO reservations (id, customer_name, email, pickup_date, shoe_id, shoe_name, size, price, part_colors, charm_id, charm_label, status, notes, seller_user_id, pickup_store, pickup_address, checkout_request_id, checkout_request_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
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
        $charmLabels[$charmId],
        'pending',
        '',
        $sellerId,
        $pickupStore,
        $pickupAddress,
        $requestId,
        $requestHash,
    ]);

    // Decrement stock; mark out_of_stock if stock <= 0
    // MySQL's second assignment sees the already-decremented stock.
    $stmtStock = $db->prepare("UPDATE shoes SET stock = stock - 1, status = CASE WHEN stock <= 0 THEN 'out_of_stock' ELSE status END WHERE id = ?");
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
        'seller_user_id' => $sellerId,
        'pickup_store' => $pickupStore,
        'pickup_address' => $pickupAddress,
        'size' => $size,
        'price' => $price,
        'part_colors' => $partColorsJson,
        'charm_id' => $charmId,
        'charm_label' => $charmLabels[$charmId],
        'status' => 'pending',
        'notes' => '',
        'created_at' => $now,
        'updated_at' => $now,
    ];

    jsonResponse([
        'success' => true,
        'reservation' => formatReservationRow($reservationRow),
    ], 201);
} catch (Throwable $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    // Different-product requests can race on the same globally unique request ID.
    if($e instanceof PDOException && $e->getCode()==='23000' && ($saved=reservationRetry($db,$requestId,$requestHash)))jsonResponse(['success'=>true,'reservation'=>formatReservationRow($saved)],200);
    error_log('KickCraft reservation create failed: ' . $e->getMessage());
    jsonError('Failed to create reservation. Please try again.', 500);
}
