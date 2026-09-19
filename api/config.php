<?php
// KickCraft Shared Configuration & Environment Bootstrap

// 1. Load .env file from __DIR__ . '/.env'
$envFile = __DIR__ . '/.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }
        if (strpos($line, '=') !== false) {
            [$key, $value] = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value);
            if (preg_match('/^([\'"]).*\1$/', $value)) {
                $value = substr($value, 1, -1);
            }
            if (!array_key_exists($key, $_ENV)) {
                $_ENV[$key] = $value;
            }
            if (!array_key_exists($key, $_SERVER)) {
                $_SERVER[$key] = $value;
            }
            putenv("{$key}={$value}");
        }
    }
}

// 2. Configure session cookies & start session
if (session_status() === PHP_SESSION_NONE) {
    // PHP CLI (used by local checks) may inherit an unwritable XAMPP session path.
    if (PHP_SAPI === 'cli') {
        $cliSessionPath = sys_get_temp_dir();
        if (is_dir($cliSessionPath) && is_writable($cliSessionPath)) {
            session_save_path($cliSessionPath);
        }
    }
    session_set_cookie_params([
        'lifetime' => 86400 * 7,
        'path' => '/',
        'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'httponly' => true,
        'samesite' => 'Lax'
    ]);
    session_start();
}

// 3. Set CORS headers from a small explicit allowlist.
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$configuredOrigins = getenv('CORS_ORIGINS') ?: 'http://localhost:5173,http://127.0.0.1:5173';
$allowedOrigins = array_values(array_filter(array_map('trim', explode(',', $configuredOrigins))));
if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
    header("Access-Control-Allow-Origin: {$origin}");
} else {
    header('Access-Control-Allow-Origin: ' . ($allowedOrigins[0] ?? 'http://localhost:5173'));
}
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

// 4. Handle OPTIONS preflight request
if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

// 5. Default content type header
header('Content-Type: application/json; charset=utf-8');
