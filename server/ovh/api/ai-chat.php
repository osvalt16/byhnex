<?php
declare(strict_types=1);

// Only this entry point is public. Configuration and rate state stay outside /www.
ini_set('display_errors', '0');
ini_set('log_errors', '1');
@set_time_limit(55);
try {
    require __DIR__ . '/lib/backend.php';
    $settings = byhnex_load_settings(dirname(__DIR__, 2));
    $headers = [
        'origin' => $_SERVER['HTTP_ORIGIN'] ?? '',
        'authorization' => $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '',
        'content-type' => $_SERVER['CONTENT_TYPE'] ?? '',
        'content-length' => $_SERVER['CONTENT_LENGTH'] ?? '',
    ];
    // Read at most MAX_BODY + 1 bytes, including when Content-Length is absent.
    $body = $_SERVER['REQUEST_METHOD'] === 'POST' ? file_get_contents('php://input', false, null, 0, 65001) : '';
    $result = byhnex_handle($_SERVER['REQUEST_METHOD'], $headers, $body ?: '', $settings,
        'byhnex_openai_transport', static fn(): bool => byhnex_rate_limit($settings['privateDirectory']));
    http_response_code($result['status']);
    foreach ($result['headers'] as $name => $value) {
        header($name . ': ' . $value);
    }
    if ($result['body'] !== null) {
        echo json_encode($result['body'], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE | JSON_THROW_ON_ERROR);
    }
} catch (Throwable $error) {
    // Never expose exception details, filesystem paths, credentials or provider responses.
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo '{"error":{"code":"SERVER_UNAVAILABLE","message":"Le serveur de l’assistant est temporairement indisponible."}}';
}
