/* Miracolo Lab V20.01.04 — dynamic market narrative + historical comparison */
(()=>{'use strict';
const esc=x=>String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const num=x=>Number.isFinite(Number(x))?Number(x):0;
function marketScore(indices,crypto){
 const xs=(indices||[]).filter(x=>x.ok&&Number.isFinite(Number(x.changePct)));
 if(!xs.length)return null;
 let total=0,weight=0,up=0,down=0;
 xs.forEach(x=>{let w=1;if(['SP500','NASDAQ100','DOW','EUROSTOXX','DAX','FTSEMIB','NIKKEI','HANGSENG'].includes(String(x.name)))w=1.4;let s=clamp(50+num(x.changePct)*12,0,100);const r=num(x.rsi);if(r){if(r>=55&&r<=70)s+=7;else if(r>75)s-=6;else if(r<35)s-=7;else if(r<45)s-=4}s=clamp(s,0,100);total+=s*w;weight+=w;if(s>=58)up++;if(s<=42)down++});
 const base=clamp(Math.round(total/weight),0,100);
 const c=(crypto||[]).filter(x=>x.ok&&num(x.change24h)!==0);let cs=0;if(c.length)cs=c.reduce((a,x)=>a+clamp(50+num(x.change24h)*5,0,100),0)/c.length;
 const score=clamp(Math.round(c.length?base*.82+cs*.18:base),0,100);
 return {score,up,down,total:xs.length,cryptoScore:Math.round(cs),label:score>=68?'Rialzista':score>=56?'Moderatamente rialzista':score<=32?'Ribassista':score<=44?'Moderatamente ribassista':'Neutrale / misto'};
}
function buildNarrative(d,hist){
 const indices=d?.indices||[],crypto=d?.crypto||[],e=marketScore(indices,crypto);if(!e)return null;
 const valid=indices.filter(x=>x.ok), sorted=[...valid].sort((a,b)=>num(b.changePct)-num(a.changePct));
 const leaders=sorted.slice(0,3).filter(x=>num(x.changePct)>0).map(x=>`${x.name} ${num(x.changePct)>0?'+':''}${num(x.changePct).toFixed(2)}%`);
 const laggards=sorted.slice(-3).filter(x=>num(x.changePct)<0).reverse().map(x=>`${x.name} ${num(x.changePct).toFixed(2)}%`);
 const vix=valid.find(x=>x.name==='VIX'), gold=valid.find(x=>x.name==='GOLD'), us10=valid.find(x=>x.name==='US10Y');
 const risks=[];if(vix&&num(vix.changePct)>2)risks.push('la volatilità sta aumentando');if(gold&&num(gold.changePct)>1)risks.push('l’oro sta mostrando una domanda difensiva');if(us10&&num(us10.changePct)>1)risks.push('i rendimenti USA stanno salendo');
 const positives=[];if(leaders.length)positives.push(`la forza è concentrata in ${leaders.join(', ')}`);if(e.up>e.down)positives.push(`la maggioranza degli indici valutabili presenta un segnale costruttivo (${e.up} contro ${e.down})`);if(e.cryptoScore>=58)positives.push('BTC/ETH confermano un tono favorevole al rischio');
 const negatives=[];if(laggards.length)negatives.push(`restano sotto pressione ${laggards.join(', ')}`);if(e.down>e.up)negatives.push(`la pressione negativa prevale tra gli indici (${e.down} contro ${e.up})`);if(e.cryptoScore&&e.cryptoScore<42)negatives.push('BTC/ETH non confermano il movimento');
 let conclusion=e.score>=68?'Il quadro è favorevole al rischio, ma va verificata la qualità del movimento e la sua ampiezza.':e.score>=56?'Il quadro è costruttivo, ma non abbastanza uniforme per parlare di rialzo forte.':e.score<=32?'Il quadro è chiaramente difensivo: la pressione negativa prevale e il rischio di ulteriore deterioramento va monitorato.':e.score<=44?'Il quadro è debole e richiede conferme prima di assumere esposizione.':'Il quadro è misto: i segnali non convergono abbastanza per una direzione dominante.';
 if(risks.length)conclusion+=' '+risks.join('; ')+'.';
 let historical='';if(Array.isArray(hist)&&hist.length){const prev=hist[hist.length-1];if(Number.isFinite(Number(prev.score))){const delta=e.score-Number(prev.score);if(Math.abs(delta)>=4)historical=` Rispetto all’ultima lettura disponibile, il bias è ${delta>0?'migliorato':'peggiorato'} di ${Math.abs(delta)} punti.`;else historical=' Rispetto all’ultima lettura disponibile, il quadro è sostanzialmente stabile.'}}
 return {score:e.score,label:e.label,confidence:clamp(Math.round(58+Math.abs(e.score-50)*.75+(Math.abs(e.up-e.down)/Math.max(1,e.total))*10),58,94),text:conclusion+historical,positives,negatives,leaders,laggards,risks};
}
async function run(){try{const r=await fetch('/api/market-monitor?ts='+Date.now(),{cache:'no-store'});if(!r.ok)return;const d=await r.json();let hist=[];try{hist=JSON.parse(localStorage.getItem('ml_ai_analysis_history_v20')||'[]')}catch{}const n=buildNarrative(d,hist);if(!n)return;hist=Array.isArray(hist)?hist:[];const last=hist[hist.length-1];if(!last||last.score!==n.score||last.label!==n.label){hist.push({timestamp:new Date().toISOString(),score:n.score,label:n.label});hist=hist.slice(-100);try{localStorage.setItem('ml_ai_analysis_history_v20',JSON.stringify(hist))}catch{}}
 let box=document.getElementById('aiMarketNarrative');if(!box){const target=document.querySelector('.radar-group-body')||document.getElementById('results');if(!target)return;box=document.createElement('section');box.id='aiMarketNarrative';box.className='ai-market-narrative';target.prepend(box)}
 box.innerHTML=`<div class="ai-narr-head"><div><b>Analisi AI del mercato</b><small>Valutazione dinamica di dati di mercato + segnali + storico</small></div><strong>${n.score}/100</strong></div><div class="ai-narr-label">${esc(n.label)} · confidenza ${n.confidence}%</div><p>${esc(n.text)}</p>${n.positives.length?`<div class="ai-narr-block"><b>Segnali favorevoli</b><span>${esc(n.positives.join(' · '))}</span></div>`:''}${n.negatives.length?`<div class="ai-narr-block"><b>Segnali contrari</b><span>${esc(n.negatives.join(' · '))}</span></div>`:''}${n.risks.length?`<div class="ai-narr-block"><b>Rischi da monitorare</b><span>${esc(n.risks.join(' · '))}</span></div>`:''}`;
 }catch(e){console.warn('V20 dynamic AI analysis',e)}}
const st=document.createElement('style');st.textContent=`.ai-market-narrative{margin:8px 0 12px;padding:12px;border:1px solid #334155;border-radius:10px;background:rgba(15,23,42,.78)}.ai-narr-head{display:flex;justify-content:space-between;gap:12px;align-items:center}.ai-narr-head b{display:block;font-size:12px;color:#e2e8f0}.ai-narr-head small{display:block;font-size:8px;color:#64748b;margin-top:2px}.ai-narr-head strong{font-size:17px;color:#e2e8f0}.ai-narr-label{font-size:9px;color:#94a3b8;margin:7px 0}.ai-market-narrative p{font-size:10px;line-height:1.55;color:#cbd5e1;margin:7px 0 9px}.ai-narr-block{display:flex;flex-direction:column;gap:2px;padding-top:6px;margin-top:6px;border-top:1px solid #202b3d}.ai-narr-block b{font-size:9px;color:#e2e8f0}.ai-narr-block span{font-size:9px;color:#94a3b8;line-height:1.4}`;document.head.appendChild(st);document.addEventListener('DOMContentLoaded',()=>setTimeout(run,1000));setInterval(run,300000);window.__ML_DYNAMIC_AI={run};
})();
