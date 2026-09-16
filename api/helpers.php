<?php
// KickCraft Shared API Helpers

function jsonResponse($data, int $statusCode = 200): void {
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function jsonError(string $message, int $statusCode = 400, $details = null): void {
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    $payload = ['error' => $message];
    if ($details !== null) {
        $payload['details'] = $details;
    }
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function requireMethod(string $method): void {
    $currentMethod = $_SERVER['REQUEST_METHOD'] ?? '';
    if (strcasecmp($currentMethod, $method) !== 0) {
        jsonError('Method not allowed', 405);
    }
}

function requireAuth(): void {
    if (!isset($_SESSION['user_id'])) {
        jsonError('Authentication required', 401);
    }
}

function requireAdmin(): void {
    if (!isset($_SESSION['user_id'])) {
        jsonError('Authentication required', 401);
    }
    if (($_SESSION['user_role'] ?? '') !== 'owner') {
        jsonError('Owner privileges required', 403);
    }
}

function getJsonBody(): array {
    $raw = file_get_contents('php://input');
    if (!$raw && php_sapi_name() === 'cli' && isset($GLOBALS['__JSON_BODY__'])) {
        $raw = is_string($GLOBALS['__JSON_BODY__']) ? $GLOBALS['__JSON_BODY__'] : json_encode($GLOBALS['__JSON_BODY__']);
    }
    if (!$raw) {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function sanitizeString(?string $val): string {
    return trim(htmlspecialchars((string)($val ?? ''), ENT_QUOTES, 'UTF-8'));
}

function validateEmail(?string $val) {
    $email = trim((string)($val ?? ''));
    return filter_var($email, FILTER_VALIDATE_EMAIL);
}

function formatShoeRow(array $row): array {
    $price = (float)($row['price'] ?? 0);
    $formattedPrice = '₱' . number_format($price, floor($price) == $price ? 0 : 2);

    $decodeJson = function($val) {
        if (is_array($val)) return $val;
        if (is_string($val) && trim($val) !== '') {
            $decoded = json_decode($val, true);
            if (is_array($decoded)) return $decoded;
        }
        return [];
    };

    return [
        'id' => (string)($row['id'] ?? ''),
        'name' => (string)($row['name'] ?? ''),
        'description' => (string)($row['description'] ?? ''),
        'price' => $price,
        'formattedPrice' => $formattedPrice,
        'stock' => (int)($row['stock'] ?? 0),
        'status' => (string)($row['status'] ?? 'available'),
        'glbPath' => (string)($row['glb_path'] ?? ''),
        'thumbnailPath' => (string)($row['thumbnail_path'] ?? '/images/kickcraft-one-card.png'),
        'charmsEnabled' => (bool)($row['charms_enabled'] ?? true),
        'charmOffset' => $row['charm_offset'] ?? null,
        'charmScale' => $row['charm_scale'] ?? '1 1 1',
        'charmDir' => $row['charm_dir'] ?? null,
        'categories' => $decodeJson($row['categories'] ?? null),
        'parts' => $decodeJson($row['parts'] ?? null),
        'colors' => $decodeJson($row['colors'] ?? null),
        'createdAt' => $row['created_at'] ?? null,
        'updatedAt' => $row['updated_at'] ?? null,
        'deletedAt' => $row['deleted_at'] ?? null,
        'permanentlyDeleted' => (int)($row['permanently_deleted'] ?? 0),
    ];
}

function generateReceiptId(?PDO $db = null): string {
    $year = date('Y');
    $candidate = "KC-{$year}-" . random_int(1000, 9999);
    if ($db) {
        for ($i = 0; $i < 10; $i++) {
            $stmt = $db->prepare('SELECT COUNT(*) FROM reservations WHERE id = ?');
            $stmt->execute([$candidate]);
            if ((int)$stmt->fetchColumn() === 0) {
                return $candidate;
            }
            $candidate = "KC-{$year}-" . random_int(1000, 9999);
        }
    }
    return $candidate;
}

function formatReservationRow(array $row): array {
    $price = (float)($row['price'] ?? 0);
    $formattedPrice = '₱' . number_format($price, floor($price) == $price ? 0 : 2);

    $decodeJson = function($val) {
        if (is_array($val)) return $val;
        if (is_string($val) && trim($val) !== '') {
            $decoded = json_decode($val, true);
            if (is_array($decoded)) return $decoded;
        }
        return [];
    };

    $email = (string)($row['email'] ?? '');

    return [
        'id' => (string)($row['id'] ?? ''),
        'customerName' => (string)($row['customer_name'] ?? ''),
        'email' => $email,
        'customerEmail' => $email,
        'pickupDate' => (string)($row['pickup_date'] ?? ''),
        'shoeId' => (string)($row['shoe_id'] ?? ''),
        'shoeName' => (string)($row['shoe_name'] ?? ''),
        'size' => (int)($row['size'] ?? 0),
        'price' => $price,
        'formattedPrice' => $formattedPrice,
        'partColors' => $decodeJson($row['part_colors'] ?? null),
        'charmId' => (string)($row['charm_id'] ?? 'none'),
        'charmLabel' => (string)($row['charm_label'] ?? 'None'),
        'status' => (string)($row['status'] ?? 'pending'),
        'paymentMethod' => (string)($row['payment_method'] ?? 'in_store'),
        'notes' => (string)($row['notes'] ?? ''),
        'date' => $row['created_at'] ?? null,
        'createdAt' => $row['created_at'] ?? null,
        'updatedAt' => $row['updated_at'] ?? null,
    ];
}
