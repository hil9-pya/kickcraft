<?php
// KickCraft Database PDO Singleton

require_once __DIR__ . '/config.php';

function getDb(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $host = getenv('DB_HOST') ?: 'localhost';
        $port = getenv('DB_PORT') ?: '3306';
        $db   = getenv('DB_NAME') ?: 'kickcraft_db';
        $user = getenv('DB_USER') ?: 'root';
        $pass = getenv('DB_PASS') !== false ? getenv('DB_PASS') : '';
        $dsn = "mysql:host={$host};port={$port};dbname={$db};charset=utf8mb4";
        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);

        // Self-heal: ensure reservations table has arrived status and soft-delete columns
        try {
            $cols = $pdo->query("SHOW COLUMNS FROM reservations")->fetchAll(PDO::FETCH_COLUMN);
            if (!in_array('deleted_at', $cols, true)) {
                $pdo->exec("ALTER TABLE reservations ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL");
            }
            if (!in_array('permanently_deleted', $cols, true)) {
                $pdo->exec("ALTER TABLE reservations ADD COLUMN permanently_deleted TINYINT(1) NOT NULL DEFAULT 0");
            }
            $statusCol = $pdo->query("SHOW COLUMNS FROM reservations LIKE 'status'")->fetch();
            if ($statusCol && isset($statusCol['Type']) && strpos($statusCol['Type'], "'arrived'") === false) {
                $pdo->exec("ALTER TABLE reservations MODIFY COLUMN status ENUM('pending', 'paid', 'approved', 'ready', 'completed', 'cancelled', 'arrived') NOT NULL DEFAULT 'pending'");
            }
        } catch (Throwable $e) {
            // Table might not exist yet before setup.sql is imported
        }
    }
    return $pdo;
}
