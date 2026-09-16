<?php
// KickCraft Shoe Catalog - Restock Shoe Endpoint (Owner Only)

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

if (!isset($body['amount']) || !is_numeric($body['amount']) || (int)$body['amount'] <= 0) {
    jsonError('Restock amount must be greater than 0', 400);
}
$amount = (int)$body['amount'];

$db = getDb();

$check = $db->prepare('SELECT id FROM shoes WHERE id = ? AND permanently_deleted = 0');
$check->execute([$id]);
if (!$check->fetch()) {
    jsonError('Shoe not found', 404);
}

$stmt = $db->prepare("UPDATE shoes SET stock = stock + ?, status = CASE WHEN status = 'out_of_stock' THEN 'available' ELSE status END, updated_at = NOW() WHERE id = ? AND permanently_deleted = 0");
$stmt->execute([$amount, $id]);

$get = $db->prepare('SELECT stock FROM shoes WHERE id = ?');
$get->execute([$id]);
$newStock = (int)$get->fetchColumn();

jsonResponse([
    'success' => true,
    'id' => $id,
    'stock' => $newStock,
]);
