<?php
// KickCraft Reservation Status Update Endpoint (Owner/Admin only)

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../helpers.php';

requireMethod('POST');
requireAdmin();

$body = getJsonBody();

$id = trim((string)($body['id'] ?? ''));
if ($id === '') {
    jsonError('Reservation ID is required', 400);
}

$status = strtolower(trim((string)($body['status'] ?? '')));
$allowedStatuses = ['pending', 'paid', 'approved', 'ready', 'completed', 'cancelled'];

if (!in_array($status, $allowedStatuses, true)) {
    jsonError("Invalid status: must be one of 'pending', 'paid', 'approved', 'ready', 'completed', 'cancelled'", 400);
}

$db = getDb();

// Verify reservation exists
$stmtCheck = $db->prepare('SELECT id FROM reservations WHERE id = ?');
$stmtCheck->execute([$id]);
if (!$stmtCheck->fetch()) {
    jsonError('Reservation not found', 404);
}

// Update status with prepared statement
$stmtUpdate = $db->prepare('UPDATE reservations SET status = ?, updated_at = NOW() WHERE id = ?');
$stmtUpdate->execute([$status, $id]);

jsonResponse([
    'success' => true,
    'id' => $id,
    'status' => $status,
    'reservation' => [
        'id' => $id,
        'status' => $status,
    ],
]);
