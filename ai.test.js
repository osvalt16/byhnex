import {test} from 'node:test';import assert from 'node:assert/strict';
import {validateAction} from './ai-contract.js';import {applyVisualActions} from './ai-actions.js';import {buildAiContext} from './ai-context.js';import {AiStore} from './ai-store.js';
import {handleAiRequest,sanitizeContext} from './server/ai-handler.js';import {calculateScenario} from './server/ai-calculations.js';
const now=Date.UTC(2026,9,2,12),env={OPENAI_API_KEY:'test-server-credential',OPENAI_MODEL:'model-test',BYHNEX_AI_ACCESS_CODE:'private-test-code-123456'},origin='https://osvalt16.github.io';
const candle={time:now-60000,open:100,high:110,low:90,close:105,volume:12};
const context={asset:'SOL',timeframe:'15m',quoteCurrency:'USD',currentPrice:100,market:{source:'Coinbase',lastUpdate:now,status:'live',stale:false},quotes:{SOL:{price:100,time:now},BTC:{price:100000,time:now}},candles:[candle],portfolio:{positions:{SOL:{quantity:20,averagePrice:80},BTC:{quantity:.01,averagePrice:90000}},cash:500},fees:{percentPerSide:.1,slippagePercent:.05,network:0},chartLevels:[],strategy:{amount:800,correction:12}};
const request=(body={},options={})=>new Request('https://worker.test/api/ai-chat',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Authorization:'Bearer '+env.BYHNEX_AI_ACCESS_CODE,...options.headers},body:JSON.stringify({message:'Analyse SOL',history:[],context,...body})});
const apiOutput=data=>new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(data)}]}]}),{status:200});
test('Actions : aucun ordre de trading et aucun prix non fini autorisés',()=>{assert.equal(validateAction({type:'SELL',symbol:'SOL',price:100}),null);assert.equal(validateAction({type:'FOCUS_PRICE',symbol:'DOGE',price:1}),null);assert.equal(validateAction({type:'ADD_HORIZONTAL_LINE',symbol:'SOL',price:NaN}),null);assert.equal(validateAction({type:'CHANGE_TIMEFRAME',symbol:'SOL',timeframe:'2m'}),null);});
test('Les suppressions IA protègent les dessins personnels, verrouillés et les autres actifs',()=>{
  const drawings=[{id:'user',asset:'SOL',type:'horizontal',origin:'user'},{id:'locked',asset:'SOL',type:'horizontal',origin:'ai',locked:true},{id:'btc',asset:'BTC',origin:'ai'},{id:'ai',asset:'SOL',type:'horizontal',origin:'ai'}];
  const removed=applyVisualActions(drawings,[{type:'REMOVE_HORIZONTAL_LINE',symbol:'SOL',id:'user'},{type:'CLEAR_AI_LEVELS',symbol:'SOL'}],{asset:'SOL'});
  assert.deepEqual(removed.drawings.map(d=>d.id),['user','locked','btc']);assert.equal(drawings.length,4);
});
test('Fibonacci IA : les deux points doivent provenir des bougies observées',()=>{
  const a={type:'DRAW_FIBONACCI',symbol:'SOL',startTime:candle.time,startPrice:90,endTime:now,endPrice:120,label:'Mouvement'};
  assert.equal(applyVisualActions([], [a], {asset:'SOL',candles:[candle]}).applied,0);
  const result=applyVisualActions([], [a], {asset:'SOL',candles:[candle,{...candle,time:now,high:125}],createId:()=> 'fib'});
  assert.equal(result.applied,1);assert.equal(result.drawings[0].origin,'ai');assert.match(result.drawings[0].label,/^IA/);
});
test('Contexte : bornes, valeurs absentes nulles, données périmées signalées',()=>{
  const raw=buildAiContext({state:{asset:'SOL',tf:'5m'},market:{quotes:{SOL:{price:NaN}}},candles:Array(1000).fill(candle)});
  assert.equal(raw.candles.length,100);assert.equal(raw.currentPrice,null);assert.equal(raw.position.quantity,null);assert.equal(raw.realizedProfit,null);
  const cleaned=sanitizeContext({...context,candles:Array(1000).fill(candle),secret:'ne-pas-transmettre',market:{...context.market,lastUpdate:now-100000}},now);
  assert.equal(cleaned.candles.length,120);assert.equal(cleaned.market.stale,true);assert.equal(cleaned.secret,undefined);assert.throws(()=>sanitizeContext({...context,asset:'ZEC'},now));
});
test('Calcul après frais : tokens nets, réserve et comparaison HOLD cohérents',()=>{
  const result=calculateScenario({kind:'accumulation',asset:'SOL',amount:800,correction:12},sanitizeContext(context,now));
  const expected=800*(1-.0015)/(88*(1+.0015))-8;
  assert.ok(Math.abs(result.net-expected)<1e-12);assert.equal(result.advantageVsHold,result.net*88);assert.equal(result.sufficientVirtualPosition,true);
  const valuation=calculateScenario({kind:'portfolio_value',asset:'SOL',targetPrice:500},sanitizeContext(context,now));assert.equal(valuation.portfolioBtcSolWithCash,11500);
  const comparison=calculateScenario({kind:'accumulation_comparison',asset:'SOL',amount:800,corrections:[10,15,20]},sanitizeContext(context,now));assert.equal(comparison.scenarios.length,3);assert.ok(comparison.scenarios[0].net<comparison.scenarios[2].net);
  assert.throws(()=>calculateScenario({kind:'accumulation',asset:'SOL',amount:800,correction:12},{...context,fees:{}}));
});
test('Historique de session : réduire/recharger ne supprime pas la conversation',()=>{
  const map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};const store=new AiStore(storage);store.add('user','Question');store.add('assistant','Réponse',{actions:[]});assert.equal(new AiStore(storage).messages.length,2);store.clear();assert.equal(new AiStore(storage).messages.length,0);
});
test('Serveur : clé absente, origine non autorisée et accès incorrect sans appel OpenAI',async()=>{
  let calls=0;const fetcher=()=>{calls++;throw Error('Ne doit pas être appelé');};
  assert.equal((await handleAiRequest(request(),{}, {fetcher,now:()=>now})).status,503);
  assert.equal((await handleAiRequest(request({}, {headers:{Origin:'https://other.test'}}),env,{fetcher,now:()=>now})).status,403);
  assert.equal((await handleAiRequest(request({}, {headers:{Authorization:'Bearer wrong'}}),env,{fetcher,now:()=>now})).status,401);assert.equal(calls,0);
});
test('Serveur : schéma strict, historique limité, secret seulement dans le header serveur',async()=>{
  let sent;const response=await handleAiRequest(request({history:Array(30).fill({role:'user',content:'Avant'})}),env,{now:()=>now,fetcher:async(url,options)=>{assert.equal(url,'https://api.openai.com/v1/responses');sent=JSON.parse(options.body);assert.equal(options.headers.Authorization,'Bearer '+env.OPENAI_API_KEY);return apiOutput({message:'Analyse avec données réelles.',actions:[]});}});
  assert.equal(response.status,200);assert.equal(sent.store,false);assert.equal(sent.model,env.OPENAI_MODEL);assert.equal(sent.text.format.strict,true);assert.equal(sent.input.length,14);assert.ok(!JSON.stringify(sent).includes(env.OPENAI_API_KEY));assert.ok(!(await response.text()).includes(env.OPENAI_API_KEY));
});
test('Serveur : erreurs de quota, timeout, réponse vide et réponse invalide lisibles',async()=>{
  for(const [fetcher,status,code] of [[async()=>new Response('quota',{status:429}),429,'OPENAI_RATE_LIMIT'],[async()=>{throw new DOMException('timeout','TimeoutError');},504,'TIMEOUT'],[async()=>new Response(JSON.stringify({output:[]}),{status:200}),502,'EMPTY_RESPONSE'],[async()=>apiOutput({actions:[]}),502,'INVALID_RESPONSE']]){
    const response=await handleAiRequest(request(),env,{fetcher,now:()=>now});assert.equal(response.status,status);assert.equal((await response.json()).error.code,code);
  }
});
test('Serveur : outils de calcul autorisés uniquement, boucle Responses et résultat déterministe',async()=>{
  let calls=0;const response=await handleAiRequest(request(),env,{now:()=>now,fetcher:async(url,options)=>{
    calls++;if(calls===1)return new Response(JSON.stringify({status:'completed',output:[{type:'function_call',name:'calculate_scenario',call_id:'calc',arguments:JSON.stringify({kind:'accumulation',asset:'SOL',amount:800,correction:12})}]}));
    const input=JSON.parse(options.body).input,result=JSON.parse(input.at(-1).output);assert.ok(result.net>0);assert.equal(result.buy,88);return apiOutput({message:'Scénario calculé après frais.',actions:[]});
  }});assert.equal(response.status,200);assert.equal(calls,2);
});
test('Serveur : borne des requêtes et rate limit contrôlés avant OpenAI',async()=>{
  const tooLarge=await handleAiRequest(request({message:'x'.repeat(70000)}),env,{now:()=>now});assert.equal(tooLarge.status,413);
  const limited=await handleAiRequest(request(),{...env,AI_RATE_LIMITER:{limit:async()=>({success:false})}},{now:()=>now});assert.equal(limited.status,429);
});
