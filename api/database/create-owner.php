<?php
// One-time owner bootstrap. Keep credentials in api/.env, never in source control.

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit("Not found\n");
}

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';

$name = trim((string)(getenv('KICKCRAFT_OWNER_NAME') ?: ''));
$email = strtolower(trim((string)(getenv('KICKCRAFT_OWNER_EMAIL') ?: '')));
$password = (string)(getenv('KICKCRAFT_OWNER_PASSWORD') ?: '');

if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 8) {
    fwrite(STDERR, "Set KICKCRAFT_OWNER_NAME, KICKCRAFT_OWNER_EMAIL, and an 8+ character KICKCRAFT_OWNER_PASSWORD in api/.env.\n");
    exit(1);
}

$db = getDb();
$hash = password_hash($password, PASSWORD_BCRYPT);
$stmt = $db->prepare(
    'INSERT INTO users (name, email, password_hash, role, deleted_at, permanently_deleted) VALUES (?, ?, ?, \'owner\', NULL, 0)
     ON DUPLICATE KEY UPDATE name = VALUES(name), password_hash = VALUES(password_hash), role = \'owner\', deleted_at = NULL, permanently_deleted = 0'
);
$stmt->execute([$name, $email, $hash]);

fwrite(STDOUT, "Owner account ready: {$email}\n");
