<?php
declare(strict_types=1);

ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    header('Allow: GET');
    http_response_code(405);
    echo '{"error":"METHOD_NOT_ALLOWED"}';
    return;
}

try {
    $directory = dirname($_SERVER['DOCUMENT_ROOT']) . '/gss-private/news';
    if (!is_readable($directory . '/cache.php')) {
        throw new RuntimeException('News cache reader unavailable.');
    }
    require $directory . '/cache.php';
    echo json_encode(Gss\News\readCache($directory), JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Throwable $error) {
    http_response_code(503);
    echo '{"error":"NEWS_UNAVAILABLE"}';
}
