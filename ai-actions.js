import { validateAction, AI_ASSETS } from './ai-contract.js?v=20261003-ovh';
import { FIB_LEVELS } from './chart-utils.js?v=20261003-ovh';

export function applyVisualActions(drawings, actions, { asset, candles = [], createId = () => crypto.randomUUID() } = {}) {
  if (!AI_ASSETS.includes(asset)) throw Error('Choisissez le graphique BTC ou SOL.');
  let next = structuredClone(drawings), timeframe=null, focusPrice=null, applied=0;
  for (const input of actions.slice(0,12)) {
    const a=validateAction(input);if(!a || a.symbol!==asset)continue;
    if(a.type==='ADD_HORIZONTAL_LINE'){
      next.push({id:createId(),asset,origin:'ai',type:'horizontal',label:'IA · '+a.label,t1:candles.at(-1)?.time||Date.now(),p1:a.price,locked:false,visible:true});applied++;
    } else if(a.type==='REMOVE_HORIZONTAL_LINE'){
      const count=next.length;next=next.filter(d=>!(d.id===a.id&&d.asset===asset&&d.origin==='ai'&&!d.locked&&d.type==='horizontal'));if(count!==next.length)applied++;
    } else if(a.type==='CLEAR_AI_LEVELS'){
      const count=next.length;next=next.filter(d=>!(d.asset===asset&&d.origin==='ai'&&!d.locked));if(count!==next.length)applied++;
    } else if(a.type==='DRAW_FIBONACCI'){
      const observed=(time,price)=>candles.some(c=>c.time===time&&price>=c.low-1e-8&&price<=c.high+1e-8);
      if(!observed(a.startTime,a.startPrice)||!observed(a.endTime,a.endPrice))continue;
      next.push({id:createId(),asset,origin:'ai',type:'fib',label:'IA · '+a.label,t1:a.startTime,p1:a.startPrice,t2:a.endTime,p2:a.endPrice,locked:false,visible:true,fib:{custom:false,levels:[...FIB_LEVELS],extend:true,reverse:false,color:'#e9b46b'}});applied++;
    } else if(a.type==='CHANGE_TIMEFRAME'){timeframe=a.timeframe;applied++;}
    else if(a.type==='FOCUS_PRICE'){focusPrice=a.price;applied++;}
  }
  return {drawings:next,timeframe,focusPrice,applied};
}
