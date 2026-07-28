// Calcule les signaux du site (RSI 14 / bougies 15 min, tendance 50/200)
// pour le widget mobile et les notifications ntfy.
// Execute par GitHub Actions toutes les 15 min — aucune cle, aucune donnee privee.
// La logique replique exactement celle de crypto-bot-virtuel.html.
'use strict';

const STABLES = new Set(['usdt','usdc','usds','usde','dai','fdusd','tusd','pyusd','busd','usdp','gusd','eurc','eurt','usdtb','susds','usd1','bsc-usd','steth','wsteth','weeth','wbtc','cbbtc','weth','reth','wbeth']);
const RSI_PERIOD = 14, BUY_BELOW = 30, SELL_ABOVE = 70, INTERVAL = '15m';

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'michmich-signaux' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}

function rsiSeries(closes, period) {
  const out = new Array(closes.length).fill(null);
  if (closes.length <= period) return out;
  let avgG = 0, avgL = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i-1];
    avgG += Math.max(d, 0); avgL += Math.max(-d, 0);
  }
  avgG /= period; avgL /= period;
  out[period] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i-1];
    avgG = (avgG * (period - 1) + Math.max(d, 0)) / period;
    avgL = (avgL * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
  }
  return out;
}

function sma(arr, n) {
  if (arr.length < n) return null;
  let s = 0;
  for (let i = arr.length - n; i < arr.length; i++) s += arr[i];
  return s / n;
}

const zoneOf = rsi => rsi === null ? null : (rsi < BUY_BELOW ? 'buy' : rsi > SELL_ABOVE ? 'sell' : 'neutral');

async function buildCoins(pairs, cbSet, top) {
  const list = [];
  for (const c of top) {
    if (STABLES.has(c.symbol.toLowerCase())) continue;
    const short = c.symbol.toUpperCase();
    if (cbSet && !cbSet.has(short)) continue;
    const quote = ['EUR', 'USDC', 'USDT'].find(q => pairs.has(short + q));
    if (quote && !list.some(x => x.short === short)) list.push({ sym: short + quote, name: c.name, short, quote });
    if (list.length === 10) break;
  }
  return list;
}

async function main() {
  const [info, top, prods, rates] = await Promise.all([
    getJson('https://data-api.binance.vision/api/v3/exchangeInfo'),
    getJson('https://api.coingecko.com/api/v3/coins/markets?vs_currency=eur&order=market_cap_desc&per_page=30&page=1'),
    getJson('https://api.exchange.coinbase.com/products').catch(() => null),
    getJson('https://data-api.binance.vision/api/v3/ticker/price?symbols=' + encodeURIComponent('["EURUSDT","EURUSDC"]')),
  ]);
  const pairs = new Set(info.symbols.filter(s => s.status === 'TRADING').map(s => s.symbol));
  const cbSet = prods ? new Set(prods.filter(x => (x.quote_currency === 'USD' || x.quote_currency === 'USDC') && x.status === 'online' && !x.trading_disabled).map(x => x.base_currency)) : null;
  const RATES = {};
  for (const t of rates) RATES[t.symbol.replace('EUR', '')] = parseFloat(t.price);
  const conv = coin => coin.quote === 'EUR' ? 1 : (RATES[coin.quote] || RATES.USDT) ? 1 / (RATES[coin.quote] || RATES.USDT) : null;

  const coins = await buildCoins(pairs, cbSet, top);
  if (coins.length < 5) throw new Error('liste de cryptos trop courte, abandon');

  const t24 = await getJson('https://data-api.binance.vision/api/v3/ticker/24hr?symbols=' + encodeURIComponent(JSON.stringify(coins.map(c => c.sym))));
  const t24Map = Object.fromEntries(t24.map(t => [t.symbol, t]));

  const now = Date.now();
  const out = [];
  for (const coin of coins) {
    const k = conv(coin);
    if (k === null) continue;
    const raw = await getJson(`https://data-api.binance.vision/api/v3/klines?symbol=${coin.sym}&interval=${INTERVAL}&limit=250`);
    const closes = raw.filter(x => x[6] <= now).map(x => parseFloat(x[4]) * k);
    const rsis = rsiSeries(closes, RSI_PERIOD);
    const rsi = rsis[rsis.length - 1];
    const s50 = sma(closes, 50), s200 = sma(closes, 200), px = closes[closes.length - 1];
    const trend = s200 === null ? null : (px > s200 && s50 > s200 ? 'up' : (px < s200 && s50 < s200 ? 'down' : 'flat'));
    const t = t24Map[coin.sym];
    out.push({
      short: coin.short, name: coin.name,
      price: t ? parseFloat(t.lastPrice) * k : px,
      pct24h: t ? parseFloat(t.priceChangePercent) : null,
      rsi: rsi === null ? null : Math.round(rsi * 10) / 10,
      trend, zone: zoneOf(rsi),
    });
  }

  const data = { updatedAt: new Date().toISOString(), coins: out };
  const fs = await import('fs');
  fs.mkdirSync('out', { recursive: true });
  fs.writeFileSync('out/data.json', JSON.stringify(data, null, 1));

  // Texte compact pour le widget KWGT (une seule formule cote telephone)
  const fmtPx = p => p >= 1000 ? Math.round(p).toLocaleString('fr-FR') : p >= 1 ? p.toFixed(2) : p.toFixed(4);
  const arrow = t => t === 'up' ? '↗' : t === 'down' ? '↘' : t === 'flat' ? '→' : '·';
  const zicon = z => z === 'buy' ? '🟢' : z === 'sell' ? '🔴' : ' ';
  const lines = out.map(c =>
    `${zicon(c.zone)}${c.short.padEnd(5)} ${fmtPx(c.price).padStart(9)}€ ${(c.pct24h >= 0 ? '▲' : '▼')}${Math.abs(c.pct24h).toFixed(1).padStart(4)}% RSI ${String(c.rsi ?? '—').padStart(4)} ${arrow(c.trend)}`
  );
  const maj = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
  fs.writeFileSync('out/widget.txt', lines.join('\n') + `\nMàJ ${maj} · RSI<30 achat · >70 vente`);

  // Version couleur pour KWGT (balises Kustom [c=#rrggbb]...[/c], theme du site)
  const GREEN = '2be3a4', RED = 'ff5f76', MUTED = '8391ad', GOLD = 'e6b95c';
  const col = (txt, c) => `[c=#${c}]${txt}[/c]`;
  const clines = out.map(c => {
    const up24 = c.pct24h >= 0;
    const pctTxt = `${up24 ? '▲' : '▼'}${Math.abs(c.pct24h).toFixed(1).padStart(4)}%`;
    const rsiTxt = `RSI ${String(c.rsi ?? '—').padStart(4)}`;
    const rsiCol = c.rsi === null ? MUTED : c.rsi < BUY_BELOW ? GREEN : c.rsi > SELL_ABOVE ? RED : null;
    const arrTxt = arrow(c.trend);
    const arrCol = c.trend === 'up' ? GREEN : c.trend === 'down' ? RED : MUTED;
    return `[b]${c.short.padEnd(5)}[/b] ${fmtPx(c.price).padStart(9)}€ `
      + col(pctTxt, up24 ? GREEN : RED) + ' '
      + (rsiCol ? `[b]${col(rsiTxt, rsiCol)}[/b]` : rsiTxt) + ' '
      + col(arrTxt, arrCol);
  });
  fs.writeFileSync('out/widget-color.txt', clines.join('\n') + '\n' + col(`MàJ ${maj} · RSI<30 achat · >70 vente`, MUTED));

  // Colonnes separees : alignement parfait avec n'importe quelle police
  // (4 elements Texte cote a cote dans KWGT, alignes par leurs reglages)
  const colRsi = c => c.rsi === null ? col('—', MUTED) : (c.rsi < BUY_BELOW ? col('' + c.rsi, GREEN) : c.rsi > SELL_ABOVE ? col('' + c.rsi, RED) : '' + c.rsi);
  fs.writeFileSync('out/col-crypto.txt', out.map(c => `[b]${c.short}[/b]`).join('\n'));
  fs.writeFileSync('out/col-prix.txt', out.map(c => `${fmtPx(c.price)}€`).join('\n'));
  fs.writeFileSync('out/col-24h.txt', out.map(c => col(`${c.pct24h >= 0 ? '▲' : '▼'} ${Math.abs(c.pct24h).toFixed(1)}%`, c.pct24h >= 0 ? GREEN : RED)).join('\n'));
  fs.writeFileSync('out/col-rsi.txt', out.map(c => `${colRsi(c)} ${col(arrow(c.trend), c.trend === 'up' ? GREEN : c.trend === 'down' ? RED : MUTED)}`).join('\n'));
  fs.writeFileSync('out/col-maj.txt', col(`MàJ ${maj} · RSI<30 achat · >70 vente`, MUTED));

  // Notifications : uniquement les ENTREES en zone (comparaison avec l'etat precedent)
  let prev = null;
  try { prev = JSON.parse(fs.readFileSync('prev.json', 'utf8')); } catch {}
  const topic = process.env.NTFY_TOPIC;
  if (prev && topic) {
    const prevZone = Object.fromEntries(prev.coins.map(c => [c.short, c.zone]));
    for (const c of out) {
      const pz = prevZone[c.short];
      if (pz !== undefined && pz !== c.zone && (c.zone === 'buy' || c.zone === 'sell')) {
        const isBuy = c.zone === 'buy';
        const warn = isBuy && c.trend === 'down' ? ' ⚠️ couteau qui tombe' : (!isBuy && c.trend === 'up' ? ' ⚠️ tendance forte' : '');
        const tLabel = c.trend === 'up' ? '📈 haussière' : c.trend === 'down' ? '📉 baissière' : c.trend === 'flat' ? '➖ neutre' : 'inconnue';
        // publication JSON : les en-tetes HTTP n'acceptent pas l'UTF-8 (accents, tirets)
        try {
          const r = await fetch('https://ntfy.sh', {
            method: 'POST',
            body: JSON.stringify({
              topic,
              title: (isBuy ? "Zone d'achat — " : 'Zone de vente — ') + c.short,
              message: `${c.name} — RSI ${c.rsi} · prix ${fmtPx(c.price)} € · tendance ${tLabel}${warn}. Info, pas un conseil financier.`,
              priority: 4,
              tags: [isBuy ? 'green_circle' : 'red_circle'],
              click: 'https://osvalt16.github.io/michmich/crypto-bot-virtuel.html',
            }),
          });
          console.log(r.ok ? 'notif envoyee:' : 'ECHEC notif HTTP ' + r.status + ':', c.short, c.zone);
        } catch (e) { console.error('ECHEC notif:', c.short, e.message); }
      }
    }
  } else {
    console.log(prev ? 'NTFY_TOPIC absent, pas de notifications' : 'premier passage, pas de notifications');
  }
  console.log(`OK — ${out.length} cryptos, ${new Date().toISOString()}`);
}

main().catch(e => { console.error(e); process.exit(1); });
