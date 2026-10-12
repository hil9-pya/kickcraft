<?php
// KickCraft Shoe Catalog - List Shoes Endpoint (Public Catalog with Admin Archive Support)

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../helpers.php';

requireMethod('GET');

$includeArchivedRequested = isset($_GET['include_archived']) && (string)$_GET['include_archived'] === '1';
$includeArchived = $includeArchivedRequested && isset($_SESSION['user_role']) && $_SESSION['user_role'] === 'owner';
if ($includeArchived) {
    // Refresh the role before exposing archived records; a demoted owner must not retain access.
    $includeArchived = (currentSessionUser()['role'] ?? '') === 'owner';
}

$db = getDb();

if ($includeArchived) {
    $stmt = $db->prepare('SELECT s.*,sp.store_name AS seller_store_name,sp.pickup_address,sp.contact AS seller_contact FROM shoes s LEFT JOIN seller_profiles sp ON sp.user_id=s.seller_user_id WHERE s.permanently_deleted = 0 ORDER BY s.created_at DESC');
} else {
    $stmt = $db->prepare('SELECT s.*,sp.store_name AS seller_store_name,sp.pickup_address,sp.contact AS seller_contact FROM shoes s LEFT JOIN seller_profiles sp ON sp.user_id=s.seller_user_id LEFT JOIN users u ON u.id=s.seller_user_id WHERE s.deleted_at IS NULL AND s.permanently_deleted = 0 AND (s.seller_user_id IS NULL OR (s.publication_state=\'approved\' AND sp.status=\'approved\' AND u.role=\'seller\' AND u.deleted_at IS NULL AND u.permanently_deleted=0)) ORDER BY s.created_at DESC');
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
