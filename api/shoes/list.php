<?php
// KickCraft Shoe Catalog - List Shoes Endpoint (Public Catalog with Admin Archive Support)

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../helpers.php';

requireMethod('GET');

$includeArchived = isset($_GET['include_archived']) && (string)$_GET['include_archived'] === '1' && isset($_SESSION['user_role']) && $_SESSION['user_role'] === 'owner';

$db = getDb();

if ($includeArchived) {
    $stmt = $db->prepare('SELECT * FROM shoes WHERE permanently_deleted = 0 ORDER BY created_at DESC');
} else {
    $stmt = $db->prepare('SELECT * FROM shoes WHERE deleted_at IS NULL AND permanently_deleted = 0 ORDER BY created_at DESC');
}

$stmt->execute();
$shoes = $stmt->fetchAll();

$formatted = array_map(function ($row) {
    // Decode JSON columns into PHP arrays for native frontend consumption
    $row['categories'] = is_string($row['categories']) ? json_decode($row['categories'], true) : ($row['categories'] ?? []);
    $row['parts'] = is_string($row['parts']) ? json_decode($row['parts'], true) : ($row['parts'] ?? []);
    $row['colors'] = is_string($row['colors']) ? json_decode($row['colors'], true) : ($row['colors'] ?? []);
    
    $shoe = formatShoeRow($row);
    // Ensure formattedPrice is explicitly defined for frontend display
    $shoe['formattedPrice'] = $shoe['formattedPrice'] ?? ('₱' . number_format((float)$row['price']));
    return $shoe;
}, $shoes);

jsonResponse(['shoes' => $formatted]);
