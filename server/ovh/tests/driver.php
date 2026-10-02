<?php
declare(strict_types=1);
// CLI fixtures only. Not included in the OVH upload or GitHub Pages build.
require __DIR__ . '/../api/lib/backend.php';
$data = json_decode(stream_get_contents(STDIN), true, 64, JSON_THROW_ON_ERROR);
try {
    switch ($data['mode']) {
        case 'context': $result = byhnex_sanitize_context($data['context'], $data['now']); break;
        case 'calculate': $result = byhnex_calculate($data['args'], $data['context']); break;
        case 'actions': $result = array_map('byhnex_validate_action', $data['actions']); break;
        case 'env': $result = byhnex_parse_env($data['text']); break;
        case 'load': $result = byhnex_load_settings($data['root']); break;
        case 'rate': $result = byhnex_rate_limit($data['directory'], $data['now']); break;
        case 'request':
            $calls = [];
            $transport = static function ($payload, $key, $timeout) use ($data, &$calls) {
                $i = count($calls);
                $calls[] = ['payload' => $payload, 'key' => $key, 'timeout' => $timeout];
                if (($data['timeout'] ?? false)) throw new RuntimeException('simulated timeout', 504);
                if (($data['networkError'] ?? false)) throw new RuntimeException('secret-provider-error');
                return $data['responses'][$i] ?? ['status' => 200, 'body' => ['output' => []]];
            };
            $limiter = static function () use ($data) {
                if ($data['rateError'] ?? false) throw new RuntimeException('private path');
                return !($data['limited'] ?? false);
            };
            $reply = byhnex_handle($data['method'], $data['headers'], $data['rawBody'], $data['env'], $transport, $limiter, $data['now']);
            $result = ['reply' => $reply, 'calls' => $calls];
            break;
        default: throw new RuntimeException('Unknown test mode');
    }
    echo json_encode(['result' => $result], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
} catch (Throwable $error) {
    echo json_encode(['error' => $error->getMessage()], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    exit(2);
}
