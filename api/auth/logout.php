<?php
// KickCraft Authentication - Logout Endpoint

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../helpers.php';

requireMethod('POST');

session_unset();
session_destroy();

jsonResponse([
    'success' => true,
    'message' => 'Logged out successfully',
]);
