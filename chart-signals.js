import {ASSETS,normalizeCandles} from './market-data.js?v=20261003-ovh';

// Same rules as Signaux Crypto: closed 15-minute candles, Wilder RSI 14,
// and price + SMA 50 compared with SMA 200. Never use the unfinished candle.
export function calculateSignals(candles,now=Date.now()) {
  const closes=candles.filter(c=>c.time+900000<=now).map(c=>c.close);
  let rsi=null,trend=null;
  if(closes.length>14){
    let gain=0,loss=0;
    for(let i=1;i<=14;i++){const change=closes[i]-closes[i-1];gain+=Math.max(change,0)/14;loss+=Math.max(-change,0)/14;}
    for(let i=15;i<closes.length;i++){const change=closes[i]-closes[i-1];gain=(gain*13+Math.max(change,0))/14;loss=(loss*13+Math.max(-change,0))/14;}
    rsi=loss===0?100:100-100/(1+gain/loss);
  }
  if(closes.length>=200){
    const mean=n=>closes.slice(-n).reduce((sum,c)=>sum+c,0)/n;
    const s50=mean(50),s200=mean(200),price=closes.at(-1);
    trend=price>s200&&s50>s200?'up':price<s200&&s50<s200?'down':'flat';
  }
  return {rsi,trend,zone:rsi===null?null:rsi<30?'buy':rsi>70?'sell':'neutral',count:closes.length};
}

export class AssetSignals extends EventTarget {
  constructor({fetcher,now=()=>Date.now()}={}){super();this.fetcher=fetcher;this.now=now;this.provider=null;this.data={};this.generation=0;this.closed=false;this.inFlight=null;}
  emit(){this.dispatchEvent(new Event('update'));}
  start(provider){clearInterval(this.timer);this.closed=false;this.refresh(provider);this.timer=setInterval(()=>this.refresh(this.provider),60000);}
  async refresh(provider=this.provider){
    if(this.closed||!provider)return;
    if(this.provider===provider&&this.inFlight)return this.inFlight;
    if(this.provider!==provider){this.provider=provider;this.data={};}
    const generation=++this.generation;
    this.emit();
    const task=Promise.all(ASSETS.map(async asset=>{
      try{
        const url=provider==='Coinbase'?`https://api.exchange.coinbase.com/products/${asset}-USD/candles?granularity=900`:`https://data-api.binance.vision/api/v3/klines?symbol=${asset}USDT&interval=15m&limit=250`;
        const rows=await this.fetcher(url),candles=normalizeCandles(rows,provider);
        const result=calculateSignals(candles,this.now());
        if(result.count<15)throw Error('Historique insuffisant');
        if(generation!==this.generation||this.closed)return;
        const lastClosed=candles.filter(c=>c.time+900000<=this.now()).at(-1);
        this.data[asset]={...result,updatedAt:this.now(),source:provider,stale:this.now()-(lastClosed.time+900000)>900000};
      }catch{
        if(generation!==this.generation||this.closed)return;
        this.data[asset]={...(this.data[asset]||{}),source:provider,stale:true};
      }
      this.emit();
    }));
    this.inFlight=task;
    try{await task;}finally{if(generation===this.generation)this.inFlight=null;}
  }
  close(){this.closed=true;this.generation++;this.inFlight=null;clearInterval(this.timer);}
}
