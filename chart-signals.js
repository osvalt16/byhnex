import {ASSETS,TIMEFRAMES} from './market-data.js?v=20261003-chart-v2';

// Wilder RSI 14 and price + SMA 50 versus SMA 200 on the plot's exact series.
// Excluding the unfinished candle keeps a signal stable until the candle closes.
export function calculateSignals(candles,now=Date.now(),timeframe){
  const duration=TIMEFRAMES[timeframe]*1000;
  if(!duration)throw Error('Unité de temps invalide');
  const closes=candles.filter(c=>c.time+duration<=now).map(c=>c.close);
  let rsi=null,trend=null;
  if(closes.length>14){
    let gain=0,loss=0;
    for(let i=1;i<=14;i++){const change=closes[i]-closes[i-1];gain+=Math.max(change,0)/14;loss+=Math.max(-change,0)/14;}
    for(let i=15;i<closes.length;i++){const change=closes[i]-closes[i-1];gain=(gain*13+Math.max(change,0))/14;loss=(loss*13+Math.max(-change,0))/14;}
    rsi=gain===0&&loss===0?50:loss===0?100:100-100/(1+gain/loss);
  }
  if(closes.length>=200){
    const mean=n=>closes.slice(-n).reduce((sum,c)=>sum+c,0)/n;
    const s50=mean(50),s200=mean(200),price=closes.at(-1);
    trend=price>s200&&s50>s200?'up':price<s200&&s50<s200?'down':'flat';
  }
  return {rsi,trend,zone:rsi===null?null:rsi<30?'buy':rsi>70?'sell':'neutral',count:closes.length};
}

export class AssetSignals extends EventTarget {
  constructor({market,now=()=>Date.now()}={}){super();this.market=market;this.now=now;this.provider=null;this.timeframe=null;this.data={};this.cache=new Map();this.signatures=new Map();this.generation=0;this.closed=false;this.inFlight=null;}
  emit(){this.dispatchEvent(new Event('update'));}
  start(provider,timeframe){clearInterval(this.timer);this.closed=false;this.refresh(provider,timeframe);this.timer=setInterval(()=>this.refresh(this.provider,this.timeframe),60000);}
  sync(provider=this.provider,timeframe=this.timeframe){
    if(!TIMEFRAMES[timeframe]||this.closed)return;
    let changed=false;
    for(const asset of ASSETS){
      const key=`${provider}:${asset}:${timeframe}`,candles=this.market.series.get(key)||[],duration=TIMEFRAMES[timeframe]*1000;
      const lastClosed=candles.findLast(c=>c.time+duration<=this.now()),meta=this.market.history.meta.get(key);
      const stale=!!meta?.error||!meta||this.now()-meta.updatedAt>120000||!lastClosed||this.now()-(lastClosed.time+duration)>Math.max(duration,120000);
      const signature=[candles.length,lastClosed?.time,meta?.updatedAt,stale].join(':');
      if(this.signatures.get(key)!==signature){
        this.signatures.set(key,signature);
        this.cache.set(key,{...calculateSignals(candles,this.now(),timeframe),source:provider,timeframe,updatedAt:meta?.updatedAt||null,stale,loading:!lastClosed});
        changed=true;
      }
      const value=this.cache.get(key);
      if(provider===this.provider&&timeframe===this.timeframe&&this.data[asset]!==value){this.data[asset]=value;changed=true;}
    }
    if(changed)this.emit();
  }
  async refresh(provider=this.provider,timeframe=this.timeframe){
    if(this.closed||!provider||!TIMEFRAMES[timeframe])return;
    if(this.provider===provider&&this.timeframe===timeframe&&this.inFlight)return this.inFlight;
    if(this.provider!==provider||this.timeframe!==timeframe){this.provider=provider;this.timeframe=timeframe;this.data={};}
    const generation=++this.generation;
    this.sync(provider,timeframe);this.emit();
    const task=Promise.all(ASSETS.map(async asset=>{
      try{await this.market.loadHistory(provider,asset,timeframe,{minBars:220});}
      catch{const key=`${provider}:${asset}:${timeframe}`;this.market.history.meta.set(key,{...(this.market.history.meta.get(key)||{}),error:true});}
      if(generation!==this.generation||this.closed)return;
      this.sync(provider,timeframe);
    }));
    this.inFlight=task;
    try{await task;}finally{if(generation===this.generation)this.inFlight=null;}
  }
  close(){this.closed=true;this.generation++;this.inFlight=null;clearInterval(this.timer);}
}
