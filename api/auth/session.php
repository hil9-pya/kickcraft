<?php
// KickCraft Authentication - Session Status Endpoint

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../helpers.php';

requireMethod('GET');

// currentSessionUser() uses prepare() with a prepared statement and checks deleted_at IS NULL and permanently_deleted = 0.
if (isset($_SESSION['user_id']) && ($user = currentSessionUser())) {
    jsonResponse([
        'authenticated' => true,
        'user' => [
            'id' => (int)$user['id'],
            'name' => $user['name'],
            'email' => $user['email'],
            'role' => $user['role'],
        ],
    ]);
}

jsonResponse(['authenticated' => false]);
