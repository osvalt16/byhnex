import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {sanitizeContext,DEVELOPER_PROMPT} from './server/ai-handler.js';
import {calculateScenario,CALCULATION_TOOL} from './server/ai-calculations.js';
import {validateAction,REPLY_SCHEMA} from './ai-contract.js';
import {generateOvhContract,buildOvh} from './build-ovh.js';

const php=process.env.BYHNEX_PHP_BIN||'php',driver='server/ovh/tests/driver.php';
const version=spawnSync(php,['-v'],{encoding:'utf8'});
if(version.status!==0)throw Error('PHP 8.2+ requis pour test:php. Définissez BYHNEX_PHP_BIN si php n’est pas dans PATH.');
generateOvhContract();
const now=Date.UTC(2026,9,3,12),origin='https://osvalt16.github.io';
const env={OPENAI_API_KEY:'test-private-credential',OPENAI_MODEL:'model-test',BYHNEX_AI_ACCESS_CODE:'private-test-code-123456',transportAvailable:true,privateStorageAvailable:true};
const candle={time:now-60000,open:100,high:110,low:90,close:105,volume:12};
const context={asset:'SOL',timeframe:'15m',quoteCurrency:'USD',currentPrice:100,market:{source:'Coinbase',lastUpdate:now,status:'live',stale:false},quotes:{SOL:{price:100,time:now},BTC:{price:100000,time:now}},candles:[candle],portfolio:{positions:{SOL:{quantity:20,averagePrice:80},BTC:{quantity:.01,averagePrice:90000}},cash:500},fees:{percentPerSide:.1,slippagePercent:.05,network:0},chartLevels:[],strategy:{amount:800,correction:12}};
function run(data){
  const reply=spawnSync(php,[driver],{encoding:'utf8',input:JSON.stringify(data),maxBuffer:4000000});
  assert.equal(reply.stderr,'');assert.equal(reply.status,0,reply.stdout||reply.error?.message);
  return JSON.parse(reply.stdout).result;
}
function request(options={}){
  const data={mode:'request',method:'POST',headers:{origin,'content-type':'application/json',authorization:'Bearer '+env.BYHNEX_AI_ACCESS_CODE},env,now,rawBody:JSON.stringify({message:'Analyse SOL',history:[],context}),...options};
  return run(data);
}
const output=(data)=>({status:200,body:{status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(data)}]}]}});
function closeEnough(actual,expected){
  if(typeof expected==='number'){assert.ok(Math.abs(actual-expected)<1e-10*Math.max(1,Math.abs(expected)),`${actual} != ${expected}`);return;}
  if(expected&&typeof expected==='object'){assert.deepEqual(Object.keys(actual).sort(),Object.keys(expected).sort());for(const k of Object.keys(expected))closeEnough(actual[k],expected[k]);return;}
  assert.equal(actual,expected);
}

test('PHP 8.2 : syntaxe de tous les fichiers serveur et fixtures',()=>{
  for(const file of ['ai-chat.php','lib/backend.php','lib/calculations.php','lib/context.php','lib/settings.php','lib/contract.php']){
    const check=spawnSync(php,['-l','server/ovh/api/'+file],{encoding:'utf8'});assert.equal(check.status,0,check.stdout+check.stderr);
  }
});
test('PHP : contexte borné identique au serveur JS, données absentes nulles',()=>{
  for(const raw of [context,{...context,candles:Array(160).fill(candle),comparisonCandles:[candle],secret:'ignored',market:{...context.market,lastUpdate:now-100000}},{asset:'BTC'}]){
    assert.deepEqual(run({mode:'context',context:raw,now}),sanitizeContext(raw,now));
  }
});
test('PHP : parité des simulations après frais, réserve, HOLD et valeurs BTC/SOL',()=>{
  const sanitized=sanitizeContext(context,now);
  const args=[{kind:'portfolio_value',asset:'SOL',targetPrice:500},{kind:'fibonacci',asset:'SOL',startPrice:90,endPrice:120},{kind:'accumulation_comparison',asset:'SOL',amount:800,corrections:[10,15,20]}];
  for(let i=0;i<18;i++)args.push({kind:'accumulation',asset:i%2?'BTC':'SOL',amount:100+i*53,correction:i*4.5});
  for(const a of args)closeEnough(run({mode:'calculate',args:a,context:sanitized}),calculateScenario(a,sanitized));
  for(const bad of [{...sanitized,fees:{}},{...sanitized,market:{stale:true}},{...sanitized,portfolio:{positions:{SOL:{quantity:null}}}}]){
    const reply=spawnSync(php,[driver],{encoding:'utf8',input:JSON.stringify({mode:'calculate',args:{kind:'accumulation',asset:'SOL',amount:800,correction:12},context:bad})});assert.equal(reply.status,2);assert.ok(JSON.parse(reply.stdout).error);
  }
});
test('PHP : même liste d’actions, rejet des ordres et des repères invalides',()=>{
  const actions=[{type:'SELL',symbol:'SOL',price:100},{type:'FOCUS_PRICE',symbol:'DOGE',price:1},{type:'ADD_HORIZONTAL_LINE',symbol:'SOL',price:-1},{type:'FOCUS_PRICE',symbol:'BTC',price:100000},{type:'ADD_HORIZONTAL_LINE',symbol:'SOL',price:120,label:'Resistance'},{type:'CHANGE_TIMEFRAME',symbol:'SOL',timeframe:'2m'},{type:'DRAW_FIBONACCI',symbol:'SOL',startPrice:90,endPrice:110,startTime:now-60000,endTime:now,label:'Fib'},{type:'REMOVE_HORIZONTAL_LINE',symbol:'SOL',id:' level '},{type:'CLEAR_AI_LEVELS',symbol:'SOL'}];
  assert.deepEqual(run({mode:'actions',actions}),actions.map(validateAction));
});
test('PHP : GET gratuit, configuration manquante, CORS et code privé vérifiés avant OpenAI',()=>{
  const health=request({method:'GET',rawBody:''});assert.equal(health.reply.body.ready,true);assert.equal(health.calls.length,0);assert.ok(!JSON.stringify(health.reply).includes(env.OPENAI_API_KEY));
  const notReady=request({method:'GET',env:{},rawBody:''});assert.equal(notReady.reply.body.ready,false);
  for(const [options,status] of [[{env:{}},503],[{env:{...env,transportAvailable:false}},503],[{env:{...env,privateStorageAvailable:false}},503],[{headers:{origin:'https://bad.test'}},403],[{headers:{origin,authorization:'Bearer wrong'}},401],[{headers:{origin:'',authorization:'Bearer '+env.BYHNEX_AI_ACCESS_CODE}},403],[{method:'GET',headers:{origin,authorization:'Bearer wrong'}},401],[{method:'OPTIONS',headers:{origin}},204]]){
    const result=request(options);assert.equal(result.reply.status,status);assert.equal(result.calls.length,0);
  }
  assert.equal(health.reply.headers['Access-Control-Allow-Origin'],origin);
  assert.equal(request({headers:{origin:'https://bad.test'}}).reply.headers['Access-Control-Allow-Origin'],undefined);
});
test('PHP : contrat strict partagé, clé uniquement au transport, historique limité',()=>{
  const result=request({rawBody:JSON.stringify({message:'Analyse SOL',history:Array(30).fill({role:'user',content:'Avant'}),context}),responses:[output({message:'Analyse réelle.',actions:[{type:'FOCUS_PRICE',symbol:'BTC',price:100000},{type:'FOCUS_PRICE',symbol:'SOL',price:110}]})]});
  assert.equal(result.reply.status,200);assert.equal(result.reply.body.actions.length,1);
  const sent=result.calls[0];assert.equal(sent.key,env.OPENAI_API_KEY);assert.equal(sent.payload.model,env.OPENAI_MODEL);assert.equal(sent.payload.store,false);assert.equal(sent.payload.parallel_tool_calls,false);
  assert.deepEqual(sent.payload.text.format.schema,REPLY_SCHEMA);assert.deepEqual(sent.payload.tools,[CALCULATION_TOOL]);assert.equal(sent.payload.input[0].content,DEVELOPER_PROMPT);assert.equal(sent.payload.input.length,14);
  assert.ok(!JSON.stringify(sent.payload).includes(env.OPENAI_API_KEY));assert.ok(!JSON.stringify(result.reply).includes(env.OPENAI_API_KEY));
});
test('PHP : boucle Responses, calcul déterministe et outil inconnu refusé',()=>{
  const call={type:'function_call',name:'calculate_scenario',call_id:'calc',arguments:JSON.stringify({kind:'accumulation',asset:'SOL',amount:800,correction:12})};
  const result=request({responses:[{status:200,body:{output:[call]}},output({message:'Calcul après frais.',actions:[]})]});
  assert.equal(result.calls.length,2);const calculation=JSON.parse(result.calls[1].payload.input.at(-1).output);assert.equal(calculation.buy,88);assert.ok(calculation.net>0);assert.equal(result.reply.status,200);
  const unknown=request({responses:[{status:200,body:{output:[{...call,name:'place_trade'}]}},output({message:'Aucun ordre possible.',actions:[]})]});assert.equal(JSON.parse(unknown.calls[1].payload.input.at(-1).output).error,'Outil non autorisé.');
});
test('PHP : erreurs quota, réseau, timeout, JSON, corps volumineux et limite lisibles',()=>{
  for(const [options,status,code] of [[{responses:[{status:429,body:null}]},429,'OPENAI_RATE_LIMIT'],[{responses:[{status:401,body:null}]},503,'OPENAI_AUTH_ERROR'],[{timeout:true},504,'TIMEOUT'],[{networkError:true},502,'NETWORK_ERROR'],[{responses:[{status:200,body:{output:[]}}]},502,'EMPTY_RESPONSE'],[{responses:[output({actions:[]})]},502,'INVALID_RESPONSE'],[{rawBody:'{'},400,'INVALID_REQUEST'],[{rawBody:'x'.repeat(65001)},413,'BODY_TOO_LARGE'],[{limited:true},429,'RATE_LIMIT'],[{rateError:true},503,'RATE_LIMIT_UNAVAILABLE']]){
    const result=request(options);assert.equal(result.reply.status,status);assert.equal(result.reply.body.error.code,code);assert.ok(!JSON.stringify(result.reply).includes('secret-provider-error'));
  }
});
test('PHP : .env privé avec guillemets, commentaires et CRLF ; aucun code évalué',()=>{
  assert.deepEqual(run({mode:'env',text:'\uFEFF# config\r\nOPENAI_API_KEY="fake-key"\r\nOPENAI_MODEL= "model-test" # commentaire\r\nBYHNEX_AI_ACCESS_CODE=private-code-123456 # note\r\nALLOWED_ORIGINS=\'https://osvalt16.github.io\'\r\nUNRELATED=ignore\n'}),{OPENAI_API_KEY:'fake-key',OPENAI_MODEL:'model-test',BYHNEX_AI_ACCESS_CODE:'private-code-123456',ALLOWED_ORIGINS:origin});
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'byhnex-env-test-'));
  try{fs.mkdirSync(path.join(root,'.secrets'));fs.writeFileSync(path.join(root,'.secrets','.env'),'OPENAI_API_KEY=fake-key\nOPENAI_MODEL=model-test\nBYHNEX_AI_ACCESS_CODE=private-code-123456\n');const loaded=run({mode:'load',root});assert.equal(loaded.OPENAI_API_KEY,'fake-key');assert.equal(loaded.privateDirectory,root+'/.secrets');assert.equal(loaded.privateStorageAvailable,true);}finally{fs.rmSync(root,{recursive:true});}
});
test('PHP : six requêtes par minute, état partagé entre processus et expiration',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'byhnex-rate-test-'));
  try{
    const calls=await Promise.all(Array.from({length:9},()=>new Promise((resolve,reject)=>{const child=spawn(php,[driver]);let out='';child.stdout.on('data',x=>out+=x);child.on('error',reject);child.on('exit',code=>code===0?resolve(JSON.parse(out).result):reject(Error(out)));child.stdin.end(JSON.stringify({mode:'rate',directory,now:1000}));})));
    assert.equal(calls.filter(Boolean).length,6);assert.equal(run({mode:'rate',directory,now:1059}),false);assert.equal(run({mode:'rate',directory,now:1060}),true);
  }finally{fs.rmSync(directory,{recursive:true});}
});
test('PHP HTTP : fichier privé chargé hors de /www, GET gratuit et CORS du vrai point d’entrée',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'byhnex-http-test-'));
  let child;
  try{
    fs.mkdirSync(path.join(root,'www'));fs.mkdirSync(path.join(root,'.secrets'));
    fs.cpSync('server/ovh/api',path.join(root,'www/api'),{recursive:true});
    fs.writeFileSync(path.join(root,'.secrets/.env'),'OPENAI_API_KEY=fixture-not-a-real-key\nOPENAI_MODEL=model-test\nBYHNEX_AI_ACCESS_CODE=private-test-code-123456\nALLOWED_ORIGINS='+origin+'\n');
    fs.writeFileSync(path.join(root,'router.php'),`<?php require __DIR__ . '/www/api/ai-chat.php';`);
    const listener=net.createServer();await new Promise(resolve=>listener.listen(0,'127.0.0.1',resolve));const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));
    child=spawn(php,['-S',`127.0.0.1:${port}`,'-t',path.join(root,'www'),path.join(root,'router.php')],{stdio:'ignore'});
    const url=`http://127.0.0.1:${port}/api/ai-chat`;let healthy;
    for(let i=0;i<40;i++){try{healthy=await fetch(url,{headers:{Origin:origin}});break;}catch{await new Promise(r=>setTimeout(r,50));}}
    assert.ok(healthy,'PHP HTTP server did not start');assert.equal(healthy.status,200);assert.equal(healthy.headers.get('Access-Control-Allow-Origin'),origin);
    const body=await healthy.json();assert.equal(body.ready,true,'cURL must be enabled in PHP for this HTTP check');assert.equal(body.accessRequired,true);assert.ok(!JSON.stringify(body).includes('fixture-not-a-real-key'));
    const options=await fetch(url,{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'Authorization, Content-Type'}});assert.equal(options.status,204);assert.equal(options.headers.get('Access-Control-Allow-Headers'),'Content-Type, Authorization');
    const wrong=await fetch(url,{method:'POST',headers:{Origin:origin,Authorization:'Bearer wrong','Content-Type':'application/json'},body:'{}'});assert.equal(wrong.status,401);
    const denied=await fetch(url,{headers:{Origin:'https://bad.test'}});assert.equal(denied.status,403);assert.equal(denied.headers.get('Access-Control-Allow-Origin'),null);
  }finally{
    if(child){child.kill();await new Promise(resolve=>child.once('exit',resolve));}
    fs.rmSync(root,{recursive:true});
  }
});
test('OVH : archive contient le dossier API et ses protections, aucun secret ni frontend',()=>{
  buildOvh();const bytes=fs.readFileSync('byhnex-ovh-api.zip');let at=0,names=[];
  while(bytes.readUInt32LE(at)===0x04034b50){const size=bytes.readUInt32LE(at+18),len=bytes.readUInt16LE(at+26),extra=bytes.readUInt16LE(at+28);names.push(bytes.subarray(at+30,at+30+len).toString());at+=30+len+extra+size;}
  assert.equal(names.length,8);assert.ok(names.includes('api/.htaccess'));assert.ok(names.includes('api/lib/.htaccess'));assert.ok(names.includes('api/ai-chat.php'));assert.ok(names.every(n=>n.startsWith('api/')&&!n.endsWith('.env')&&!n.endsWith('.html')));
});
