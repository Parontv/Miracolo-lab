import aiWorker, { runAI } from './ai-worker.js';
import { runAutoPaperBot } from './bot-paper-auto.js';
import { runBot, getBotDecision } from './bot-server-engine.js';
import { getCryptoDecision } from './bot-crypto-engine.js';
import { runCryptoPaperCycle, getCryptoPaperStatus } from './bot-crypto-paper.js';
import { alpacaRequest } from './alpaca-paper.js';
import { refreshAlpacaEquities } from './alpaca-market-fallback.js';
import { seedBotMarket } from './bot-market-seed.js';
import { refreshNewsAndMacro, refreshFredOnly } from './bot-context-enrichment.js';
import { recordSignals, evaluateSignals, getEvalReport } from './bot-evaluation.js';
import { getHummingbotOverview } from './hummingbot-adapter.js';
import { reconcileFilledOrders, flattenAlpacaOrders } from './bot-pnl-reconciliation.js';
import { assessPositionRisk } from './bot-position-risk.js';
import { refreshBinanceOrderFlow } from './bot-order-flow.js';
import { runAlpacaCryptoPaperSmokeTest, getAlpacaCryptoPaperSmokeReport } from './alpaca-crypto-paper-test.js';

const STATE='state/latest',LAST='bot/last-run',BTC_POSITION='bot/positions/btc',QUANT='quantitative/latest-v2',JOURNAL='bot/journal/v1';
async function read(env,key,f=null){try{const v=await env.ML_KV?.get(key);return v?JSON.parse(v):f}catch(error){console.error(`KV read failed: ${key}`,error);return f}}
async function write(env,key,v,ttl=3600){try{if(!env.ML_KV)return false;await env.ML_KV.put(key,JSON.stringify(v),{expirationTtl:ttl});return true}catch(e){console.warn('KV write skipped',key,String(e?.message||e).slice(0,120));return false}}
function decisionFresh(data){const modules=Array.isArray(data?.modules)?data.modules:[],macro=modules.find(m=>m.family==='macro'&&m.dataAvailable&&m.freshness==='fresh'),ai=modules.find(m=>m.family==='ai'&&m.dataAvailable&&m.freshness==='fresh'),flow=modules.find(m=>m.family==='flow');const now=Date.now(),macroUntil=Date.parse(macro?.freshUntil||'')||0,aiAt=Date.parse(ai?.asOf||'')||0,flowUntil=Date.parse(flow?.freshUntil||'')||0;return Boolean(macroUntil>now&&aiAt>now-60*60*1000&&aiAt<=now+60000&&flow&&flowUntil>now)}
function slim(data){const out={...data};if(out.universe&&typeof out.universe==='object'){const{tickers,...u}=out.universe;out.universe=u}if(out.news&&typeof out.news==='object')out.news={...out.news,items:Array.isArray(out.news.items)?out.news.items.slice(0,120):[]};return out}
async function marketPhase(env){const state=await read(env,STATE,{phase:'bot'});const p={name:'market',fetches:0,errors:[]};const a=await refreshAlpacaEquities(env,state);p.fetches++;if(!a.ok)p.errors.push(a.error||'Alpaca unavailable');let next=a.ok?a.state:state;const y=await seedBotMarket();p.fetches+=y.fetchCount||1;if(!y.indices.length)p.errors.push(...(y.failures||[]).map(x=>x.error));const rows=Array.isArray(next?.market?.indices)?next.market.indices:[];const map=new Map(rows.map(x=>[String(x?.ticker||'').toUpperCase(),x]));for(const x of y.indices)map.set(String(x.ticker).toUpperCase(),x);next={...next,market:{...(next.market||{}),indices:[...map.values()],timestamp:new Date().toISOString(),source:a.ok?'Alpaca + Yahoo batch':'Yahoo Finance batch'}};await write(env,STATE,next);return{state:next,phase:p}}
async function contextPhase(env,state){
 const p={name:'context',fetches:0,errors:[],warnings:[]};
 const [r,orderFlow]=await Promise.all([refreshNewsAndMacro(),refreshBinanceOrderFlow()]);
 p.fetches=(r.fetches||0)+(orderFlow.fetches||0);
 if(r.errors?.length)p.errors.push(...r.errors);
 if(orderFlow.status!=='ok')p.warnings.push('Order Flow Binance: '+(orderFlow.errors||[]).map(x=>x.reason).join(' · '));
 let newsItems=r.news?.items||[],quantData=r.quantitative;
 if(!quantData?.groups?.macro?.length||quantData?.coverage?.available===0){const cachedQuant=await read(env,QUANT,null);if(cachedQuant?.groups?.macro?.length){quantData=cachedQuant;p.warnings.push('FRED macro live fallback: utilizzati dati quantitativi in cache');}}
 if(!newsItems.length){const cachedState=await read(env,STATE,{});if(Array.isArray(cachedState?.news?.items)&&cachedState.news.items.length){newsItems=cachedState.news.items;p.warnings.push('News RSS live fallback: utilizzate notizie in cache');}}
 const marketRows=Array.isArray(state?.market?.indices)?state.market.indices:[],changes=marketRows.map(x=>Number(x.changePct)).filter(Number.isFinite),avg=changes.length?changes.reduce((a,b)=>a+b,0)/changes.length:0,aiDirection=Math.abs(avg)>=.5?Math.sign(avg):0;
 const enriched={...state,news:{...(state.news||{}),...(r.news||{}),items:newsItems},market:{...(state.market||{}),quantitative:quantData,orderFlow},ai:state?.ai||{status:'fallback',model:'Miracolo deterministic context',direction:aiDirection,confidence:aiDirection?62:50,regime:avg>0.5?'risk-on':avg<-0.5?'risk-off':'neutral',thesis:`Contesto automatico: variazione media equity ${avg.toFixed(2)}% su ${changes.length} strumenti.`,generatedAt:new Date().toISOString()},backtest:null};
 await write(env,STATE,enriched);if(quantData?.coverage?.available>0)await write(env,QUANT,quantData,604800);
 return{state:enriched,phase:p};
}
async function cryptoPhase(env){const p={name:'crypto',fetches:3,errors:[]};const c=await getCryptoDecision(env,{force:true});if(!c.dataAvailable)p.errors.push(c.reason||'BTC unavailable');await write(env,'bot/crypto/latest',c,600);return{crypto:c,phase:p}}
async function positionPhase(env){const p={name:'position',fetches:0,errors:[]};try{const key=env?.ALPACA_API_KEY,secret=env?.ALPACA_API_SECRET;if(!key||!secret)throw Error('Alpaca credentials missing');const headers={'APCA-API-KEY-ID':key,'APCA-API-SECRET-KEY':secret,'Accept':'application/json'};const [pr,or]=await Promise.all([fetch('https://paper-api.alpaca.markets/v2/positions',{headers}),fetch('https://paper-api.alpaca.markets/v2/orders?status=open&nested=true&limit=500',{headers})]);p.fetches=2;if(!pr.ok||!or.ok)throw Error('Alpaca risk reconciliation HTTP positions='+pr.status+' orders='+or.status);const rows=await pr.json(),orders=await or.json();if(!Array.isArray(rows)||!Array.isArray(orders))throw Error('Alpaca positions/orders response shape non valida: riconciliazione bloccata.');const raw=rows.map(x=>({symbol:x.symbol,qty:Number(x.qty||0),side:x.side||'long',avg_entry_price:Number(x.avg_entry_price||0),notional:Math.abs(Number(x.market_value||0)),marketValue:Number(x.market_value||0),unrealizedPl:Number(x.unrealized_pl||0)})),positions=assessPositionRisk(raw,orders),btc=positions.find(x=>String(x?.symbol||'').toUpperCase().replace(/[^A-Z0-9]/g,'')==='BTCUSD');p.verified=positions.filter(x=>x.riskVerified).length;p.unknown=positions.filter(x=>!x.riskVerified).length;await write(env,'bot/positions/v1',positions,600);await write(env,BTC_POSITION,btc?{qty:btc.qty,marketValue:btc.marketValue,unrealizedPl:btc.unrealizedPl,risk:btc.risk,riskVerified:btc.riskVerified}:null,600)}catch(e){p.errors.push(String(e.message||e));console.error('position phase failed',e)}return p}
async function journalOrder(env,result,signalId,preloaded=[]){const ex=result?.execution;if(!ex?.executed||!ex?.orderId)return null;const rows=Array.isArray(preloaded)?preloaded:[],entry={orderId:ex.orderId,symbol:ex.symbol,side:ex.side||ex.action,notional:Number(ex.notional||0),signalRecordId:signalId||null,time:new Date().toISOString()};const next=[...rows.filter(x=>x?.orderId!==entry.orderId),entry].slice(-200);await write(env,JOURNAL,next,30*24*3600);return entry}
async function syncJournal(env){
 const p={name:'journal',fetches:0,errors:[]};
 try{
  const key=env?.ALPACA_API_KEY,secret=env?.ALPACA_API_SECRET;
  if(!key||!secret)throw Error('Alpaca credentials missing');
  const r=await fetch('https://paper-api.alpaca.markets/v2/orders?status=all&nested=true&limit=500&direction=desc',{headers:{'APCA-API-KEY-ID':key,'APCA-API-SECRET-KEY':secret,'Accept':'application/json'}});
  p.fetches++;
  if(!r.ok)throw Error('Alpaca orders HTTP '+r.status);
  const orders=await r.json();if(!Array.isArray(orders))throw Error('Alpaca orders response shape non valida: journal sync bloccato.');const old=await read(env,JOURNAL,[]),rows=Array.isArray(old)?old:[],byId=new Map(rows.filter(x=>x?.orderId).map(x=>[String(x.orderId),x]));
  const reconciliation=reconcileFilledOrders(orders,{limit:500});
  let imported=0,updated=0,knownRealized=0,unknownRealized=0;
  for(const o of flattenAlpacaOrders(orders)){
   if(!o?.id)continue;
   const id=String(o.id),prev=byId.get(id)||{},status=String(o.status||prev.status||'unknown').toLowerCase();
   const filledQty=Number(o.filled_qty||0),filled=filledQty>0,terminal=['filled','canceled','cancelled','rejected','expired'].includes(status);
   const side=String(o.side||prev.side||'').toLowerCase(),fill=reconciliation.byOrderId.get(id);
   const fillPrice=Number(o.filled_avg_price)>0?Number(o.filled_avg_price):null;
   const exit=side==='sell';
   const realized=exit?(fill?.realizedGross??null):null;
   const realizedStatus=exit?(fill?.realizedStatus||'UNKNOWN_FILL_DATA'):'NOT_AN_EXIT';
   if(exit&&realized!==null)knownRealized++;else if(exit&&terminal)unknownRealized++;
   const entry={
    ...prev,
    orderId:id,
    clientOrderId:o.client_order_id||prev.clientOrderId||null,
    symbol:o.symbol||prev.symbol,
    side:o.side||prev.side,
    parentOrderId:o.parent_order_id||prev.parentOrderId||null,
    groupId:o.group_id||prev.groupId||null,
    groupRole:o.group_role||prev.groupRole||null,
    notional:Number(o.notional||prev.notional||(filledQty&&fillPrice?filledQty*fillPrice:0)),
    qty:filled?filledQty:Number(o.qty||prev.qty||0),
    filledQty:filledQty||0,
    status,
    fillPrice:fillPrice??prev.fillPrice??null,
    filledAt:o.filled_at||prev.filledAt||null,
    updatedAt:o.updated_at||new Date().toISOString(),
    time:prev.time||o.submitted_at||o.created_at||new Date().toISOString(),
    orderCompletedAt:terminal?(o.filled_at||o.updated_at||new Date().toISOString()):prev.orderCompletedAt||null,
    closedAt:exit&&terminal?(o.filled_at||o.updated_at||new Date().toISOString()):exit?(prev.closedAt||null):null,
    realized,
    pnl:null,
    pnlNet:null,
    realizedStatus,
    realizedBasis:exit?'GROSS_BEFORE_FEES':null,
    reconciliationHistoryComplete:reconciliation.historyComplete
   };
   if(!prev.orderId)imported++;else if(JSON.stringify(prev)!==JSON.stringify(entry))updated++;
   byId.set(id,entry);
  }
  const next=[...byId.values()].slice(-500);
  p.imported=imported;p.updated=updated;p.realizedKnown=knownRealized;p.realizedUnknown=unknownRealized;p.historyComplete=reconciliation.historyComplete;p.processedFills=reconciliation.processedFills;
  if(JSON.stringify(next)!==JSON.stringify(rows))await write(env,JOURNAL,next,30*24*3600);
 }catch(e){p.errors.push(String(e.message||e));console.error('journal sync failed',e)}
 return p;
}
async function evaluationPhase(env,result,state){const started=Date.now(),phase={name:'evaluation',fetches:0,errors:[],durationMs:0};try{const rec=await recordSignals(env,result,state),report=await evaluateSignals(env,state,{records:rec.records,report:rec.report});phase.recorded=rec.recorded;phase.recordId=rec.recordId;phase.modules=Object.values(report.horizons||{}).reduce((n,h)=>n+Object.keys(h).length,0);phase.durationMs=Date.now()-started;return{phase,report,preloadedJournal:rec.journal}}catch(e){phase.errors.push(String(e.message||e));phase.durationMs=Date.now()-started;console.error('evaluation phase failed',e);return{phase,report:null,preloadedJournal:[]}}}
async function buildLiveBotState(env){const m=await marketPhase(env);const c=await cryptoPhase(env);const x=await contextPhase(env,m.state);const ai=await runAI(env,false,x.state);return{...x.state,ai:ai||x.state.ai,crypto:c.crypto}}
async function refreshRiskState(env){const[position,journal]=await Promise.all([positionPhase(env),syncJournal(env)]);const errors=[...(position.errors||[]),...(journal.errors||[])];return{ok:errors.length===0,errors,position,journal}}
async function buildLiveBotDecision(env){const riskState=await refreshRiskState(env);if(!riskState.ok)return{ok:false,mode:'PAPER',status:'NO_DATA',engine:'bot-server-engine',decision:{direction:0,confidence:0,coverage:0,dataCoverage:0,agreement:0,score:0,contributors:[],evidence:[],asOf:new Date().toISOString(),reason:'Riconciliazione posizioni/ordini non riuscita: esecuzione bloccata.'},modules:[],riskReconciliation:riskState};return await runBot(env,await buildLiveBotState(env))}
export default {
 async scheduled(event,env,ctx){if(event?.cron==='*/1 * * * *'){try{const result=await runCryptoPaperCycle(env);await write(env,'crypto/paper/heartbeat',{at:new Date().toISOString(),ok:result.ok,cycles:result.state.cycles,available:result.state.lastCycle?.available||0,total:result.state.lastCycle?.total||0},86400)}catch(e){await write(env,'crypto/paper/heartbeat',{at:new Date().toISOString(),ok:false,error:String(e.message||e)},86400);console.error('Crypto PAPER cron failed',e)}return}const started=Date.now(),run={startedAt:new Date().toISOString(),phases:[],fetches:0,errors:[],status:'RUNNING'};try{const m=await marketPhase(env);run.phases.push(m.phase);run.fetches+=m.phase.fetches;run.errors.push(...m.phase.errors);const c=await cryptoPhase(env);run.phases.push(c.phase);run.fetches+=c.phase.fetches;run.errors.push(...c.phase.errors);const x=await contextPhase(env,m.state);run.phases.push(x.phase);run.fetches+=x.phase.fetches;run.errors.push(...x.phase.errors);const ai=await runAI(env,false,x.state);run.phases.push({name:'ai',fetches:ai?.status==='ok'?1:0,status:ai?.status==='ok'?'OK':ai?.status==='cached'||ai?.status==='stale'?'CACHED':'FALLBACK',model:ai?.model||null,reason:ai?.fallbackReason||ai?.lastError||null});const botState={...x.state,ai:ai||x.state.ai,crypto:c.crypto};const pos=await positionPhase(env);run.phases.push(pos);run.fetches+=pos.fetches;run.errors.push(...pos.errors);const journal=await syncJournal(env);run.phases.push(journal);run.fetches+=journal.fetches;run.errors.push(...journal.errors);
  /* FIX: chiamare runBot() direttamente nel cron — non leggere dalla cache che potrebbe essere vuota */
  const reconciliationFailed=pos.errors.length>0||journal.errors.length>0;const botResult=reconciliationFailed?{ok:false,decision:{reason:'Position/order reconciliation failed: automatic execution blocked to avoid stale risk state.'}}:await runBot(env,botState);
  run.phases.push({name:'decision',fetches:0,status:botResult?.ok?'OK':'NO_DATA',direction:botResult?.decision?.direction??null,confidence:botResult?.decision?.confidence??null});
  if(!botResult?.ok){run.errors.push('Bot decision unavailable: '+( botResult?.decision?.reason||'NO_DATA'));run.status='NO_DATA'}
  else{const executed=await runAutoPaperBot(env,{stateOverride:botState,decisionOverride:botResult});const ev=await evaluationPhase(env,executed,botState);run.phases.push(ev.phase);run.fetches+=ev.phase.fetches;run.errors.push(...ev.phase.errors);await journalOrder(env,executed,ev.phase.recordId,ev.preloadedJournal);run.status='OK'}
 }catch(e){run.status='ERROR';run.errors.push(String(e.message||e));console.error('Bot cron failed',e)}run.completedAt=new Date().toISOString();run.durationMs=Date.now()-started;await write(env,LAST,run,86400)},
 async fetch(request,env,ctx){const u=new URL(request.url);
  /* === API routes === */
  if(u.pathname==='/api/hummingbot/overview'){if(request.method!=='GET')return Response.json({ok:false,error:'Metodo non consentito: usare GET.'},{status:405,headers:{'Allow':'GET','Cache-Control':'no-store'}});const result=await getHummingbotOverview(env);return Response.json(result,{status:result.ok?200:503,headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}})}
  if(u.pathname.startsWith('/api/alpaca/')){const r=await alpacaRequest(request,env);if(r)return r}
  if(u.pathname==='/api/bot/crypto')return Response.json({ok:true,mode:'PAPER',...await getCryptoDecision(env)});
  if(u.pathname==='/api/crypto-bot/alpaca-paper-test'){
   if(request.method==='GET'){const report=await getAlpacaCryptoPaperSmokeReport(env);return Response.json({ok:true,mode:'PAPER',report},{headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}})}
   if(request.method!=='POST')return Response.json({ok:false,error:'Metodo non consentito.'},{status:405,headers:{'Allow':'GET, POST','Cache-Control':'no-store'}});
   if(request.headers.get('Origin')!==new URL(request.url).origin||request.headers.get('X-Miracolo-Paper-Confirm')!=='PAPER')return Response.json({ok:false,error:'Test rifiutato: origine o conferma PAPER non valida.'},{status:403});
   let body={};try{body=await request.json()}catch{return Response.json({ok:false,error:'Payload JSON non valido.'},{status:400})}
   if(body?.confirm!=='ALPACA_CRYPTO_PAPER_TEST')return Response.json({ok:false,error:'Conferma test mancante.'},{status:400});
   try{const report=await runAlpacaCryptoPaperSmokeTest(env);return Response.json({ok:report.ok,mode:'PAPER',report},{status:report.ok?200:409,headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}})}
   catch(e){return Response.json({ok:false,mode:'PAPER',error:String(e.message||e)},{status:502,headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}})}
  }
  if(u.pathname==='/api/crypto-bot/status'){if(request.method!=='GET')return Response.json({ok:false,error:'Metodo non consentito: usare GET.'},{status:405,headers:{'Allow':'GET','Cache-Control':'no-store'}});const [status,heartbeat]=await Promise.all([getCryptoPaperStatus(env),read(env,'crypto/paper/heartbeat',null)]);return Response.json({...status,heartbeat},{headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}})}
  if(u.pathname==='/api/bot/order-flow'){if(request.method!=='GET')return Response.json({ok:false,error:'Metodo non consentito: usare GET.'},{status:405,headers:{'Allow':'GET','Cache-Control':'no-store'}});const state=await read(env,STATE,{}),snapshot=state?.market?.orderFlow;if(!snapshot)return Response.json({ok:false,mode:'READ_ONLY',status:'NO_DATA',message:'Nessuno snapshot Order Flow: avvia una scansione del bot.'},{status:503,headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}});return Response.json({ok:snapshot.status==='ok',mode:'READ_ONLY',...snapshot},{headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}})}
  if(u.pathname==='/api/bot/fred-diagnostic'){const cached=await read(env,QUANT,null);const cachedRows=Array.isArray(cached?.groups?.macro)?cached.groups.macro:[];try{const context=await Promise.race([refreshFredOnly(),new Promise((_,reject)=>setTimeout(()=>reject(Error('Diagnostica FRED timeout dopo 12000 ms')),12000))]);const q=context?.quantitative||{};const allRows=Array.isArray(q.groups?.macro)?q.groups.macro:[];const liveRows=allRows.filter(x=>x.provider==='FRED live');const observations=allRows.length?allRows:cachedRows;if(allRows.length)await write(env,QUANT,q,604800);return Response.json({ok:true,source:q.source||cached?.source||'FRED',provider:q.provider||'direct/proxy',timestamp:q.timestamp||context.timestamp||cached?.timestamp||new Date().toISOString(),cached:allRows.some(x=>x.provider!=='FRED live')||!liveRows.length,coverage:q.coverage||{available:0,total:8},observationCount:observations.length,liveObservationCount:liveRows.length,observations:observations.map(x=>({series:x.series,label:x.label,value:x.value,previous:x.previous,change:x.change,changePct:x.changePct,asOf:x.asOf,status:x.status})),errors:context.errors||[],seriesErrors:q.errors||[],seriesResults:context.seriesResults||q.seriesResults||[],mirrorAvailable:allRows.some(x=>x.provider==='GitHub Actions mirror fallback'),cacheAvailable:Boolean(cachedRows.length),cacheTimestamp:cached?.timestamp||null,cacheObservationCount:cachedRows.length},{headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}})}catch(e){return Response.json({ok:Boolean(cachedRows.length),source:'FRED',error:String(e.message||e),observationCount:cachedRows.length,observations:cachedRows.map(x=>({series:x.series,label:x.label,value:x.value,previous:x.previous,change:x.change,changePct:x.changePct,asOf:x.asOf,status:x.status})),cached:Boolean(cachedRows.length),cacheAvailable:Boolean(cachedRows.length),cacheTimestamp:cached?.timestamp||null,cacheObservationCount:cachedRows.length},{status:cachedRows.length?200:504,headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}})}}if(u.pathname==='/api/bot/decision'){const cachedDecision=await getBotDecision(env);const age=Date.now()-(Date.parse(cachedDecision?.diagnostics?.generatedAt||cachedDecision?.decision?.asOf||'')||0);const researchPayloadReady=data=>Boolean(data?.researchCouncil?.aiResearch&&Array.isArray(data?.researchAdapters)&&data?.vibeTradingResearch&&data?.freqtradeBacktest&&data?.llmTradingLab&&data?.dayTraderSkill&&data?.dailyStockAnalysis&&data?.aiHedgeFundResearch);if(cachedDecision&&age<15*60*1000&&decisionFresh(cachedDecision)&&researchPayloadReady(cachedDecision))return Response.json({ok:true,...cachedDecision},{headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}});const edgeCache=globalThis.caches?.default||null;const cacheKey=new Request(new URL('/__internal/bot-decision-fallback',request.url).toString(),{method:'GET'});if(edgeCache){try{const hit=await edgeCache.match(cacheKey);if(hit){const data=await hit.json();if(data?.ok&&decisionFresh(data)&&researchPayloadReady(data))return Response.json(data,{headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*','X-ML-Decision-Source':'edge-cache'}})}}catch{}}try{const fresh=await buildLiveBotDecision(env);const payload={...fresh,ok:Boolean(fresh?.ok),diagnostics:{...(fresh?.diagnostics||{}),liveFallback:true,generatedAt:new Date().toISOString(),reason:'Rebuilt live because the KV decision was stale or missing required modules, including research sidecars.'}};if(edgeCache){try{ctx.waitUntil(edgeCache.put(cacheKey,Response.json(payload,{headers:{'Cache-Control':'max-age=300','Content-Type':'application/json'}})))}catch{}}return Response.json(payload,{headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*','X-ML-Decision-Source':'live-fallback'}})}catch(e){return cachedDecision?Response.json({ok:true,...cachedDecision,diagnosticError:String(e.message||e)},{headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}}):Response.json({ok:false,mode:'PAPER',status:'NO_DATA',error:String(e.message||e),message:'Decision cache assente e ricostruzione live non riuscita.'},{status:503,headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}})}}if(u.pathname==='/api/bot/eval')return Response.json({ok:true,mode:'PAPER',...(await getEvalReport(env))},{headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}});
  if(u.pathname==='/api/bot/health'){const lastRun=await read(env,LAST,null),botMode=String(env?.BOT_MODE||'PAPER').toUpperCase(),autoExecutionEnabled=botMode==='PAPER'&&String(env?.PAPER_AUTO_EXECUTION||'false').toLowerCase()==='true';return Response.json({ok:true,mode:botMode,autoExecutionEnabled,paperCapital:2000,paperNotional:Number(env?.PAPER_NOTIONAL||100),riskPerTradeUsd:Number(env?.PAPER_RISK_PER_TRADE_USD||8),stopLossPct:Number(env?.PAPER_STOP_LOSS_PCT||1.5),takeProfitPct:Number(env?.PAPER_TAKE_PROFIT_PCT||3),maxTradesPerDay:Number(env?.PAPER_MAX_TRADES_PER_DAY||env?.PAPER_MAX_BUYS_PER_DAY||3),maxPositions:Number(env?.PAPER_MAX_POSITIONS||3),lastCronAt:lastRun?.startedAt||null,lastRun});}
  if(u.pathname==='/api/bot/market-test'){const state=await read(env,STATE,{}),a=await refreshAlpacaEquities(env,state),y=await seedBotMarket();return Response.json({ok:true,fetches:2,alpaca:{ok:a.ok,added:a.added,error:a.error||null},yahoo:{count:y.indices.length,coverage:y.coverage,failures:y.failures}})}
  if(u.pathname==='/api/bot/plan'){const riskState=await refreshRiskState(env);if(!riskState.ok)return Response.json({ok:false,mode:'PAPER',status:'NO_DATA',execution:{executed:false,blocked:true,reason:'Riconciliazione posizioni/ordini non riuscita.'},riskReconciliation:riskState},{status:503,headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}});const state=await buildLiveBotState(env);return Response.json(await runAutoPaperBot(env,{execute:false,stateOverride:state}),{headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}})}
  if(u.pathname==='/api/bot/run'){if(request.method!=='POST')return Response.json({ok:false,error:'POST richiesto'},{status:405});const riskState=await refreshRiskState(env);if(!riskState.ok)return Response.json({ok:false,mode:'PAPER',status:'NO_DATA',execution:{executed:false,blocked:true,reason:'Riconciliazione posizioni/ordini non riuscita.'},riskReconciliation:riskState},{status:503,headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}});const state=await buildLiveBotState(env),result=await runAutoPaperBot(env,{stateOverride:state}),ev=await evaluationPhase(env,result,state);await journalOrder(env,result,ev.phase.recordId,ev.preloadedJournal);return Response.json({...result,evaluation:ev.phase},{headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}})}
  if(u.pathname==='/api/live'){const r=await aiWorker.fetch(request,env,ctx);return Response.json(slim(await r.json()),{status:r.status})}
  /* === Static assets: serve da ASSETS binding (cartella ./public) === */
  if(env.ASSETS){try{const r=await env.ASSETS.fetch(request);if(r.status!==404)return r}catch{}}
  /* fallback al legacy aiWorker per le rotte non trovate */
  return aiWorker.fetch(request,env,ctx)}};
