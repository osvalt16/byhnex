import {TIMEFRAMES,normalizeCandles,aggregateCandles} from './market-data.js?v=20261003-chart-v2';

export const binanceIntervals={'1m':'1m','5m':'5m','15m':'15m','30m':'30m','1H':'1h','4H':'4h','1D':'1d','1W':'1w'};
export const nativeInterval=tf=>[60,300,900,3600,21600,86400].filter(s=>s<=TIMEFRAMES[tf]).at(-1);
export function mergeCandles(previous,incoming){return [...new Map([...previous,...incoming].map(c=>[c.time,c])).values()].sort((a,b)=>a.time-b.time);}

// Shared, deduplicated history for the plot and its signal summaries.
export class CandleHistory {
  constructor(market){this.market=market;this.pending=new Map();this.meta=new Map();this.targets=new Map();}
  key(provider,asset,tf){return `${provider}:${asset}:${tf}`;}
  async load(provider,asset,tf,{minBars=220,force=false,before=null}={}){
    const market=this.market,key=this.key(provider,asset,tf),requestKey=key+(before===null?'':':before:'+before);
    this.targets.set(requestKey,Math.max(minBars,this.targets.get(requestKey)||0));
    if(this.pending.has(requestKey))return this.pending.get(requestKey);
    const cached=market.series.get(key),meta=this.meta.get(key);
    if(!force&&before===null&&cached?.length>=minBars&&meta&&!meta.error&&market.now()-meta.updatedAt<30000){this.targets.delete(requestKey);return cached;}
    const task=this.fetch(provider,asset,tf,{minBars,before,requestKey});
    this.pending.set(requestKey,task);
    try{return await task;}catch(error){this.meta.set(key,{...(this.meta.get(key)||{}),error:true});throw error;}finally{if(this.pending.get(requestKey)===task){this.pending.delete(requestKey);this.targets.delete(requestKey);}}
  }
  async fetch(provider,asset,tf,{minBars,before,requestKey}){
    const market=this.market,key=this.key(provider,asset,tf),epoch=market.historyEpoch,seconds=TIMEFRAMES[tf];
    const valid=()=>epoch===market.historyEpoch&&!market.closed;
    let data=[],end=before,pages=0;
    while(pages++<8){
      const requestedAt=market.now();
      const native=nativeInterval(tf),base=`https://api.exchange.coinbase.com/products/${asset}-USD/candles?granularity=${native}`;
      const url=provider==='Coinbase'?base+(end===null?'':`&start=${new Date(end-native*299000).toISOString()}&end=${new Date(end).toISOString()}`):`https://data-api.binance.vision/api/v3/klines?symbol=${asset}USDT&interval=${binanceIntervals[tf]}&limit=700${end===null?'':'&endTime='+end}`;
      const rows=await market.json(url),incoming=normalizeCandles(rows,provider);
      if(!valid())return market.series.get(key)||[];
      if(!incoming.length){if(!data.length)throw Error('Historique indisponible');break;}
      const previousFirst=data[0]?.time;
      if(provider==='Coinbase'){
        const rawKey=asset+':'+native;
        const raw=mergeCandles(market.nativeSeries.get(rawKey)||[],incoming);
        market.nativeSeries.set(rawKey,raw);
        data=aggregateCandles(raw,seconds);
        // An aggregated first bucket may start halfway through the requested period.
        if(seconds>native&&raw[0].time>data[0]?.time)data.shift();
      }else data=mergeCandles(market.series.get(key)||[],incoming);
      const previous=market.series.get(key)||[],liveAt=market.liveUpdates?.get(key)||0;
      data=mergeCandles(previous,data);
      if(liveAt>0&&liveAt>=requestedAt&&previous.length){
        const live=previous.at(-1),index=data.findIndex(c=>c.time===live.time);
        if(index>=0)data[index]={...live,high:Math.max(live.high,data[index].high),low:Math.min(live.low,data[index].low),volume:Math.max(live.volume,data[index].volume)};
      }
      market.series.set(key,data);
      this.meta.set(key,{updatedAt:market.now(),error:false});
      market.emit(key);
      // Explicit backfill loads one page; initial history fills the SMA 200 window.
      if(before!==null||data.length>=Math.max(minBars,this.targets.get(requestKey)||0)||data[0]?.time===previousFirst)break;
      end=(provider==='Coinbase'?(market.nativeSeries.get(asset+':'+native)||[])[0]?.time:data[0]?.time)-1;
      if(!Number.isFinite(end))break;
    }
    if(data.length<2)throw Error('Historique indisponible');
    return data;
  }
}
