/* Miracolo Lab — unified Bot pipeline adapters.
 * Deterministic, analysis/PAPER only. No broker execution.
 */
import { toNum, fuse } from './bot-decision-core-v1.js';

const EQUITY_NAMES=/SP500|S&P|NASDAQ|DOW|RUSSELL|DAX|CAC|FTSE|NIKKEI|TOPIX|HANG|KOSPI|EUROSTOXX|IBEX|SMI|AEX|MSCI|FTSE MIB|MIB/i;
const VIX=/\bVIX\b/i;
const NEGATIONS=/\b(no|not|without|fails?|failed|falling|falls?|decline|declining|miss|missed|weak|weakness|cuts?|cut)\b/i;
const POSITIVE=/\b(rally|surge|beat|beats|upgrade|inflow|record|growth|easing|rate cut|strong|bullish|breakout)\b/gi;
const NEGATIVE=/\b(crash|plunge|selloff|outflow|downgrade|recession|default|hawkish|rate hike|panic|weak|decline|fall|bearish|miss)\b/gi;

function ageHours(value, now=Date.now()) { const t=Date.parse(value||''); return t ? Math.max(0,(now-t)/3600000) : Infinity; }
function decay(age, halfLife=12) { return Number.isFinite(age) ? Math.pow(.5,age/halfLife) : 0; }
function signWithNegation(text, regex) { const s=String(text||'').toLowerCase(); const m=s.match(regex); if(!m)return 0; const before=s.slice(Math.max(0,(m.index||0)-28),m.index||0); return NEGATIONS.test(before)?-1:1; }

export function marketVote(indices=[]) {
  const rows=(Array.isArray(indices)?indices:[]).map(x=>({x,change:toNum(x?.changePct)})).filter(r=>r.change!==null);
  const equities=rows.filter(({x})=>EQUITY_NAMES.test(String(x?.name||x?.ticker||''))&&!VIX.test(String(x?.name||x?.ticker||'')));
  if(equities.length<3)return{family:'market',direction:0,strength:0,confidence:0,coverage:0,evidence:[],asOf:null,reason:'NO DATA — meno di 3 indici azionari validi'};
  const avg=equities.reduce((s,r)=>s+r.change,0)/equities.length;
  const vixRow=rows.find(r=>VIX.test(String(r.x?.name||r.x?.ticker||'')));
  const vix=vixRow?.change??null;
  const riskAdjusted=avg-(vix!==null?Math.max(0,vix)*.05:0);
  const direction=Math.abs(riskAdjusted)>=.15?Math.sign(riskAdjusted):0;
  return{family:'market',direction,strength:Math.min(1,Math.abs(riskAdjusted)/1.5),confidence:Math.round(50+Math.min(40,Math.abs(riskAdjusted)*15)),coverage:Math.min(1,equities.length/20),evidence:[`media azionaria ${avg.toFixed(2)}%`,vix===null?'VIX NO DATA':`VIX ${vix.toFixed(2)}% · peso separato`],asOf:rows.map(r=>r.x?.asOf).filter(Boolean).sort().at(-1)||new Date().toISOString(),reason:'Media limitata agli strumenti azionari; VIX non viene contato come azionario'};
}

export function newsVote(items=[],now=Date.now()) {
  const rows=(Array.isArray(items)?items:[]).map(item=>{const text=`${item?.title||''} ${item?.description||item?.summary||''}`;const pos=(text.match(POSITIVE)||[]).length,neg=(text.match(NEGATIVE)||[]).length;const directional=pos-neg;const age=ageHours(item?.date,now);const w=decay(age);return{item,directional,w,age}}).filter(r=>r.w>0);
  if(!rows.length)return{family:'news',direction:0,strength:0,confidence:0,coverage:0,evidence:[],asOf:null,reason:'NO DATA — nessuna notizia recente valida'};
  const score=rows.reduce((s,r)=>s+r.directional*r.w,0)/rows.reduce((s,r)=>s+r.w,0);const direction=Math.abs(score)>=.08?Math.sign(score):0;const coverage=Math.min(1,rows.length/50);
  return{family:'news',direction,strength:Math.min(1,Math.abs(score)/2),confidence:Math.round(50+Math.min(40,Math.abs(score)*12)),coverage,evidence:[`${rows.length} notizie con decadimento 12h`,`score semantico ${score.toFixed(2)}`],asOf:rows.map(r=>r.item?.date).filter(Boolean).sort().at(-1)||new Date().toISOString(),reason:'Dedup e decadimento temporale; sentiment indicativo, non previsivo'};
}

export function macroVote(groups={}) {
  const rows=[...(groups.macro||[]),...(groups.central||[]),...(groups.rates||[]),...(groups.credit||[])];
  const votes=[];
  for(const x of rows){const label=String(x?.label||'').toLowerCase(),trend=toNum(x?.trendPct??x?.changePct??x?.delta);if(trend===null)continue;
    let d=0;
    if(/high.?yield|credit|corporate/.test(label))d=trend>0?-1:trend<0?1:0;
    else if(/unemployment/.test(label))d=trend>0?-1:trend<0?1:0;
    else if(/industrial|gdp|payroll|employment|production/.test(label))d=trend>0?1:trend<0?-1:0;
    else if(/inflation|cpi/.test(label))d=trend>0?-1:trend<0?1:0;
    else continue;
    if(d)votes.push({direction:d,strength:Math.min(1,Math.abs(trend)/5),confidence:60,coverage:1,weight:1,evidence:[`${x.label}: trend ${trend.toFixed(2)}%`],asOf:x.asOf||x.period});
  }
  if(!votes.length)return{family:'macro',direction:0,strength:0,confidence:0,coverage:0,evidence:[],asOf:null,reason:'NO DATA — trend macro non disponibile'};
  const score=votes.reduce((s,v)=>s+v.direction*v.strength,0)/votes.length,d=Math.abs(score)>=.15?Math.sign(score):0;
  return{family:'macro',direction:d,strength:Math.abs(score),confidence:Math.round(50+Math.abs(score)*25),coverage:Math.min(1,votes.length/4),evidence:votes.flatMap(v=>v.evidence).slice(0,6),asOf:votes.map(v=>v.asOf).filter(Boolean).sort().at(-1)||new Date().toISOString(),reason:'Macro letto da market.quantitative.groups; spread HY in aumento = risk-off'};
}

export function buildConsensus({market={},news={},quantitative={}}={}) {
  const votes=[marketVote(market.indices),newsVote(news.items),macroVote(quantitative.groups||{})].map(v=>({...v,weight:1}));
  return fuse(votes,{nominalWeight:3});
}

export const CONTRACT='direction,strength,confidence,coverage,evidence,asOf';
