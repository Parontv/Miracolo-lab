/* Production entrypoint: live data + unified Bot brain + autonomous Alpaca Paper execution. */
import aiWorker from './ai-worker.js';
import { runAutoPaperBot } from './bot-paper-auto.js';
import { getBotDecision } from './bot-server-engine.js';
import { getCryptoDecision } from './bot-crypto-engine.js';
import { alpacaRequest } from './alpaca-paper.js';
import { refreshAlpacaEquities } from './alpaca-market-fallback.js';
import { seedBotMarket } from './bot-market-seed.js';
import { refreshNewsAndMacro } from './bot-context-enrichment.js';
import { recordSignals, evaluateSignals } from './bot-evaluation.js';
const LAST_RUN='bot/last-run';
async function writeRun(env,value){if(!env.ML_KV)throw Error('KV ML_KV binding missing');await env.ML_KV.put(LAST_RUN,JSON.stringify(value),{expirationTtl:86400})}
function slimLive(data) {
  const out = { ...data };
  if (out.universe && typeof out.universe === 'object') { const { tickers, ...universe } = out.universe; out.universe = { ...universe }; }
  if (out.news && typeof out.news === 'object') { const news = { ...out.news }; if (Array.isArray(news.items)) news.items = news.items.slice(0, 120).map(x => ({ title: x.title, date: x.date, url: x.url || x.link, source: x.source, type: x.type, cat: x.cat, score: x.score, description: String(x.description || x.summary || '').slice(0, 500) })); delete news.categories; out.news = news; }
  if (out.ai && typeof out.ai === 'object') out.ai = { ...out.ai, commentary: String(out.ai.commentary || '').slice(0, 3500), thesis: String(out.ai.thesis || '').slice(0, 1800) };
  return out;
}
async function refreshBotContext(env) {
  const cacheKey='bot/context-enrichment/latest';
  try {
    const cachedRaw=await env.ML_KV?.get(cacheKey);
    if(cachedRaw){const cached=JSON.parse(cachedRaw);if(Date.now()-Date.parse(cached.timestamp||'')<10*60*1000)return {...cached,cached:true};}
  } catch(e) { console.error('Bot context cache read failed',e); }
  const fresh=await refreshNewsAndMacro();
  const enriched={...fresh,timestamp:fresh.timestamp||new Date().toISOString()};
  try { if(env.ML_KV) await env.ML_KV.put(cacheKey,JSON.stringify(enriched),{expirationTtl:3600}); }
  catch(e) { console.error('Bot context cache write failed',e); }
  return enriched;
}
async function refreshBotState(env, ctx, request) {
  const started=Date.now();
  try {
    const u = new URL(request.url); u.pathname = '/api/live'; u.search = '?bot_refresh=' + Date.now();
    const r = await aiWorker.fetch(new Request(u.toString(), { method: 'GET', headers: { Accept: 'application/json', 'Cache-Control': 'no-cache', Pragma: 'no-cache' } }), env, ctx);
    if (!r.ok) throw Error('Live refresh HTTP '+r.status);
    let live = await r.json(); if (!live || typeof live !== 'object' || !live.market) throw Error('Live payload without market');
    const fallback = await refreshAlpacaEquities(env, live);
    if (fallback.ok && fallback.added >= 4) live = fallback.state;
    else { const publicSeed = await seedBotMarket(); if (publicSeed.indices.length >= 4) { const existing = Array.isArray(live.market.indices) ? live.market.indices : []; const additions = publicSeed.indices.filter(p => !existing.some(x => String(x?.ticker || '').toUpperCase() === String(p?.ticker || '').toUpperCase())); live = { ...live, market: { ...(live.market || {}), indices: [...existing, ...additions], timestamp: publicSeed.timestamp, source: 'Yahoo Finance fallback' } }; } else if (!fallback.ok) live.market = { ...(live.market || {}), botMarketFallback: { ok: false, error: fallback.error || 'unavailable', publicSeedCoverage: publicSeed.coverage, publicSeedFailures: publicSeed.failures } }; }
    let contextRefresh=null;
    try {
      contextRefresh=await refreshBotContext(env);
      const currentNews=Array.isArray(live.news?.items)?live.news.items:[];
      const freshNews=Array.isArray(contextRefresh.news?.items)?contextRefresh.news.items:[];
      const seen=new Set();
      const mergedNews=[...freshNews,...currentNews].filter(item=>{const key=String(item?.title||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();if(!key||seen.has(key))return false;seen.add(key);return true}).slice(0,180);
      live={...live,news:{...(live.news||{}),items:mergedNews,timestamp:contextRefresh.news?.timestamp||contextRefresh.timestamp,contextSource:contextRefresh.news?.source||'RSS'},market:{...(live.market||{}),quantitative:{groups:contextRefresh.quantitative?.groups||{},timestamp:contextRefresh.quantitative?.timestamp||contextRefresh.timestamp,source:contextRefresh.quantitative?.source||'FRED',coverage:contextRefresh.quantitative?.coverage||{available:0,total:8},errors:contextRefresh.quantitative?.errors||[]}}};
      if(env.ML_KV&&contextRefresh.quantitative)await env.ML_KV.put('quantitative/latest-v2',JSON.stringify(contextRefresh.quantitative),{expirationTtl:3600});
    } catch(e) { console.error('Bot context enrichment failed',e); }
    if (env.ML_KV) await env.ML_KV.put('state/latest', JSON.stringify(live), { expirationTtl: 3600 });
    return {ok:true,state:live,durationMs:Date.now()-started,context:{ok:Boolean(contextRefresh),cached:Boolean(contextRefresh?.cached),news:contextRefresh?.news?.items?.length||0,fred:contextRefresh?.quantitative?.coverage?.available||0,errors:contextRefresh?.errors||[]}};
  } catch(e) { console.error('refreshBotState failed',e); return {ok:false,state:null,error:String(e.message||e),durationMs:Date.now()-started}; }
}
async function ensureBotState(env) {
  try { let state = null; if (env.ML_KV) { const raw = await env.ML_KV.get('state/latest'); if (raw) { try { state = JSON.parse(raw); } catch (e) { console.error('state/latest JSON invalid',e); } } } const current = Array.isArray(state?.market?.indices) ? state.market.indices : []; if (current.length >= 4) return state; const fallback = await seedBotMarket(); if (fallback.indices.length < 4) return state; const merged = [...current]; for (const item of fallback.indices) if (!merged.some(x => String(x?.ticker || '').toUpperCase() === String(item?.ticker || '').toUpperCase())) merged.push(item); const next = { ...(state || {}), market: { ...(state?.market || {}), indices: merged, timestamp: fallback.timestamp, source: state?.market?.source || fallback.source } }; if (env.ML_KV) await env.ML_KV.put('state/latest', JSON.stringify(next), { expirationTtl: 3600 }); return next; } catch(e) { console.error('ensureBotState failed',e); return null; }
}
export default {
  async scheduled(event, env, ctx) {
    const started=Date.now(),run={startedAt:new Date().toISOString(),phases:[],errors:[],status:'RUNNING'};
    try { const refreshed=await refreshBotState(env,ctx,new Request('https://miracolo.local/api/live')); if(!refreshed.ok)run.errors.push(refreshed.error); const state=refreshed.state||await ensureBotState(env); const result=await runAutoPaperBot(env); const rec=await recordSignals(env,result,state||{}); const report=await evaluateSignals(env,state||{}, {records:rec.records,report:rec.report}); run.phases.push({name:'evaluation',recorded:rec.recorded,recordId:rec.recordId,modules:Object.values(report.horizons||{}).reduce((n,h)=>n+Object.keys(h).length,0)}); run.status=result?.ok?'OK':'NO_DATA'; } catch(e) { run.status='ERROR'; run.errors.push(String(e.message||e)); console.error('live-worker scheduled failed',e); }
    run.completedAt=new Date().toISOString();run.durationMs=Date.now()-started;await writeRun(env,run);
  },
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/alpaca/')) { const response = await alpacaRequest(request, env); if (response) return response; }
    if (url.pathname === '/api/bot/crypto') { try { return Response.json({ ok: true, mode:'PAPER', ...await getCryptoDecision(env) }, { headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' } }); } catch (e) { return Response.json({ ok: false, mode:'PAPER', error: String(e.message || e) }, { status: 502, headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' } }); } }
    if (url.pathname === '/api/bot/decision') { const decision = await getBotDecision(env); if (!decision) return Response.json({ ok: false, mode:'PAPER', status: 'NO_DATA', message: 'Nessuna decisione server disponibile. Attendi la prima scansione.' }, { status: 503, headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' } }); return Response.json({ ok: true, ...decision }, { headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' } }); }
    if (url.pathname === '/api/bot/market-test') { try { const u = new URL(request.url); u.pathname = '/api/live'; u.search = '?bot_market_test=' + Date.now(); const r = await aiWorker.fetch(new Request(u.toString(), { method: 'GET', headers: { Accept: 'application/json', 'Cache-Control': 'no-cache', Pragma: 'no-cache' } }), env, ctx); const live = await r.json(); const alpaca = await refreshAlpacaEquities(env, live); const yahoo = await seedBotMarket(); return Response.json({ ok: true, alpaca: { ok: alpaca.ok, added: alpaca.added, error: alpaca.error || null }, yahoo: { count: yahoo.indices.length, coverage: yahoo.coverage, failures: yahoo.failures }, liveMarketCount: Array.isArray(live?.market?.indices) ? live.market.indices.length : 0 }, { headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' } }); } catch (e) { return Response.json({ ok: false, error: String(e.message || e) }, { status: 500, headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' } }); } }
    if (url.pathname === '/api/bot/plan') { try { await refreshBotState(env, ctx, request); await ensureBotState(env); return Response.json(await runAutoPaperBot(env, { execute: false }), { headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' } }); } catch (e) { return Response.json({ ok: false, mode:'PAPER', status: 'ERROR', error: String(e.message || e) }, { status: 500, headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' } }); } }
    if (url.pathname === '/api/bot/run') { if (request.method !== 'POST') return Response.json({ ok: false, error: 'POST richiesto' }, { status: 405 }); try { const refreshed=await refreshBotState(env,ctx,request); const state=refreshed.state||await ensureBotState(env); const result=await runAutoPaperBot(env); const rec=await recordSignals(env,result,state||{}); const report=await evaluateSignals(env,state||{}, {records:rec.records,report:rec.report}); return Response.json({...result,evaluation:{recorded:rec.recorded,recordId:rec.recordId,horizons:report.horizons}},{headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}}); } catch (e) { return Response.json({ ok: false, mode:'PAPER', status: 'ERROR', error: String(e.message || e) }, { status: 500, headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' } }); } }
    if (url.pathname === '/api/live') { const response = await aiWorker.fetch(request, env, ctx); const data = await response.json(); return Response.json(slimLive(data), { status: response.status, headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' } }); }
    return aiWorker.fetch(request, env, ctx);
  }
};
