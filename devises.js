/* Byhnex — module de devises partage par toutes les pages.
   Les taux sont bases sur l'euro (open.er-api, gratuit, sans cle, ~160 devises).
   Les pages fournissent leurs montants soit en euros, soit en dollars ;
   le module se charge de la conversion et du formatage.
   Le choix est memorise dans localStorage sous 'byhnex-devise' : il est donc
   partage entre toutes les pages du site. */
'use strict';
window.Devises = (function () {
  const KEY = 'byhnex-devise';
  const MAJORS = ['EUR', 'USD', 'GBP', 'CHF', 'CAD', 'JPY', 'AUD'];
  let rates = { EUR: 1 }; let ratesTimestamp=0, ratesLive=false;try{const cached=JSON.parse(localStorage.getItem('byhnex-fx-cache'));if(cached&&Date.now()-cached.savedAt<172800000&&cached.rates?.USD>0){rates=cached.rates;ratesTimestamp=cached.timestamp;}}catch{} // No invented exchange rate.          // repli si le reseau est indisponible
  let code = localStorage.getItem(KEY) || 'EUR';
  const listeners = [];

  const rate = () => rates[code] || 1;
  const fromEur = v => v * rate();
  const fromUsd = v => rates.USD ? v / rates.USD * rate() : code==='USD'?v:NaN;

  function format(v, digits) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    const d = digits !== undefined && digits !== null
      ? digits
      : (v >= 1 ? 2 : v >= 0.001 ? 5 : 8);
    try {
      return v.toLocaleString('fr-FR', { style: 'currency', currency: code, minimumFractionDigits: d, maximumFractionDigits: d });
    } catch (e) {                              // code inconnu du navigateur
      return v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }) + ' ' + code;
    }
  }

  // gros montants : 1,2 Md / 340 M, avec le code de la devise
  function formatBig(v) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    const abs = Math.abs(v);
    const unit = abs >= 1e12 ? [1e12, 'T'] : abs >= 1e9 ? [1e9, 'Md'] : abs >= 1e6 ? [1e6, 'M'] : [1, ''];
    const n = v / unit[0];
    const txt = n.toLocaleString('fr-FR', { maximumFractionDigits: unit[1] ? 2 : 0 });
    return txt + (unit[1] ? ' ' + unit[1] : '') + ' ' + symbol();
  }

  function symbol() {
    try {
      const parts = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: code }).formatToParts(1);
      const s = parts.find(p => p.type === 'currency');
      return s ? s.value : code;
    } catch (e) { return code; }
  }

  async function load() {
    try {
      const r = await fetch('https://open.er-api.com/v6/latest/EUR');
      const j = await r.json();
      if (j && j.rates && j.rates.USD>0){rates=Object.assign({EUR:1},j.rates);ratesTimestamp=Number(j.time_last_update_unix)*1000||Date.now();ratesLive=true;try{localStorage.setItem('byhnex-fx-cache',JSON.stringify({rates,timestamp:ratesTimestamp,savedAt:Date.now()}));}catch{}}else throw Error('Taux indisponibles');
    } catch (e) { console.warn('Taux de change indisponibles : cache daté ou conversion désactivée.', e); }
    if (!rates[code]) code = 'EUR';
  }

  function fillSelect(sel) {
    if (!sel) return;
    const autres = Object.keys(rates).filter(c => !MAJORS.includes(c)).sort();
    sel.innerHTML =
      '<optgroup label="Principales">' + MAJORS.filter(c => rates[c]).map(c => '<option value="' + c + '">' + c + '</option>').join('') + '</optgroup>' +
      '<optgroup label="Toutes les devises">' + autres.map(c => '<option value="' + c + '">' + c + '</option>').join('') + '</optgroup>';
    sel.value = code;sel.title=ratesTimestamp?(ratesLive?'Taux source du ':'Taux en cache du ')+new Date(ratesTimestamp).toLocaleString('fr-FR'):'Conversion indisponible : aucun taux réel reçu';
    sel.addEventListener('change', () => {
      code = sel.value;
      localStorage.setItem(KEY, code);
      listeners.forEach(fn => { try { fn(code); } catch (e) { console.warn(e); } });
    });
  }

  return {
    /* init(selecteur CSS ou element, callback appele a chaque changement) */
    async init(selOrEl, onChange) {
      await load();
      if (onChange) listeners.push(onChange);
      fillSelect(typeof selOrEl === 'string' ? document.querySelector(selOrEl) : selOrEl);
      return code;
    },
    onChange(fn) { listeners.push(fn); },
    get code() { return code; },
    /* taux dollar par euro : utile aux pages qui raisonnent en dollars */
    get usdPerEur() { return rates.USD || NaN; },
    symbol,
    /* montant fourni en euros */
    conv: fromEur,
    fmt: (v, d) => format(fromEur(v), d),
    /* montant fourni en dollars */
    convUsd: fromUsd,
    fmtUsd: (v, d) => format(fromUsd(v), d),
    fmtBigUsd: v => formatBig(fromUsd(v)),
  };
})();
