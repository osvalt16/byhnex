import {test} from 'node:test';import assert from 'node:assert/strict';
import {normalizeCandles,aggregateCandles,applyTrade,bucketTime,LiveMarket} from './market-data.js';
test('Bougies Coinbase : ordre chronologique et OHLC valides',()=>{const rows=[[120,8,12,10,11,7],[60,7,11,8,10,5],[60,7,11,8,10,5],[180,0,0,0,0,NaN]];const data=normalizeCandles(rows,'Coinbase');assert.equal(data.length,2);assert.equal(data[0].time,60000);assert.equal(data[1].close,11);});
test('Agrégation 30 minutes : ouverture, clôture et volumes exacts',()=>{const rows=[{time:0,open:10,high:12,low:8,close:11,volume:3},{time:900000,open:11,high:14,low:9,close:13,volume:4}];assert.deepEqual(aggregateCandles(rows,1800),[{time:0,open:10,high:14,low:8,close:13,volume:7}]);});
test('Bougies hebdomadaires ancrées au lundi UTC',()=>{const monday=Date.UTC(2026,8,28);assert.equal(bucketTime(Date.UTC(2026,9,2),604800),monday);});
test('Ticks : bougie courante mise à jour ; aucun remplissage artificiel des trous',()=>{const data=[];applyTrade(data,{time:0,price:10,size:2},60);applyTrade(data,{time:30000,price:12,size:1},60);applyTrade(data,{time:240000,price:11,size:4},60);assert.equal(data.length,2);assert.deepEqual(data[0],{time:0,open:10,high:12,low:10,close:12,volume:3});assert.equal(data[1].time,240000);});
test('Une réponse tardive ne remplace pas le nouvel actif',async()=>{let resolve;const service=new LiveMarket({fetcher:()=>new Promise(r=>{resolve=r}),now:()=>100000});const pending=service.loadCandles('Coinbase',0);service.asset='BTC';service.generation=1;resolve({ok:true,json:async()=>[[3600,7,11,8,10,5],[7200,8,12,10,11,7]]});await pending;assert.equal(service.candles.length,0);service.close();});
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
