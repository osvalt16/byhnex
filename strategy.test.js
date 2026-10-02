import {test} from 'node:test';import assert from 'node:assert/strict';import {simulate,comparison} from './strategy.js';
test('Exemple SOL sans frais',()=>{const r=simulate({amount:800,sell:140,correction:15,fee:0,quantity:21});assert.ok(Math.abs(r.net-1.0084033613)<1e-9);assert.ok(Math.abs(r.stock-22.0084033613)<1e-9)});
test('Prix identique : perte nette après frais',()=>{const r=simulate({amount:800,sell:140,correction:0,fee:.1,slippage:.05});assert.ok(r.net<0);assert.ok(r.breakEven<140)});
test('Break-even restaure les tokens vendus',()=>{const r=simulate({amount:800,sell:140,correction:15,fee:.1,network:2});const equal=simulate({amount:800,sell:140,correction:(1-r.breakEven/140)*100,fee:.1,network:2});assert.ok(Math.abs(equal.net)<1e-12)});
test('La réserve est incluse dans la comparaison HOLD',()=>{assert.deepEqual(comparison({SOL:{quantity:15}},{SOL:21},{SOL:140},840),{hold:2940,active:2940})});
test('Paramètres invalides refusés',()=>{for(const amount of [0,-1,NaN,Infinity])assert.throws(()=>simulate({amount,sell:140,correction:15,fee:0}));assert.throws(()=>simulate({amount:800,sell:140,correction:100,fee:0}))});
