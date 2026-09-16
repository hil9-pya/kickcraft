<?php
// KickCraft Reservation Status Update Endpoint (Owner or Customer Cancellation)

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../helpers.php';

requireMethod('POST');
requireAuth();

$body = getJsonBody();

$id = trim((string)($body['id'] ?? ''));
$status = strtolower(trim((string)($body['status'] ?? '')));

$allowedStatuses = ['pending', 'paid', 'approved', 'ready', 'completed', 'cancelled', 'arrived'];

$isOwner = (isset($_SESSION['user_role']) && $_SESSION['user_role'] === 'owner');
$isCustomer = (isset($_SESSION['user_role']) && $_SESSION['user_role'] === 'customer');

// Customer sessions can ONLY request cancellation
if (!$isOwner) {
    if (!$isCustomer || $status !== 'cancelled') {
        requireAdmin();
    }
}

if ($id === '') {
    jsonError('Reservation ID is required', 400);
}

if (!in_array($status, $allowedStatuses, true)) {
    jsonError("Invalid status: must be one of 'pending', 'paid', 'approved', 'ready', 'completed', 'cancelled', 'arrived'", 400);
}

$notes = sanitizeString($body['notes'] ?? '');

$db = getDb();

// If customer role, only allow cancelling their own pending reservation (WHERE id = ? AND email = ?)
if ($isCustomer) {
    $customerEmail = $_SESSION['user_email'] ?? '';
    $stmtCheck = $db->prepare('SELECT id, email, status, shoe_id, notes FROM reservations WHERE id = ? AND email = ?');
    $stmtCheck->execute([$id, $customerEmail]);
    $reservation = $stmtCheck->fetch();

    if (!$reservation) {
        // Check if reservation exists for another user to return 403 vs 404
        $stmtExists = $db->prepare('SELECT id FROM reservations WHERE id = ?');
        $stmtExists->execute([$id]);
        if ($stmtExists->fetch()) {
            jsonError('Access denied: You can only cancel your own reservation', 403);
        }
        jsonError('Reservation not found', 404);
    }

    if ($reservation['status'] !== 'pending') {
        jsonError('Only pending reservations can be cancelled', 403);
    }
} else {
    // Owner can update any existing reservation
    $stmtCheck = $db->prepare('SELECT id, email, status, shoe_id, notes FROM reservations WHERE id = ?');
    $stmtCheck->execute([$id]);
    $reservation = $stmtCheck->fetch();

    if (!$reservation) {
        jsonError('Reservation not found', 404);
    }
}

// Preserve existing notes if no new notes provided, otherwise update notes
$updatedNotes = array_key_exists('notes', $body) ? $notes : (string)($reservation['notes'] ?? '');

// Update reservation status and notes with prepared statement
$stmtUpdate = $db->prepare('UPDATE reservations SET status = ?, notes = ?, updated_at = NOW() WHERE id = ?');
$stmtUpdate->execute([$status, $updatedNotes, $id]);

// When transitioning to 'cancelled', restores shoe stock by 1
if ($reservation['status'] !== 'cancelled' && $status === 'cancelled') {
    $shoeId = (string)($reservation['shoe_id'] ?? '');
    if ($shoeId !== '') {
        $stmtStock = $db->prepare("UPDATE shoes SET stock = stock + 1, status = CASE WHEN stock + 1 > 0 AND status = 'out_of_stock' THEN 'in_stock' ELSE status END WHERE id = ?");
        $stmtStock->execute([$shoeId]);
    }
}

jsonResponse([
    'success' => true,
    'id' => $id,
    'status' => $status,
    'notes' => $updatedNotes,
    'reservation' => [
        'id' => $id,
        'status' => $status,
        'notes' => $updatedNotes,
    ],
]);
