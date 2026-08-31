/* Miracolo Lab V21.2.0 — source intelligence UI. */
(() => {
  'use strict';
  const esc = v => String(v ?? '').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const cat = s => ({macro:'🌍',social:'💬',crypto:'₿',company:'🏢',equity:'📈',rates:'💶',central:'🏦',commodities:'🛢️',fx:'💱',volatility:'📊',geopolitics:'🌐',regulatory:'⚖️',news:'📰'}[s]||'📡');
  function style(){if(document.getElementById('ml-v212-source-style'))return;const s=document.createElement('style');s.id='ml-v212-source-style';s.textContent=`
    #mlSourcePanel{margin:8px 0 12px;background:rgba(15,23,42,.72);border:1px solid rgba(71,85,105,.35);border-radius:12px;overflow:hidden}
    #mlSourcePanel summary{cursor:pointer;list-style:none;padding:9px 11px;display:flex;align-items:center;gap:8px;font-size:10px;font-weight:800;color:#cbd5e1}
    #mlSourcePanel summary::-webkit-details-marker{display:none}.ml-sp-count{margin-left:auto;color:#64748b;font-size:9px}
    .ml-sp-body{padding:0 10px 10px}.ml-sp-group{margin-top:8px}.ml-sp-group-title{font-size:8px;letter-spacing:.08em;color:#64748b;margin:7px 1px 4px;text-transform:uppercase}
    .ml-sp-row{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;padding:5px 2px;border-top:1px solid rgba(51,65,85,.22);font-size:9px}
    .ml-sp-name{color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ml-sp-name a{color:inherit;text-decoration:none}.ml-sp-meta{font-size:8px;color:#475569}.ml-sp-ok{color:#4ade80}.ml-sp-err{color:#fb7185}.ml-sp-off{color:#fbbf24}
    .ml-feed-group{margin-bottom:7px;border:1px solid rgba(71,85,105,.22);border-radius:10px;overflow:hidden}.ml-feed-group summary{cursor:pointer;list-style:none;padding:8px 10px;background:rgba(15,23,42,.55);font-size:10px;font-weight:800;color:#cbd5e1}.ml-feed-group summary::-webkit-details-marker{display:none}.ml-feed-items{padding:0 5px 5px}
    .ml-more{width:100%;margin:5px 0;padding:7px;border:1px solid rgba(71,85,105,.35);border-radius:8px;background:rgba(30,41,59,.55);color:#94a3b8;font-size:9px;cursor:pointer}
  `;document.head.appendChild(s)}
  function ensure(){let p=document.getElementById('mlSourcePanel');if(!p){p=document.createElement('details');p.id='mlSourcePanel';p.open=false;const head=document.querySelector('.feed-head');if(head)head.insertAdjacentElement('afterend',p);else document.getElementById('feedCol')?.prepend(p)}return p}
  function renderSources(){const p=ensure();if(!p)return;const sources=window.S?.sources||[];const ok=sources.filter(x=>x.status==='ok').length,err=sources.filter(x=>x.status==='error').length,off=sources.filter(x=>x.status==='disabled').length;const groups={};sources.forEach(x=>(groups[x.type||x.cat||'other']??=[]).push(x));p.innerHTML=`<summary>📚 FONTI RICEVUTE <span class="ml-sp-count">${ok} OK · ${err} ERR · ${off} OFF · ${sources.length} totali</span></summary><div class="ml-sp-body">${Object.entries(groups).map(([g,arr])=>`<div class="ml-sp-group"><div class="ml-sp-group-title">${cat(g)} ${esc(g)}</div>${arr.map(s=>{const cls=s.status==='ok'?'ml-sp-ok':s.status==='disabled'?'ml-sp-off':'ml-sp-err';const label=s.status==='ok'?`OK · ${Number(s.count||0)}`:s.status==='disabled'?'OFF':'ERR';const extra=[s.latencyMs?`${s.latencyMs}ms`:'',s.error?s.error:''].filter(Boolean).join(' · ');return `<div class="ml-sp-row"><span class="ml-sp-name">${s.url?`<a href="${esc(s.url)}" target="_blank" rel="noopener">${cat(g)} ${esc(s.name)}</a>`:`${cat(g)} ${esc(s.name)}`}<span class="ml-sp-meta">${extra?` · ${esc(extra)}`:''}</span></span><span class="${cls}">${label}</span></div>`}).join('')}</div>`).join('')}</div>`}
  function renderMoreFeed(){
    if(!window.S||!window.signalCard)return;
    const filter=window.S.filter||'all';let list=window.S.signals.slice();
    if(filter==='news')list=list.filter(x=>x.kind==='news'&&x.cat!=='crypto');
    if(filter==='social')list=list.filter(x=>x.kind==='social');
    if(filter==='macro')list=list.filter(x=>x.cat==='macro');
    if(filter==='crypto')list=list.filter(x=>x.cat==='crypto');
    if(filter==='strong')list=list.filter(x=>Number(x.score||0)>=5);
    if(!list.length){const r=document.getElementById('results');if(r)r.innerHTML='<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-title">Nessun segnale</div></div>';return}
    const groups=[
      ['🔥','Segnali Forti',list.filter(x=>Number(x.score||0)>=5)],
      ['🌍','Macro & Economia',list.filter(x=>x.cat==='macro'&&Number(x.score||0)<5)],
      ['📰','Mercati & Finance',list.filter(x=>x.cat==='news'&&x.kind==='news'&&Number(x.score||0)<5)],
      ['₿','Crypto News',list.filter(x=>x.cat==='crypto'&&Number(x.score||0)<5)],
      ['💬','Social & Reddit',list.filter(x=>x.kind==='social'&&Number(x.score||0)<5)]
    ].filter(g=>g[2].length);
    const r=document.getElementById('results');if(!r)return;let html='';
    groups.forEach((g,gi)=>{const id=`mlfg${gi}`;html+=`<details class="ml-feed-group" open><summary>${g[0]} ${g[1]} <span style="float:right;color:#64748b">${g[2].length}</span></summary><div class="ml-feed-items">${g[2].slice(0,50).map((x,i)=>window.signalCard(x,i)).join('')}${g[2].length>50?`<button class="ml-more" data-group="${id}">Mostra altri ${Math.min(100,g[2].length-50)}</button>`:''}</div></details>`});
    r.innerHTML=html;
    r.querySelectorAll('.ml-more').forEach(btn=>btn.addEventListener('click',()=>{const parent=btn.closest('.ml-feed-group'), title=parent?.querySelector('summary')?.textContent||'';const source=groups.find(g=>title.includes(g[1]));if(!source)return;const items=parent.querySelector('.ml-feed-items');items.innerHTML=source[2].slice(0,100).map((x,i)=>window.signalCard(x,i)).join('');if(source[2].length>100){const b=document.createElement('button');b.className='ml-more';b.textContent=`Mostra altri ${source[2].length-100}`;b.onclick=()=>{items.innerHTML=source[2].map((x,i)=>window.signalCard(x,i)).join('')};items.appendChild(b)}}));
  }
  function hook(){style();renderSources();if(window.S)renderMoreFeed();}
  document.addEventListener('DOMContentLoaded',hook,{once:true});
  window.addEventListener('miracolo:full-scan',()=>{setTimeout(hook,20)});
  window.addEventListener('miracolo:panel-change',()=>setTimeout(renderSources,20));
  setInterval(()=>{if(window.S?.sources?.length)renderSources()},5000);
})();
