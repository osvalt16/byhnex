import './sidebar.js?v=20261003-sidebar';
import {AiStore} from './ai-store.js?v=20261003-ovh';
import {sendAiMessage,checkConnection,getEndpoint,setEndpoint,setAccessCode,hasAccessCode} from './ai-service.js?v=20261003-strategy';
import {buildAiContext,savedPortfolio} from './ai-context.js?v=20261003-ovh';
import {AI_ASSETS} from './ai-contract.js?v=20261003-ovh';

if(!document.body.classList.contains('embed'))mountAssistant();
function mountAssistant(){
  const store=new AiStore(),widget=document.createElement('div');widget.className='ai-widget';
  const icon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M8 4h8a5 5 0 0 1 5 5v6a5 5 0 0 1-5 5h-5l-5 2v-3a5 5 0 0 1-3-4V9a5 5 0 0 1 5-5Z"/><path d="m12 7 1.3 3.7L17 12l-3.7 1.3L12 17l-1.3-3.7L7 12l3.7-1.3Z"/></svg>';
  widget.innerHTML=`<button class="ai-launcher" aria-controls="ai-panel" aria-expanded="false">${icon}<span>Assistant IA</span><small>BTC / SOL</small></button>
  <aside class="ai-panel" id="ai-panel" aria-label="Assistant IA Byhnex" hidden>
    <div class="ai-header"><div class="ai-mark">${icon}</div><div><h2>Assistant IA<span>Copilote BTC / SOL</span></h2><div class="ai-status"><i></i><span id="ai-status">Connexion à vérifier</span></div></div><button id="ai-new" title="Nouvelle conversation" aria-label="Nouvelle conversation">＋</button><button id="ai-close" title="Réduire" aria-label="Réduire l’assistant">✕</button></div>
    <div class="ai-context"><div><span class="ai-context-dot"></span><b id="ai-context-label">Contexte du graphique</b></div><small id="ai-context-detail"></small><a href="accumulation.html?asset=SOL&assistant=1" id="ai-open-chart">Ouvrir le graphique ↗</a></div>
    <div class="ai-tools-row"><span>Analyse & simulations</span><button id="ai-connect-toggle">⚙ Connexion</button></div>
    <form id="ai-connection" class="ai-connection" hidden><h3>Connecter l’assistant</h3><p>La clé OpenAI reste sur votre serveur. Cette interface utilise seulement son adresse et votre code d’accès Byhnex.</p><label>Adresse de l’assistant<input name="endpoint" type="url" placeholder="https://votre-serveur/api/ai-chat" autocomplete="url"></label><label>Code d’accès Byhnex<input name="access" type="password" autocomplete="current-password" placeholder="Code choisi sur votre serveur"></label><div><button type="button" id="ai-connect-close">Fermer</button><button type="submit">Vérifier la connexion →</button></div><p id="ai-connection-error" role="alert"></p></form>
    <div class="ai-feed" id="ai-feed" role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions text"></div>
    <div class="ai-error" id="ai-error" role="alert" hidden></div>
    <form class="ai-compose" id="ai-compose"><label class="ai-sr-only" for="ai-input">Votre message à l’assistant</label><textarea id="ai-input" maxlength="4000" rows="3" placeholder="Analyse SOL, compare mes scénarios…"></textarea><div><span>Entrée pour envoyer · ⇧ Entrée pour une ligne</span><button type="submit" id="ai-send" aria-label="Envoyer le message">↑</button><button type="button" id="ai-cancel" hidden>Annuler</button></div></form>
    <div class="ai-footer"><span>✦ OpenAI</span><span>Portefeuille virtuel · Repères visuels</span></div>
  </aside>`;
  document.body.append(widget);
  const $=id=>widget.querySelector('#'+id),panel=$('ai-panel'),launcher=widget.querySelector('.ai-launcher');
  let opened=false,lastFocus=null,controller=null,requestGeneration=0,status={ready:false},contextSnapshot=null,contextSequence=0;
  const nav=document.querySelector('.bn-nav'),navButton=document.createElement('button');navButton.className='ai-nav-button';navButton.type='button';navButton.innerHTML=icon+'<span>Assistant IA</span><small>OPENAI</small>';navButton.setAttribute('aria-label','Assistant IA');navButton.title='Assistant IA';navButton.setAttribute('aria-controls','ai-panel');navButton.setAttribute('aria-expanded','false');if(nav)nav.append(navButton);
  const snapshot=()=>window.byhnexAiChart?.snapshot()||buildAiContext({state:savedPortfolio(),market:window.byhnexAiMarket?.()||{}});
  async function updateContext(){
    const sequence=++contextSequence;const c=snapshot();if(sequence!==contextSequence)return;contextSnapshot=c;
    const supported=AI_ASSETS.includes(c.asset),chart=!!window.byhnexAiChart;
    $('ai-context-label').textContent=supported?c.asset+' / '+c.quoteCurrency+' · '+c.timeframe:'BTC / SOL uniquement';
    $('ai-context-detail').textContent=supported?(c.currentPrice!==null?c.currentPrice.toLocaleString('fr-FR',{maximumFractionDigits:c.currentPrice<1?5:2})+' '+c.quoteCurrency+' · ':'')+(chart?c.candles.length+' bougies · '+(c.market.stale?'cours non actualisé':c.market.source):'Ouvrez le graphique pour joindre ses bougies.'):'Choisissez BTC ou SOL pour utiliser le copilote.';
    $('ai-open-chart').hidden=chart&&supported;$('ai-context-label').parentElement.classList.toggle('ai-context-stale',c.market.stale||!supported);
  }
  function statusText(){
    const text=store.pending?'Analyse en cours…':status.ready?(status.hasAccessCode?'OpenAI prêt':'Code d’accès requis'):'OpenAI à connecter';
    $('ai-status').textContent=text;widget.classList.toggle('ai-connected',!!status.ready&&!!status.hasAccessCode);$('ai-connect-toggle').textContent=status.ready?'⚙ Connexion':'⚙ Activer OpenAI';
  }
  async function showConnection(message=''){const f=$('ai-connection');f.elements.endpoint.value=await getEndpoint();f.hidden=false;$('ai-connection-error').textContent=message;(f.elements.endpoint.value?f.elements.access:f.elements.endpoint).focus();}
  async function refreshConnection(){try{status=await checkConnection();}catch{status={ready:false};}statusText();if(opened&&status.ready&&!hasAccessCode())showConnection('Entrez le code BYHNEX_AI_ACCESS_CODE de votre .env. Il est demandé à chaque nouvelle ouverture de la page.');}
  function open(){lastFocus=document.activeElement;opened=true;panel.hidden=false;document.body.classList.add('ai-open');document.fullscreenElement?.classList.add('ai-fullscreen-open');launcher.setAttribute('aria-expanded','true');navButton.setAttribute('aria-expanded','true');updateContext();render();refreshConnection();$('ai-input').focus();}
  function close(){opened=false;panel.hidden=true;document.body.classList.remove('ai-open');document.querySelectorAll('.ai-fullscreen-open').forEach(e=>e.classList.remove('ai-fullscreen-open'));launcher.setAttribute('aria-expanded','false');navButton.setAttribute('aria-expanded','false');if(lastFocus?.isConnected)lastFocus.focus();}
  launcher.onclick=()=>opened?close():open();navButton.onclick=()=>opened?close():open();$('ai-close').onclick=close;
  function safeText(node,text){
    const parts=String(text).split(/(\*\*[^*]+\*\*|`[^`]+`)/g);for(const part of parts){if(part.startsWith('**')&&part.endsWith('**')){const b=document.createElement('strong');b.textContent=part.slice(2,-2);node.append(b);}else if(part.startsWith('`')&&part.endsWith('`')){const code=document.createElement('code');code.textContent=part.slice(1,-1);node.append(code);}else node.append(document.createTextNode(part));}
  }
  const prompts=['Analyse SOL actuellement','Si je sécurise 800 $ et SOL corrige de 12 %, combien de SOL vais-je récupérer ?','Place Fibonacci sur le dernier mouvement','Analyse BTC et son influence sur SOL'];
  function render(){
    const feed=$('ai-feed'),atBottom=feed.scrollHeight-feed.scrollTop-feed.clientHeight<60;feed.replaceChildren();
    if(!store.messages.length){const empty=document.createElement('div');empty.className='ai-welcome';empty.innerHTML=`<div class="ai-welcome-orbit">${icon}<span>✦</span></div><span class="ai-eyebrow">VOTRE COPILOTE DE MARCHÉ</span><h3>Une question.<br>Un scénario plus clair.</h3><p>Analysez BTC et SOL avec le contexte de votre graphique et de votre portefeuille virtuel.</p><div class="ai-prompts"></div>`;for(const prompt of prompts){const b=document.createElement('button');b.type='button';b.textContent=prompt;b.onclick=()=>{$('ai-input').value=prompt;$('ai-input').focus();};empty.querySelector('.ai-prompts').append(b);}feed.append(empty);}
    for(const m of store.messages){const article=document.createElement('article');article.className='ai-message ai-'+m.role;const meta=document.createElement('div');meta.className='ai-message-meta';const role=document.createElement('b');role.textContent=m.role==='user'?'Vous':'Assistant';const time=document.createElement('time');time.dateTime=new Date(m.time).toISOString();time.textContent=new Date(m.time).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});meta.append(role,time);const text=document.createElement('div');text.className='ai-message-text';safeText(text,m.content);article.append(meta,text);
      if(m.role==='assistant'&&m.context){const tag=document.createElement('small');tag.className='ai-message-context';tag.textContent=m.context.asset+' · '+m.context.timeframe+' · contexte envoyé à '+new Date(m.context.time).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});article.append(tag);}
      if(m.role==='assistant'&&m.actions?.length){const actions=document.createElement('div');actions.className='ai-action-card';const title=document.createElement('b');title.textContent='Repères proposés · '+m.actions.length;actions.append(title);for(const a of m.actions){const line=document.createElement('span');const names={ADD_HORIZONTAL_LINE:'Ajouter une ligne',REMOVE_HORIZONTAL_LINE:'Retirer une ligne IA',CLEAR_AI_LEVELS:'Effacer les repères IA',DRAW_FIBONACCI:'Tracer Fibonacci',CHANGE_TIMEFRAME:'Changer la période',FOCUS_PRICE:'Cadrer un prix'};line.textContent=a.symbol+' · '+names[a.type]+(a.price?' · '+a.price.toLocaleString('fr-FR')+' '+(m.context?.quoteCurrency||'USD'):'')+(a.timeframe?' · '+a.timeframe:'')+(a.label?' · '+a.label:'');actions.append(line);}const apply=document.createElement('button');apply.type='button';apply.textContent=m.applied?'✓ Repères appliqués':'Appliquer au graphique →';apply.disabled=!!m.applied||store.pending;apply.onclick=async()=>{
          try{if(!window.byhnexAiChart)throw Error('Ouvrez le graphique pour appliquer ces repères.');await window.byhnexAiChart.apply(m.actions,m.context);m.applied=true;store.error='';store.emit();}catch(error){store.status(false,error.message);}
        };actions.append(apply);article.append(actions);}
      feed.append(article);
    }
    if(store.pending){const loading=document.createElement('div');loading.className='ai-loading';loading.innerHTML='<i></i><i></i><i></i><span>Analyse du contexte…</span>';feed.append(loading);}
    $('ai-error').hidden=!store.error;$('ai-error').textContent=store.error;$('ai-send').hidden=store.pending;$('ai-send').disabled=store.pending;$('ai-cancel').hidden=!store.pending;statusText();
    if(atBottom||store.pending||!store.messages.length)feed.scrollTop=feed.scrollHeight;
  }
  store.addEventListener('change',render);render();
  async function submit(){
    if(store.pending)return;const message=$('ai-input').value.trim();if(!message)return;
    const current=snapshot();if(!AI_ASSETS.includes(current.asset)){store.status(false,'Choisissez le graphique BTC ou SOL. Le copilote est spécialisé sur ces deux actifs.');return;}
    if(!await getEndpoint()){store.status(false,'Connectez votre serveur pour envoyer ce message.');await showConnection(store.error);return;}
    if(!hasAccessCode()){await showConnection('Entrez le code d’accès Byhnex de votre .env pour envoyer votre question.');return;}
    const generation=++requestGeneration;controller=new AbortController();const history=store.history(),sentMessage=store.add('user',message);$('ai-input').value='';store.status(true);
    try{const context=window.byhnexAiChart?await window.byhnexAiChart.getContext():current;if(controller.signal.aborted)return;const reply=await sendAiMessage({message,history,context,signal:controller.signal});if(generation!==requestGeneration)return;store.add('assistant',reply.message,{actions:reply.actions,context:{asset:context.asset,timeframe:context.timeframe,time:context.capturedAt,quoteCurrency:context.quoteCurrency}});store.status(false);}
    catch(error){if(generation!==requestGeneration)return;if(['ACCESS_DENIED','ACCESS_REQUIRED'].includes(error.code)){status.hasAccessCode=false;store.messages=store.messages.filter(m=>m.id!==sentMessage.id);if(!$('ai-input').value.trim())$('ai-input').value=message;$('ai-connection').elements.access.value='';store.status(false,error.message);await showConnection(error.message);return;}store.status(false,error.name==='AbortError'?'Analyse annulée.':error.message);}
  }
  $('ai-compose').onsubmit=e=>{e.preventDefault();submit();};$('ai-input').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();submit();}};
  $('ai-cancel').onclick=()=>{controller?.abort();store.status(false,'Analyse annulée.');};
  $('ai-new').onclick=()=>{controller?.abort();requestGeneration++;store.pending=false;store.clear();$('ai-input').focus();};
  $('ai-connect-toggle').onclick=()=>{$('ai-connection').hidden?showConnection():$('ai-connection').hidden=true;};$('ai-connect-close').onclick=()=>$('ai-connection').hidden=true;
  $('ai-connection').onsubmit=async e=>{
    e.preventDefault();const f=e.target,button=f.querySelector('[type=submit]');button.disabled=true;$('ai-connection-error').textContent='';
    try{setEndpoint(f.elements.endpoint.value.trim());setAccessCode(f.elements.access.value);if(!hasAccessCode())throw Error('Entrez le code d’accès Byhnex configuré dans votre .env.');status=await checkConnection();statusText();if(!status.ready)throw Error('Le serveur répond, mais sa connexion OpenAI n’est pas activée.');f.hidden=true;f.elements.access.value='';store.error='';store.emit();$('ai-input').focus();}catch(error){status.hasAccessCode=hasAccessCode();statusText();$('ai-connection-error').textContent=error.message;}finally{button.disabled=false;}
  };
  document.addEventListener('keydown',e=>{if(!opened)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(!$('ai-connection').hidden)$('ai-connection').hidden=true;else close();}},true);
  document.addEventListener('fullscreenchange',()=>{const parent=document.fullscreenElement||document.body;parent.append(widget);parent.classList.toggle('ai-fullscreen-open',opened);});
  setInterval(()=>{if(opened)updateContext();},1500);
  window.addEventListener('byhnex-ai-context',()=>{if(opened)updateContext();});
  // Public bridge exposes UI controls only, never credentials or wallet operations.
  window.byhnexAssistant={open,close};
  if(new URLSearchParams(location.search).has('assistant'))open();
}
