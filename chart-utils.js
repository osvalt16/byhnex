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
