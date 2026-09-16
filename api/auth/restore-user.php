<?php
// KickCraft User Management - Restore Soft-Deleted User Endpoint (Admin Only)

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../helpers.php';

requireMethod('POST');
requireAdmin();

$body = getJsonBody();
$id = $body['id'] ?? null;

if (!$id || !is_numeric($id)) {
    jsonError('User ID is required', 400);
}
$id = (int)$id;

$db = getDb();

$check = $db->prepare('SELECT id, permanently_deleted FROM users WHERE id = ?');
$check->execute([$id]);
$user = $check->fetch();

if (!$user) {
    jsonError('User not found', 404);
}

if ((int)$user['permanently_deleted'] === 1) {
    jsonError('Cannot restore permanently deleted user', 400);
}

$stmt = $db->prepare('UPDATE users SET deleted_at = NULL WHERE id = ? AND permanently_deleted = 0');
$stmt->execute([$id]);

jsonResponse([
    'success' => true,
    'message' => 'User restored successfully',
]);
