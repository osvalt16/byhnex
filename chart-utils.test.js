import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseFibLevels,fibPrice,ema} from './chart-utils.js';
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
