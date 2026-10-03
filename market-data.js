import {CandleHistory,binanceIntervals} from './candle-history.js?v=20261003-chart-v2';
export const ASSETS=['SOL','BTC','DOGE','ZEC'];
export const TIMEFRAMES={'1m':60,'5m':300,'15m':900,'30m':1800,'1H':3600,'4H':14400,'1D':86400,'1W':604800};
export function bucketTime(time,seconds){const shift=seconds===604800?345600000:0;return Math.floor((time-shift)/(seconds*1000))*seconds*1000+shift;}
export function normalizeCandles(rows,provider){
  const data=rows.map(r=>provider==='Coinbase'?{time:Number(r[0])*1000,low:+r[1],high:+r[2],open:+r[3],close:+r[4],volume:+r[5]}:{time:+r[0],open:+r[1],high:+r[2],low:+r[3],close:+r[4],volume:+r[5]});
  return [...new Map(data.filter(c=>Object.values(c).every(Number.isFinite)&&c.open>0&&c.close>0&&c.low>0&&c.high>=Math.max(c.open,c.close)&&c.low<=Math.min(c.open,c.close)&&c.volume>=0).map(c=>[c.time,c])).values()].sort((a,b)=>a.time-b.time);
}
export function aggregateCandles(data,seconds){const buckets=new Map();for(const c of [...data].sort((a,b)=>a.time-b.time)){const t=bucketTime(c.time,seconds),previous=buckets.get(t);if(previous){previous.high=Math.max(previous.high,c.high);previous.low=Math.min(previous.low,c.low);previous.close=c.close;previous.volume+=c.volume;}else buckets.set(t,{...c,time:t});}return [...buckets.values()];}
export function applyTrade(data,trade,seconds){const t=bucketTime(trade.time,seconds),last=data.at(-1);if(!Number.isFinite(trade.price)||trade.price<=0||!Number.isFinite(trade.time))return data;if(last&&t<last.time)return data;const volume=Number.isFinite(trade.size)&&trade.size>0?trade.size:0;if(last&&t===last.time){last.high=Math.max(last.high,trade.price);last.low=Math.min(last.low,trade.price);last.close=trade.price;last.volume+=volume;}else data.push({time:t,open:trade.price,high:trade.price,low:trade.price,close:trade.price,volume});return data;}

export class LiveMarket extends EventTarget{
  constructor({fetcher=globalThis.fetch,socketClass=globalThis.WebSocket,now=()=>Date.now()}={}){super();this.fetcher=fetcher;this.Socket=socketClass;this.now=now;this.asset='SOL';this.timeframe='1H';this.provider='Coinbase';this.quote='USD';this.quotes={};this.series=new Map();this.nativeSeries=new Map();this.generation=0;this.status='loading';this.lastUpdate=0;this.closed=false;this.retry=0;this.seenTrades=new Map();this.liveUpdates=new Map();this.historyEpoch=0;this.history=new CandleHistory(this);this.connectionId=0;this.revisions=new Map();}
  emit(key=this.key){if(key)this.revisions.set(key,(this.revisions.get(key)||0)+1);this.dispatchEvent(new Event('update'));}
  get key(){return `${this.provider}:${this.asset}:${this.timeframe}`;}
  get candles(){return this.series.get(this.key)||[];}
  get fresh(){return !this.closed&&!'stale unavailable loading'.split(' ').includes(this.status)&&this.now()-this.lastUpdate<90000&&ASSETS.every(a=>this.quotes[a]?.price>0&&this.now()-(this.quotes[a].receivedAt||this.quotes[a].time)<90000)&&this.candles.length>0;}
  async json(url){const response=await this.fetcher.call(globalThis,url,{signal:AbortSignal.timeout(7000)});if(!response.ok)throw Error(`HTTP ${response.status}`);return response.json();}
  async start(asset='SOL',timeframe='1H'){clearInterval(this.poll);clearInterval(this.health);this.asset=asset;this.timeframe=timeframe;this.closed=false;this.status='loading';this.emit();await this.refresh(true);if(!this.closed){this.connect();this.poll=setInterval(()=>this.refresh(),30000);this.health=setInterval(()=>{if(this.now()-this.lastUpdate>90000){this.status='stale';this.emit();}},10000);}}
  async refresh(allowFallback=false){if(this.refreshing)return;this.refreshing=true;const generation=this.generation,provider=this.provider;try{await Promise.all([this.loadQuotes(provider,generation),this.loadCandles(provider,generation)]);if(generation===this.generation){this.lastUpdate=this.now();this.status=this.socket?.readyState===1?'live':'polling';this.emit();}}catch(error){if(generation===this.generation){this.error=error.message;this.status=this.lastUpdate?'stale':'unavailable';this.emit();if(allowFallback&&provider==='Coinbase'){this.provider='Binance';this.quote='USDT';this.quotes={};this.refreshing=false;return this.refresh(false);}}}finally{this.refreshing=false;}}
  async loadQuotes(provider,generation){const requestedAt=this.now();let quotes={};if(provider==='Coinbase'){const results=await Promise.all(ASSETS.map(async a=>{const [ticker,stats]=await Promise.all([this.json(`https://api.exchange.coinbase.com/products/${a}-USD/ticker`),this.json(`https://api.exchange.coinbase.com/products/${a}-USD/stats`)]);const price=+ticker.price;if(!(price>0)||!(+stats.open>0))throw Error('Cours Coinbase invalide');return [a,{price,change:(price/+stats.open-1)*100,receivedAt:this.now(),time:Date.parse(ticker.time)||this.now()}];}));quotes=Object.fromEntries(results);}else{const rows=await this.json('https://data-api.binance.vision/api/v3/ticker/24hr?symbols='+encodeURIComponent(JSON.stringify(ASSETS.map(a=>a+'USDT'))));for(const r of rows){const a=r.symbol.replace('USDT','');if(!(Number(r.lastPrice)>0))throw Error('Cours Binance invalide');quotes[a]={price:+r.lastPrice,change:+r.priceChangePercent,receivedAt:this.now(),time:+r.closeTime};}}
    if(generation===this.generation&&provider===this.provider){for(const asset of ASSETS)if(this.quotes[asset]?.receivedAt>requestedAt)quotes[asset]=this.quotes[asset];this.quotes=quotes;this.emit(null);}}
  loadHistory(provider,asset,tf,options={}){if(!ASSETS.includes(asset)||!TIMEFRAMES[tf])throw Error('Actif ou unité invalide');return this.history.load(provider,asset,tf,options);}
  async loadCandles(provider,generation,asset=this.asset,tf=this.timeframe){
    const data=await this.loadHistory(provider,asset,tf,{force:true});
    if(generation===this.generation&&provider===this.provider&&!this.closed)this.emit();
    return data;
  }
  async select(asset,timeframe){
    if(!TIMEFRAMES[timeframe]||!ASSETS.includes(asset))throw Error('Actif ou unité invalide');
    const changedTimeframe=timeframe!==this.timeframe;
    this.asset=asset;this.timeframe=timeframe;this.generation++;const generation=this.generation;
    this.status=this.candles.length?'polling':'loading';
    if(this.provider==='Binance'&&changedTimeframe)this.disconnectSocket();
    this.emit();
    try{
      await this.loadHistory(this.provider,asset,timeframe);
      if(generation===this.generation&&!this.closed){this.status=this.socket?.readyState===1?'live':this.now()-this.lastUpdate<90000?'polling':'stale';if(!this.socket)this.connect();this.emit();}
    }catch(error){if(generation===this.generation&&!this.closed){this.status='unavailable';this.error=error.message;this.emit();if(!this.socket)this.connect();}}
  }
  disconnectSocket(){this.connectionId++;clearTimeout(this.reconnectTimer);clearTimeout(this.handshake);if(this.socket){this.socket.onclose=null;this.socket.onerror=null;this.socket.onmessage=null;this.socket.close();this.socket=null;}}
  connect(){
    if(this.closed)return;this.disconnectSocket();const provider=this.provider,connectionId=this.connectionId;
    try{
      const streams=ASSETS.flatMap(a=>[a.toLowerCase()+'usdt@ticker',a.toLowerCase()+'usdt@kline_'+binanceIntervals[this.timeframe]]);
      const socket=this.socket=new this.Socket(provider==='Coinbase'?'wss://ws-feed.exchange.coinbase.com':'wss://data-stream.binance.vision/stream?streams='+streams.join('/'));
      this.handshake=setTimeout(()=>{if(socket.readyState!==1)socket.close();},12000);
      const valid=()=>!this.closed&&connectionId===this.connectionId&&provider===this.provider;
      socket.onopen=()=>{clearTimeout(this.handshake);this.retry=0;if(provider==='Coinbase')socket.send(JSON.stringify({type:'subscribe',product_ids:ASSETS.map(a=>a+'-USD'),channels:['ticker','heartbeat']}));};
      socket.onmessage=e=>{
        if(!valid())return;
        try{
          const payload=JSON.parse(e.data),m=payload.data||payload;let changedAsset=null;
          if(provider==='Coinbase'){
            if(m.type!=='ticker'||!ASSETS.map(a=>a+'-USD').includes(m.product_id)||!(+m.price>0))return;
            const asset=m.product_id.split('-')[0],time=Date.parse(m.time)||this.now();changedAsset=asset;
            if(this.quotes[asset]?.time>time)return;
            this.quotes[asset]={price:+m.price,change:+m.open_24h>0?(+m.price/+m.open_24h-1)*100:this.quotes[asset]?.change||0,time,receivedAt:this.now()};
            const lastId=this.seenTrades.get(asset);
            if(lastId===undefined||+m.trade_id>lastId){
              this.seenTrades.set(asset,+m.trade_id);
              for(const [key,candles] of this.series){
                const [source,a,tf]=key.split(':');
                if(source===provider&&a===asset&&candles.length){applyTrade(candles,{price:+m.price,time,size:+m.last_size},TIMEFRAMES[tf]);this.liveUpdates.set(key,this.now());}
              }
            }
          }else if(m.e==='24hrTicker'){
            const asset=m.s.replace('USDT','');changedAsset=asset;if(!ASSETS.includes(asset)||this.quotes[asset]?.time>+m.E)return;
            this.quotes[asset]={price:+m.c,change:+m.P,receivedAt:this.now(),time:+m.E};
          }else if(m.e==='kline'&&ASSETS.includes(m.s.replace('USDT',''))){
            const asset=m.s.replace('USDT',''),tf=Object.keys(binanceIntervals).find(tf=>binanceIntervals[tf]===m.k.i)||this.timeframe;
            const key=provider+':'+asset+':'+tf,data=this.series.get(key);changedAsset=asset;
            const c=normalizeCandles([[m.k.t,m.k.o,m.k.h,m.k.l,m.k.c,m.k.v]],'Binance')[0];
            if(c&&data?.length){const index=data.findIndex(x=>x.time===c.time);if(index>=0)data[index]=c;else if(c.time>data.at(-1).time)data.push(c);this.liveUpdates.set(key,this.now());}
          }else return;
          this.lastUpdate=this.now();if(this.candles.length)this.status='live';this.emit(changedAsset===this.asset?this.key:null);
        }catch{}
      };
      const reconnect=()=>{if(!valid())return;this.status=this.fresh?'polling':this.lastUpdate?'stale':'unavailable';this.emit();clearTimeout(this.reconnectTimer);this.reconnectTimer=setTimeout(()=>{this.refresh();this.connect();},Math.min(30000,1000*2**Math.min(this.retry++,5)));};
      socket.onclose=reconnect;socket.onerror=()=>socket.close();
    }catch{this.status='polling';this.emit();}
  }
  async loadMore(){const first=this.candles[0];if(!first)return;return this.loadHistory(this.provider,this.asset,this.timeframe,{before:first.time-1,force:true});}
  close(){this.closed=true;this.generation++;this.historyEpoch++;clearInterval(this.poll);clearInterval(this.health);this.disconnectSocket();}
}
