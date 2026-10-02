// Shared validation only: this module contains no server credentials.
export const AI_ASSETS = ['BTC', 'SOL'];
export const AI_TIMEFRAMES = ['1m', '5m', '15m', '30m', '1H', '4H', '1D', '1W'];
export const AI_ACTION_TYPES = ['ADD_HORIZONTAL_LINE', 'REMOVE_HORIZONTAL_LINE', 'CLEAR_AI_LEVELS', 'DRAW_FIBONACCI', 'CHANGE_TIMEFRAME', 'FOCUS_PRICE'];
const positive = x => typeof x === 'number' && Number.isFinite(x) && x > 0 && x < 1e12;
const text = (value, limit = 80) => typeof value === 'string' ? value.trim().slice(0, limit) : '';

export function validateAction(action) {
  if (!action || !AI_ASSETS.includes(action.symbol) || !AI_ACTION_TYPES.includes(action.type)) return null;
  const base = { type: action.type, symbol: action.symbol };
  switch (action.type) {
    case 'ADD_HORIZONTAL_LINE': return positive(action.price) ? { ...base, price: action.price, label: text(action.label) || 'Niveau IA' } : null;
    case 'REMOVE_HORIZONTAL_LINE': return text(action.id) ? { ...base, id: text(action.id) } : null;
    case 'CLEAR_AI_LEVELS': return base;
    case 'CHANGE_TIMEFRAME': return AI_TIMEFRAMES.includes(action.timeframe) ? { ...base, timeframe: action.timeframe } : null;
    case 'FOCUS_PRICE': return positive(action.price) ? { ...base, price: action.price } : null;
    case 'DRAW_FIBONACCI':
      if (![action.startPrice, action.endPrice].every(positive) || ![action.startTime,action.endTime].every(x=>typeof x==='number'&&Number.isFinite(x)&&x>0&&x<1e14) || action.startTime === action.endTime || action.startPrice === action.endPrice) return null;
      return { ...base, startTime: action.startTime, endTime: action.endTime, startPrice: action.startPrice, endPrice: action.endPrice, label: text(action.label) || 'Fibonacci IA' };
    default: return null;
  }
}

export function validateReply(reply) {
  if (!reply || typeof reply.message !== 'string' || !reply.message.trim() || reply.message.length > 16000 || !Array.isArray(reply.actions) || reply.actions.length > 12) throw Error('Réponse de l’assistant invalide. Réessayez.');
  return { message: reply.message.trim(), actions: reply.actions.map(validateAction).filter(Boolean) };
}

const object = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const action = (type, properties = {}) => object({ type: { type: 'string', enum: [type] }, symbol: { type: 'string', enum: AI_ASSETS }, ...properties });
const number = { type: 'number' }, string = { type: 'string' };
export const REPLY_SCHEMA = object({
  message: string,
  actions: { type: 'array', items: { anyOf: [
    action('ADD_HORIZONTAL_LINE', { price: number, label: string }),
    action('REMOVE_HORIZONTAL_LINE', { id: string }),
    action('CLEAR_AI_LEVELS'),
    action('DRAW_FIBONACCI', { startTime: number, startPrice: number, endTime: number, endPrice: number, label: string }),
    action('CHANGE_TIMEFRAME', { timeframe: { type: 'string', enum: AI_TIMEFRAMES } }),
    action('FOCUS_PRICE', { price: number })
  ] } }
});
