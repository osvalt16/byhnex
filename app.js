import {AssetSignals} from './chart-signals.js?v=20261003-chart-coherence';
import {simulate,comparison} from './strategy.js?v=20261003-ovh';
import {FIB_LEVELS,parseFibLevels,parseStrategyLevels,strategyPrice,moveDrawing,ema,fibPrice} from './chart-utils.js?v=20261003-strategy';
import {ASSETS,TIMEFRAMES,LiveMarket} from './market-data.js?v=20261003-chart-coherence';
import {quantityFromValue,reserveFromTotal} from './portfolio.js?v=20261003-ovh';
import {buildAiContext} from './ai-context.js?v=20261003-ovh';
import {applyVisualActions} from './ai-actions.js?v=20261003-ovh';
export const market=new LiveMarket();
export const signals=new AssetSignals({market,now:()=>market.now()});
const $=id=>document.getElementById(id), prices=Object.fromEntries(ASSETS.map(a=>[a,NaN])), names={SOL:'Solana',BTC:'Bitcoin',DOGE:'Dogecoin',ZEC:'Zcash'},icons={SOL:'≋',BTC:'₿',DOGE:'Ð',ZEC:'ⓩ'}, esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const priceFormats=new Map([2,5].map(d=>[d,new Intl.NumberFormat('fr-FR',{style:'currency',currency:'USD',maximumFractionDigits:d})]));
const usd=n=>Number.isFinite(n)?priceFormats.get(n>0&&n<1?5:2).format(n).replace(/\$US|US\$/,market.quote==='USDT'?'USDT':'$US'):'—',tok=(n,a=state.asset)=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:a==='BTC'?8:4}).format(n),num=id=>Number($(id).value);
const defaults={asset:'SOL',tf:'1H',period:'7D',holdings:{SOL:{quantity:0,average:0},BTC:{quantity:0,average:0}},initial:{SOL:0,BTC:0},initialReserve:0,reserve:0,cycles:[],scenarios:[],drawings:[],settings:{SOL:{sell:140},BTC:{sell:100000}}};
let state;try{const s=JSON.parse(localStorage.getItem('cryptonite-v1'));state=s&&s.holdings&&s.settings&&Array.isArray(s.drawings)?{...structuredClone(defaults),...s}:structuredClone(defaults)}catch{state=structuredClone(defaults)}
for(const a of ASSETS){state.holdings[a]??={quantity:0,average:0};state.initial[a]??=0;state.settings[a]??={sell:0};}
if(!ASSETS.includes(state.asset))state.asset='SOL';
if(!TIMEFRAMES[state.tf])state.tf='1H';
const requestedAsset=new URLSearchParams(location.search).get('asset');if(ASSETS.includes(requestedAsset))state.asset=requestedAsset;
if(new URLSearchParams(location.search).has('embed'))state.asset='SOL';
let mode='single',correction=15,allocations=[25,25,25,25],tool='cursor',pending=null,zoom=70,offset=0,drag=null,cursor=null,selectedBuy=null,view=['candle','line','area','ohlc'].includes(state.chartOptions?.view)?state.chartOptions.view:'candle',computed=null,overlays=state.chartOptions?.overlays??false,aiFocusPrice=null;const svg=$('chart');
const options=state.chartOptions={volume:true,ema20:false,ema50:false,fibCustom:false,fibLevels:[...FIB_LEVELS],fibExtend:false,fibReverse:false,fibColor:'#b7a4f7',...state.chartOptions};
$('view').value=view;
try{options.strategyLevels=parseStrategyLevels((options.strategyLevels||[5,10,15,20]).join(';'));}catch{options.strategyLevels=[5,10,15,20];}
correction=Number.isFinite(options.strategyCorrection)&&options.strategyCorrection>0&&options.strategyCorrection<100?options.strategyCorrection:15;
mode=options.strategyMode==='split'?'split':'single';
function equalAllocations(count){const part=Math.floor(10000/count)/100;return Array.from({length:count},(_,i)=>i===count-1?Number((100-part*(count-1)).toFixed(2)):part);}
allocations=Array.isArray(options.strategyAllocations)&&options.strategyAllocations.length===options.strategyLevels.length?options.strategyAllocations:equalAllocations(options.strategyLevels.length);
let hoveredPoint=null,pinnedRange=null;
const pct=n=>Number(n.toFixed(3)).toLocaleString('fr-FR',{maximumFractionDigits:3});
function persistStrategy(){options.strategyCorrection=correction;options.strategyMode=mode;options.strategyAllocations=[...allocations];persist();}

function toast(message){$('toast').textContent=message;$('toast').style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').style.display='none',3500)}
function persist(){try{localStorage.setItem('cryptonite-v1',JSON.stringify(state));$('save-status').textContent='● Sauvegarde automatique sur cet appareil'}catch{$('save-status').textContent='Sauvegarde indisponible';toast('Le stockage local est indisponible. Exportez vos données.')}}
function args(c=correction){return{amount:num('amount'),sell:num('sell'),fee:num('fee'),slippage:num('slippage'),network:num('network'),quantity:state.holdings[state.asset].quantity,correction:c}}
function calc(){const result=simulate(args());if(mode==='single')return result;if(Math.abs(allocations.reduce((s,v)=>s+v,0)-100)>0.001||allocations.some(v=>!Number.isFinite(v)||v<0))throw Error('Les allocations doivent totaliser 100 %.');const parts=options.strategyLevels.map((c,i)=>allocations[i]===0?null:simulate({...args(c),amount:num('amount')*allocations[i]/100,network:num('network')*allocations[i]/100}));const bought=parts.reduce((s,p)=>s+(p?.bought||0),0);return{...result,bought,net:bought-result.sold,stock:args().quantity+bought-result.sold,buy:parts.reduce((s,p)=>s+(p?p.bought*p.buy:0),0)/bought,cost:parts.reduce((s,p)=>s+(p?.cost||0),0)}}
function renderLab(){try{computed=calc();$('lab-error').textContent='';$('gain').textContent=(computed.net>=0?'+':'')+tok(computed.net)+' '+state.asset;$('gain').style.color=computed.net>=0?'var(--green)':'#ef8f96';$('stock').textContent='Nouveau stock théorique : '+tok(computed.stock)+' '+state.asset;$('break-even').textContent=usd(computed.breakEven);$('correction-label').textContent=mode==='single'?'−'+pct(correction)+' %':options.strategyLevels.length+' niveaux';$('details').textContent=tok(computed.sold)+' vendus → '+tok(computed.bought)+' rachetables · Frais estimés '+usd(computed.cost);$('save-scenario').disabled=false;$('record-sell').disabled=false;$('allocation-label').textContent=mode==='split'?'Allocation de réserve':'Gain net en tokens';$('levels').innerHTML=options.strategyLevels.map((c,i)=>{const r=simulate(args(c));return `<${mode==='split'?'div':'button'} class="level ${mode==='single'&&Math.abs(correction-c)<.0001?'selected':''}" data-correction="${c}"><span><span class="percent">−${pct(c)} %</span><span class="level-price">${usd(r.buy)}</span></span>${mode==='split'?`<span><input aria-label="Allocation à moins ${pct(c)} pour cent" data-allocation="${i}" type="number" min="0" max="100" step="0.01" value="${allocations[i]}"> %</span>`:`<span class="gain">${r.net>=0?'+':''}${tok(r.net)}</span>`}</${mode==='split'?'div':'button'}>`}).join('')}catch(e){computed=null;$('lab-error').textContent=e.message;$('gain').textContent='—';$('stock').textContent='Vérifiez les paramètres du scénario.';$('break-even').textContent='—';$('details').textContent='';$('save-scenario').disabled=true;$('record-sell').disabled=true}}
function renderPortfolio(){const p=comparison(state.holdings,state.initial,prices,state.reserve);p.hold+=state.initialReserve;const delta=p.active-p.hold,gains=Object.fromEntries(ASSETS.map(a=>[a,0]));state.cycles.forEach(c=>{if(c.remaining<.01)gains[c.asset]+=c.bought-c.sold});const latent=Object.entries(state.holdings).reduce((s,[a,h])=>s+h.quantity*(prices[a]-h.average),0);$('metrics').innerHTML=[['Valeur du portefeuille','◈',usd(p.active),`<span class="${delta>=0?'positive':'negative'}">${delta>=0?'+':''}${usd(delta)}</span> vs HOLD`],['Positions · 4 actifs','↗',tok(state.holdings.SOL.quantity,'SOL')+' <small>SOL</small>',ASSETS.filter(a=>a!=='SOL').map(a=>tok(state.holdings[a].quantity,a)+' '+a).join(' · ')+' · P&L '+usd(latent)],['Réserve disponible','▣',usd(state.reserve),'USD / USDC · Prête pour vos rachats'],['Tokens accumulés','⌁',(gains.SOL>=0?'+':'')+tok(gains.SOL,'SOL')+' <small>SOL</small>',ASSETS.filter(a=>a!=='SOL').map(a=>(gains[a]>=0?'+':'')+tok(gains[a],a)+' '+a).join(' · ')+' · Cycles clôturés']].map(([label,icon,value,detail])=>`<div class="metric"><div class="metric-label">${label}<span>${icon}</span></div><div class="metric-value">${value}</div><div class="metric-detail">${detail}</div></div>`).join('');$('comparison').innerHTML=`<div>HOLD de référence<b>${usd(p.hold)}</b></div><div>Stratégie active<b>${usd(p.active)}</b></div>`;const max=Number.isFinite(p.active)&&Number.isFinite(p.hold)?Math.max(p.hold,p.active,1):1;$('benchmark').innerHTML=`<div class="benchmark-row"><span>HOLD</span><div class="bar hold" style="width:${(Number.isFinite(p.hold)?p.hold/max*72:0)}%"></div></div><div class="benchmark-row"><span>Stratégie</span><div class="bar" style="width:${(Number.isFinite(p.active)?p.active/max*72:0)}%"></div></div><div class="${delta>=0?'positive':'negative'}" style="font-size:10px">${delta>=0?'+':''}${usd(delta)} · réserve incluse</div>`;renderJournal()}
function signalHtml(asset){
  const signal=signals.data[asset]?.timeframe===state.tf?signals.data[asset]:null,rsi=signal?.rsi,trend=signal?.trend;
  const ready=Number.isFinite(rsi),stale=ready&&(signal?.stale||(signal?.updatedAt&&Date.now()-signal.updatedAt>120000));
  const direction={up:'↗ Hausse',down:'↘ Baisse',flat:'→ Neutre'}[trend]||'Tendance —';
  const title='Bougies '+state.tf+' clôturées · RSI 14 (vert < 30, rouge > 70) · Prix et SMA 50 / SMA 200'+(signal?.source?' · '+signal.source:'')+(signal?.updatedAt?' · Calcul '+new Date(signal.updatedAt).toLocaleTimeString('fr-FR'):'')+(stale?' · Données non actualisées':!ready?' · Chargement des bougies':'')+(!trend&&ready?' · 200 bougies nécessaires pour la tendance':'');
  return '<span class="asset-signal '+(stale?'signal-stale':'')+'" data-signal="'+asset+'" title="'+esc(title)+'"><span class="signal-rsi '+(signal?.zone==='buy'?'signal-buy':signal?.zone==='sell'?'signal-sell':'')+'">RSI '+(ready?rsi.toLocaleString('fr-FR',{maximumFractionDigits:1,minimumFractionDigits:1}):'—')+'</span><span class="signal-trend '+(trend==='up'?'signal-buy':trend==='down'?'signal-sell':'')+'">'+direction+'</span><em>'+state.tf+(stale?' ⚠':'')+'</em></span>';
}
function renderSignals(){for(const asset of ASSETS){const node=document.querySelector('[data-signal="'+asset+'"]');if(node){const html=signalHtml(asset);if(node.outerHTML!==html)node.outerHTML=html;}}}
signals.addEventListener('update',renderSignals);
function renderAsset(){const a=state.asset;if(!$('asset-tabs').children.length)$('asset-tabs').innerHTML=ASSETS.map(x=>`<button class="asset-tab ${a===x?'selected':''}" data-asset="${x}"><span class="coin ${x.toLowerCase()}">${icons[x]}</span><span class="asset-tab-info"><span class="asset-tab-top"><strong>${names[x]}</strong><span class="asset-tab-price">${usd(prices[x])}</span></span><small>${x} / USD</small>${signalHtml(x)}</span></button>`).join('');$('asset-tabs').querySelectorAll('[data-asset]').forEach(b=>b.classList.toggle('selected',b.dataset.asset===a));syncSignals();$('pair').textContent=a+' / '+market.quote;$('sell-symbol').textContent=a+' / '+market.quote;$('price').textContent=usd(prices[a]);$('change').textContent=market.quotes[a]?((market.quotes[a].change>=0?'+':'')+market.quotes[a].change.toFixed(2)+' % (24 h)'):'—';$('position').textContent=tok(state.holdings[a].quantity)+' '+a;$('average').textContent='Prix moyen '+usd(state.holdings[a].average);$('sell').value=state.settings[a].sell||((prices[a]>0)?prices[a]:'');renderLab();renderChart();renderElements();window.dispatchEvent(new Event('byhnex-ai-context'));}
const tfMs=Object.fromEntries(Object.entries(TIMEFRAMES).map(([tf,seconds])=>[tf,seconds*1000]));
function candles(){return market.candles;}
let geometry={},chartFrame=0,labFrame=false,cursorFrame=0,viewportKey=null,viewportRightTime=null;
function renderChart(updateLab=false){labFrame ||= updateLab;if(!chartFrame)chartFrame=requestAnimationFrame(flushChart);}
function flushChart(){if(chartFrame)cancelAnimationFrame(chartFrame);chartFrame=0;if(labFrame){labFrame=false;renderLab();}drawChart();}
function drawChart(){
  const bounds=svg.getBoundingClientRect(),height=Math.max(180,bounds.height||440),width=Math.max(240,bounds.width||900);
  svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.dataset.chartAsset=state.asset;svg.dataset.timeframe=state.tf;svg.setAttribute('aria-busy',String(market.status==='loading'));svg.setAttribute('aria-label',state.asset+' / '+market.quote+' · '+state.tf+' · graphique et dessins');
  const all=candles();
  if(!all.length){delete svg.dataset.visibleFrom;delete svg.dataset.visibleTo;delete svg.dataset.visibleCount;$('ohlc').textContent=state.asset+' / '+market.quote+' · '+state.tf+' · '+(market.status==='unavailable'?'Historique indisponible':'Chargement…');$('indicator-legend').textContent='';svg.innerHTML=`<text x="${width/2}" y="${height/2}" text-anchor="middle" fill="#8590a6" font-size="14">${market.status==='unavailable'?'Données indisponibles · Réessayez la connexion.':'Chargement des bougies réelles…'}</text>`;geometry={};return;}
  const key=market.key;
  if(key!==viewportKey){viewportKey=key;viewportRightTime=null;}
  if(offset>0&&viewportRightTime!==null&&!drag){const rightIndex=all.findIndex(c=>c.time===viewportRightTime);if(rightIndex>=0)offset=all.length-rightIndex-1;}
  offset=Math.min(offset,Math.max(0,all.length-Math.min(zoom,all.length)));
  const last=Math.max(1,all.length-offset),first=Math.max(0,last-Math.min(zoom,all.length)),data=all.slice(first,last);
  svg.dataset.visibleFrom=String(data[0].time);svg.dataset.visibleTo=String(data.at(-1).time);svg.dataset.visibleCount=String(data.length);
  viewportRightTime=offset>0?data.at(-1).time:null;
  const sell=num('sell'),valid=overlays&&Number.isFinite(sell)&&sell>0,levels=[...(valid?[sell,...options.strategyLevels.map(c=>strategyPrice(sell,c))]:[]),...(aiFocusPrice>0?[aiFocusPrice]:[])],holding=state.holdings[state.asset];
  const ema20=options.ema20?ema(all,20).slice(first,last):[],ema50=options.ema50?ema(all,50).slice(first,last):[];
  const average=overlays&&holding.quantity>0?holding.average:0;
  let min=Math.min(...data.map(c=>c.low),...levels,...ema20,...ema50,...(average>0?[average]:[])),max=Math.max(...data.map(c=>c.high),...levels,...ema20,...ema50,average);
  const pad=(max-min)*.09||Math.max(max*.01,.000001);min=Math.max(min-pad,min>0?min*.5:min-pad);max+=pad;
  if(pinnedRange){min=pinnedRange.min;max=pinnedRange.max;}else if(drag){min=drag.geometry.min;max=drag.geometry.max;}
  const left=12,right=width-(width<500?91:114),top=20,volumeBottom=height-38,bottom=options.volume?volumeBottom-65:volumeBottom-6;
  const maxVolume=Math.max(1,...data.map(c=>c.volume)),step=(right-left)/data.length,x=i=>left+i*step+step/2,y=p=>bottom-(p-min)/(max-min)*(bottom-top),priceAt=py=>min+(bottom-py)/(bottom-top)*(max-min);
  // Interpolate actual timestamps so saved drawings stay anchored across gaps in trading.
  const timeAt=px=>{const index=(px-left)/step-.5,i=Math.max(0,Math.min(data.length-2,Math.floor(index))),c=data[i],next=data[i+1];return c.time+(index-i)*(next?next.time-c.time:tfMs[state.tf]);};
  const timeX=t=>{let low=0,high=data.length-1;while(low<high){const mid=Math.floor((low+high)/2);if(data[mid].time<t)low=mid+1;else high=mid;}const i=t<data[0].time?0:Math.max(0,low-1),c=data[i],next=data[i+1];return x(i)+(t-c.time)/(next?next.time-c.time:tfMs[state.tf])*step;};
  geometry={min,max,left,right,top,bottom,volumeBottom,step,x,y,priceAt,timeAt,timeX,data,first};
  const anchorTime=state.settings[state.asset].strategyTime??data[Math.floor(data.length*.35)].time,anchorX=Math.max(left+12,Math.min(right-22,timeX(anchorTime))),strategyLeft=anchorX;
  let s=`<defs><clipPath id="plot"><rect x="${left}" y="${top}" width="${right-left}" height="${volumeBottom-top}"/></clipPath><clipPath id="price-plot"><rect x="${left}" y="${top}" width="${right-left}" height="${bottom-top}"/></clipPath><linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#00b79d" stop-opacity=".25"/><stop offset="1" stop-color="#00b79d" stop-opacity="0"/></linearGradient></defs>`;
  for(let i=0;i<7;i++){const p=min+(max-min)*i/6,py=y(p);s+=`<line x1="${left}" x2="${right}" y1="${py}" y2="${py}" stroke="#202735"/><text x="${right+10}" y="${py+4}" fill="#8e99ab" font-size="10">${esc(usd(p))}</text>`;}
  const ticks=Math.max(3,Math.min(9,Math.floor((right-left)/100)));
  for(let i=0;i<ticks;i++){const j=Math.min(data.length-1,Math.floor(i*(data.length-1)/(ticks-1))),px=x(j),date=new Date(data[j].time),label=state.tf.includes('m')||((state.tf==='1H'||state.tf==='4H')&&data.at(-1).time-data[0].time<86400000)?date.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',timeZone:'UTC'}):date.toLocaleDateString('fr-FR',{day:'2-digit',month:'short',timeZone:'UTC'});s+=`<line x1="${px}" x2="${px}" y1="${top}" y2="${volumeBottom}" stroke="#202735"/><text x="${px}" y="${height-13}" fill="#8e99ab" font-size="10" text-anchor="middle">${label}</text>`;}
  s+='<g clip-path="url(#plot)">';
  const path=data.map((c,i)=>(i?'L':'M')+x(i)+','+y(c.close)).join(' ');
  if(view==='line'||view==='area'){if(view==='area')s+=`<path d="${path} L${x(data.length-1)},${bottom} L${x(0)},${bottom}Z" fill="url(#areaFill)"/>`;s+=`<path d="${path}" fill="none" stroke="#00c7aa" stroke-width="1.8"/>`;}
  data.forEach((c,i)=>{const px=x(i),color=c.close>=c.open?'#00b79d':'#f23645',w=Math.max(1,step*.65);if(view==='candle')s+=`<line x1="${px}" x2="${px}" y1="${y(c.high)}" y2="${y(c.low)}" stroke="${color}"/><rect x="${px-w/2}" y="${Math.min(y(c.open),y(c.close))}" width="${w}" height="${Math.max(1,Math.abs(y(c.open)-y(c.close)))}" fill="${color}"/>`;if(view==='ohlc')s+=`<path d="M${px},${y(c.high)}V${y(c.low)} M${px-w/2},${y(c.open)}H${px} M${px},${y(c.close)}H${px+w/2}" stroke="${color}" fill="none"/>`;if(options.volume)s+=`<rect x="${px-w/2}" y="${volumeBottom-c.volume/maxVolume*45}" width="${w}" height="${c.volume/maxVolume*45}" fill="${color}" opacity=".36"/>`;});
  for(const [values,color,key] of [[ema20,'#e9b46b','ema20'],[ema50,'#a49aff','ema50']])if(values.length)s+=`<path data-indicator="${key}" d="${values.map((v,i)=>(i?'L':'M')+x(i)+','+y(v)).join(' ')}" fill="none" stroke="${color}" stroke-width="1.5"/>`;
  s+='<g clip-path="url(#price-plot)">';
  const line=(p,label,color,id,percent)=>`<g data-line="${id}" data-price="${p}" data-percent="${percent}" style="cursor:${id==='sell'?'move':'ns-resize'}"><line x1="${strategyLeft}" x2="${right}" y1="${y(p)}" y2="${y(p)}" stroke="${color}" stroke-dasharray="${id==='sell'?'none':'5 5'}" stroke-width="${id==='sell'?1.5:1}"/><line x1="${strategyLeft}" x2="${right}" y1="${y(p)}" y2="${y(p)}" stroke="transparent" stroke-width="18"/><rect x="${right-158}" y="${y(p)-10}" width="154" height="20" rx="4" fill="#15252b" stroke="${color}" stroke-opacity=".6"/><text x="${right-151}" y="${y(p)+4}" fill="${color}" font-size="10">${esc(label)}</text><circle cx="${anchorX}" cy="${y(p)}" r="${id==='sell'?6:4}" fill="#0e1420" stroke="${color}" stroke-width="2"/><circle cx="${anchorX}" cy="${y(p)}" r="14" fill="transparent"/></g>`;
  if(valid){
    const sorted=[0,...options.strategyLevels];
    sorted.slice(0,-1).forEach((c,i)=>{const a=y(strategyPrice(sell,c)),b=y(strategyPrice(sell,sorted[i+1]));s+=`<rect data-strategy-band x="${strategyLeft}" y="${Math.min(a,b)}" width="${right-strategyLeft}" height="${Math.abs(a-b)}" fill="#65cdb4" opacity="${i%2?.025:.05}" pointer-events="none"/>`;});
    s+=`<line x1="${anchorX}" x2="${anchorX}" y1="${y(sell)}" y2="${y(strategyPrice(sell,options.strategyLevels.at(-1)))}" stroke="#88a89d" stroke-dasharray="3 5" pointer-events="none"/>`;
    // Paint the selected level and then the origin last so nearby lines remain usable.
    const order=options.strategyLevels.map((c,i)=>({c,i})).sort((a,b)=>Number(Math.abs(a.c-correction)<.0001)-Number(Math.abs(b.c-correction)<.0001));
    order.forEach(({c,i})=>s+=line(strategyPrice(sell,c),'−'+pct(c)+' % · '+usd(strategyPrice(sell,c)),Math.abs(correction-c)<.0001?'#a6e8bb':'#789f95','buy-'+i,c));
    s+=line(sell,'0 % · VENTE '+usd(sell),'#e9bd78','sell',0);
    if(computed)s+=`<line x1="${strategyLeft}" x2="${right}" y1="${y(computed.breakEven)}" y2="${y(computed.breakEven)}" stroke="#808b9c" stroke-dasharray="2 7" pointer-events="none"/>`;
  }
  if(average>0)s+=`<line x1="${left}" x2="${right}" y1="${y(average)}" y2="${y(average)}" stroke="#8e83af" stroke-dasharray="3 6"/><text x="${left+8}" y="${y(average)-6}" fill="#a89abd" font-size="10">Prix moyen ${esc(usd(average))}</text>`;
  function drawObject(d,preview=false){
    const px=timeX(d.t1),py=y(d.p1),qx=timeX(d.t2??d.t1),qy=y(d.p2??d.p1),fib=d.fib||{},color=d.origin==='ai'?'#e9b46b':d.type==='fib'?(fib.color||options.fibColor):'#b7a4f7';
    let out=`<g ${preview?'opacity=".55" pointer-events="none"':`data-drawing="${d.id}"`} style="cursor:${d.locked?'default':'move'}">`;
    if(d.type==='horizontal'||d.type==='ray')out+=`<line x1="${d.type==='ray'?px:left}" x2="${right}" y1="${py}" y2="${py}" stroke="${color}" stroke-width="1.5"/><text x="${left+15}" y="${py-5}" fill="${color}" font-size="10">${esc(d.label)}</text>`;
    if(d.type==='trend')out+=`<line x1="${px}" x2="${qx}" y1="${py}" y2="${qy}" stroke="transparent" stroke-width="16"/><line x1="${px}" x2="${qx}" y1="${py}" y2="${qy}" stroke="${color}" stroke-width="2"/>`;
    if(d.type==='zone')out+=`<rect x="${Math.min(px,qx)}" y="${Math.min(py,qy)}" width="${Math.abs(px-qx)}" height="${Math.abs(py-qy)}" fill="${color}" fill-opacity=".1" stroke="${color}"/>`;
    if(d.type==='fib'){
      const ratios=fib.custom?fib.levels:FIB_LEVELS,startX=Math.min(px,qx),endX=fib.extend?right:Math.max(px,qx);
      out+=`<path d="M${px},${py}L${qx},${qy}" fill="none" stroke="transparent" stroke-width="18"/><path d="M${px},${py}L${qx},${qy}" fill="none" stroke="${color}" stroke-dasharray="4 5" opacity=".65"/>`;
      (ratios||FIB_LEVELS).forEach((r,i)=>{const p=fibPrice(d.p1,d.p2,r,fib.reverse),next=(ratios||FIB_LEVELS)[i+1];if(next!==undefined){const np=fibPrice(d.p1,d.p2,next,fib.reverse);out+=`<rect x="${startX}" y="${Math.min(y(p),y(np))}" width="${Math.max(0,endX-startX)}" height="${Math.abs(y(p)-y(np))}" fill="${color}" opacity="${i%2?.045:.075}"/>`;}out+=`<line x1="${startX}" x2="${endX}" y1="${y(p)}" y2="${y(p)}" stroke="${color}" stroke-dasharray="${r===0||r===1?'none':'3 4'}"/><text x="${startX+5}" y="${y(p)-4}" fill="${color}" font-size="10">${Number((r*100).toFixed(2))} % · ${esc(usd(p))}</text>`;});
    }
    if(d.type==='measure')out+=`<path d="M${px},${py}H${qx}V${qy}" fill="none" stroke="${color}"/><text x="${Math.min(px,qx)}" y="${Math.min(py,qy)-8}" fill="${color}" font-size="10">${esc(usd(d.p2-d.p1))} · ${((d.p2/d.p1-1)*100).toFixed(2)} %</text>`;
    if(d.type==='note')out+=`<text x="${px}" y="${py}" fill="${color}" font-size="12">${esc(d.label)}</text>`;
    if(!preview&&d.p2!==undefined&&!d.locked)out+=[[px,py,1],[qx,qy,2]].map(([cx,cy,h])=>`<g data-handle="${h}" style="cursor:crosshair"><circle cx="${cx}" cy="${cy}" r="5" fill="#0e1420" stroke="${color}" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="15" fill="transparent"/></g>`).join('');
    return out+'</g>';
  }
  state.drawings.filter(d=>d.asset===state.asset&&d.visible!==false).forEach(d=>s+=drawObject(d));
  if(aiFocusPrice>0)s+=`<line x1="${left}" x2="${right}" y1="${y(aiFocusPrice)}" y2="${y(aiFocusPrice)}" stroke="#e9b46b" stroke-dasharray="5 5"/><text x="${left+8}" y="${y(aiFocusPrice)-5}" fill="#e9b46b" font-size="10">IA · Focus ${esc(usd(aiFocusPrice))}</text>`;
  if(pending){s+=`<circle cx="${timeX(pending.time)}" cy="${y(pending.price)}" r="4" fill="#00c7aa"/>`;if(hoveredPoint)s+=drawObject({type:tool,t1:pending.time,p1:pending.price,t2:timeAt(hoveredPoint.x),p2:priceAt(hoveredPoint.y),fib:{custom:options.fibCustom,levels:options.fibLevels,extend:options.fibExtend,reverse:options.fibReverse,color:options.fibColor}},true);}
  s+='</g></g>';
  const current=market.quotes[state.asset]?.price||all.at(-1).close,within=current>=min&&current<=max,py=Math.max(top,Math.min(bottom,y(current)));
  s+=`<g pointer-events="none"><title>Cours actuel · ${esc(usd(current))}</title>${within?`<line x1="${left}" x2="${right}" y1="${py}" y2="${py}" stroke="#00b79d" stroke-dasharray="2 3"/>`:''}<rect x="${right+4}" y="${py-10}" width="${width-right-8}" height="21" rx="2" fill="#009e87"/><text x="${right+9}" y="${py+4}" fill="white" font-size="10">${!within?(current>max?'↑ ':'↓ '):''}${esc(usd(current))}</text></g><g id="crosshair" pointer-events="none"></g>`;

  svg.innerHTML=s;$('drawing-count').textContent=state.drawings.filter(d=>d.asset===state.asset).length;
  $('indicator-legend').innerHTML=(options.volume?'<span>Volume</span>':'')+(options.ema20?'<span class="ema20-key">EMA 20</span>':'')+(options.ema50?'<span class="ema50-key">EMA 50</span>':'');
  $('latest').classList.toggle('selected',offset===0);if(cursor&&!drag&&!pending)drawCursor();else showCandle(data.at(-1));
  $('chart-hint').textContent=overlays?'0 % : déplacer le Fibonacci · Niveaux : ajuster les % · F : plein écran':'Molette : zoom · Glisser : déplacer · F : plein écran';
}

function showCandle(c){if(c)$('ohlc').textContent=`O ${usd(c.open)}   H ${usd(c.high)}   L ${usd(c.low)}   C ${usd(c.close)}   ·   Vol ${Math.round(c.volume).toLocaleString('fr-FR')}   ·   ${new Date(c.time).toLocaleString('fr-FR',{timeZone:'UTC'})}`}
function point(e){const matrix=svg.getScreenCTM();if(matrix){const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());return{x:p.x,y:p.y};}return{x:0,y:0};}
function selectTool(value){tool=value;pending=null;document.querySelectorAll('[data-tool]').forEach(x=>x.classList.toggle('selected',x.dataset.tool===value));}
svg.addEventListener('pointerdown',e=>{
  if(chartFrame)flushChart();if(!geometry.data?.length||e.button>0)return;const p=point(e),g=geometry;
  if(p.x<g.left||p.x>g.right||p.y<g.top||p.y>g.bottom)return;
  e.preventDefault();svg.setPointerCapture(e.pointerId);
  const l=e.target.closest('[data-line]'),d=e.target.closest('[data-drawing]');
  if(l&&tool==='cursor'){
    const visibleAnchor=Math.max(g.left+12,Math.min(g.right-22,g.timeX(state.settings[state.asset].strategyTime??g.data[Math.floor(g.data.length*.35)].time)));
    drag={type:l.dataset.line,start:p,geometry:{...g},sell:num('sell'),anchorTime:g.timeAt(visibleAnchor)};
    pinnedRange={min:g.min,max:g.max};svg.classList.add('is-dragging');return;
  }
  if(d&&tool==='cursor'){const obj=state.drawings.find(x=>x.id===d.dataset.drawing);if(obj&&!obj.locked){drag={type:'drawing',obj,start:p,geometry:{...g},original:structuredClone(obj),handle:e.target.closest('[data-handle]')?.dataset.handle};svg.classList.add('is-dragging');}return;}
  if(tool==='cursor'){clearPeriod();pinnedRange=null;viewportRightTime=null;cursor=null;drag={type:'pan',start:p,geometry:{...g},offset};return;}
  const v={time:g.timeAt(p.x),price:g.priceAt(p.y)};if(v.price<=0)return;
  if(['horizontal','ray','note'].includes(tool)){
    const label=tool==='note'?prompt('Texte de la note :','Mon niveau'):tool==='horizontal'?'Niveau horizontal':'Rayon horizontal';if(label===null)return;
    state.drawings.push({id:crypto.randomUUID(),asset:state.asset,tf:state.tf,type:tool,t1:v.time,p1:v.price,label,locked:false,visible:true});selectTool('cursor');persist();renderChart();renderElements();
  }else if(!pending){pending=v;renderChart();toast('Cliquez sur le deuxième point.');}
  else{state.drawings.push({id:crypto.randomUUID(),asset:state.asset,tf:state.tf,type:tool,t1:pending.time,p1:pending.price,t2:v.time,p2:v.price,label:tool,...(tool==='fib'?{fib:{custom:options.fibCustom,levels:[...options.fibLevels],extend:options.fibExtend,reverse:options.fibReverse,color:options.fibColor}}:{}),locked:false,visible:true});selectTool('cursor');persist();renderChart();renderElements();}
});
svg.addEventListener('pointermove',e=>{
  if(!geometry.data?.length)return;const p=point(e),g=drag?.geometry||geometry;hoveredPoint=p;
  if(pending&&!drag){renderChart();return;}
  if(drag){
    const dp=g.priceAt(p.y)-g.priceAt(drag.start.y),dt=g.timeAt(p.x)-g.timeAt(drag.start.x);
    if(drag.type==='sell'){
      const sell=Math.max(1e-8,drag.sell+dp);$('sell').value=Number(sell.toPrecision(12));state.settings[state.asset].sell=num('sell');
      state.settings[state.asset].strategyTime=g.timeAt(Math.max(g.left+12,Math.min(g.right-22,g.timeX(drag.anchorTime)+p.x-drag.start.x)));
      renderChart(true);
    }else if(drag.type.startsWith('buy-')){
      const index=Number(drag.type.slice(4)),low=index>0?options.strategyLevels[index-1]+.001:.001,high=index<options.strategyLevels.length-1?options.strategyLevels[index+1]-.001:99.999;
      correction=Number(Math.min(high,Math.max(low,(1-g.priceAt(p.y)/drag.sell)*100)).toFixed(3));options.strategyLevels[index]=correction;renderChart(true);
    }else if(drag.type==='pan'){offset=Math.max(0,Math.min(Math.max(0,candles().length-zoom),Math.round(drag.offset+(p.x-drag.start.x)/g.step)));renderChart();}
    else if(drag.type==='drawing'){Object.assign(drag.obj,moveDrawing(drag.original,dp,dt,drag.handle));renderChart();}
    return;
  }
  cursor=p;if(!cursorFrame)cursorFrame=requestAnimationFrame(()=>{cursorFrame=0;drawCursor();});
});
function drawCursor(){
  const p=cursor,g=geometry,layer=$('crosshair');if(!p||!g.data?.length||!layer)return;
  if(p.x<g.left||p.x>g.right||p.y<g.top||p.y>g.volumeBottom){layer.innerHTML='';return;}
  const i=Math.max(0,Math.min(g.data.length-1,Math.floor((p.x-g.left)/g.step))),candle=g.data[i],cx=g.x(i),labelX=Math.max(g.left,Math.min(g.right-144,cx-72));showCandle(candle);
  const label=new Date(candle.time).toLocaleString('fr-FR',{timeZone:'UTC',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
  layer.innerHTML=`<path d="M${cx},${g.top}V${g.volumeBottom}${p.y<=g.bottom?` M${g.left},${p.y}H${g.right}`:''}" stroke="#82909e" stroke-dasharray="3 4" opacity=".7"/>${p.y<=g.bottom?`<rect x="${g.right+4}" y="${p.y-9}" width="${Math.max(82,svg.viewBox.baseVal.width-g.right-8)}" height="18" fill="#2c3642"/><text x="${g.right+9}" y="${p.y+4}" fill="#e9edf3" font-size="10">${esc(usd(g.priceAt(p.y)))}</text>`:''}<rect x="${labelX}" y="${g.volumeBottom+7}" width="144" height="20" rx="3" fill="#2c3642"/><text x="${labelX+72}" y="${g.volumeBottom+21}" text-anchor="middle" fill="#e9edf3" font-size="9">${esc(label)} UTC</text>`;
}
function finishDrag(){if(!drag)return;if(chartFrame)flushChart();const changedStrategy=drag.type==='sell'||drag.type.startsWith('buy-');drag=null;svg.classList.remove('is-dragging');changedStrategy?persistStrategy():persist();renderChart();renderElements();window.dispatchEvent(new Event('byhnex-ai-context'));}
svg.addEventListener('pointerup',finishDrag);svg.addEventListener('pointercancel',finishDrag);svg.addEventListener('lostpointercapture',finishDrag);
svg.addEventListener('pointerleave',()=>{cursor=null;if(cursorFrame)cancelAnimationFrame(cursorFrame);cursorFrame=0;if($('crosshair'))$('crosshair').innerHTML='';showCandle(geometry.data?.at(-1));});
function clearPeriod(){document.querySelectorAll('#periods button').forEach(b=>b.classList.remove('selected'));}
function zoomAt(nextZoom,px=(geometry.left+geometry.right)/2){
  const count=candles().length;if(!count||!geometry.data?.length)return;
  const ratio=Math.max(0,Math.min(1,(px-geometry.left)/(geometry.right-geometry.left))),visible=Math.min(zoom,count),index=count-offset-visible+ratio*visible;
  zoom=Math.max(Math.min(15,count),Math.min(count,nextZoom));
  const first=index-ratio*zoom;offset=Math.max(0,Math.min(count-zoom,Math.round(count-first-zoom)));
  viewportRightTime=null;pinnedRange=null;clearPeriod();renderChart();
}
svg.addEventListener('wheel',e=>{e.preventDefault();if(drag)return;const p=point(e);zoomAt(Math.round(zoom*Math.exp(Math.sign(e.deltaY)*.09)),p.x);},{passive:false});
svg.addEventListener('dblclick',()=>{pinnedRange=null;viewportRightTime=null;zoom=70;offset=0;clearPeriod();renderChart()});
function renderElements(){const list=state.drawings.filter(d=>d.asset===state.asset);$('elements').innerHTML=list.length?list.map(d=>`<div class="element-row"><input aria-label="Nom de l’objet" value="${esc(d.label)}" data-rename="${d.id}">${d.type==='fib'?`<button data-configure="${d.id}" title="Régler ce Fibonacci">⚙</button>`:''}<button data-visible="${d.id}" title="Afficher ou masquer">${d.visible===false?'○':'◉'}</button><button data-lock="${d.id}" title="Verrouiller">${d.locked?'🔒':'♧'}</button><button data-duplicate="${d.id}" title="Dupliquer">⧉</button><button data-delete="${d.id}" title="Supprimer">✕</button></div>`).join(''):'<p class="muted">Choisissez un outil à gauche du graphique pour créer un dessin.</p>'}
function renderJournal(){$('cycle-count').textContent=state.cycles.length+' cycle'+(state.cycles.length>1?'s':'');$('cycle-rows').innerHTML=state.cycles.length?[...state.cycles].reverse().map(c=>`<tr><td><b>${c.asset}</b><small>${new Date(c.date).toLocaleDateString('fr-FR')}</small></td><td>${usd(c.sell)}<small>${tok(c.sold,c.asset)} ${c.asset}</small></td><td>${c.bought?usd(c.buyCost/c.bought):'—'}<small>${c.bought?tok(c.bought,c.asset)+' '+c.asset:'Réserve '+usd(c.remaining)}</small></td><td class="${c.bought-c.sold>=0?'positive':'negative'}">${c.remaining<.01?tok(c.bought-c.sold,c.asset):'En cours'}</td><td><span class="status ${c.remaining>=.01?'open':''}">${c.remaining>=.01?(c.bought?'Partiel':'Vendu'):'Clôturé'}</span></td><td>${c.remaining>=.01?`<button class="button" data-buy="${c.id}">Racheter</button>`:''}</td></tr>`).join(''):'<tr><td colspan="6"><div class="empty-state"><strong>Votre premier cycle commence ici.</strong>Simulez un scénario, puis enregistrez une vente pour suivre vos rachats.</div></td></tr>';$('scenarios').innerHTML=state.scenarios.length?state.scenarios.map(s=>`<div class="scenario-row">${esc(s.asset)} · ${usd(s.amount)} · Vente ${usd(s.sell)} → Rachat ${usd(s.buy)} · ${s.net>=0?'+':''}${tok(s.net,s.asset)} ${esc(s.asset)} net théorique</div>`).join(''):'<div class="empty-state">Aucun scénario enregistré.</div>'}
$('asset-tabs').onclick=e=>{const b=e.target.closest('[data-asset]');if(b){if(state.asset===b.dataset.asset)return;state.asset=b.dataset.asset;cursor=null;viewportRightTime=null;aiFocusPrice=null;pinnedRange=null;drag=null;pending=null;offset=0;persist();market.select(state.asset,state.tf);renderAsset()}};
['amount','sell','fee','slippage','network'].forEach(id=>$(id).addEventListener('input',()=>{if(id==='sell')pinnedRange=null;if(id==='sell'&&num('sell')>0){state.settings[state.asset].sell=num('sell');persist()}renderLab();renderChart()}));$('market-price').onclick=()=>{if(!market.fresh){toast('Le cours n’est pas actualisé. Réessayez la connexion.');return;}pinnedRange=null;$('sell').value=prices[state.asset];state.settings[state.asset].sell=prices[state.asset];persist();renderLab();renderChart()};
$('levels').onclick=e=>{const b=e.target.closest('button[data-correction]');if(b){correction=+b.dataset.correction;persistStrategy();renderLab();renderChart()}};$('levels').addEventListener('change',e=>{if(e.target.dataset.allocation!==undefined){allocations[+e.target.dataset.allocation]=+e.target.value;persistStrategy();renderLab();renderChart()}});
document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('selected',b.dataset.mode===mode);b.onclick=()=>{mode=b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('selected',x===b));persistStrategy();renderLab();renderChart()};});
function segmented(id,options,selected,fn){$(id).innerHTML=options.map(v=>`<button class="${v===selected?'selected':''}" data-value="${v}">${v}</button>`).join('');$(id).onclick=e=>{const b=e.target.closest('[data-value]');if(b){$(id).querySelectorAll('button').forEach(x=>x.classList.toggle('selected',x===b));fn(b.dataset.value)}}}
segmented('timeframes',Object.keys(tfMs),state.tf,v=>{if(state.tf===v)return;state.tf=v;cursor=null;viewportRightTime=null;pinnedRange=null;drag=null;pending=null;offset=0;clearPeriod();persist();market.select(state.asset,state.tf);syncSignals();renderChart()});segmented('periods',['1D','7D','30D','3M','1Y','MAX'],'',v=>{state.period=v;cursor=null;viewportRightTime=null;pinnedRange=null;const days={'1D':1,'7D':7,'30D':30,'3M':90,'1Y':365,MAX:700};zoom=Math.max(15,Math.min(700,Math.round(days[v]*86400000/tfMs[state.tf])));offset=0;persist();renderChart()});$('view').onchange=e=>{view=e.target.value;options.view=view;persist();renderChart()};$('reset-view').onclick=()=>{clearPeriod();viewportRightTime=null;cursor=null;pinnedRange=null;aiFocusPrice=null;zoom=70;offset=0;renderChart()};
const toolNames={cursor:['＋','Curseur / déplacer'],horizontal:['━','Ligne horizontale'],trend:['╱','Ligne de tendance · deux points'],ray:['↦','Rayon horizontal'],zone:['□','Zone · deux points'],fib:['≡','Fibonacci · deux points'],measure:['↔','Mesure · deux points'],note:['T','Note'],clear:['⌫','Effacer les dessins de cet actif']};$('tools').innerHTML=Object.entries(toolNames).map(([k,[icon,title]])=>`<button data-tool="${k}" class="${k===tool?'selected':''}" title="${title}" aria-label="${title}">${icon}</button>`).join('');$('tools').onclick=e=>{const b=e.target.closest('[data-tool]');if(!b)return;if(b.dataset.tool==='clear'){if(confirm('Effacer les dessins de '+state.asset+' ?')){state.drawings=state.drawings.filter(d=>d.asset!==state.asset);persist();renderChart();renderElements()}return}tool=b.dataset.tool;pending=null;document.querySelectorAll('[data-tool]').forEach(x=>x.classList.toggle('selected',x===b));renderChart()};
$('elements-btn').onclick=()=>{$('elements').hidden=!$('elements').hidden;renderElements()};$('elements').onclick=e=>{const b=e.target.closest('button');if(!b)return;const action=Object.keys(b.dataset)[0],id=b.dataset[action],d=state.drawings.find(d=>d.id===id);if(!d)return;if(action==='configure'){openChartSettings(d);return;}if(action==='delete')state.drawings=state.drawings.filter(x=>x.id!==id);if(action==='visible')d.visible=d.visible===false;if(action==='lock')d.locked=!d.locked;if(action==='duplicate')state.drawings.push({...d,id:crypto.randomUUID(),label:d.label+' (copie)'});persist();renderChart();renderElements()};$('elements').onchange=e=>{const d=state.drawings.find(d=>d.id===e.target.dataset.rename);if(d){d.label=e.target.value;persist();renderChart()}};
$('save-scenario').onclick=()=>{if(!computed)return;state.scenarios.push({asset:state.asset,...args(),...computed,date:new Date().toISOString(),mode,allocations:[...allocations]});persist();renderJournal();toast('Scénario enregistré. Le portefeuille reste inchangé.')};$('record-sell').onclick=()=>{if(!computed)return;if(!market.fresh){toast('Attendez un cours actualisé avant d’enregistrer une vente.');return;}const a=state.asset,h=state.holdings[a];if(Math.abs(num('sell')-prices[a])/prices[a]>.01){toast('Utilisez le cours actuel avec « Au marché » pour enregistrer cette vente virtuelle.');return;}if(computed.sold>h.quantity){toast('La vente dépasse votre position disponible.');return}const c={id:crypto.randomUUID(),asset:a,date:new Date().toISOString(),sell:num('sell'),amount:num('amount'),sold:computed.sold,reserve:computed.reserve,remaining:computed.reserve,bought:0,buyCost:0,fee:num('fee'),slippage:num('slippage'),network:num('network')};h.quantity-=c.sold;state.reserve+=c.reserve;state.cycles.push(c);persist();renderPortfolio();renderAsset();toast('Vente simulée enregistrée. Réserve mise à jour.')};
$('cycle-rows').onclick=e=>{const b=e.target.closest('[data-buy]');if(!b)return;selectedBuy=state.cycles.find(c=>c.id===b.dataset.buy);const f=$('buy-form');f.elements.amount.value=selectedBuy.remaining.toFixed(2);f.elements.price.value=(selectedBuy.sell*(1-correction/100)).toFixed(2);$('buy-info').textContent=selectedBuy.asset+' · Réserve de ce cycle : '+usd(selectedBuy.remaining);$('buy-error').textContent='';$('buy-dialog').showModal()};$('close-buy').onclick=()=>$('buy-dialog').close();$('buy-form').onsubmit=e=>{e.preventDefault();const f=e.target,c=selectedBuy,m=+f.elements.amount.value,p=+f.elements.price.value,rate=(c.fee+c.slippage)/100;if(!Number.isFinite(m)||!Number.isFinite(p)||m<=c.network||p<=0||m>c.remaining+.001||m>state.reserve+.001){$('buy-error').textContent='Vérifiez le montant, le prix et la réserve disponible.';return}const q=(m-c.network)/(p*(1+rate)),h=state.holdings[c.asset];h.average=(h.quantity*h.average+m)/(h.quantity+q);h.quantity+=q;c.bought+=q;c.buyCost+=m;c.remaining=Math.max(0,c.remaining-m);state.reserve=Math.max(0,state.reserve-m);persist();$('buy-dialog').close();renderPortfolio();renderAsset();toast('Rachat simulé enregistré : '+tok(q,c.asset)+' '+c.asset)};
$('scenarios-btn').onclick=()=>$('scenarios').hidden=!$('scenarios').hidden;
let portfolioPrices={};function updatePortfolioTotal(){const f=$('portfolio-form'),value=ASSETS.reduce((sum,a)=>sum+Number(f.elements['quantity'+a].value)*(portfolioPrices[a]||0),0);f.elements.total.value=(value+Number(f.elements.reserve.value)).toFixed(2);return value;}function openPortfolio(){portfolioPrices={...prices};const fresh=market.fresh;$('portfolio-fields').innerHTML=ASSETS.map(a=>`<section class="portfolio-asset"><h3>${icons[a]} ${names[a]} <span>${usd(portfolioPrices[a])} · cours à l’ouverture</span></h3><div class="portfolio-inputs"><label>Quantité virtuelle ${a}<input name="quantity${a}" type="number" min="0" step="any" required value="${state.holdings[a].quantity}"></label><label>Valeur de la position (${market.quote})<input name="value${a}" type="number" min="0" step="0.01" ${fresh?'':'disabled'} value="${Number.isFinite(portfolioPrices[a])?(state.holdings[a].quantity*portfolioPrices[a]).toFixed(2):''}"></label><label>Prix moyen d’achat (${market.quote})<input name="average${a}" type="number" min="0" step="any" required value="${state.holdings[a].average||((portfolioPrices[a]>0)?portfolioPrices[a]:0)}"></label></div></section>`).join('');const f=$('portfolio-form');f.elements.reserve.value=state.reserve;f.elements.reset.checked=true;f.elements.total.disabled=!fresh;updatePortfolioTotal();$('portfolio-error').textContent='';$('portfolio-dialog').showModal();}$('portfolio-form').addEventListener('input',e=>{const f=e.currentTarget,name=e.target.name;if(name.startsWith('value')){const a=name.replace('value','');try{f.elements['quantity'+a].value=quantityFromValue(Number(e.target.value),portfolioPrices[a]);$('portfolio-error').textContent='';updatePortfolioTotal();}catch(error){$('portfolio-error').textContent=error.message;}}else if(name.startsWith('quantity')){const a=name.replace('quantity','');f.elements['value'+a].value=(Number(e.target.value)*(portfolioPrices[a]||0)).toFixed(2);updatePortfolioTotal();}else if(name==='reserve'){updatePortfolioTotal();}else if(name==='total'){const positions=ASSETS.reduce((sum,a)=>sum+Number(f.elements['quantity'+a].value)*(portfolioPrices[a]||0),0);try{f.elements.reserve.value=reserveFromTotal(Number(e.target.value),positions).toFixed(2);$('portfolio-error').textContent='';}catch(error){$('portfolio-error').textContent=error.message;}}});
document.querySelectorAll('.edit-portfolio').forEach(b=>b.onclick=openPortfolio);$('close-dialog').onclick=()=>$('portfolio-dialog').close();$('portfolio-form').onsubmit=e=>{e.preventDefault();const f=e.target;if(!f.elements.total.disabled){try{const positions=ASSETS.reduce((sum,a)=>sum+Number(f.elements['quantity'+a].value)*(portfolioPrices[a]||0),0);f.elements.reserve.value=reserveFromTotal(Number(f.elements.total.value),positions).toFixed(2);}catch(error){$('portfolio-error').textContent=error.message;return;}}const values=[...ASSETS.flatMap(a=>['quantity'+a,'average'+a]),'reserve'].map(k=>+f.elements[k].value);if(values.some(v=>!Number.isFinite(v)||v<0)){ $('portfolio-error').textContent='Saisissez des valeurs positives ou nulles.';return}const openReserve=state.cycles.reduce((s,c)=>s+c.remaining,0);if(values.at(-1)+.001<openReserve){$('portfolio-error').textContent='La réserve doit couvrir les cycles ouverts ('+usd(openReserve)+').';return}state.holdings=Object.fromEntries(ASSETS.map((a,i)=>[a,{quantity:values[2*i],average:values[2*i+1]}]));state.reserve=values.at(-1);if(f.elements.reset.checked){state.initial=Object.fromEntries(ASSETS.map(a=>[a,state.holdings[a].quantity]));state.initialReserve=values.at(-1)}persist();$('portfolio-dialog').close();renderPortfolio();renderAsset();toast('Portefeuille enregistré.')};
document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-nav]').forEach(x=>x.classList.toggle('active',x===b));$(b.dataset.nav).scrollIntoView({behavior:'smooth',block:'start'})});
function download(name,data,type){const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}$('export').onclick=()=>download('cryptonite-portefeuille.json',JSON.stringify(state,null,2),'application/json');$('snapshot').onclick=()=>download('cryptonite-'+state.asset+'.svg',new XMLSerializer().serializeToString(svg),'image/svg+xml');renderPortfolio();renderAsset();

$("overlay-mode").onclick=()=>{overlays=!overlays;options.overlays=overlays;pinnedRange=null;selectTool('cursor');if(overlays&&geometry.data?.length&&!Number.isFinite(state.settings[state.asset].strategyTime))state.settings[state.asset].strategyTime=geometry.data[Math.floor(geometry.data.length*.35)].time;persist();$("overlay-mode").setAttribute("aria-pressed",String(overlays));$("overlay-mode").classList.toggle("selected",overlays);renderChart();if(overlays)toast('Glissez le point 0 % pour placer votre Fibonacci. Les autres poignées règlent les baisses en %.');};$("overlay-mode").classList.toggle("selected",overlays);$("overlay-mode").setAttribute("aria-pressed",String(overlays));$("price-mode").onclick=()=>{overlays=false;options.overlays=false;pinnedRange=null;$("overlay-mode").classList.remove('selected');$("overlay-mode").setAttribute('aria-pressed','false');persist();renderChart()};

function syncSignals(){if(signals.provider!==market.provider||signals.timeframe!==state.tf)signals.refresh(market.provider,state.tf);signals.sync(market.provider,state.tf);renderSignals();}
let marketRenderTimer,lastPortfolioRender=0,lastChartSignature=null,lastContextRender=0;function updateMarket(){syncSignals();for(const a of ASSETS)prices[a]=market.quotes[a]?.price>0?market.quotes[a].price:NaN;if(!state.settings[state.asset].sell&&prices[state.asset]>0){state.settings[state.asset].sell=prices[state.asset];$('sell').value=prices[state.asset];persist();renderLab();}const q=market.quotes[state.asset];$('pair').textContent=state.asset+' / '+market.quote;$('sell-symbol').textContent=state.asset+' / '+market.quote;$('price').textContent=usd(prices[state.asset]);$('change').textContent=q?(q.change>=0?'+':'')+q.change.toFixed(2)+' % (24 h)':'—';$('change').classList.toggle('negative',!!q&&q.change<0);$('change').classList.toggle('positive',!!q&&q.change>=0);$('asset-tabs').querySelectorAll('[data-asset]').forEach(b=>{const a=b.dataset.asset;b.querySelector('small').textContent=a+' / '+market.quote;b.querySelector('.asset-tab-price').textContent=usd(prices[a]);});const age=market.lastUpdate?Math.max(0,Math.floor((Date.now()-market.lastUpdate)/1000)):null;const labels={loading:'Connexion aux marchés…',live:'EN DIRECT',polling:'ACTUALISATION 30 s',stale:'COURS NON ACTUALISÉ',unavailable:'FLUX INDISPONIBLE'};const label=labels[market.status]+' · '+market.provider+(age!==null?' · '+age+' s':'');document.querySelector('.demo').textContent=label;document.querySelector('.demo').classList.toggle('market-live',market.status==='live');document.querySelector('.exchange').textContent=market.provider+' · '+market.quote;$('pair').title=market.quote==='USDT'?'Cours coté en USDT. Valorisation indicative ; USDT assimilé au dollar pour les scénarios.':'Cours coté en dollars USD.';document.querySelector('.chart-note').textContent=label+' · Bougies réelles · Scénarios de rachat indicatifs'+(market.quote==='USDT'?' · USDT assimilé au dollar : valorisation indicative':'');$('market-price').disabled=!market.fresh;$('market-retry').hidden=!['stale','unavailable'].includes(market.status);if(ASSETS.every(a=>Number.isFinite(prices[a]))&&Date.now()-lastPortfolioRender>1000){lastPortfolioRender=Date.now();renderPortfolio();}const signature=market.key+':'+market.revisions.get(market.key)+':'+prices[state.asset];if(signature!==lastChartSignature){lastChartSignature=signature;renderChart();}if(Date.now()-lastContextRender>1000){lastContextRender=Date.now();window.dispatchEvent(new Event('byhnex-ai-context'));}if(window.parent!==window)window.parent.postMessage({type:'byhnex-market',status:market.status,source:market.provider,quote:market.quote,quotes:market.quotes,lastUpdate:market.lastUpdate},location.origin);}
market.addEventListener('update',()=>{syncSignals();if(!marketRenderTimer)marketRenderTimer=requestAnimationFrame(()=>{marketRenderTimer=null;updateMarket();})});$('market-retry').onclick=()=>{market.refresh(true).then(()=>market.connect());};$('load-history').onclick=async()=>{const b=$('load-history');b.disabled=true;b.textContent='Chargement…';try{const key=market.key,before=market.candles.length;await market.loadMore();if(market.key!==key)return;toast(market.candles.length>before?'Historique supplémentaire chargé.':'Aucun historique supplémentaire disponible.');}catch{toast('Historique indisponible. Réessayez plus tard.');}finally{b.disabled=false;b.textContent='← Plus d’historique';}};window.addEventListener('online',()=>{market.refresh(true).then(()=>market.connect());});window.addEventListener('offline',()=>{market.status='stale';updateMarket();});window.addEventListener('pagehide',()=>{market.close();signals.close();});window.addEventListener('pageshow',e=>{if(e.persisted){market.start(state.asset,state.tf);signals.start(market.provider,state.tf);}});

const chartPanel=document.querySelector('.chart-panel');
chartPanel.append($('chart-dialog'),$('toast'));
let editedFib=null;
function openChartSettings(d=null){
  editedFib=d;const f=$('chart-settings-form'),fib=d?.fib||{};
  $('strategy-settings-group').hidden=!!d;f.elements.strategyLevels.value=options.strategyLevels.map(pct).join(' ; ');f.elements.strategyAnchor.value=num('sell')||'';
  for(const key of ['volume','ema20','ema50'])f.elements[key].checked=options[key];
  f.elements.fibCustom.checked=d?!!fib.custom:options.fibCustom;
  f.elements.fibLevels.value=(d?(fib.levels||FIB_LEVELS):options.fibLevels).map(r=>Number((r*100).toFixed(3))).join(' ; ');
  f.elements.fibLevels.disabled=!f.elements.fibCustom.checked;
  for(const [field,key] of [['fibExtend','extend'],['fibReverse','reverse']])f.elements[field].checked=d?!!fib[key]:options[field];
  f.elements.fibColor.value=d?(fib.color||options.fibColor):options.fibColor;
  $('fib-edit-label').textContent=d?'Modifier ce Fibonacci : '+d.label:'Fibonacci standard par défaut. Activez vos niveaux pour les prochains dessins.';
  $('chart-settings-error').textContent='';$('chart-dialog').showModal();
}
$('chart-settings').onclick=()=>openChartSettings();$('close-chart-settings').onclick=()=>$('chart-dialog').close();
$('strategy-settings').onclick=()=>{openChartSettings();$('chart-settings-form').elements.strategyLevels.focus();};
$('chart-settings-form').elements.fibCustom.onchange=e=>{$('chart-settings-form').elements.fibLevels.disabled=!e.target.checked;};
$('chart-settings-form').onsubmit=e=>{
  e.preventDefault();const f=e.target;let levels,strategyLevels=options.strategyLevels,anchor=num('sell');
  try{levels=f.elements.fibCustom.checked?parseFibLevels(f.elements.fibLevels.value):FIB_LEVELS;if(!editedFib){strategyLevels=parseStrategyLevels(f.elements.strategyLevels.value);anchor=strategyPrice(Number(f.elements.strategyAnchor.value),0);}}catch(error){$('chart-settings-error').textContent=error.message;return;}
  for(const key of ['volume','ema20','ema50'])options[key]=f.elements[key].checked;
  const fib={custom:f.elements.fibCustom.checked,levels:[...levels],extend:f.elements.fibExtend.checked,reverse:f.elements.fibReverse.checked,color:f.elements.fibColor.value};
  if(editedFib)editedFib.fib=fib;else{
    Object.assign(options,{fibCustom:fib.custom,fibLevels:fib.levels,fibExtend:fib.extend,fibReverse:fib.reverse,fibColor:fib.color});
    if(JSON.stringify(strategyLevels)!==JSON.stringify(options.strategyLevels))allocations=equalAllocations(strategyLevels.length);
    options.strategyLevels=[...strategyLevels];if(!strategyLevels.includes(correction))correction=strategyLevels[0];
    $('sell').value=anchor;state.settings[state.asset].sell=anchor;pinnedRange=null;
  }
  persistStrategy();$('chart-dialog').close();renderLab();renderChart();toast('Réglages enregistrés.');
};
function setFullscreenAppearance(){
  const active=document.fullscreenElement===chartPanel||chartPanel.classList.contains('fullscreen-fallback');
  chartPanel.classList.toggle('is-fullscreen',active);document.body.classList.toggle('chart-expanded',active);
  const b=$('fullscreen');b.textContent=active?'⛶ Quitter':'⛶ Plein écran';b.setAttribute('aria-pressed',String(active));b.setAttribute('aria-label',active?'Quitter le plein écran':'Ouvrir le graphique en plein écran');
  requestAnimationFrame(renderChart);
}
async function toggleFullscreen(){
  if(document.fullscreenElement===chartPanel){await document.exitFullscreen();return;}
  if(chartPanel.classList.contains('fullscreen-fallback')){chartPanel.classList.remove('fullscreen-fallback');setFullscreenAppearance();return;}
  if(chartPanel.requestFullscreen){try{await chartPanel.requestFullscreen();return;}catch{}}
  chartPanel.classList.add('fullscreen-fallback');setFullscreenAppearance();
}
$('fullscreen').onclick=toggleFullscreen;document.addEventListener('fullscreenchange',setFullscreenAppearance);
function changeZoom(delta){zoomAt(zoom+delta);}
$('zoom-in').onclick=()=>changeZoom(-15);$('zoom-out').onclick=()=>changeZoom(15);$('latest').onclick=()=>{cursor=null;viewportRightTime=null;pinnedRange=null;offset=0;renderChart();};
document.addEventListener('keydown',e=>{
  if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)||document.querySelector('dialog[open]'))return;
  if(e.key.toLowerCase()==='f'&&!e.ctrlKey&&!e.metaKey){e.preventDefault();toggleFullscreen();}
  if(e.key==='Escape'){pending=null;tool='cursor';document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('selected',b.dataset.tool==='cursor'));chartPanel.classList.remove('fullscreen-fallback');setFullscreenAppearance();renderChart();}
  if(e.key==='+'||e.key==='='){e.preventDefault();changeZoom(-15);}if(e.key==='-'){e.preventDefault();changeZoom(15);}
  if((e.ctrlKey||e.metaKey)&&e.key==='z'){const index=state.drawings.findLastIndex(d=>d.asset===state.asset&&!d.locked);if(index>=0){e.preventDefault();state.drawings.splice(index,1);persist();renderChart();renderElements();}}
});
new ResizeObserver(()=>renderChart()).observe(svg);
function aiSnapshot(){
  const other=state.asset==='SOL'?'BTC':'SOL';
  return buildAiContext({state,market,candles:market.candles,comparisonCandles:market.series.get(`${market.provider}:${other}:${state.tf}`)||[],fees:{percentPerSide:num('fee'),slippagePercent:num('slippage'),network:num('network')},strategy:{amount:num('amount'),sell:num('sell'),correction}});
}
window.byhnexAiChart={
  snapshot:aiSnapshot,
  async getContext(){
    const context=aiSnapshot(),other=context.asset==='SOL'?'BTC':'SOL',provider=market.provider,generation=market.generation;
    if(['BTC','SOL'].includes(context.asset))try{await market.loadCandles(provider,generation,other,context.timeframe);context.comparisonCandles=(market.series.get(`${provider}:${other}:${context.timeframe}`)||[]).slice(-60).map(c=>({...c}));}catch{}
    return context;
  },
  async apply(actions,context){
    if(!context||state.asset!==context.asset||state.tf!==context.timeframe)throw Error('Le graphique a changé. Revenez à '+context?.asset+' · '+context?.timeframe+' pour appliquer ces repères.');
    const result=applyVisualActions(state.drawings,actions,{asset:state.asset,candles:market.candles});
    if(!result.applied)throw Error('Aucun repère valide à appliquer. Les dessins personnels et verrouillés sont protégés.');
    state.drawings=result.drawings;if(result.focusPrice)aiFocusPrice=result.focusPrice;
    if(result.timeframe){state.tf=result.timeframe;pending=null;offset=0;document.querySelectorAll('#timeframes [data-value]').forEach(b=>b.classList.toggle('selected',b.dataset.value===state.tf));await market.select(state.asset,state.tf);}
    persist();renderChart();renderElements();window.dispatchEvent(new Event('byhnex-ai-context'));toast(result.applied+' repère(s) IA appliqué(s) au graphique.');
    return result.applied;
  }
};
market.start(state.asset,state.tf);
signals.start(market.provider,state.tf);
