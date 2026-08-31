/* Miracolo Lab V21.1 — AI market summary and history bridge. */
(() => {
  'use strict';
  const VERSION = '21.1.0';
  const HISTORY_KEY = 'ml_ai_history_v21';
  const MAX_LOCAL_HISTORY = 200;

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function ensureStyle() {
    if (document.getElementById('ml-v21-intelligence-style')) return;
    const s = document.createElement('style');
    s.id = 'ml-v21-intelligence-style';
    s.textContent = `
      .ml-ai-market-card{margin:12px 0;border:1px solid #d9dee7;border-radius:12px;background:#fff;overflow:hidden;box-shadow:0 1px 2px rgba(15,23,42,.05)}
      .ml-ai-toggle{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;border:0;background:#f8fafc;color:#0f172a;padding:11px 13px;cursor:pointer;font:inherit;font-size:12px;font-weight:800;text-align:left}
      .ml-ai-toggle:hover{background:#f1f5f9}.ml-ai-chevron{font-size:14px;min-width:16px;text-align:center}.ml-ai-body{padding:12px 13px;color:#334155;font-size:12px;line-height:1.5}.ml-ai-meta{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px}.ml-ai-pill{padding:3px 7px;border-radius:999px;background:#eef2f7;font-size:11px;font-weight:700}.ml-ai-drivers{margin-top:8px;color:#64748b}
      @media(max-width:520px){.ml-ai-market-card{margin:8px 0}.ml-ai-toggle{padding:10px 11px;font-size:11px}.ml-ai-body{padding:10px 11px;font-size:11px}}
    `;
    document.head.appendChild(s);
  }

  function saveLocal(snapshot) {
    try {
      const old = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      if (old[old.length - 1]?.text === snapshot.text) return;
      old.push(snapshot);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(old.slice(-MAX_LOCAL_HISTORY)));
      window.dispatchEvent(new CustomEvent('miracolo:ai-memory', {detail:snapshot}));
    } catch {}
  }

  function render(data) {
    const feed = document.getElementById('feedCol');
    const results = document.getElementById('results');
    if (!feed || !data?.aiMarket) return;
    let card = document.getElementById('ml-ai-market-card');
    if (!card) {
      card = document.createElement('section');
      card.id = 'ml-ai-market-card';
      card.className = 'ml-ai-market-card';
      const anchor = results || feed.firstElementChild;
      (anchor?.parentNode || feed).insertBefore(card, anchor || null);
    }
    const a = data.aiMarket;
    const tone = a.sentiment === 'BULLISH' ? 'BULLISH' : a.sentiment === 'BEARISH' ? 'BEARISH' : 'NEUTRAL';
    card.innerHTML = `
      <button type="button" class="ml-ai-toggle" aria-expanded="false">
        <span>AI MARKET — COSA STA SUCCEDENDO</span><span class="ml-ai-chevron">▸</span>
      </button>
      <div class="ml-ai-body" hidden>
        <div class="ml-ai-meta"><span class="ml-ai-pill">Sentiment: ${esc(tone)}</span><span class="ml-ai-pill">Score: ${esc(a.score)}/100</span><span class="ml-ai-pill">Dati: ${esc(data.summary?.items || 0)}</span></div>
        <div>${esc(a.text)}</div>
        ${a.drivers?.length ? `<div class="ml-ai-drivers"><strong>Driver:</strong> ${esc(a.drivers.join(' · '))}</div>` : ''}
      </div>`;
    const toggle = card.querySelector('.ml-ai-toggle');
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', open ? 'false' : 'true');
      card.querySelector('.ml-ai-body').hidden = open;
      card.querySelector('.ml-ai-chevron').textContent = open ? '▸' : '▾';
    });
    const snap={ts:a.updatedAt||data.timestamp||new Date().toISOString(),sentiment:a.sentiment,score:a.score,text:a.text,drivers:a.drivers||[],summary:data.summary||{}};
    saveLocal(snap);
    document.querySelectorAll('.build-badge').forEach(x=>x.textContent=VERSION);
    document.querySelector('meta[name="version"]')?.setAttribute('content',VERSION);
  }

  async function load() {
    try {
      const r=await fetch('/api/full-scan',{cache:'no-store'});
      if(!r.ok) return;
      const data=await r.json();
      render(data);
      const s=data.summary||{};
      const map={hNews:s.news,hSocial:s.social,hStrong:s.strong,hTime:new Date(data.timestamp||Date.now()).toLocaleTimeString('it-IT')};
      Object.entries(map).forEach(([id,v])=>{const el=document.getElementById(id);if(el&&v!=null)el.textContent=v});
      window.dispatchEvent(new CustomEvent('miracolo:full-scan',{detail:data}));
    } catch (e) { console.warn('Miracolo Lab intelligence unavailable:',e.message); }
  }

  function boot(){ensureStyle();load();setInterval(load,5*60*1000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
