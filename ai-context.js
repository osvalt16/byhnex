import { AI_ASSETS } from './ai-contract.js?v=20261003-ovh';
const numeric = x => typeof x === 'number' && Number.isFinite(x) ? x : null;
export function savedPortfolio(storage = globalThis.localStorage) {
  try { return JSON.parse(storage.getItem('cryptonite-v1')) || {}; } catch { return {}; }
}
export function buildAiContext({ state = {}, market = {}, candles = [], comparisonCandles = [], fees = {}, strategy = {} } = {}) {
  const asset = state.asset || market.asset || 'SOL', holdings = state.holdings || {}, quotes = market.quotes || {};
  const positions = Object.fromEntries(AI_ASSETS.map(a => [a, { quantity: numeric(holdings[a]?.quantity), averagePrice: numeric(holdings[a]?.average) }]));
  const realized = Object.fromEntries(AI_ASSETS.map(a => [a, 0]));
  for (const cycle of state.cycles || []) if (AI_ASSETS.includes(cycle.asset) && cycle.remaining < .01) realized[cycle.asset] += cycle.bought - cycle.sold;
  return {
    asset, symbol: asset + (market.quote || 'USD'), timeframe: state.tf || market.timeframe || '1H', quoteCurrency: market.quote || 'USD',
    currentPrice: numeric(quotes[asset]?.price), capturedAt: Date.now(),
    market: { source: market.provider || '', status: market.status || 'unavailable', lastUpdate: market.lastUpdate || null, stale: !market.fresh },
    quotes: Object.fromEntries(AI_ASSETS.map(a => [a, { price: numeric(quotes[a]?.price), change24h: numeric(quotes[a]?.change), time: numeric(quotes[a]?.time) }])),
    candles: candles.slice(-100).map(c => ({...c})), comparisonCandles: comparisonCandles.slice(-60).map(c => ({...c})),
    comparisonAsset: AI_ASSETS.find(a => a !== asset) || null,
    portfolio: { virtual: true, positions, cash: numeric(state.reserve), initial: state.initial || {}, initialCash: numeric(state.initialReserve) },
    position: positions[asset] || null, realizedProfit: null, realizedTokenGains: realized,
    fees: { percentPerSide: numeric(fees.percentPerSide), slippagePercent: numeric(fees.slippagePercent), network: numeric(fees.network) },
    strategy: { amount: numeric(strategy.amount), sell: numeric(strategy.sell), correction: numeric(strategy.correction) },
    chartLevels: (state.drawings || []).filter(d => d.asset === asset).slice(-40).map(d => ({ id:d.id, type:d.type, price:d.p1, label:d.label, origin:d.origin || 'user', locked:!!d.locked, visible:d.visible!==false }))
  };
}
