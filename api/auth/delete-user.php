<?php
// KickCraft User Management - Soft/Hard Delete User Endpoint (Admin Only)

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../helpers.php';

requireMethod('POST');
requireAdmin();

$body = getJsonBody();
$id = $body['id'] ?? null;
$mode = strtolower(trim($body['mode'] ?? 'soft'));

if (!$id || !is_numeric($id)) {
    jsonError('User ID is required', 400);
}
$id = (int)$id;

if ($mode !== 'soft' && $mode !== 'hard') {
    jsonError("Invalid mode: must be 'soft' or 'hard'", 400);
}

// Prevent admin from deleting their own currently logged-in account
if (isset($_SESSION['user_id']) && $id === (int)$_SESSION['user_id']) {
    jsonError('Cannot delete your own account', 400);
}

$db = getDb();

$check = $db->prepare('SELECT id FROM users WHERE id = ?');
$check->execute([$id]);
if (!$check->fetch()) {
    jsonError('User not found', 404);
}

if ($mode === 'hard') {
    $stmt = $db->prepare('UPDATE users SET deleted_at = NOW(), permanently_deleted = 1 WHERE id = ?');
    $stmt->execute([$id]);
} else {
    $stmt = $db->prepare('UPDATE users SET deleted_at = NOW() WHERE id = ?');
    $stmt->execute([$id]);
}

jsonResponse([
    'success' => true,
    'message' => 'User deleted successfully',
    'mode' => $mode,
]);
