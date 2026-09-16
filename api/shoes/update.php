<?php
// KickCraft Shoe Catalog - Update Shoe Endpoint (Owner Only)

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

$check = $db->prepare('SELECT * FROM shoes WHERE id = ? AND permanently_deleted = 0');
$check->execute([$id]);
$shoe = $check->fetch();
if (!$shoe) {
    jsonError('Shoe not found', 404);
}

$fields = [];
$params = [];

if (isset($body['name'])) {
    $name = trim((string)$body['name']);
    if ($name === '') {
        jsonError('Shoe name cannot be empty', 400);
    }
    $fields[] = 'name = ?';
    $params[] = $name;
}

if (isset($body['description'])) {
    $fields[] = 'description = ?';
    $params[] = trim((string)$body['description']);
}

if (isset($body['price'])) {
    if (!is_numeric($body['price']) || (float)$body['price'] < 0) {
        jsonError('Valid price is required', 400);
    }
    $fields[] = 'price = ?';
    $params[] = (float)$body['price'];
}

if (isset($body['stock'])) {
    if (!is_numeric($body['stock']) || (int)$body['stock'] < 0) {
        jsonError('Valid stock count is required', 400);
    }
    $fields[] = 'stock = ?';
    $params[] = (int)$body['stock'];
}

if (isset($body['status'])) {
    $status = trim((string)$body['status']);
    if (in_array($status, ['available', 'coming_soon', 'out_of_stock'], true)) {
        $fields[] = 'status = ?';
        $params[] = $status;
    }
}

if (isset($body['glbPath']) || isset($body['glb_path'])) {
    $fields[] = 'glb_path = ?';
    $params[] = trim((string)($body['glbPath'] ?? $body['glb_path']));
}

if (isset($body['thumbnailPath']) || isset($body['thumbnail_path'])) {
    $fields[] = 'thumbnail_path = ?';
    $params[] = trim((string)($body['thumbnailPath'] ?? $body['thumbnail_path']));
}

if (isset($body['charmsEnabled']) || isset($body['charms_enabled'])) {
    $val = $body['charmsEnabled'] ?? $body['charms_enabled'];
    $fields[] = 'charms_enabled = ?';
    $params[] = $val ? 1 : 0;
}

if (array_key_exists('charmOffset', $body) || array_key_exists('charm_offset', $body)) {
    $fields[] = 'charm_offset = ?';
    $params[] = $body['charmOffset'] ?? $body['charm_offset'];
}

if (array_key_exists('charmScale', $body) || array_key_exists('charm_scale', $body)) {
    $fields[] = 'charm_scale = ?';
    $params[] = $body['charmScale'] ?? $body['charm_scale'];
}

if (array_key_exists('charmDir', $body) || array_key_exists('charm_dir', $body)) {
    $fields[] = 'charm_dir = ?';
    $params[] = $body['charmDir'] ?? $body['charm_dir'];
}

if (isset($body['categories'])) {
    $rawCat = $body['categories'];
    $categories = is_string($rawCat) ? (json_decode($rawCat, true) ?: []) : (is_array($rawCat) ? $rawCat : []);
    $fields[] = 'categories = ?';
    $params[] = json_encode($categories, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
}

if (isset($body['parts'])) {
    $rawParts = $body['parts'];
    $parts = is_string($rawParts) ? (json_decode($rawParts, true) ?: []) : (is_array($rawParts) ? $rawParts : []);
    $fields[] = 'parts = ?';
    $params[] = json_encode($parts, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
}

if (isset($body['colors'])) {
    $rawColors = $body['colors'];
    $colors = is_string($rawColors) ? (json_decode($rawColors, true) ?: []) : (is_array($rawColors) ? $rawColors : []);
    $fields[] = 'colors = ?';
    $params[] = json_encode($colors, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
}

if (!empty($fields)) {
    $sql = 'UPDATE shoes SET ' . implode(', ', $fields) . ', updated_at = NOW() WHERE id = ? AND permanently_deleted = 0';
    $params[] = $id;
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
}

$fetch = $db->prepare('SELECT * FROM shoes WHERE id = ?');
$fetch->execute([$id]);
$updated = $fetch->fetch();

jsonResponse([
    'success' => true,
    'shoe' => formatShoeRow($updated),
]);
