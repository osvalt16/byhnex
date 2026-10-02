<?php
declare(strict_types=1);

function byhnex_calculate(array $args, array $context): array
{
    $asset = $args['asset'] ?? null;
    if (!in_array($asset, ['BTC', 'SOL'], true)) throw new InvalidArgumentException('Analyse limitée à BTC et SOL.');
    $kind = $args['kind'] ?? null;
    if ($kind === 'accumulation_comparison') {
        $corrections = $args['corrections'] ?? null;
        if (!is_array($corrections) || count($corrections) < 1 || count($corrections) > 6) throw new InvalidArgumentException('Comparez entre 1 et 6 corrections.');
        return ['hypothetical' => true, 'asset' => $asset, 'amount' => $args['amount'] ?? null, 'scenarios' => array_map(static fn($c) => byhnex_calculate(array_replace($args, ['kind' => 'accumulation', 'correction' => $c]), $context), $corrections)];
    }
    if ($kind === 'fibonacci') {
        if (!byhnex_positive($args['startPrice'] ?? null) || !byhnex_positive($args['endPrice'] ?? null)) throw new InvalidArgumentException('Deux prix observés sont nécessaires.');
        return ['kind' => 'fibonacci', 'asset' => $asset, 'levels' => array_map(static fn($r) => ['ratio' => $r, 'price' => $args['endPrice'] + ($args['startPrice'] - $args['endPrice']) * $r], [0, .236, .382, .5, .618, .786, 1])];
    }
    $quantity = $context['portfolio']['positions'][$asset]['quantity'] ?? null;
    if (byhnex_number($quantity) === null || $quantity < 0) throw new InvalidArgumentException('Quantité du portefeuille manquante.');
    if ($kind === 'portfolio_value') {
        if (!byhnex_positive($args['targetPrice'] ?? null)) throw new InvalidArgumentException('Prix cible invalide.');
        $other = $asset === 'BTC' ? 'SOL' : 'BTC';
        $otherQty = $context['portfolio']['positions'][$other]['quantity'] ?? null;
        $otherPrice = $context['quotes'][$other]['price'] ?? null;
        $cash = $context['portfolio']['cash'] ?? null;
        if (byhnex_number($otherQty) === null || $otherQty < 0) throw new InvalidArgumentException('Autre position manquante.');
        if ($otherQty > 0 && !byhnex_positive($otherPrice)) throw new InvalidArgumentException('Cours de l’autre position manquant.');
        if (byhnex_number($cash) === null) throw new InvalidArgumentException('Réserve manquante.');
        $positionValue = $quantity * $args['targetPrice'];
        return ['hypothetical' => true, 'asset' => $asset, 'targetPrice' => $args['targetPrice'], 'positionValue' => $positionValue, 'portfolioBtcSolWithCash' => $positionValue + ($otherQty ? $otherQty * $otherPrice : 0) + $cash, 'otherAssetPriceHeldConstant' => $otherPrice, 'excludesOtherAssets' => true];
    }
    if ($kind !== 'accumulation') throw new InvalidArgumentException('Calcul non autorisé.');
    $sell = $context['quotes'][$asset]['price'] ?? null;
    if (!byhnex_positive($sell)) throw new InvalidArgumentException('Cours réel manquant.');
    if ($context['market']['stale'] ?? true) throw new InvalidArgumentException('Cours non actualisé : demandez un prix de simulation explicite.');
    $fees = $context['fees'] ?? [];
    foreach (['percentPerSide', 'slippagePercent', 'network'] as $key) {
        if (byhnex_number($fees[$key] ?? null) === null || $fees[$key] < 0) throw new InvalidArgumentException('Frais manquants : demander les paramètres, sans les supposer nuls.');
    }
    $amount = $args['amount'] ?? null;
    $correction = $args['correction'] ?? null;
    $rate = ($fees['percentPerSide'] + $fees['slippagePercent']) / 100;
    if (!byhnex_positive($amount) || byhnex_number($correction) === null || $correction < 0 || $correction >= 100 || $rate >= 1) throw new InvalidArgumentException('Vérifiez les prix, montants et frais.');
    // Exact Strategy Lab convention: fees/slippage each side, network on repurchase.
    $sold = $amount / $sell;
    $reserve = $amount * (1 - $rate);
    $buy = $sell * (1 - $correction / 100);
    $available = $reserve - $fees['network'];
    if ($available <= 0) throw new InvalidArgumentException('Frais supérieurs à la réserve.');
    $bought = $available / ($buy * (1 + $rate));
    $net = $bought - $sold;
    $stock = $quantity + $net;
    return ['hypothetical' => true, 'asset' => $asset, 'sold' => $sold, 'reserve' => $reserve, 'buy' => $buy, 'bought' => $bought, 'gross' => $amount / $buy - $sold, 'net' => $net, 'breakEven' => $available / ($sold * (1 + $rate)), 'stock' => $stock, 'cost' => $amount - $reserve + $bought * $buy * $rate + $fees['network'], 'amount' => $amount, 'correction' => $correction, 'sufficientVirtualPosition' => $sold <= $quantity, 'holdPositionAtBuyPrice' => $quantity * $buy, 'strategyPositionAtBuyPrice' => $stock * $buy, 'advantageVsHold' => $net * $buy, 'feesConvention' => 'Pourcentage + slippage de chaque côté ; frais réseau sur le rachat, comme Strategy Lab.'];
}
