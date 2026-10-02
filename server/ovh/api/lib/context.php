<?php
declare(strict_types=1);

function byhnex_number(mixed $value): int|float|null
{
    return (is_int($value) || is_float($value)) && is_finite((float) $value) ? $value : null;
}

function byhnex_short(mixed $value, int $limit = 100): string
{
    if (!is_string($value)) return '';
    return function_exists('mb_substr') ? mb_substr($value, 0, $limit, 'UTF-8') : (preg_match('/^.{0,' . $limit . '}/us', $value, $m) ? $m[0] : '');
}

function byhnex_candles(mixed $rows): array
{
    if (!is_array($rows)) return [];
    $result = [];
    foreach (array_slice($rows, -120) as $row) {
        if (!is_array($row)) continue;
        $c = [];
        foreach (['time', 'open', 'high', 'low', 'close', 'volume'] as $key) $c[$key] = byhnex_number($row[$key] ?? null);
        if (in_array(null, $c, true) || $c['time'] <= 0 || $c['low'] <= 0 || $c['high'] < max($c['open'], $c['close']) || $c['low'] > min($c['open'], $c['close']) || $c['volume'] < 0) continue;
        $result[] = $c;
    }
    usort($result, static fn($a, $b) => $a['time'] <=> $b['time']);
    return $result;
}

function byhnex_sanitize_context(mixed $raw, int $now): array
{
    if (!is_array($raw)) throw new InvalidArgumentException('Contexte du graphique manquant.');
    $assets = ['BTC', 'SOL'];
    $asset = $raw['asset'] ?? null;
    if (!in_array($asset, $assets, true)) throw new InvalidArgumentException('L’assistant analyse BTC et SOL. Choisissez l’un de ces actifs.');
    $quote = in_array($raw['quoteCurrency'] ?? null, ['USD', 'USDT', 'USDC'], true) ? $raw['quoteCurrency'] : 'USD';
    $last = byhnex_number($raw['market']['lastUpdate'] ?? null);
    $positions = $quotes = $initial = $gains = [];
    foreach ($assets as $a) {
        $positions[$a] = ['quantity' => byhnex_number($raw['portfolio']['positions'][$a]['quantity'] ?? null), 'averagePrice' => byhnex_number($raw['portfolio']['positions'][$a]['averagePrice'] ?? null)];
        $quotes[$a] = ['price' => byhnex_number($raw['quotes'][$a]['price'] ?? null), 'change24h' => byhnex_number($raw['quotes'][$a]['change24h'] ?? null), 'time' => byhnex_number($raw['quotes'][$a]['time'] ?? null)];
        $initial[$a] = byhnex_number($raw['portfolio']['initial'][$a] ?? null);
        $gains[$a] = byhnex_number($raw['realizedTokenGains'][$a] ?? null);
    }
    $fees = $strategy = $levels = [];
    foreach (['percentPerSide', 'slippagePercent', 'network'] as $k) $fees[$k] = byhnex_number($raw['fees'][$k] ?? null);
    foreach (['amount', 'sell', 'correction'] as $k) $strategy[$k] = byhnex_number($raw['strategy'][$k] ?? null);
    foreach (array_slice(is_array($raw['chartLevels'] ?? null) ? $raw['chartLevels'] : [], -40) as $d) {
        if (!is_array($d)) continue;
        $levels[] = ['id' => byhnex_short($d['id'] ?? null), 'label' => byhnex_short($d['label'] ?? null, 80), 'type' => byhnex_short($d['type'] ?? null, 30), 'price' => byhnex_number($d['price'] ?? null), 'origin' => ($d['origin'] ?? '') === 'ai' ? 'ai' : 'user', 'locked' => (bool) ($d['locked'] ?? false), 'visible' => ($d['visible'] ?? true) !== false];
    }
    return [
        'asset' => $asset, 'symbol' => $asset . $quote, 'quoteCurrency' => $quote,
        'timeframe' => in_array($raw['timeframe'] ?? null, ['1m', '5m', '15m', '30m', '1H', '4H', '1D', '1W'], true) ? $raw['timeframe'] : '1H',
        'capturedAt' => $now, 'currentPrice' => byhnex_number($raw['currentPrice'] ?? null),
        'market' => ['source' => byhnex_short($raw['market']['source'] ?? null, 40), 'status' => byhnex_short($raw['market']['status'] ?? null, 30), 'lastUpdate' => $last, 'stale' => ($raw['market']['stale'] ?? true) !== false || !$last || $now - $last > 90000],
        'quotes' => $quotes, 'candles' => byhnex_candles($raw['candles'] ?? null), 'comparisonCandles' => byhnex_candles($raw['comparisonCandles'] ?? null), 'comparisonAsset' => $asset === 'BTC' ? 'SOL' : 'BTC',
        'portfolio' => ['virtual' => true, 'positions' => $positions, 'cash' => byhnex_number($raw['portfolio']['cash'] ?? null), 'initial' => $initial, 'initialCash' => byhnex_number($raw['portfolio']['initialCash'] ?? null)],
        'position' => $positions[$asset], 'realizedProfit' => null, 'realizedTokenGains' => $gains,
        'fees' => $fees, 'strategy' => $strategy, 'chartLevels' => $levels,
    ];
}

function byhnex_positive(mixed $value, float $maximum = 1e12): bool
{
    return byhnex_number($value) !== null && $value > 0 && $value < $maximum;
}

function byhnex_validate_action(mixed $a): ?array
{
    if (!is_array($a) || !in_array($a['symbol'] ?? null, ['BTC', 'SOL'], true)) return null;
    $base = ['type' => $a['type'] ?? '', 'symbol' => $a['symbol']];
    switch ($base['type']) {
        case 'ADD_HORIZONTAL_LINE':
            return byhnex_positive($a['price'] ?? null) ? $base + ['price' => $a['price'], 'label' => trim(byhnex_short($a['label'] ?? null, 80)) ?: 'Niveau IA'] : null;
        case 'REMOVE_HORIZONTAL_LINE':
            $id = trim(byhnex_short($a['id'] ?? null, 80));
            return $id !== '' ? $base + ['id' => $id] : null;
        case 'CLEAR_AI_LEVELS': return $base;
        case 'FOCUS_PRICE': return byhnex_positive($a['price'] ?? null) ? $base + ['price' => $a['price']] : null;
        case 'CHANGE_TIMEFRAME':
            return in_array($a['timeframe'] ?? null, ['1m', '5m', '15m', '30m', '1H', '4H', '1D', '1W'], true) ? $base + ['timeframe' => $a['timeframe']] : null;
        case 'DRAW_FIBONACCI':
            if (!byhnex_positive($a['startPrice'] ?? null) || !byhnex_positive($a['endPrice'] ?? null) || !byhnex_positive($a['startTime'] ?? null, 1e14) || !byhnex_positive($a['endTime'] ?? null, 1e14) || $a['startTime'] == $a['endTime'] || $a['startPrice'] == $a['endPrice']) return null;
            return $base + ['startTime' => $a['startTime'], 'startPrice' => $a['startPrice'], 'endTime' => $a['endTime'], 'endPrice' => $a['endPrice'], 'label' => trim(byhnex_short($a['label'] ?? null, 80)) ?: 'Fibonacci IA'];
        default: return null;
    }
}
