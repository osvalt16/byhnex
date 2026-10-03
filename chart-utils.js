export const FIB_LEVELS = [0, .236, .382, .5, .618, .786, 1];

export function parseFibLevels(text) {
  const levels = String(text).split(/[;\s]+/).filter(Boolean).map(x => Number(x.replace(',', '.')) / 100);
  if (!levels.length || levels.length > 16 || levels.some(x => !Number.isFinite(x) || x < -5 || x > 5)) {
    throw Error('Indiquez 1 à 16 niveaux entre −500 et 500 %, séparés par un point-virgule.');
  }
  return [...new Set(levels)].sort((a, b) => a - b);
}

export function ema(candles, period) {
  const alpha = 2 / (period + 1);
  let value;
  return candles.map(c => {
    value = value === undefined ? c.close : alpha * c.close + (1 - alpha) * value;
    return value;
  });
}

export function fibPrice(start, end, ratio, reversed = false) {
  return reversed ? start + (end - start) * ratio : end + (start - end) * ratio;
}

export function parseStrategyLevels(text) {
  const values = String(text).split(/[;\s]+/).filter(Boolean).map(x => Number(x.replace(',', '.')));
  if (!values.length || values.length > 16 || values.some(x => !Number.isFinite(x) || x <= 0 || x >= 100)) {
    throw Error('Indiquez 1 à 16 baisses entre 0 et 100 % exclus, séparées par ;.');
  }
  return [...new Set(values)].sort((a,b) => a-b);
}

export function strategyPrice(anchor, percent) {
  if (!Number.isFinite(anchor) || anchor <= 0 || !Number.isFinite(percent) || percent < 0 || percent >= 100) throw Error('Prix d’ancrage ou pourcentage invalide.');
  return anchor * (1 - percent / 100);
}

export function moveDrawing(original, deltaPrice, deltaTime, handle = null) {
  const copy = {...original};
  if (handle === '1' || handle === '2') {
    copy['p'+handle] = Math.max(1e-12, original['p'+handle] + deltaPrice);
    copy['t'+handle] = original['t'+handle] + deltaTime;
  } else {
    const shift = Math.max(deltaPrice, 1e-12 - Math.min(original.p1, original.p2 ?? original.p1));
    copy.p1 += shift; copy.t1 += deltaTime;
    if (original.p2 !== undefined) { copy.p2 += shift; copy.t2 += deltaTime; }
  }
  return copy;
}
