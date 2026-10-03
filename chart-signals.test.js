import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calculateSignals,AssetSignals} from './chart-signals.js';
import {LiveMarket,TIMEFRAMES} from './market-data.js';
const bars=closes=>closes.map((close,i)=>({time:i*900000,close}));
test('RSI 14 and SMA trend use closed 15-minute candles, excluding the unfinished candle',()=>{
  const data=bars(Array.from({length:251},(_,i)=>i<250?i+1:.01));
  const result=calculateSignals(data,250*900000);
  assert.equal(result.count,250);assert.equal(result.rsi,100);assert.equal(result.trend,'up');assert.equal(result.zone,'sell');
  const down=calculateSignals(bars(Array.from({length:250},(_,i)=>300-i)),250*900000);
  assert.equal(down.rsi,0);assert.equal(down.trend,'down');assert.equal(down.zone,'buy');
  assert.deepEqual(calculateSignals(bars([10,11]),900000),{rsi:null,trend:null,zone:null,count:1});
});
test('Wilder smoothing matches a known RSI example rather than a simple average',()=>{
  const prices=[44.34,44.09,44.15,43.61,44.33,44.83,45.1,45.42,45.84,46.08,45.89,46.03,45.61,46.28,46.28,46,46.03,46.41,46.22,45.64];
  assert.ok(Math.abs(calculateSignals(bars(prices),prices.length*900000).rsi-57.915)<.001);
});
test('Each asset fails independently; outages retain explicitly stale values without invented signals',async()=>{
  let failing=false;
  let clock=250*900000;
  const market=new LiveMarket({now:()=>clock,fetcher:async url=>{if(failing&&url.includes('DOGE'))throw Error('offline');return {ok:true,json:async()=>Array.from({length:250},(_,i)=>[i*900,1,300,1,i+1,0])};}});
  const service=new AssetSignals({market,now:()=>clock});
  await service.refresh('Coinbase','15m');assert.equal(Object.keys(service.data).length,4);assert.equal(service.data.DOGE.rsi,100);
  failing=true;clock+=60000;await service.refresh('Coinbase','15m');assert.equal(service.data.DOGE.stale,true);assert.equal(service.data.DOGE.rsi,100);assert.equal(service.data.ZEC.stale,false);
  service.close();
});
test('Late responses from the previous source cannot overwrite signals after a provider switch',async()=>{
  const pending=[];
  const market=new LiveMarket({now:()=>250*900000,fetcher:url=>url.includes('coinbase')?new Promise(resolve=>pending.push(resolve)):Promise.resolve({ok:true,json:async()=>Array.from({length:250},(_,i)=>[i*900000,300,300,1,300-i,0])})});
  const service=new AssetSignals({market,now:()=>250*900000});
  const old=service.refresh('Coinbase','15m');await service.refresh('Binance','15m');
  for(const resolve of pending)resolve({ok:true,json:async()=>Array.from({length:250},(_,i)=>[i*900,1,300,1,i+1,0])});
  await old;assert.equal(service.data.SOL.source,'Binance');assert.equal(service.data.SOL.rsi,0);assert.equal(service.data.SOL.trend,'down');service.close();
});
test('Every chart timeframe excludes its own unfinished candle; a flat market is neutral',()=>{
  for(const [tf,seconds] of Object.entries(TIMEFRAMES)){
    const duration=seconds*1000,data=Array.from({length:201},(_,i)=>({time:i*duration,close:i<200?i+1:.01}));
    const result=calculateSignals(data,200*duration,tf);assert.equal(result.count,200,tf);assert.equal(result.rsi,100,tf);assert.equal(result.trend,'up',tf);
  }
  assert.equal(calculateSignals(bars(Array(200).fill(10)),200*900000).rsi,50);
  assert.throws(()=>calculateSignals([],0,'bad'));
});
test('Fast timeframe changes discard old indicators and late replies; returning to a timeframe reuses its cache',async()=>{
  const pending=[];let calls=0;
  const market=new LiveMarket({now:()=>250*3600000,fetcher:url=>{calls++;const slow=url.includes('granularity=900');const rows=Array.from({length:250},(_,i)=>[i*(slow?900:3600),1,300,1,slow?i+1:300-i,0]);return slow?new Promise(resolve=>pending.push(()=>resolve({ok:true,json:async()=>rows}))):Promise.resolve({ok:true,json:async()=>rows});}});
  const service=new AssetSignals({market,now:market.now});
  const old=service.refresh('Coinbase','15m');const next=service.refresh('Coinbase','1H');
  assert.ok(Object.values(service.data).every(s=>s.timeframe==='1H'&&s.rsi===null));
  await next;assert.equal(service.data.SOL.rsi,0);for(const resolve of pending)resolve();await old;
  assert.equal(service.timeframe,'1H');assert.equal(service.data.SOL.timeframe,'1H');assert.equal(service.data.SOL.rsi,0);
  const before=calls;await service.refresh('Coinbase','15m');assert.equal(calls,before);assert.equal(service.data.SOL.rsi,100);service.close();market.close();
});
