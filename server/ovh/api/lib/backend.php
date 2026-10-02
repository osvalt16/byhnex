<?php
declare(strict_types=1);
require_once __DIR__ . '/settings.php';
require_once __DIR__ . '/context.php';
require_once __DIR__ . '/calculations.php';

function byhnex_handle(string $method, array $headers, string $rawBody, array $env, callable $transport, callable $rateLimit, ?int $now = null): array
{
    $now ??= (int) floor(microtime(true) * 1000);
    $origin = $headers['origin'] ?? '';
    $allowed = array_map('trim', explode(',', $env['ALLOWED_ORIGINS'] ?? 'https://osvalt16.github.io,https://byhnex.com,https://www.byhnex.com'));
    $responseHeaders = ['Content-Type' => 'application/json; charset=utf-8', 'Cache-Control' => 'no-store', 'Vary' => 'Origin', 'X-Content-Type-Options' => 'nosniff'];
    if ($origin !== '' && in_array($origin, $allowed, true)) {
        $responseHeaders += ['Access-Control-Allow-Origin' => $origin, 'Access-Control-Allow-Methods' => 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers' => 'Content-Type, Authorization', 'Access-Control-Max-Age' => '600'];
    }
    $reply = static fn(int $status, mixed $body): array => ['status' => $status, 'headers' => $responseHeaders, 'body' => $body];
    $fail = static fn(int $status, string $code, string $message): array => $reply($status, ['error' => ['code' => $code, 'message' => $message]]);
    if ($origin !== '' && !in_array($origin, $allowed, true)) return $fail(403, 'ORIGIN_DENIED', 'Ce site n’est pas autorisé à utiliser l’assistant.');
    if ($method === 'OPTIONS') return $reply(204, null);
    $secret = $env['BYHNEX_AI_ACCESS_CODE'] ?? '';
    $configured = !empty($env['OPENAI_API_KEY']) && !empty($env['OPENAI_MODEL']) && is_string($secret) && strlen($secret) >= 16 && !str_starts_with($secret, 'sk-') && ($env['transportAvailable'] ?? false) && ($env['privateStorageAvailable'] ?? false);
    $authorization = $headers['authorization'] ?? '';
    $authenticated = $configured && str_starts_with($authorization, 'Bearer ') && hash_equals($secret, substr($authorization, 7));
    if ($method === 'GET') {
        if ($configured && $authorization !== '' && !$authenticated) return $fail(401, 'ACCESS_DENIED', 'Code d’accès à l’assistant incorrect.');
        // No OpenAI request, credential, key fragment, model or filesystem path.
        return $reply(200, ['ready' => (bool) $configured, 'accessRequired' => true, 'supportedAssets' => ['BTC', 'SOL']]);
    }
    if ($method !== 'POST') return $fail(405, 'METHOD_NOT_ALLOWED', 'Utilisez POST.');
    if ($origin === '' || !in_array($origin, $allowed, true)) return $fail(403, 'ORIGIN_DENIED', 'Origine du navigateur manquante ou non autorisée.');
    if (!$configured) return $fail(503, 'SERVER_NOT_CONFIGURED', 'Vérifiez la configuration privée, cURL et les droits du dossier .secrets sur OVH.');
    if (!$authenticated) return $fail(401, 'ACCESS_DENIED', 'Code d’accès à l’assistant absent ou incorrect.');
    if (!str_contains($headers['content-type'] ?? '', 'application/json')) return $fail(415, 'INVALID_CONTENT_TYPE', 'Le message doit être envoyé en JSON.');
    if ((int) ($headers['content-length'] ?? 0) > 65000 || strlen($rawBody) > 65000) return $fail(413, 'BODY_TOO_LARGE', 'Le contexte envoyé est trop volumineux.');
    try {
        $body = json_decode($rawBody, true, 32, JSON_THROW_ON_ERROR);
        if (!is_array($body) || !is_string($body['message'] ?? null) || trim($body['message']) === '' || byhnex_short($body['message'], 4001) !== byhnex_short($body['message'], 4000)) throw new InvalidArgumentException('Écrivez un message de 1 à 4 000 caractères.');
        $context = byhnex_sanitize_context($body['context'] ?? null, $now);
    } catch (Throwable $error) {
        return $fail(400, 'INVALID_REQUEST', $error instanceof InvalidArgumentException ? $error->getMessage() : 'Message JSON ou contexte invalide.');
    }
    try {
        if (!$rateLimit()) {
            $result = $fail(429, 'RATE_LIMIT', 'Trop de messages. Patientez une minute.');
            $result['headers']['Retry-After'] = '60';
            return $result;
        }
    } catch (Throwable $error) {
        return $fail(503, 'RATE_LIMIT_UNAVAILABLE', 'L’assistant est temporairement indisponible. Vérifiez les droits du dossier .secrets.');
    }
    $contract = require __DIR__ . '/contract.php';
    $input = [['role' => 'developer', 'content' => $contract['prompt']]];
    $history = is_array($body['history'] ?? null) ? array_slice($body['history'], -12) : [];
    foreach ($history as $m) {
        if (is_array($m) && in_array($m['role'] ?? null, ['user', 'assistant'], true) && is_string($m['content'] ?? null)) $input[] = ['role' => $m['role'], 'content' => byhnex_short($m['content'], 6000)];
    }
    $input[] = ['role' => 'user', 'content' => json_encode(['message' => trim($body['message']), 'context' => $context], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)];
    $deadline = microtime(true) + 45;
    try {
        for ($round = 0; $round < 3; $round++) {
            $timeout = $deadline - microtime(true);
            if ($timeout <= 0) throw new RuntimeException('Timeout', 504);
            $payload = ['model' => $env['OPENAI_MODEL'], 'store' => false, 'input' => $input, 'tools' => [$contract['tool']], 'parallel_tool_calls' => false, 'text' => ['format' => ['type' => 'json_schema', 'name' => 'byhnex_analysis', 'strict' => true, 'schema' => $contract['schema']]], 'max_output_tokens' => 4000];
            $response = $transport($payload, $env['OPENAI_API_KEY'], $timeout);
            if ($response['status'] !== 200) {
                if ($response['status'] === 429) return $fail(429, 'OPENAI_RATE_LIMIT', 'OpenAI a atteint une limite de débit ou de quota. Réessayez plus tard.');
                if (in_array($response['status'], [401, 403], true)) return $fail(503, 'OPENAI_AUTH_ERROR', 'La connexion OpenAI doit être vérifiée par le propriétaire du site.');
                return $fail(502, 'OPENAI_UNAVAILABLE', 'OpenAI est indisponible ou le modèle configuré n’accepte pas cette requête.');
            }
            $result = $response['body'];
            if (!is_array($result)) return $fail(502, 'INVALID_RESPONSE', 'La réponse d’OpenAI est invalide. Réessayez.');
            if (($result['status'] ?? '') === 'incomplete') return $fail(502, 'INCOMPLETE_RESPONSE', 'L’analyse n’a pas pu être terminée. Essayez une question plus ciblée.');
            $output = is_array($result['output'] ?? null) ? $result['output'] : [];
            $calls = array_values(array_filter($output, static fn($item) => is_array($item) && ($item['type'] ?? '') === 'function_call'));
            if (count($calls) > 6) return $fail(502, 'CALCULATION_LIMIT', 'L’analyse demande trop de calculs. Posez une question plus ciblée.');
            if ($calls) {
                array_push($input, ...$output);
                foreach ($calls as $call) {
                    try {
                        if (($call['name'] ?? '') !== 'calculate_scenario') throw new InvalidArgumentException('Outil non autorisé.');
                        $args = json_decode($call['arguments'] ?? '', true, 16, JSON_THROW_ON_ERROR);
                        $value = byhnex_calculate($args, $context);
                    } catch (Throwable $error) {
                        $value = ['error' => $error instanceof InvalidArgumentException ? byhnex_short($error->getMessage(), 160) : 'Paramètres de calcul invalides.'];
                    }
                    $input[] = ['type' => 'function_call_output', 'call_id' => $call['call_id'] ?? '', 'output' => json_encode($value, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)];
                }
                continue;
            }
            $text = '';
            foreach ($output as $item) {
                if (!is_array($item) || ($item['type'] ?? '') !== 'message') continue;
                foreach (($item['content'] ?? []) as $c) {
                    if (($c['type'] ?? '') === 'refusal') return $reply(200, ['message' => byhnex_short($c['refusal'] ?? 'Je ne peux pas répondre à cette demande.', 16000), 'actions' => []]);
                    if (($c['type'] ?? '') === 'output_text' && is_string($c['text'] ?? null)) $text .= $c['text'];
                }
            }
            if (trim($text) === '') return $fail(502, 'EMPTY_RESPONSE', 'OpenAI a renvoyé une réponse vide. Réessayez.');
            try {
                $parsed = json_decode($text, true, 24, JSON_THROW_ON_ERROR);
                if (!is_string($parsed['message'] ?? null) || trim($parsed['message']) === '' || byhnex_short($parsed['message'], 16001) !== byhnex_short($parsed['message'], 16000) || !is_array($parsed['actions'] ?? null) || !array_is_list($parsed['actions']) || count($parsed['actions']) > 12) throw new RuntimeException('Invalid response');
                $actions = [];
                foreach ($parsed['actions'] as $action) {
                    $valid = byhnex_validate_action($action);
                    if ($valid !== null && $valid['symbol'] === $context['asset']) $actions[] = $valid;
                }
                return $reply(200, ['message' => trim($parsed['message']), 'actions' => $actions]);
            } catch (Throwable $error) {
                return $fail(502, 'INVALID_RESPONSE', 'La réponse d’OpenAI est invalide. Réessayez.');
            }
        }
        return $fail(502, 'CALCULATION_LIMIT', 'L’analyse demande trop de calculs. Posez une question plus ciblée.');
    } catch (Throwable $error) {
        return $error->getCode() === 504 ? $fail(504, 'TIMEOUT', 'L’analyse a pris trop de temps. Réessayez.') : $fail(502, 'NETWORK_ERROR', 'La connexion à OpenAI a échoué. Réessayez.');
    }
}

function byhnex_openai_transport(array $payload, string $key, float $timeout): array
{
    $curl = curl_init('https://api.openai.com/v1/responses');
    $responseBody = '';
    curl_setopt_array($curl, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Authorization: Bearer ' . $key],
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
        CURLOPT_CONNECTTIMEOUT_MS => min(10000, (int) ceil($timeout * 1000)),
        CURLOPT_TIMEOUT_MS => (int) ceil($timeout * 1000),
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_WRITEFUNCTION => static function ($handle, string $chunk) use (&$responseBody): int {
            if (strlen($responseBody) + strlen($chunk) > 2000000) return 0;
            $responseBody .= $chunk;
            return strlen($chunk);
        },
    ]);
    try {
        $ok = curl_exec($curl);
        $errno = curl_errno($curl);
        $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        if ($ok === false) throw new RuntimeException('Provider transport failure', $errno === CURLE_OPERATION_TIMEDOUT ? 504 : 502);
        return ['status' => $status, 'body' => $status === 200 ? json_decode($responseBody, true, 64, JSON_THROW_ON_ERROR) : null];
    } finally {
        curl_close($curl);
    }
}
