import {test} from 'node:test';import assert from 'node:assert/strict';
import {normalizeCandles,aggregateCandles,applyTrade,bucketTime,LiveMarket} from './market-data.js';
import {calculateSignals} from './chart-signals.js';
test('Bougies Coinbase : ordre chronologique et OHLC valides',()=>{const rows=[[120,8,12,10,11,7],[60,7,11,8,10,5],[60,7,11,8,10,5],[180,0,0,0,0,NaN]];const data=normalizeCandles(rows,'Coinbase');assert.equal(data.length,2);assert.equal(data[0].time,60000);assert.equal(data[1].close,11);});
test('Agrégation 30 minutes : ouverture, clôture et volumes exacts',()=>{const rows=[{time:0,open:10,high:12,low:8,close:11,volume:3},{time:900000,open:11,high:14,low:9,close:13,volume:4}];assert.deepEqual(aggregateCandles(rows,1800),[{time:0,open:10,high:14,low:8,close:13,volume:7}]);});
test('Bougies hebdomadaires ancrées au lundi UTC',()=>{const monday=Date.UTC(2026,8,28);assert.equal(bucketTime(Date.UTC(2026,9,2),604800),monday);});
test('Ticks : bougie courante mise à jour ; aucun remplissage artificiel des trous',()=>{const data=[];applyTrade(data,{time:0,price:10,size:2},60);applyTrade(data,{time:30000,price:12,size:1},60);applyTrade(data,{time:240000,price:11,size:4},60);assert.equal(data.length,2);assert.deepEqual(data[0],{time:0,open:10,high:12,low:10,close:12,volume:3});assert.equal(data[1].time,240000);});
test('Une réponse tardive ne remplace pas le nouvel actif',async()=>{let resolve,calls=0;const service=new LiveMarket({fetcher:()=>++calls===1?new Promise(r=>{resolve=r}):Promise.resolve({ok:true,json:async()=>[]}),now:()=>100000});const pending=service.loadCandles('Coinbase',0);service.asset='BTC';service.generation=1;resolve({ok:true,json:async()=>[[3600,7,11,8,10,5],[7200,8,12,10,11,7]]});await pending;assert.equal(service.candles.length,0);service.close();});
test('Une panne ne produit aucune donnée fictive',async()=>{const service=new LiveMarket({fetcher:async()=>{throw Error('hors ligne')},now:()=>100000});await service.refresh(true);assert.equal(service.status,'unavailable');assert.equal(service.candles.length,0);assert.equal(service.fresh,false);service.close();});
test('DOGE et ZEC : ticks Coinbase mettent à jour le bon actif et ses bougies',()=>{
  class Socket {constructor(){Socket.last=this;this.readyState=1;}close(){}send(value){this.subscription=JSON.parse(value);}}
  const service=new LiveMarket({socketClass:Socket,now:()=>Date.UTC(2026,9,2)});
  for(const asset of ['DOGE','ZEC']){
    service.asset=asset;service.series.set(service.key,[{time:Date.UTC(2026,9,2),open:1,high:1,low:1,close:1,volume:0}]);service.connect();
    Socket.last.onopen();assert.ok(Socket.last.subscription.product_ids.includes(asset+'-USD'));
    Socket.last.onmessage({data:JSON.stringify({type:'ticker',product_id:asset+'-USD',price:'1.25',open_24h:'1',time:'2026-10-02T00:00:01Z',trade_id:1,last_size:'2'})});
    assert.equal(service.quotes[asset].price,1.25);assert.equal(service.candles.at(-1).close,1.25);assert.equal(service.candles.at(-1).volume,2);
  }
  service.close();
});
test('4H history shares requests with indicators and paginates within the Coinbase limit',async()=>{
  const calls=[],native=3600,now=1000*native*1000;
  const rows=Array.from({length:1000},(_,i)=>[i*native,100,300,100,101+i/10,1]);
  const service=new LiveMarket({now:()=>now,fetcher:async url=>{
    calls.push(url);const u=new URL(url),end=u.searchParams.get('end');
    if(end){assert.ok(Date.parse(end)-Date.parse(u.searchParams.get('start'))<=299*native*1000);}
    const page=rows.filter(r=>!end||r[0]*1000<=Date.parse(end)).slice(-300);
    return {ok:true,json:async()=>page};
  }});
  const [plot,indicator]=await Promise.all([service.loadCandles('Coinbase',0,'SOL','4H'),service.loadHistory('Coinbase','SOL','4H')]);
  assert.equal(plot,indicator);assert.equal(calls.length,3);assert.ok(plot.length>=220);assert.ok(plot.every(c=>c.time%14400000===0));
  assert.equal(calculateSignals(plot,now,'4H').trend,'up');
  await service.loadHistory('Coinbase','SOL','4H');assert.equal(calls.length,3);service.close();
});
test('Weekly history loads enough real daily candles, uses Monday UTC and excludes partial leading weeks',async()=>{
  const day=86400000,now=Date.UTC(2026,9,3),start=bucketTime(now,86400)-1599*day;
  const rows=Array.from({length:1600},(_,i)=>[(start+i*day)/1000,100,300,100,101+i/10,1]);
  let calls=0;
  const service=new LiveMarket({now:()=>now,fetcher:async url=>{calls++;const u=new URL(url),end=u.searchParams.get('end');return {ok:true,json:async()=>rows.filter(r=>!end||r[0]*1000<=Date.parse(end)).slice(-300)};}});
  const data=await service.loadHistory('Coinbase','BTC','1W');assert.ok(calls<=8&&calls>1);assert.ok(data.length>=220);
  assert.ok(data.every(c=>new Date(c.time).getUTCDay()===1));assert.equal(calculateSignals(data,now,'1W').trend,'up');service.close();
});
test('A period request upgrades pending shared history instead of stopping at the indicator window',async()=>{
  const day=86400000,now=Date.UTC(2026,9,3),rows=Array.from({length:900},(_,i)=>[(now-(899-i)*day)/1000,8,12,10,11,1]);
  let calls=0,release;
  const service=new LiveMarket({now:()=>now,fetcher:async url=>{
    calls++;if(calls===1)await new Promise(resolve=>{release=resolve;});
    const end=new URL(url).searchParams.get('end');
    return {ok:true,json:async()=>rows.filter(r=>!end||r[0]*1000<=Date.parse(end)).slice(-300)};
  }});
  const short=service.loadHistory('Coinbase','SOL','1D',{minBars:220});
  const year=service.loadHistory('Coinbase','SOL','1D',{minBars:565});release();
  const [a,b]=await Promise.all([short,year]);assert.equal(a,b);assert.ok(b.length>=565);assert.equal(calls,2);service.close();
});
test('A late timeframe response stays in its own cache and cannot change the selected plot',async()=>{
  let resolve;
  const now=Date.UTC(2026,9,3);
  const service=new LiveMarket({now:()=>now,fetcher:url=>{const native=Number(new URL(url).searchParams.get('granularity')),end=Math.floor(now/(native*1000))*native;const rows=Array.from({length:250},(_,i)=>[end-(249-i)*native,8,12,10,11,1]);return native===3600?new Promise(r=>{resolve=()=>r({ok:true,json:async()=>rows});}):Promise.resolve({ok:true,json:async()=>rows});}});
  const slow=service.select('SOL','1H');await service.select('BTC','1D');const active=service.candles;
  resolve();await slow;assert.equal(service.asset,'BTC');assert.equal(service.timeframe,'1D');assert.equal(service.candles,active);assert.equal(service.candles[1].time-service.candles[0].time,86400000);service.close();
});
test('Coinbase connection stays open when changing the plot context and still updates cached series',async()=>{
  class Socket {constructor(){this.readyState=1;this.closed=false;}close(){this.closed=true;}send(){}}
  const now=Date.UTC(2026,9,3),seconds=3600,end=now/1000;
  const service=new LiveMarket({socketClass:Socket,now:()=>now,fetcher:async()=>({ok:true,json:async()=>Array.from({length:250},(_,i)=>[end-(249-i)*seconds,8,12,10,11,1])})});
  await service.loadHistory('Coinbase','SOL','1H');service.connect();const socket=service.socket;
  await service.select('BTC','1H');assert.equal(service.socket,socket);assert.equal(socket.closed,false);
  socket.onmessage({data:JSON.stringify({type:'ticker',product_id:'BTC-USD',price:'12',time:new Date(now+1000).toISOString(),trade_id:2,last_size:'1'})});
  assert.equal(service.quotes.BTC.price,12);assert.equal(service.candles.at(-1).close,12);service.close();
});
test('A slow REST snapshot cannot roll back a candle updated by the live feed',async()=>{
  class Socket {constructor(){this.readyState=1;}close(){}send(){}}
  let clock=3600000,resolve;
  const service=new LiveMarket({socketClass:Socket,now:()=>clock,fetcher:()=>new Promise(r=>{resolve=r;})});
  service.series.set(service.key,[{time:0,open:10,high:11,low:10,close:11,volume:1},{time:3600000,open:10,high:10,low:10,close:10,volume:1}]);service.connect();
  const pending=service.loadHistory('Coinbase','SOL','1H',{force:true,minBars:2});clock+=1000;
  service.socket.onmessage({data:JSON.stringify({type:'ticker',product_id:'SOL-USD',price:'15',time:new Date(clock).toISOString(),trade_id:2,last_size:'2'})});
  resolve({ok:true,json:async()=>[[0,8,12,10,11,5],[3600,8,12,10,11,5]]});await pending;
  assert.equal(service.candles.at(-1).close,15);assert.equal(service.candles.at(-1).high,15);assert.equal(service.candles.at(-1).low,8);assert.equal(service.candles.at(-1).volume,5);service.close();
});
