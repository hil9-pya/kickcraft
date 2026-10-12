<?php
// KickCraft Database PDO Singleton

require_once __DIR__ . '/config.php';

function getDb(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $host = configValue('DB_HOST') ?: 'localhost';
        $port = configValue('DB_PORT') ?: '3306';
        $db   = configValue('DB_NAME') ?: 'kickcraft_db';
        $user = configValue('DB_USER') ?: 'root';
        $pass = configValue('DB_PASS', '');
        $dsn = "mysql:host={$host};port={$port};dbname={$db};charset=utf8mb4";
        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    }
    return $pdo;
}
