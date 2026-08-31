/* Miracolo Lab V21.1.2 — single AI comment inside the existing Market Sentiment card. */
(() => {
  'use strict';
  const HISTORY_KEY = 'ml_ai_history_v21';
  const MAX_LOCAL_HISTORY = 200;
  const esc = (v) => String(v ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));

  function ensureStyle() {
    if (document.getElementById('ml-v21-intelligence-style')) return;
    const s = document.createElement('style');
    s.id = 'ml-v21-intelligence-style';
    s.textContent = `
      .ml-ms-ai{margin-top:7px;padding-top:7px;border-top:1px solid rgba(148,163,184,.16);font-size:10px;line-height:1.48;color:#e2e8f0}
      .ml-ms-ai-text{font-size:10px;line-height:1.48;color:#e2e8f0;margin:0}
      .ml-ms-ai-meta{display:flex;gap:4px;flex-wrap:wrap;margin-top:4px;font-size:7px;line-height:1.2;color:#64748b;opacity:.8}
      .ml-ms-ai-meta span{white-space:nowrap}
      .ml-ms-ai-time,.ml-ms-ai-title{display:none!important}
    `;
    document.head.appendChild(s);
  }

  function findMarketSentimentCard() {
    const nodes = [...document.querySelectorAll('summary,h2,h3,h4,.card-title,.panel-title,.section-title,.title,div,section,article')];
    const hit = nodes.find(el => {
      const t = (el.textContent || '').replace(/\s+/g,' ').trim().toLowerCase();
      return t === 'market sentiment' || t.startsWith('market sentiment ');
    });
    return hit ? (hit.closest('section,article,.card,.panel,.radar-group,details') || hit.parentElement) : null;
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
    const card = findMarketSentimentCard();
    if (!card || !data?.aiMarket) return;
    let box = card.querySelector('#ml-ms-ai');
    if (!box) {
      box = document.createElement('div');
      box.id = 'ml-ms-ai';
      box.className = 'ml-ms-ai';
      card.appendChild(box);
    }
    const a = data.aiMarket;
    const tone = a.sentiment === 'BULLISH' ? 'BULLISH' : a.sentiment === 'BEARISH' ? 'BEARISH' : 'NEUTRAL';
    box.innerHTML = `
      <div class="ml-ms-ai-text">${esc(a.text)}</div>
      <div class="ml-ms-ai-meta"><span>${esc(tone)}</span><span>·</span><span>${esc(a.score)}/100</span><span>·</span><span>Fonti ${esc(data.summary?.items || 0)}</span><span>·</span><span>Segnali ${esc(data.summary?.signals || data.summary?.strong || 0)}</span></div>`;
    saveLocal({ts:a.updatedAt||data.timestamp||new Date().toISOString(),sentiment:a.sentiment,score:a.score,text:a.text,drivers:a.drivers||[],summary:data.summary||{}});
  }

  async function load() {
    try {
      const r = await fetch('/api/full-scan?ts=' + Date.now(), {cache:'no-store'});
      if(!r.ok) return;
      const data = await r.json();
      render(data);
      const s=data.summary||{};
      const map={hNews:s.news,hSocial:s.social,hStrong:s.strong};
      Object.entries(map).forEach(([id,v])=>{const el=document.getElementById(id);if(el&&v!=null)el.textContent=v});
      window.dispatchEvent(new CustomEvent('miracolo:full-scan',{detail:data}));
    } catch (e) { console.warn('Miracolo Lab intelligence unavailable:',e.message); }
  }

  function boot(){
    ensureStyle();
    load();
    setInterval(load,5*60*1000);
    const obs=new MutationObserver(()=>{clearTimeout(window.__mlMSRefresh);window.__mlMSRefresh=setTimeout(load,250)});
    if(document.body) obs.observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
