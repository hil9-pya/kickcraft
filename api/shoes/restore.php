<?php
// KickCraft Shoe Catalog - Restore Soft-Deleted Shoe Endpoint (Owner Only)

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../helpers.php';

requireMethod('POST');
requireAdmin();

$body = getJsonBody();

$id = trim((string)($body['id'] ?? ''));
if ($id === '') {
    jsonError('Shoe ID is required', 400);
}

$db = getDb();

$check = $db->prepare('SELECT id, permanently_deleted, deleted_at FROM shoes WHERE id = ?');
$check->execute([$id]);
$shoe = $check->fetch();
if (!$shoe) {
    jsonError('Shoe not found', 404);
}

if ((int)$shoe['permanently_deleted'] === 1) {
    jsonError('Cannot restore permanently deleted shoe', 400);
}

$stmt = $db->prepare('UPDATE shoes SET deleted_at = NULL WHERE id = ? AND permanently_deleted = 0');
$stmt->execute([$id]);

jsonResponse([
    'success' => true,
    'message' => 'Shoe restored successfully',
]);
