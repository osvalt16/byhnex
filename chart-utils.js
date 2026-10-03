export const FIB_LEVELS = [0, .236, .382, .5, .618, .786, 1];

export function periodPlan(period,timeframe,timeframes,now=Date.now()){
  if(!timeframes[timeframe]||!['1D','7D','30D','3M','1Y','MAX'].includes(period))throw Error('Période ou unité invalide.');
  if(period==='MAX')return {period,timeframe,start:null,end:now,minBars:220};
  const end=new Date(now),start=new Date(now);
  if(period==='3M'||period==='1Y'){
    const day=start.getUTCDate();start.setUTCDate(1);
    start.setUTCMonth(start.getUTCMonth()-(period==='3M'?3:12));
    const lastDay=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,0)).getUTCDate();
    start.setUTCDate(Math.min(day,lastDay));
  }else start.setUTCDate(start.getUTCDate()-{'1D':1,'7D':7,'30D':30}[period]);
  const duration=end-start,requested=duration/(timeframes[timeframe]*1000);
  if(requested<15||requested>600){
    const choices=Object.entries(timeframes).filter(([,seconds])=>duration/(seconds*1000)>=15&&duration/(seconds*1000)<=600);
    if(choices.length)timeframe=choices.reduce((a,b)=>Math.abs(Math.log(b[1]/timeframes[timeframe]))<Math.abs(Math.log(a[1]/timeframes[timeframe]))?b:a)[0];
  }
  return {period,timeframe,start:+start,end:now,minBars:Math.max(220,Math.ceil(duration/(timeframes[timeframe]*1000))+200)};
}

export function periodViewport(candles,plan,seconds,now=Date.now()){
  if(!candles.length)return {count:0,offset:0,partial:false};
  if(plan.start===null)return {count:candles.length,offset:0,partial:false};
  // Include the candle covering the start boundary, without inventing gaps.
  const duration=now-plan.end,start=plan.start+duration;
  let first=candles.findIndex(c=>c.time+seconds*1000>start);
  if(first<0)first=candles.length-1;
  return {count:candles.length-first,offset:0,partial:candles[0].time>start};
}

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
