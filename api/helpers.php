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
