/* Miracolo Lab V21.1.1 — AI market analysis inside the existing Market Sentiment card. */
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
      .ml-ms-ai{margin-top:7px;padding-top:7px;border-top:1px solid rgba(148,163,184,.16);font-size:10px;line-height:1.45;color:#cbd5e1}
      .ml-ms-ai-title{font-size:9px;font-weight:800;letter-spacing:.04em;color:#94a3b8;margin-bottom:4px}
      .ml-ms-ai-text{font-size:10px;color:#e2e8f0}
      .ml-ms-ai-meta{display:flex;gap:5px;flex-wrap:wrap;margin-top:5px;font-size:8px;color:#64748b}
      .ml-ms-ai-meta span{white-space:nowrap}
    `;
    document.head.appendChild(s);
  }

  function findMarketSentimentCard() {
    const nodes = [...document.querySelectorAll('summary,h2,h3,h4,.card-title,.panel-title,.section-title,.title,div,section,article')];
    const hit = nodes.find(el => {
      const t = (el.textContent || '').replace(/\\s+/g,' ').trim().toLowerCase();
      return t === 'market sentiment' || t.startsWith('market sentiment ');
    });
    if (!hit) return null;
    return hit.closest('section,article,.card,.panel,.radar-group,details') || hit.parentElement;
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
      <div class="ml-ms-ai-title">ANALISI AI</div>
      <div class="ml-ms-ai-text">${esc(a.text)}</div>
      ${a.drivers?.length ? `<div class="ml-ms-ai-meta"><span>Driver: ${esc(a.drivers.join(' · '))}</span></div>` : ''}
      <div class="ml-ms-ai-meta"><span>Sentiment ${esc(tone)}</span><span>·</span><span>Score ${esc(a.score)}/100</span><span>·</span><span>Fonti ${esc(data.summary?.items || 0)}</span><span>·</span><span>Social ${esc(data.summary?.social || 0)}</span></div>`;

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
