const state={
 tab:"home",
 capital:2000,
 cash:2000,
 portfolio:JSON.parse(localStorage.getItem("ml_portfolio")||"[]"),
 trades:JSON.parse(localStorage.getItem("ml_trades")||"[]"),
 news:null,
 lastScan:null,
 scanBusy:false
};

const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const eur=n=>new Intl.NumberFormat("it-IT",{style:"currency",currency:"EUR",maximumFractionDigits:2}).format(Number(n)||0);
const pct=n=>(Number(n)||0).toFixed(2)+"%";

function save(){localStorage.setItem("ml_portfolio",JSON.stringify(state.portfolio));localStorage.setItem("ml_trades",JSON.stringify(state.trades))}
function toast(t){const x=$("#toast");x.textContent=t;x.className="show";setTimeout(()=>x.className="",2600)}
function setTab(tab){state.tab=tab;document.querySelectorAll(".nav").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));$("#pageTitle").textContent={home:"Dashboard",trading:"Trading",portfolio:"Portafoglio",radar:"Radar",news:"News Radar",crypto:"Crypto",risk:"Black Swan Monitor",sim:"Simulazioni",settings:"Impostazioni"}[tab];render()}

document.querySelectorAll(".nav").forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
$("#quickNews").onclick=()=>{setTab("news");scanNews()};

function render(){
 const c=$("#content");
 if(state.tab==="home") c.innerHTML=home();
 if(state.tab==="trading") c.innerHTML=trading();
 if(state.tab==="portfolio") c.innerHTML=portfolio();
 if(state.tab==="radar") c.innerHTML=radar();
 if(state.tab==="news") c.innerHTML=newsPage();
 if(state.tab==="crypto") c.innerHTML=crypto();
 if(state.tab==="risk") c.innerHTML=risk();
 if(state.tab==="sim") c.innerHTML=sim();
 if(state.tab==="settings") c.innerHTML=settings();
 bind();
}

function home(){
 const invested=state.portfolio.reduce((s,x)=>s+Number(x.value||0),0);
 return `<div class="grid">
 <div class="card"><div class="statlabel">Capitale iniziale</div><div class="big">${eur(state.capital)}</div><div class="muted">Paper trading</div></div>
 <div class="card"><div class="statlabel">Cash disponibile</div><div class="big">${eur(state.cash)}</div><div class="muted">Da aggiornare con le operazioni</div></div>
 <div class="card"><div class="statlabel">Posizioni</div><div class="big">${state.portfolio.length}</div><div class="muted">Nel portafoglio</div></div>
 <div class="card"><div class="statlabel">Ultima scansione</div><div class="big" style="font-size:20px">${state.lastScan||"—"}</div><div class="muted">${state.news?state.news.summary.total+" elementi":"Nessun scan"}</div></div>
 </div>
 <div class="grid2">
 <div class="card"><h2>🔥 Cosa guardare</h2>${state.news?.top_signals?.slice(0,6).map(signalHtml).join("")||`<div class="empty">Esegui una scansione News per popolare il radar.</div>`}</div>
 <div class="card"><h2>🎯 Disciplina trading</h2><div class="notice">Con €2.000 il sistema deve privilegiare selettività, rischio limitato e operazioni con rapporto rischio/rendimento chiaro.</div><div style="margin-top:15px"><div class="kpi"><span>Rischio guida per trade</span><b>1%</b></div><div class="progress" style="margin-top:8px"><span style="width:1%"></span></div><p class="muted">≈ €20 di rischio massimo teorico per operazione.</p></div><div class="actions"><button class="primary" onclick="setTab('trading')">Apri Trading</button><button class="ghost" onclick="setTab('radar')">Apri Radar</button></div></div>
 </div>
 <div class="section-title"><h2>📡 Stato sistema</h2><button class="primary" onclick="setTab('news');scanNews()">Scansiona News</button></div>
 <div class="grid"><div class="card"><div class="statlabel">News</div><div class="big">${state.news?.summary?.news??"—"}</div></div><div class="card"><div class="statlabel">Social</div><div class="big">${state.news?.summary?.social??"—"}</div></div><div class="card"><div class="statlabel">Fonti operative</div><div class="big green">${state.news?.summary?.workingSources??"—"}</div></div><div class="card"><div class="statlabel">Fonti fallite</div><div class="big red">${state.news?.summary?.failedSources??"—"}</div></div></div>`;
}

function signalHtml(x){return `<div class="signal"><span class="badge">${esc(x.source||"Fonte")}</span><span class="score ${Number(x.score)>=5?"green":Number(x.score)>=3?"yellow":""}">Score ${esc(x.score||0)}</span><div class="signal-title" style="margin-top:9px">${x.link?`<a href="${esc(x.link)}" target="_blank" style="color:#93c5fd">${esc(x.title||"Senza titolo")}</a>`:esc(x.title||"Senza titolo")}</div><div class="signal-meta">${esc(x.description||"")}</div></div>`}

function trading(){
 return `<div class="grid"><div class="card"><div class="statlabel">Capitale</div><div class="big">${eur(state.capital)}</div></div><div class="card"><div class="statlabel">Rischio guida</div><div class="big">€20</div><div class="muted">1% del capitale</div></div><div class="card"><div class="statlabel">Regola</div><div class="big">NO TRADE</div><div class="muted">se il setup non è chiaro</div></div><div class="card"><div class="statlabel">Operazioni</div><div class="big">${state.trades.length}</div></div></div>
 <div class="grid2"><div class="card"><h2>🎯 Generatore setup</h2><div class="form"><div class="field"><label>Ticker</label><input id="tTicker" placeholder="es. NVDA"></div><div class="field"><label>Entry</label><input id="tEntry" type="number" step="0.01"></div><div class="field"><label>Stop</label><input id="tStop" type="number" step="0.01"></div><div class="field"><label>Target</label><input id="tTarget" type="number" step="0.01"></div><div class="field"><label>Probabilità stimata %</label><input id="tProb" type="number" value="55"></div><div class="field"><label>Capitale allocato</label><input id="tAlloc" type="number" value="200"></div></div><div class="actions" style="margin-top:14px"><button class="primary" onclick="analyzeSetup()">Analizza setup</button></div><div id="setupResult" style="margin-top:15px"></div></div>
 <div class="card"><h2>🧠 Regole</h2><ul class="muted"><li>Non rischiare tutto il capitale in una posizione.</li><li>Definisci lo stop prima dell'ingresso.</li><li>Preferisci setup con R/R ≥ 2.</li><li>News e social sono segnali, non conferme sufficienti da soli.</li></ul></div></div>
 <div class="section-title"><h2>Storico operazioni</h2></div><div class="card">${tradeTable()}</div>`;
}

function analyzeSetup(){
 const e=+$("#tEntry").value,s=+$("#tStop").value,t=+$("#tTarget").value,a=+$("#tAlloc").value,p=+$("#tProb").value;
 if(!e||!s||!t){$("#setupResult").innerHTML='<div class="notice">Inserisci entry, stop e target.</div>';return}
 const risk=Math.abs(e-s),reward=Math.abs(t-e),rr=reward/risk, riskPct=risk/e*100, riskEuro=a*riskPct/100, ev=p/100*reward-(1-p/100)*risk;
 const ok=rr>=2&&riskEuro<=20&&ev>0;
 $("#setupResult").innerHTML=`<div class="notice"><b class="${ok?"green":"yellow"}">${ok?"SETUP INTERESSANTE":"NO TRADE / DA MIGLIORARE"}</b><br><br>R/R: <b>${rr.toFixed(2)}</b> · Rischio posizione: <b>${eur(riskEuro)}</b> · EV per azione: <b>${ev.toFixed(3)}</b><br><span class="muted">Questa è una simulazione quantitativa semplice, non una previsione.</span></div>`;
}

function tradeTable(){if(!state.trades.length)return '<div class="empty">Nessuna operazione registrata.</div>';return `<table class="table"><tr><th>Data</th><th>Ticker</th><th>Tipo</th><th>Entry</th><th>Stop</th><th>Target</th><th>Esito</th></tr>${state.trades.slice().reverse().map(x=>`<tr><td>${esc(x.date)}</td><td><b>${esc(x.ticker)}</b></td><td>${esc(x.side)}</td><td>${eur(x.entry)}</td><td>${eur(x.stop)}</td><td>${eur(x.target)}</td><td>${esc(x.result||"APERTO")}</td></tr>`).join("")}</table>`}

function portfolio(){
 return `<div class="card"><h2>➕ Aggiungi posizione</h2><div class="form"><div class="field"><label>Ticker / Asset</label><input id="pTicker" placeholder="NVDA / BTC / ETF"></div><div class="field"><label>Quantità</label><input id="pQty" type="number" step="0.0001"></div><div class="field"><label>Valore attuale €</label><input id="pValue" type="number" step="0.01"></div></div><div class="actions" style="margin-top:12px"><button class="primary" onclick="addPosition()">Aggiungi</button></div></div>
 <div class="section-title"><h2>Posizioni</h2><span class="muted">${state.portfolio.length} asset</span></div><div class="card">${state.portfolio.length?`<table class="table"><tr><th>Asset</th><th>Qtà</th><th>Valore</th><th>Peso</th><th></th></tr>${state.portfolio.map((x,i)=>`<tr><td><b>${esc(x.ticker)}</b></td><td>${x.qty}</td><td>${eur(x.value)}</td><td>${pct(x.value/state.capital*100)}</td><td><button class="danger" onclick="removePosition(${i})">×</button></td></tr>`).join("")}</table>`:'<div class="empty">Nessuna posizione. Il portafoglio viene salvato localmente nel browser.</div>'}</div>`;
}
function addPosition(){const ticker=$("#pTicker").value.trim().toUpperCase(),qty=+$("#pQty").value,value=+$("#pValue").value;if(!ticker||!value)return toast("Inserisci asset e valore");state.portfolio.push({ticker,qty,value});save();render();toast("Posizione aggiunta")}
function removePosition(i){state.portfolio.splice(i,1);save();render()}

function radar(){const s=state.news?.top_signals||[];return `<div class="card"><h2>🔎 Radar investibile</h2><div class="notice">Il Radar ordina gli elementi raccolti dal backend per score. Prima di operare, verifica sempre il dato sul mercato reale.</div>${s.length?s.map(signalHtml).join(""):'<div class="empty">Nessun dato. Premi SCANSIONA NEWS.</div>'}</div>`}

function newsPage(){return `<div class="grid"><div class="card"><div class="statlabel">News</div><div class="big">${state.news?.summary?.news??"—"}</div></div><div class="card"><div class="statlabel">Social</div><div class="big">${state.news?.summary?.social??"—"}</div></div><div class="card"><div class="statlabel">Fonti operative</div><div class="big green">${state.news?.summary?.workingSources??"—"}</div></div><div class="card"><div class="statlabel">Ultimo scan</div><div class="big" style="font-size:18px">${state.lastScan||"—"}</div></div></div><div class="section-title"><h2>📰 News + Social</h2><button id="scanNewsBtn" class="primary" ${state.scanBusy?"disabled":""}>${state.scanBusy?"🔄 Scansione...":"🔎 SCANSIONA NEWS"}</button></div><div class="card">${state.scanBusy?'<div class="notice">Sto cercando news e social...</div>':state.news?.top_signals?.length?state.news.top_signals.map(signalHtml).join(""):'<div class="empty">Premi il pulsante per avviare la scansione.</div>'}</div>`}

function crypto(){return `<div class="grid"><div class="card"><div class="statlabel">BTC</div><div class="big">WATCH</div><div class="muted">Prezzo live non collegato in questa versione.</div></div><div class="card"><div class="statlabel">ETH</div><div class="big">WATCH</div><div class="muted">Aggiorna con dati di mercato prima di operare.</div></div><div class="card"><div class="statlabel">Sentiment</div><div class="big">${state.news?"Analisi news":"—"}</div></div><div class="card"><div class="statlabel">Rischio</div><div class="big yellow">ALTO</div></div></div><div class="card" style="margin-top:14px"><h2>₿ Crypto Radar</h2><div class="notice">Il modulo utilizza le news raccolte dal radar. Non considera ancora prezzi live, order book o indicatori tecnici.</div></div>`}

function risk(){return `<div class="grid"><div class="card"><div class="statlabel">Macro</div><div class="big yellow">ATTENZIONE</div><div class="muted">Fed / inflazione / lavoro</div></div><div class="card"><div class="statlabel">AI Valuations</div><div class="big yellow">MONITORARE</div><div class="muted">Capex e aspettative elevate</div></div><div class="card"><div class="statlabel">Geopolitica</div><div class="big red">ALTA</div><div class="muted">Tariffe / conflitti</div></div><div class="card"><div class="statlabel">Liquidità</div><div class="big">WATCH</div><div class="muted">Tassi e Treasury</div></div></div><div class="card" style="margin-top:14px"><h2>⚠️ Checklist</h2><div class="signal">Inflazione persistente → rischio tassi più alti</div><div class="signal">Rallentamento occupazione → rischio recessione</div><div class="signal">Capex AI molto elevato → rischio aspettative</div><div class="signal">Tariffe/geopolitica → rischio margini e supply chain</div></div>`}

function sim(){const n=state.trades.length,w=state.trades.filter(x=>x.result==="WIN").length,l=state.trades.filter(x=>x.result==="LOSS").length;return `<div class="grid"><div class="card"><div class="statlabel">Trade simulati</div><div class="big">${n}</div></div><div class="card"><div class="statlabel">Win rate</div><div class="big">${n?pct(w/n*100):"—"}</div></div><div class="card"><div class="statlabel">Win</div><div class="big green">${w}</div></div><div class="card"><div class="statlabel">Loss</div><div class="big red">${l}</div></div></div><div class="card" style="margin-top:14px"><h2>🧪 Paper trading</h2><div class="notice">Le simulazioni sono locali e servono per testare il processo. Non rappresentano performance reali.</div>${tradeTable()}</div>`}

function settings(){return `<div class="card"><h2>⚙️ Impostazioni</h2><div class="form"><div class="field"><label>Capitale iniziale €</label><input id="sCapital" type="number" value="${state.capital}"></div><div class="field"><label>Rischio guida per trade %</label><input value="1" disabled></div><div class="field"><label>Modalità</label><select disabled><option>Paper trading</option></select></div></div><div class="actions" style="margin-top:14px"><button class="primary" onclick="saveSettings()">Salva</button><button class="danger" onclick="clearData()">Cancella dati locali</button></div></div><div class="card" style="margin-top:14px"><h2>Connessione</h2><div class="notice">News Radar: endpoint <code>/api/full-scan</code>. Il backend Cloudflare deve essere sullo stesso dominio.</div></div>`}
function saveSettings(){state.capital=+$("#sCapital").value||2000;state.cash=state.capital;save();render();toast("Impostazioni salvate")}
function clearData(){if(confirm("Cancellare portafoglio e storico locali?")){localStorage.removeItem("ml_portfolio");localStorage.removeItem("ml_trades");location.reload()}}

async function scanNews(){
 if(state.scanBusy)return;
 state.scanBusy=true;setTab("news");
 try{
  const r=await fetch("/api/full-scan?ts="+Date.now(),{cache:"no-store"});
  if(!r.ok)throw new Error("HTTP "+r.status);
  const d=await r.json();
  if(!d.ok)throw new Error("Risposta non valida");
  state.news=d;state.lastScan=new Date().toLocaleTimeString("it-IT");
  toast(`Scansione completata: ${d.summary?.news||0} news / ${d.summary?.social||0} social`);
 }catch(e){toast("Scansione non riuscita: "+e.message)}finally{state.scanBusy=false;render()}
}
function bind(){const b=$("#scanNewsBtn");if(b)b.onclick=scanNews}
render();
