/* Public market requests only. No credentials, trades or account access. */
(()=>{
  const nativeFetch=window.fetch.bind(window),NativeSocket=window.WebSocket,cooldown=new Map();
  window.fetch=async(input,options={})=>{
    const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
    if(!/^https:\/\/(api\.binance\.com|api\.coingecko\.com|api\.exchange\.coinbase\.com|coincodex\.com|fapi\.binance\.com|open\.er-api\.com)\//.test(url))return nativeFetch(input,options);
    const isPublicBinance=/^https:\/\/api\.binance\.com\/api\/v3\/(exchangeInfo|klines|ticker\/[^?]+)(\?|$)/.test(url);
    const candidates=isPublicBinance?[url.replace('api.binance.com','data-api.binance.vision'),url]:[url];
    let error;
    for(const target of candidates){
      const host=new URL(target).hostname;if((cooldown.get(host)||0)>Date.now()){error=Error('Limite fournisseur : réessayez plus tard.');continue;}
      try{
        const timeout=AbortSignal.timeout(10000),signal=options.signal?AbortSignal.any([options.signal,timeout]):timeout;
        const response=await nativeFetch(target,{...options,signal});
        if(response.status===429||response.status===418){cooldown.set(host,Date.now()+Math.max(60000,(Number(response.headers.get('Retry-After'))||60)*1000));return response;}
        if(!response.ok&&target!==candidates.at(-1)){error=Error('HTTP '+response.status);continue;}
        return response;
      }catch(e){error=e;if(options.signal?.aborted)throw e;}
    }
    throw error||Error('Fournisseur de données indisponible.');
  };
  window.WebSocket=class extends NativeSocket{
    constructor(url,protocols){const target=String(url).replace(/^wss:\/\/stream\.binance\.com(?::9443)?\//,'wss://data-stream.binance.vision/');if(protocols===undefined)super(target);else super(target,protocols);}
  };
})();
