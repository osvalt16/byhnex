<?php
declare(strict_types=1);

function byhnex_parse_env(string $text): array
{
    $values = [];
    $text = preg_replace('/^\xEF\xBB\xBF/', '', $text);
    foreach (preg_split('/\r?\n/', $text) as $line) {
        if (!preg_match('/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/', $line, $match)) {
            continue;
        }
        if (!in_array($match[1], ['OPENAI_API_KEY', 'OPENAI_MODEL', 'BYHNEX_AI_ACCESS_CODE', 'ALLOWED_ORIGINS'], true)) {
            continue;
        }
        $value = $match[2];
        if (str_starts_with($value, '"') || str_starts_with($value, "'")) {
            $quote = $value[0];
            $end = strrpos($value, $quote);
            if ($end === 0 || !preg_match('/^\s*(?:#.*)?$/', substr($value, $end + 1))) {
                throw new RuntimeException('Configuration invalide.');
            }
            $value = substr($value, 1, $end - 1);
        } else {
            $value = trim(preg_replace('/\s+#.*$/', '', $value));
        }
        // No variable interpolation, shell evaluation or include of the .env file.
        $values[$match[1]] = $value;
    }
    return $values;
}

function byhnex_load_settings(string $ftpRoot): array
{
    // OVH's FTP '/' usually maps to /home/account, not the OS filesystem root.
    // With /www/api/ai-chat.php, dirname(__DIR__, 2) resolves that FTP root.
    $directory = $ftpRoot . '/.secrets';
    $file = $directory . '/.env';
    if (!is_readable($file) && is_readable('/.secrets/.env')) {
        $directory = '/.secrets';
        $file = $directory . '/.env';
    }
    $values = is_readable($file) ? byhnex_parse_env((string) file_get_contents($file)) : [];
    return $values + ['privateDirectory' => $directory, 'transportAvailable' => function_exists('curl_init'), 'privateStorageAvailable' => is_writable($directory)];
}

function byhnex_rate_limit(string $directory, ?int $now = null): bool
{
    // Shared file lock works across PHP-FPM workers; no cookie/session/IP spoofing.
    // Only authenticated requests reach this limiter. Six messages / rolling minute.
    $now ??= time();
    $previousMask = umask(0077);
    try {
        $file = @fopen($directory . '/byhnex-ai-rate.json', 'c+');
    } finally {
        umask($previousMask);
    }
    if ($file === false) {
        throw new RuntimeException('Limiteur indisponible.');
    }
    try {
        if (!flock($file, LOCK_EX)) {
            throw new RuntimeException('Limiteur indisponible.');
        }
        $raw = stream_get_contents($file, 2048);
        $timestamps = $raw === '' ? [] : json_decode($raw, true, 8, JSON_THROW_ON_ERROR);
        if (!is_array($timestamps)) {
            throw new RuntimeException('Limiteur indisponible.');
        }
        $timestamps = array_values(array_filter($timestamps, static fn($stamp) => is_int($stamp) && $stamp > $now - 60 && $stamp <= $now));
        if (count($timestamps) >= 6) {
            return false;
        }
        $timestamps[] = $now;
        rewind($file);
        if (!ftruncate($file, 0) || fwrite($file, json_encode($timestamps, JSON_THROW_ON_ERROR)) === false || !fflush($file)) {
            throw new RuntimeException('Limiteur indisponible.');
        }
        return true;
    } finally {
        flock($file, LOCK_UN);
        fclose($file);
    }
}
