/* Optional Cloudflare Workers AI research layer.
 * Strictly advisory: grounded only in current payload; never influences consensus,
 * risk approval, or order execution. Disabled gracefully when AI binding is absent.
 */
const MODEL='@cf/meta/llama-3.1-8b-instruct';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function safeText(value,max=500){return String(value??'').replace(/[\u0000-\u001f]/g,' ').slice(0,max)}
function parseJson(text){
 const raw=String(text??'').trim().replace(/^\u0060\u0060\u0060(?:json)?/i,'').replace(/\u0060\u0060\u0060$/,'').trim();
 try{return JSON.parse(raw)}catch{}
 const start=raw.indexOf('{'),end=raw.lastIndexOf('}');
 if(start>=0&&end>start){try{return JSON.parse(raw.slice(start,end+1))}catch{}}
 return null;
}
function compactEvidence(modules){
 return modules.filter(x=>x?.dataAvailable).map(x=>({
  family:safeText(x.family,40),direction:clamp(Number(x.direction)||0,-1,1),
  confidence:clamp(Number(x.confidence)||0,0,100),
  evidence:(Array.isArray(x.evidence)?x.evidence:[]).slice(0,3).map(v=>safeText(v,180))
 })).slice(0,12);
}
export async function runAIResearchCouncil(env,{state={},modules=[],decision={},risk={}}={}){
 const generatedAt=new Date().toISOString();
 if(!env?.AI?.run)return{status:'DISABLED',model:MODEL,generatedAt,reason:'Workers AI binding non disponibile; analisi LLM saltata.'};
 const evidence=compactEvidence(modules);
 if(!evidence.length)return{status:'INSUFFICIENT_DATA',model:MODEL,generatedAt,reason:'Nessuna evidenza numerica o testuale valida da passare al modello.'};
 const prompt=[
 'Sei un analista finanziario prudente. Produci SOLO JSON valido, senza markdown.',
 'Analizza esclusivamente le evidenze fornite. Non inventare prezzi, notizie, fonti, indicatori o date.',
 'Non formulare ordini. Non modificare consenso, risk review o esecuzione. Se evidenza insufficiente, usa INSUFFICIENT_DATA.',
 'Schema: {"stance":"BULLISH|BEARISH|MIXED|NEUTRAL|INSUFFICIENT_DATA","confidence":0-100,"summary":"max 450 caratteri","bullCase":"max 250 caratteri","bearCase":"max 250 caratteri","risks":["..."],"missingData":["..."],"evidenceFamilies":["family"]}',
 'Decisione quantitativa già calcolata (solo contesto): '+JSON.stringify({direction:decision.direction,score:decision.score,coverage:decision.dataCoverage,confidence:decision.confidence}),
 'Risk gate (non modificarlo): '+JSON.stringify({allowed:risk.allowed,reason:risk.reason,flags:risk.flags}),
 'Evidenze attuali: '+JSON.stringify(evidence),
 'Timestamp dati: '+safeText(state?.market?.timestamp||'non disponibile',80)
 ].join('\n');
 try{
  const response=await env.AI.run(MODEL,{messages:[{role:'system',content:'Return concise, grounded JSON only.'},{role:'user',content:prompt}],max_tokens:500,temperature:0.1});
  const parsed=parseJson(response?.response??response?.result??response);
  const valid=['BULLISH','BEARISH','MIXED','NEUTRAL','INSUFFICIENT_DATA'].includes(String(parsed?.stance||'').toUpperCase())&&Number.isFinite(Number(parsed?.confidence))&&typeof parsed?.summary==='string';
  if(!valid)return{status:'INVALID_OUTPUT',model:MODEL,generatedAt,reason:'Il modello ha restituito un formato non valido; output escluso.',rawPreview:safeText(response?.response??response?.result??'',160)};
  return{status:'ok',model:MODEL,generatedAt,stance:String(parsed.stance).toUpperCase(),confidence:clamp(Number(parsed.confidence),0,100),summary:safeText(parsed.summary,450),bullCase:safeText(parsed.bullCase,250),bearCase:safeText(parsed.bearCase,250),risks:Array.isArray(parsed.risks)?parsed.risks.slice(0,5).map(x=>safeText(x,180)):[],missingData:Array.isArray(parsed.missingData)?parsed.missingData.slice(0,5).map(x=>safeText(x,180)):[],evidenceFamilies:Array.isArray(parsed.evidenceFamilies)?parsed.evidenceFamilies.slice(0,12).map(x=>safeText(x,40)):[],advisoryOnly:true,affectsConsensus:false,affectsRiskGate:false,affectsOrders:false};
 }catch(error){return{status:'ERROR',model:MODEL,generatedAt,reason:'Workers AI non disponibile o errore di inferenza.',detail:safeText(error?.message||error,180),advisoryOnly:true,affectsConsensus:false,affectsRiskGate:false,affectsOrders:false}}
}
