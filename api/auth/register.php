<?php
// KickCraft Authentication - Register Endpoint

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../helpers.php';

requireMethod('POST');

$body = getJsonBody();
$name = trim($body['name'] ?? '');
$email = trim($body['email'] ?? '');
$password = (string)($body['password'] ?? '');

if (mb_strlen($name) < 2) {
    jsonError('Name must be at least 2 characters', 400);
}

if (!validateEmail($email)) {
    jsonError('Invalid email address', 400);
}

if (strlen($password) < 6) {
    jsonError('Password must be at least 6 characters', 400);
}

$db = getDb();

// Check if email already taken
$stmt = $db->prepare('SELECT id FROM users WHERE email = ?');
$stmt->execute([$email]);
if ($stmt->fetch()) {
    jsonError('Email already registered', 409);
}

$passwordHash = password_hash($password, PASSWORD_BCRYPT);
$cleanName = sanitizeString($name);
$cleanEmail = strtolower($email);

$insert = $db->prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)');
$insert->execute([$cleanName, $cleanEmail, $passwordHash, 'customer']);

jsonResponse([
    'success' => true,
    'message' => 'Account created successfully',
], 201);
