/* Miracolo Lab — Intelligence dashboard add-on
   Adds a live, source-aware market brief without replacing existing panels. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const fmt = n => Number.isFinite(Number(n)) ? Number(n).toLocaleString('it-IT',{maximumFractionDigits:2}) : '—';
  const when = v => { const d=new Date(v); return Number.isNaN(d.getTime())?'—':d.toLocaleString('it-IT'); };
  async function get(path) { const r=await fetch(path,{headers:{Accept:'application/json'},cache:'no-store'}); if(!r.ok) throw Error('HTTP '+r.status); return r.json(); }
  function ensure(){
    let el=$('ml-intelligence');
    if(el)return el;
    const host=$('sidePanel')||$('results'); if(!host)return null;
    el=document.createElement('section'); el.id='ml-intelligence'; el.className='panel';
    el.style.cssText='margin:12px 0;padding:14px;border:1px solid var(--border,#334155);border-radius:14px;background:var(--card,#111827);color:var(--text,#e5e7eb);font:inherit';
    el.innerHTML='<div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><strong>Market Intelligence</strong><button id="ml-intel-refresh" type="button">Aggiorna</button></div><div id="ml-intel-body" aria-live="polite" style="margin-top:12px">Caricamento dati…</div>';
    host.prepend(el);
    $('ml-intel-refresh').addEventListener('click',refresh);
    return el;
  }
  function render(live,market){
    const body=$('ml-intel-body'); if(!body)return;
    const news=live?.news||{}, summary=news.summary||live?.summary||{};
    const sources=news.sources||live?.sources||[];
    const ok=sources.filter(s=>s.status==='ok').length, bad=sources.length-ok;
    const items=news.items||[];
    const pos=items.filter(x=>Number(x.score)>0).length,neg=items.filter(x=>Number(x.score)<0).length;
    const indices=(market?.indices||live?.market?.indices||[]).filter(x=>x.ok);
    const up=indices.filter(x=>Number(x.changePct)>0).length,down=indices.filter(x=>Number(x.changePct)<0).length;
    const coverage=sources.length?Math.round(ok/sources.length*100):null;
    const status=live?.phase||'—';
    const top=items.slice().sort((a,b)=>Math.abs(Number(b.score||0))-Math.abs(Number(a.score||0))).slice(0,4);
    body.innerHTML=`
      <div style="font-size:12px;opacity:.75;margin-bottom:10px">Ciclo: ${esc(status)} · Snapshot: ${esc(when(live?.timestamp))}</div>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px">
        <div style="padding:10px;border-radius:10px;background:rgba(148,163,184,.09)"><small>Fonti OK</small><div style="font-size:20px;font-weight:700">${sources.length?ok+'/'+sources.length:'—'}</div><small>${coverage===null?'Nessun dato':coverage+'% raggiungibili'}${bad?' · '+bad+' errori':''}</small></div>
        <div style="padding:10px;border-radius:10px;background:rgba(148,163,184,.09)"><small>Notizie analizzate</small><div style="font-size:20px;font-weight:700">${items.length||summary.items||0}</div><small>${pos} positive · ${neg} negative</small></div>
        <div style="padding:10px;border-radius:10px;background:rgba(148,163,184,.09)"><small>Indici disponibili</small><div style="font-size:20px;font-weight:700">${indices.length||'—'}</div><small>${up} in rialzo · ${down} in calo</small></div>
        <div style="padding:10px;border-radius:10px;background:rgba(148,163,184,.09)"><small>Stato dati</small><div style="font-size:16px;font-weight:700">${sources.length?(bad?'Parziale':'Operativo'):'Da verificare'}</div><small>Non equivale a previsione</small></div>
      </div>
      <h4 style="margin:14px 0 7px">Segnali informativi più intensi</h4>
      ${top.length?top.map(x=>'<div style="padding:8px 0;border-top:1px solid rgba(148,163,184,.18)"><div style="font-weight:600;font-size:13px">'+esc(x.title||'Senza titolo')+'</div><small>'+esc(x.source||'Fonte')+' · score '+fmt(x.score)+'/6 · '+esc(x.date||'data non indicata')+'</small></div>').join(''):'<div style="opacity:.7;font-size:13px">Nessun segnale nel snapshot disponibile.</div>'}
      <div style="margin-top:10px;font-size:11px;opacity:.7">Le notizie sono indicatori descrittivi: non costituiscono da sole un segnale operativo. Dati e cicli possono avere orari diversi.</div>`;
  }
  async function refresh(){
    const el=ensure(); if(!el)return;
    const body=$('ml-intel-body'); body.textContent='Aggiornamento in corso…';
    try{
      const [live,market]=await Promise.allSettled([get('/api/live'),get('/api/market-monitor')]);
      if(live.status==='rejected'&&market.status==='rejected')throw Error('API non raggiungibili');
      render(live.status==='fulfilled'?live.value:null,market.status==='fulfilled'?market.value:null);
      if(live.status==='rejected')body.insertAdjacentHTML('beforeend','<div style="margin-top:8px;color:#fbbf24">Snapshot news non disponibile.</div>');
      if(market.status==='rejected')body.insertAdjacentHTML('beforeend','<div style="margin-top:8px;color:#fbbf24">Dati mercato non disponibili.</div>');
    }catch(e){body.innerHTML='<div style="color:#fbbf24">Impossibile caricare l’intelligence: '+esc(e.message)+'. Riprova manualmente.</div>';}
  }
  function init(){ensure();refresh();document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();