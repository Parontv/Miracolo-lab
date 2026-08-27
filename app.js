let signals=[];let filter="all";
const $=id=>document.getElementById(id);
function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");}
function kind(x){return String(x.source||"").toLowerCase().includes("reddit")?"social":"news";}
function renderSources(list=[]){
  $("sources").innerHTML='<div class="sourceGrid">'+list.map(s=>{
    const ok=s.status==="ok";
    return `<div class="source"><strong>${esc(s.name)}</strong><span class="${ok?"sok":"serr"}">${ok?"● OK":"● ERRORE"} · ${Number(s.count||0)} elementi</span>${!ok&&s.error?`<div class="date">${esc(s.error)}</div>`:""}</div>`;
  }).join("")+'</div>';
}
function render(){
 let list=signals.slice();
 if(filter==="news")list=list.filter(x=>kind(x)==="news");
 if(filter==="social")list=list.filter(x=>kind(x)==="social");
 if(filter==="strong")list=list.filter(x=>Number(x.score||0)>=5);
 if(!list.length){$("results").innerHTML='<div class="empty">Nessun segnale disponibile.</div>';return;}
 $("results").innerHTML=list.map(x=>{
   const sc=Number(x.score||0), cls=sc>=5?"green":sc>=3?"yellow":"";
   return `<article class="signal">
   <span class="badge">${esc(x.source||"Fonte")}</span>${kind(x)==="social"?'<span class="badge">SOCIAL</span>':""}
   <span class="score ${cls}">Score ${sc}</span>
   <a class="title" href="${esc(x.link||"#")}" target="_blank" rel="noopener">${esc(x.title||"Senza titolo")}</a>
   <div class="desc">${esc(x.description||"")}</div>
   <div class="date">${esc(x.date||"")}</div></article>`;
 }).join("");
}
async function scan(){
 $("scan").disabled=true;$("status").textContent="SCANSIONE";$("status").className="warn";
 $("results").innerHTML='<div class="empty">🔄 Sto cercando news e social…</div>';
 try{
   const r=await fetch("/api/full-scan?ts="+Date.now(),{cache:"no-store"});
   const d=await r.json(); if(!r.ok||!d.ok)throw new Error(d.error||"HTTP "+r.status);
   signals=(d.top_signals||[]).map(x=>({...x,kind:kind(x)}));
   $("newsCount").textContent=d.summary?.news??0;$("socialCount").textContent=d.summary?.social??0;
   $("lastScan").textContent=new Date().toLocaleTimeString("it-IT");
   $("sourceInfo").textContent=`${d.summary?.workingSources??0} fonti operative · ${d.summary?.failedSources??0} non disponibili · ${d.summary?.total??signals.length} elementi`;
   renderSources(d.sources||[]);$("status").textContent="ONLINE";$("status").className="ok";filter="all";
   document.querySelectorAll(".tabs button").forEach(b=>b.classList.toggle("active",b.dataset.filter==="all"));render();
 }catch(e){$("status").textContent="ERRORE";$("status").className="bad";$("results").innerHTML=`<div class="error"><b>Scansione non riuscita</b><br>${esc(e.message)}</div>`}
 finally{$("scan").disabled=false}
}
document.querySelectorAll(".tabs button").forEach(b=>b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll(".tabs button").forEach(x=>x.classList.toggle("active",x===b));render()});
$("scan").onclick=scan;