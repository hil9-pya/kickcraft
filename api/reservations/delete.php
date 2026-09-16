<?php
// KickCraft Reservation Soft Deletion Endpoint (Owner Only)

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

$db = getDb();

// Verify reservation exists
$stmtCheck = $db->prepare('SELECT id FROM reservations WHERE id = ?');
$stmtCheck->execute([$id]);
if (!$stmtCheck->fetch()) {
    jsonError('Reservation not found', 404);
}

// Soft delete reservation by setting deleted_at and permanently_deleted flag
$stmtDelete = $db->prepare('UPDATE reservations SET deleted_at = NOW(), permanently_deleted = 1, updated_at = NOW() WHERE id = ?');
$stmtDelete->execute([$id]);

jsonResponse([
    'success' => true,
    'id' => $id,
    'message' => 'Reservation deleted successfully',
]);
