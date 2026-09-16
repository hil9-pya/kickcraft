<?php
// KickCraft Authentication - Session Status Endpoint

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../helpers.php';

requireMethod('GET');

if (isset($_SESSION['user_id'])) {
    $db = getDb();
    $stmt = $db->prepare('SELECT id, name, email, role FROM users WHERE id = ? AND deleted_at IS NULL AND permanently_deleted = 0');
    $stmt->execute([$_SESSION['user_id']]);
    $user = $stmt->fetch();

    if ($user) {
        jsonResponse([
            'authenticated' => true,
            'user' => [
                'id' => (int)$user['id'],
                'name' => $user['name'],
                'email' => $user['email'],
                'role' => $user['role'],
            ],
        ]);
    } else {
        // User session exists but user was removed or soft-deleted in database
        session_unset();
        session_destroy();
        jsonResponse(['authenticated' => false]);
    }
}

jsonResponse(['authenticated' => false]);
