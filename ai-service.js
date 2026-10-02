import { validateReply } from './ai-contract.js?v=20261003-ovh';
let accessCode='', configuredEndpoint=null;
export function setAccessCode(code){if(code.startsWith('sk-'))throw Error('Utilisez le code d’accès Byhnex, jamais une clé OpenAI dans cette interface.');accessCode=code;}
export function validEndpoint(value){
  if(!value)return '';
  if(value.includes('sk-'))throw Error('Cette adresse ne doit contenir aucune clé OpenAI.');
  const url=new URL(value,location.href),local=['localhost','127.0.0.1'].includes(url.hostname);
  if(url.username||url.password||url.search||url.hash||!(url.protocol==='https:'||local&&url.protocol==='http:'))throw Error('Indiquez une URL HTTPS de serveur, sans clé ni paramètres.');
  if(url.hostname==='api.openai.com')throw Error('Indiquez votre serveur Byhnex, qui protège la clé OpenAI.');
  if(url.pathname==='/')url.pathname=url.hostname==='byhnex.com'?'/iacrypto/ai-chat.php':'/api/ai-chat';
  if(!['/api/ai-chat','/api/ai-chat.php','/iacrypto/ai-chat','/iacrypto/ai-chat.php','/.netlify/functions/ai-chat'].some(path=>url.pathname.endsWith(path)))throw Error('Indiquez l’adresse du chat sur votre serveur, par exemple https://byhnex.com/iacrypto/ai-chat.php.');
  return url.href;
}
export async function getEndpoint(){
  if(configuredEndpoint!==null)return configuredEndpoint;
  let stored='';try{stored=localStorage.getItem('byhnex-ai-endpoint')||'';}catch{}
  if(['https://byhnex.com/api/ai-chat','https://byhnex.com/api/ai-chat.php'].includes(stored)){stored='https://byhnex.com/iacrypto/ai-chat.php';try{localStorage.setItem('byhnex-ai-endpoint',stored);}catch{}}
  if(stored)return configuredEndpoint=validEndpoint(stored);
  if(['localhost','127.0.0.1'].includes(location.hostname))return configuredEndpoint=new URL('/api/ai-chat',location.href).href;
  try{const response=await fetch('ai-config.json?v=20261003-ovh-live',{signal:AbortSignal.timeout(5000)});if(response.ok){const data=await response.json();return configuredEndpoint=validEndpoint(data.endpoint);}}catch{}
  return configuredEndpoint='';
}
export function setEndpoint(url){configuredEndpoint=validEndpoint(url);try{if(configuredEndpoint)localStorage.setItem('byhnex-ai-endpoint',configuredEndpoint);else localStorage.removeItem('byhnex-ai-endpoint');}catch{}return configuredEndpoint;}
export async function checkConnection(){
  const endpoint=await getEndpoint();if(!endpoint)return {ready:false,missingEndpoint:true,accessRequired:true};
  const response=await fetch(endpoint,{headers:accessCode?{Authorization:'Bearer '+accessCode}:{},signal:AbortSignal.timeout(8000)});
  const data=await response.json().catch(()=>null);if(!response.ok||!data)throw Error(data?.error?.message||'Le serveur de l’assistant n’est pas joignable.');
  return {...data,hasAccessCode:!!accessCode};
}
export async function sendAiMessage({message,history,context,signal}){
  const endpoint=await getEndpoint();if(!endpoint)throw Error('La connexion OpenAI doit être activée dans Connexion.');
  try{
    const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',...(accessCode?{'Authorization':'Bearer '+accessCode}:{})},signal:AbortSignal.any([AbortSignal.timeout(60000),...(signal?[signal]:[])]),body:JSON.stringify({message,history,context})});
    const data=await response.json().catch(()=>null);if(!response.ok)throw Error(data?.error?.message||'Le serveur de l’assistant a renvoyé une erreur.');return validateReply(data);
  }catch(error){if(error.name==='TimeoutError')throw Error('L’analyse a pris trop de temps. Réessayez.');if(error.name==='AbortError')throw error;if(error instanceof TypeError)throw Error('Impossible de joindre l’assistant. Vérifiez la connexion réseau.');throw error;}
}
