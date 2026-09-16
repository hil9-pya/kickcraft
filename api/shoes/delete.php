<?php
// KickCraft Shoe Catalog - Soft/Hard Delete Shoe Endpoint (Owner Only)

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

$mode = strtolower(trim((string)($body['mode'] ?? 'soft')));
if ($mode !== 'soft' && $mode !== 'hard') {
    jsonError("Invalid mode: must be 'soft' or 'hard'", 400);
}

$db = getDb();

$check = $db->prepare('SELECT id FROM shoes WHERE id = ?');
$check->execute([$id]);
if (!$check->fetch()) {
    jsonError('Shoe not found', 404);
}

if ($mode === 'hard') {
    $stmt = $db->prepare('UPDATE shoes SET deleted_at = NOW(), permanently_deleted = 1 WHERE id = ?');
    $stmt->execute([$id]);
} else {
    $stmt = $db->prepare('UPDATE shoes SET deleted_at = NOW() WHERE id = ?');
    $stmt->execute([$id]);
}

jsonResponse([
    'success' => true,
    'message' => 'Shoe deleted successfully',
    'mode' => $mode,
]);
