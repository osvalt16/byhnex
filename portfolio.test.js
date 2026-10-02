import {test} from 'node:test';import assert from 'node:assert/strict';import {quantityFromValue,reserveFromTotal} from './portfolio.js';
test('Une valeur virtuelle est convertie en quantité au cours réel',()=>{assert.equal(quantityFromValue(800,100),8);assert.equal(quantityFromValue(0,100),0);assert.throws(()=>quantityFromValue(-10,100));assert.throws(()=>quantityFromValue(10,NaN));});
test('Le capital total ajuste uniquement la réserve',()=>{assert.equal(reserveFromTotal(1500,800),700);assert.equal(reserveFromTotal(800,800),0);assert.throws(()=>reserveFromTotal(700,800));});
