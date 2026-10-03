// One navigation component for every full page.
const sidebarMarkup="<aside class=\"bn-sidebar\" id=\"bn-sidebar\" aria-label=\"Navigation principale\"><a class=\"bn-brand\" href=\"index.html\"><img src=\"logo.png\" alt=\"\"><span>byhnex<span class=\"bn-brand-point\">.</span></span></a><div class=\"bn-workspace\"><span class=\"bn-workspace-icon\">B</span><div>Espace personnel<small>Votre boîte à outils crypto</small></div><span>⌄</span></div><p class=\"bn-nav-label\">EXPLORER</p><nav class=\"bn-nav\"><a href=\"index.html\" ><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 10l9-7 9 7 M5 9v12h5v-7h4v7h5V9\"/></svg><span>Vue d’ensemble</span></a><a href=\"crypto-dashboard.html\" ><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 17l5-5 4 3 8-10 M15 5h5v5\"/></svg><span>Dashboard Marché</span></a><a href=\"signaux-crypto.html\" ><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M4 13h3l3-8 4 14 3-6h3\"/></svg><span>Signaux Crypto</span></a><a href=\"backtest.html\" ><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M9 3h6 M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3 M8 14h8\"/></svg><span>Backtest</span></a><a href=\"positionnement.html\" ><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 3v18 M5 21h14 M4 7h16 M6 7l-4 7h8z M18 7l-4 7h8z\"/></svg><span>Positionnement</span></a><a href=\"saisonnalite-btc.html\" ><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2 M7 2v5 M17 2v5 M3 10h18 M7 14h2 M12 14h2 M7 17h2\"/></svg><span>Saisonnalité BTC</span></a><a href=\"rainbow-crypto.html\" ><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M2 20a10 10 0 0 1 20 0 M6 20a6 6 0 0 1 12 0 M10 20a2 2 0 0 1 4 0\"/></svg><span>Rainbow Chart</span></a><a href=\"accumulation.html\" ><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 3v18h18 M7 15V7 M5 9h4v4H5 M13 18V6 M11 10h4v5h-4 M19 13V3 M17 6h4v4h-4\"/></svg><span>Accumulation</span><b>NOUVEAU</b></a></nav><div class=\"bn-sidebar-bottom\"><div class=\"bn-local\"><span class=\"bn-status-dot\"></span>Vos données vous appartiennent<p>Portefeuille et simulations<br>enregistrés sur votre appareil.</p><span>Sans compte · Gratuit</span></div><a href=\"https://osvalt16.github.io/byhnex/\" target=\"_blank\" rel=\"noopener\" class=\"bn-source\">Site d’origine ↗</a><div class=\"bn-user\"><span>B</span><div>Mon workspace<small>Sauvegarde locale</small></div><i></i></div></div></aside>";

if (!document.body.classList.contains('embed')) mountSidebar();

function mountSidebar() {
  const host=document.querySelector('[data-shared-sidebar]');
  if (!host) return;
  host.outerHTML=sidebarMarkup;
  document.body.classList.add('bn-shared-nav');
  const sidebar=document.getElementById('bn-sidebar');
  sidebar.querySelector('.bn-brand').setAttribute('aria-label','Accueil Byhnex');
  const page=location.pathname.split('/').pop() || 'index.html';
  const links=[...sidebar.querySelectorAll('.bn-nav a')];
  for (const link of links) {
    const active=link.getAttribute('href')===page;
    link.classList.toggle('active',active);
    link.title=link.querySelector('span').textContent;
    if (active) link.setAttribute('aria-current','page');
  }
  const bar=document.createElement('div');
  bar.className='bn-menu-bar';
  bar.innerHTML='<button type="button" class="bn-menu-toggle" aria-label="Ouvrir le menu" aria-controls="bn-sidebar" aria-expanded="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button><a href="index.html">byhnex.</a><span></span>';
  bar.querySelector('span').textContent=links.find(link=>link.classList.contains('active'))?.textContent.replace('NOUVEAU','').trim() || 'Workspace';
  const backdrop=document.createElement('button');
  backdrop.type='button';backdrop.className='bn-menu-backdrop';backdrop.tabIndex=-1;
  backdrop.setAttribute('aria-label','Fermer le menu');
  document.body.prepend(bar,backdrop);
  const toggle=bar.querySelector('button');
  const mobile=matchMedia('(max-width:520px)');
  let opened=false;
  function setOpen(value,restoreFocus=false) {
    opened=value;
    document.body.classList.toggle('bn-navigation-open',value);
    toggle.setAttribute('aria-expanded',String(value));
    toggle.setAttribute('aria-label',value?'Fermer le menu':'Ouvrir le menu');
    sidebar.inert=mobile.matches && !value;
    if (value) (sidebar.querySelector('[aria-current="page"]') || links[0]).focus();
    else if (restoreFocus) toggle.focus();
  }
  setOpen(false);
  toggle.onclick=()=>setOpen(!opened,true);
  backdrop.onclick=()=>setOpen(false,true);
  sidebar.addEventListener('click',event=>{if(event.target.closest('.bn-nav a,.ai-nav-button')) setOpen(false);});
  document.addEventListener('keydown',event=>{
    if(!opened || !mobile.matches)return;
    if(event.key==='Escape'){event.preventDefault();setOpen(false,true);}
    if(event.key==='Tab'){
      const focusables=[...sidebar.querySelectorAll('a,button')].filter(el=>!el.disabled && el.getClientRects().length);
      const first=focusables[0],last=focusables.at(-1);
      if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
    }
  });
  mobile.addEventListener('change',()=>setOpen(false));
}
