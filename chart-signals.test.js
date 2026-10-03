import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calculateSignals,AssetSignals} from './chart-signals.js';
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
  const service=new AssetSignals({now:()=>250*900000,fetcher:async url=>{if(failing&&url.includes('DOGE'))throw Error('offline');return Array.from({length:250},(_,i)=>[i*900,1,300,1,i+1,0]);}});
  await service.refresh('Coinbase');assert.equal(Object.keys(service.data).length,4);assert.equal(service.data.DOGE.rsi,100);
  failing=true;await service.refresh('Coinbase');assert.equal(service.data.DOGE.stale,true);assert.equal(service.data.DOGE.rsi,100);assert.equal(service.data.ZEC.stale,false);
  service.close();
});
test('Late responses from the previous source cannot overwrite signals after a provider switch',async()=>{
  const pending=[];
  const service=new AssetSignals({now:()=>250*900000,fetcher:url=>url.includes('coinbase')?new Promise(resolve=>pending.push(resolve)):Promise.resolve(Array.from({length:250},(_,i)=>[i*900000,300,300,1,300-i,0]))});
  const old=service.refresh('Coinbase');await service.refresh('Binance');
  for(const resolve of pending)resolve(Array.from({length:250},(_,i)=>[i*900,1,300,1,i+1,0]));
  await old;assert.equal(service.data.SOL.source,'Binance');assert.equal(service.data.SOL.rsi,0);assert.equal(service.data.SOL.trend,'down');service.close();
});
