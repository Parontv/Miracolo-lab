/* Miracolo Lab V16.2 — Bot real-data bridge */
(()=>{'use strict';
const TAG='V16.2';
function detectAsset(text){const t=(text||'').toLowerCase();if(/\b(bitcoin|btc)\b/.test(t))return'BTC';if(/\b(ethereum|eth)\b/.test(t))return'ETH';return null}
function enrichSignals(list){return(list||[]).map(s=>({...s,cryptoAsset:s.cryptoAsset||detectAsset(`${s.title||''} ${s.description||''}`)}))}
async function runBotCycle(){
 const status=document.getElementById('botCycleStatus');
 if(status)status.textContent='Raccolta dati…';
 const [scan,crypto]=await Promise.all([
   fetch('/api/full-scan?ts='+Date.now(),{cache:'no-store'}).then(r=>r.json()),
   fetch('/api/crypto?ts='+Date.now(),{cache:'no-store'}).then(r=>r.json())
 ]);
 if(!scan.ok)throw new Error('Source Engine non disponibile');
 S.signals=enrichSignals(scan.top_signals||scan.signals||[]);
 S.sources=scan.sources||[];S.summary=scan.summary||{};
 if(crypto.ok&&crypto.coins){S.cryptoList=crypto.coins;S.cryptoPrices={};crypto.coins.forEach(c=>{if(c.verified&&c.price>0)S.cryptoPrices[c.symbol]=c.price})}
 const suggestions=BOT.generateSuggestions(S.signals,S.cryptoPrices);
 BOT.lastCycle={time:new Date().toISOString(),signals:S.signals.length,sources:S.sources.length,suggestions:suggestions.length,regime:null};BOT.save();
 if(typeof updateBotBar==='function')updateBotBar();if(typeof renderPanel==='function'&&S.activePanel==='bot')renderPanel();
 if(status)status.textContent=`Ciclo ${TAG} · ${S.signals.length} segnali · ${suggestions.length} nuovi suggerimenti`;
 return {scan,crypto,suggestions};
}
window.botRunCycle=runBotCycle;
function patch(){const panel=document.getElementById('sidePanel');if(!panel||S.activePanel!=='bot')return;const controls=panel.querySelector('.bot-controls');if(!controls)return;if(!document.getElementById('botCycleBtn')){const b=document.createElement('button');b.id='botCycleBtn';b.className='bot-btn';b.type='button';b.textContent='🤖 Analizza dati raccolti';b.onclick=async()=>{b.disabled=true;try{await runBotCycle();if(typeof toast==='function')toast('Bot analizzato sui dati reali','success','🤖')}catch(e){console.error(e);if(typeof toast==='function')toast('Ciclo Bot fallito: '+e.message,'error')}finally{b.disabled=false}};controls.prepend(b);const st=document.createElement('div');st.id='botCycleStatus';st.style='font-size:10px;color:#64748b;margin-top:6px';st.textContent='Pronto per test sui dati reali';controls.appendChild(st)}}
const oldSet=window.setPanel;window.setPanel=function(id){if(typeof oldSet==='function')oldSet(id);setTimeout(patch,20)};document.addEventListener('DOMContentLoaded',()=>setTimeout(patch,500));window.addEventListener('load',()=>setTimeout(patch,700));
})();
