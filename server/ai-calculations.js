import { simulate } from '../strategy.js';
import { AI_ASSETS } from '../ai-contract.js';
export const CALCULATION_TOOL = {
  type: 'function', name: 'calculate_scenario', strict: true,
  description: 'Calculs déterministes : vente/rachat après frais vs HOLD, comparaison de 1 à 6 corrections en un appel, valeur du portefeuille à un prix hypothétique ou Fibonacci. Aucun ordre exécuté. Les champs inutilisés valent null.',
  parameters: {
    type: 'object', additionalProperties: false,
    properties: {
      kind: { type: 'string', enum: ['accumulation', 'accumulation_comparison', 'portfolio_value', 'fibonacci'] },
      asset: { type: 'string', enum: AI_ASSETS },
      amount: { type: ['number', 'null'] }, correction: { type: ['number', 'null'] }, corrections: { type: ['array','null'], items: {type:'number'} },
      targetPrice: { type: ['number', 'null'] }, startPrice: { type: ['number', 'null'] }, endPrice: { type: ['number', 'null'] }
    }, required: ['kind', 'asset', 'amount', 'correction', 'corrections', 'targetPrice', 'startPrice', 'endPrice']
  }
};
const positive = x => typeof x === 'number' && Number.isFinite(x) && x > 0;
export function calculateScenario(args, context) {
  if (!AI_ASSETS.includes(args.asset)) throw Error('Analyse limitée à BTC et SOL.');
  if(args.kind==='accumulation_comparison'){
    if(!Array.isArray(args.corrections)||!args.corrections.length||args.corrections.length>6)throw Error('Comparez entre 1 et 6 corrections.');
    return {hypothetical:true,asset:args.asset,amount:args.amount,scenarios:args.corrections.map(correction=>calculateScenario({...args,kind:'accumulation',correction},context))};
  }
  if (args.kind === 'fibonacci') {
    if (!positive(args.startPrice) || !positive(args.endPrice)) throw Error('Deux prix observés sont nécessaires.');
    return { kind: 'fibonacci', asset: args.asset, levels: [0, .236, .382, .5, .618, .786, 1].map(r => ({ ratio: r, price: args.endPrice + (args.startPrice - args.endPrice) * r })) };
  }
  const position = context.portfolio?.positions?.[args.asset];
  if (!position || !Number.isFinite(position.quantity) || position.quantity < 0) throw Error('Quantité du portefeuille manquante.');
  if (args.kind === 'portfolio_value') {
    if (!positive(args.targetPrice)) throw Error('Prix cible invalide.');
    const other = AI_ASSETS.find(a => a !== args.asset), otherQty = context.portfolio.positions[other]?.quantity;
    if (!Number.isFinite(otherQty)) throw Error('Autre position manquante.');
    const otherPrice = context.quotes?.[other]?.price;
    if (otherQty > 0 && !positive(otherPrice)) throw Error('Cours de l’autre position manquant.');
    if (!Number.isFinite(context.portfolio.cash)) throw Error('Réserve manquante.');
    return { hypothetical: true, asset: args.asset, targetPrice: args.targetPrice, positionValue: position.quantity * args.targetPrice, portfolioBtcSolWithCash: position.quantity * args.targetPrice + (otherQty ? otherQty * otherPrice : 0) + context.portfolio.cash, otherAssetPriceHeldConstant: otherPrice ?? null, excludesOtherAssets: true };
  }
  if (args.kind !== 'accumulation') throw Error('Calcul non autorisé.');
  const sell = context.quotes?.[args.asset]?.price;
  if (!positive(sell)) throw Error('Cours réel manquant.');
  if (context.market?.stale) throw Error('Cours non actualisé : demandez un prix de simulation explicite.');
  const fees = context.fees;
  if (!fees || ![fees.percentPerSide, fees.slippagePercent, fees.network].every(x => typeof x === 'number' && Number.isFinite(x) && x >= 0)) throw Error('Frais manquants : demander les paramètres, sans les supposer nuls.');
  const result = simulate({ amount: args.amount, sell, correction: args.correction, quantity: position.quantity, fee: fees.percentPerSide, slippage: fees.slippagePercent, network: fees.network });
  return { hypothetical: true, asset: args.asset, ...result, amount: args.amount, correction: args.correction, sufficientVirtualPosition: result.sold <= position.quantity, holdPositionAtBuyPrice: position.quantity * result.buy, strategyPositionAtBuyPrice: result.stock * result.buy, advantageVsHold: result.net * result.buy, feesConvention: 'Pourcentage + slippage de chaque côté ; frais réseau sur le rachat, comme Strategy Lab.' };
}
