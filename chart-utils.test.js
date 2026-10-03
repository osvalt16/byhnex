import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseFibLevels,fibPrice,ema,parseStrategyLevels,strategyPrice,moveDrawing} from './chart-utils.js';
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
