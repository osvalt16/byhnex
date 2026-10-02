export class AiStore extends EventTarget {
  constructor(storage = globalThis.sessionStorage) {
    super();this.storage=storage;this.pending=false;this.error='';
    try {const saved=JSON.parse(storage.getItem('byhnex-ai-session-v1'));this.messages=Array.isArray(saved)?saved.filter(m=>['user','assistant'].includes(m.role)&&typeof m.content==='string').slice(-60):[];} catch {this.messages=[];}
  }
  emit(){try{this.storage.setItem('byhnex-ai-session-v1',JSON.stringify(this.messages.slice(-60)));}catch{}this.dispatchEvent(new Event('change'));}
  add(role,content,extra={}){const message={id:crypto.randomUUID(),role,content:content.slice(0,16000),time:Date.now(),...extra};this.messages.push(message);this.emit();return message;}
  history(){return this.messages.slice(-12).map(({role,content})=>({role,content:content.slice(0,2000)}));}
  status(pending,error=''){this.pending=pending;this.error=error;this.emit();}
  clear(){this.messages=[];this.error='';this.emit();}
}
