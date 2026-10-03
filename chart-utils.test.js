import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseFibLevels,fibPrice,ema,parseStrategyLevels,strategyPrice,moveDrawing,periodPlan,periodViewport} from './chart-utils.js';
test('Chart periods pick a matching resolution, retain valid chosen units and use calendar dates',()=>{
  const tfs={'1m':60,'5m':300,'15m':900,'30m':1800,'1H':3600,'4H':14400,'1D':86400,'1W':604800},now=Date.UTC(2026,9,3,12);
  assert.equal(periodPlan('1D','1m',tfs,now).timeframe,'5m');assert.equal(periodPlan('1Y','1m',tfs,now).timeframe,'1D');
  assert.equal(periodPlan('7D','1H',tfs,now).timeframe,'1H');assert.equal(periodPlan('1D','1W',tfs,now).timeframe,'1H');
  assert.equal(periodPlan('3M','1D',tfs,now).start,Date.UTC(2026,6,3,12));
  assert.equal(periodPlan('1Y','1D',tfs,Date.UTC(2024,1,29)).start,Date.UTC(2023,1,28));
  assert.throws(()=>periodPlan('wrong','1H',tfs,now));
});
test('Time ranges respect real timestamps and report insufficient history rather than claiming a full period',()=>{
  const now=864000000,tfs={'1H':3600},plan=periodPlan('7D','1H',tfs,now);
  const candles=Array.from({length:220},(_,i)=>({time:now-(219-i)*3600000}));
  const view=periodViewport(candles,plan,3600,now);assert.equal(view.count,169);assert.equal(view.partial,false);
  assert.equal(periodViewport(candles.slice(-50),plan,3600,now).partial,true);
  assert.equal(periodViewport([{time:plan.start+1800000},{time:now}],plan,3600,now).partial,true);
  assert.equal(periodViewport(candles,{start:null},3600,now).count,220);
  const gaps=candles.filter((_,i)=>i%3!==0);assert.ok(periodViewport(gaps,plan,3600,now).count<view.count);
});
test('Fibonacci personnalisé : décimales françaises, extensions, tri et doublons',()=>{
  assert.deepEqual(parseFibLevels('100 ; 0 ; 61,8 ; 161.8 ; 61.8'),[0,.618,1,1.618]);
  for(const value of ['','abc','Infinity','600','1;NaN'])assert.throws(()=>parseFibLevels(value));
});
test('Fibonacci : sens et extensions conservent les points de référence',()=>{
  assert.equal(fibPrice(100,200,0),200);assert.equal(fibPrice(100,200,1),100);
  assert.equal(fibPrice(100,200,1.618),38.19999999999999);
  assert.equal(fibPrice(100,200,0,true),100);assert.equal(fibPrice(100,200,1,true),200);
});
test('EMA calculée sur tout l’historique avant le cadrage du graphique',()=>{
  assert.deepEqual(ema([{close:10},{close:20},{close:30}],3),[10,15,22.5]);
});
test('Fibonacci de stratégie : les baisses sont des pourcentages du prix de départ',()=>{
  assert.deepEqual(parseStrategyLevels('20 ; 5 ; 12,5 ; 5'),[5,12.5,20]);
  assert.equal(strategyPrice(100,12),88);assert.equal(strategyPrice(200,12),176);
  for(const price of [.12,95.4321,100000])for(const percent of [3.5,12,18,27.5])assert.ok(Math.abs((1-strategyPrice(price,percent)/price)*100-percent)<1e-10);
  for(const text of ['','abc','0','100','-5','5;Infinity'])assert.throws(()=>parseStrategyLevels(text));
});
test('Déplacer un dessin conserve son écart ; une poignée modifie seulement son point',()=>{
  const original={p1:100,p2:200,t1:1000,t2:4000,type:'fib'};
  assert.deepEqual(moveDrawing(original,25,500),{...original,p1:125,p2:225,t1:1500,t2:4500});
  assert.deepEqual(moveDrawing(original,25,500,'1'),{...original,p1:125,t1:1500});
  assert.deepEqual(moveDrawing(original,-25,500,'2'),{...original,p2:175,t2:4500});
  assert.equal(original.p1,100);const moved=moveDrawing(original,-1000,0);assert.ok(moved.p1>0);assert.ok(Math.abs(moved.p2-moved.p1-100)<1e-10);
});
