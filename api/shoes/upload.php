<?php
// Authenticated owner upload for local GLB and thumbnail assets.

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../helpers.php';

requireMethod('POST');
requireAdmin();

$kind = strtolower(trim((string)($_POST['kind'] ?? 'model')));
$file = $_FILES['file'] ?? null;
$maxBytes = $kind === 'thumbnail' ? 5 * 1024 * 1024 : 20 * 1024 * 1024;
$allowedExtensions = $kind === 'thumbnail' ? ['png', 'jpg', 'jpeg', 'webp'] : ['glb'];

if (!is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    jsonError('A file upload is required', 400);
}
if (!in_array($kind, ['model', 'thumbnail'], true)) {
    jsonError('Invalid upload kind', 400);
}
if ((int)$file['size'] <= 0 || (int)$file['size'] > $maxBytes) {
    jsonError('Uploaded file is empty or too large', 413);
}

$extension = strtolower(pathinfo((string)$file['name'], PATHINFO_EXTENSION));
if (!in_array($extension, $allowedExtensions, true)) {
    jsonError('Unsupported file type', 415);
}

$temporaryPath = (string)$file['tmp_name'];
if ($kind === 'model') {
    $header = file_get_contents($temporaryPath, false, null, 0, 4);
    if ($header !== 'glTF') {
        jsonError('The 3D model is not a valid binary GLB file', 422);
    }
} elseif (@getimagesize($temporaryPath) === false) {
    jsonError('The thumbnail is not a valid image', 422);
}

$relativeDirectory = $kind === 'thumbnail' ? 'public/images/uploads' : 'public/models/uploads';
$publicPrefix = $kind === 'thumbnail' ? '/images/uploads/' : '/models/uploads/';
$directory = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relativeDirectory);
if (!is_dir($directory) && !mkdir($directory, 0755, true) && !is_dir($directory)) {
    jsonError('Upload storage is unavailable', 500);
}

try {
    $filename = bin2hex(random_bytes(16)) . '.' . $extension;
} catch (Throwable $e) {
    error_log('KickCraft upload filename generation failed: ' . $e->getMessage());
    jsonError('Upload storage is unavailable', 500);
}

$targetPath = $directory . DIRECTORY_SEPARATOR . $filename;
if (!move_uploaded_file($temporaryPath, $targetPath)) {
    jsonError('Could not save uploaded file', 500);
}

jsonResponse([
    'success' => true,
    'kind' => $kind,
    'path' => $publicPrefix . $filename,
    'filename' => $filename,
], 201);
