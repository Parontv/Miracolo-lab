/* Miracolo Lab — autonomous PAPER execution. Equities during market hours, BTC/USD 24/7. */
import { runBot as analyzeBot } from './bot-server-engine.js';
import { getCryptoDecision } from './bot-crypto-engine.js';
import { executePaperDecision } from './bot-paper-executor.js';
const STATE='state/latest';
const PAPER_BASE='https://paper-api.alpaca.markets/v2';
async function read(env,key,f=null){try{const x=await env.ML_KV?.get(key);return x?JSON.parse(x):f}catch{return f}}
async function btcPosition(env){try{if(!env?.ALPACA_API_KEY||!env?.ALPACA_API_SECRET)return null;const r=await fetch(`${PAPER_BASE}/positions`,{headers:{'APCA-API-KEY-ID':env.AL...}})}catch{return null}}
