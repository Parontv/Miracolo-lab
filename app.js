let signals=[];
let currentFilter="all";

document.querySelectorAll(".tab").forEach(btn=>{
  btn.addEventListener("click",()=>{
    document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".view").forEach(x=>x.classList.remove("active"));
    document.getElementById(btn.dataset.tab).classList.add("active");
  });
});

function esc(v){
  return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

function setFilter(f,el){
  currentFilter=f;
  document.querySelectorAll(".filter").forEach(x=>x.classList.remove("active"));
  if(el)el.classList.add("active");
  render();
}

function render(){
  let list=signals.slice();
  if(currentFilter==="news")list=list.filter(x=>x.kind!=="social");
  if(currentFilter==="social")list=list.filter(x=>x.kind==="social");
  if(currentFilter==="strong")list=list.filter(x=>Number(x.score||0)>=5);

  const box=document.getElementById("results");
  if(!list.length){box.innerHTML='<div class="empty">Nessun segnale disponibile.</div>';return;}

  box.innerHTML=list.map(x=>{
    const s=Number(x.score||0);
    const cls=s>=5?"green":s>=3?"yellow":"";
    return `<article class="signal">
      <span class="badge">${esc(x.source||"Fonte")}</span>
      ${x.kind==="social"?'<span class="badge">SOCIAL</span>':""}
      <span class="score ${cls}">Score ${s}</span>
      <a class="signal-title" target="_blank" rel="noopener" href="${esc(x.link||"#")}">${esc(x.title||"Senza titolo")}</a>
      <div class="desc">${esc(x.description||"")}</div>
      <div class="date">${esc(x.date||x.published||"")}</div>
    </article>`;
  }).join("");
}

async function scanNews(){
  const buttons=[...document.querySelectorAll("#scanBtn,.news-head .primary")];
  buttons.forEach(b=>b.disabled=true);
  document.getElementById("results").innerHTML='<div class="empty">🔄 Scansione di news e social in corso...</div>';
  document.getElementById("sourceInfo").textContent="Connessione alle fonti...";

  try{
    const r=await fetch("/api/full-scan",{cache:"no-store",headers:{Accept:"application/json"}});
    if(!r.ok)throw new Error("HTTP "+r.status);
    const d=await r.json();
    if(!d||!Array.isArray(d.top_signals))throw new Error("Risposta non valida");

    signals=d.top_signals.map(x=>({...x,kind:String(x.source||"").toLowerCase().includes("reddit")?"social":"news"}));

    const n=d.summary?.news??signals.filter(x=>x.kind==="news").length;
    const so=d.summary?.social??signals.filter(x=>x.kind==="social").length;
    const strong=signals.filter(x=>Number(x.score||0)>=5).length;
    document.getElementById("dashNews").textContent=n;
    document.getElementById("dashSocial").textContent=so;
    document.getElementById("dashStrong").textContent=strong;
    document.getElementById("sourceInfo").textContent=`${d.summary?.workingSources??0} fonti operative · ${d.summary?.failedSources??0} non disponibili · ultimo scan ${new Date().toLocaleTimeString("it-IT")}`;
    render();
  }catch(e){
    document.getElementById("sourceInfo").textContent="Errore durante la scansione";
    document.getElementById("results").innerHTML=`<div class="error"><b>⚠️ Scansione non riuscita</b><br><br>${esc(e.message)}</div>`;
  }finally{
    buttons.forEach(b=>b.disabled=false);
  }
}