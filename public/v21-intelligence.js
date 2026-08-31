/* Miracolo Lab V21.1 — AI market intelligence presentation layer.
   Prototype: stable collapsible presentation of the existing V20 AI narrative.
   Persistence here is browser-local only; server memory belongs in the next data-layer step. */
(() => {
  'use strict';
  const STORAGE_KEY = 'ml_ai_history_v21';
  const MAX_HISTORY = 500;

  function findNarrative() {
    return document.getElementById('aiMarketNarrative') || document.getElementById('indexAiEvaluation');
  }

  function saveSnapshot(narrative) {
    if (!narrative) return;
    const text = (narrative.innerText || narrative.textContent || '').trim();
    if (!text) return;
    const snapshot = {
      ts: new Date().toISOString(),
      text: text.slice(0, 4000),
      score: document.querySelector('[data-ai-score]')?.textContent?.trim() || null,
      sentiment: document.querySelector('[data-ai-sentiment]')?.textContent?.trim() || null
    };
    try {
      const old = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      const last = old[old.length - 1];
      if (last && last.text === snapshot.text) return;
      old.push(snapshot);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(old.slice(-MAX_HISTORY)));
      window.dispatchEvent(new CustomEvent('miracolo:ai-memory', { detail: snapshot }));
    } catch (e) {
      console.warn('Miracolo Lab AI history unavailable:', e.message);
    }
  }

  function render(narrative) {
    const sourceGrid = document.getElementById('sourceGrid');
    const results = document.getElementById('results');
    if (!sourceGrid || !narrative) return false;

    let card = document.getElementById('ml-ai-market-card');
    if (!card) {
      card = document.createElement('section');
      card.id = 'ml-ai-market-card';
      card.className = 'ml-ai-market-card';
      card.innerHTML = `
        <button type="button" class="ml-ai-toggle" aria-expanded="false">
          <span class="ml-ai-title">AI MARKET — COSA STA SUCCEDENDO</span>
          <span class="ml-ai-chevron" aria-hidden="true">▸</span>
        </button>
        <div class="ml-ai-body" hidden></div>`;
      const anchor = results || sourceGrid;
      anchor.parentNode.insertBefore(card, anchor);
      card.querySelector('.ml-ai-toggle').addEventListener('click', () => {
        const open = card.dataset.open === 'true';
        card.dataset.open = open ? 'false' : 'true';
        card.querySelector('.ml-ai-toggle').setAttribute('aria-expanded', open ? 'false' : 'true');
        card.querySelector('.ml-ai-body').hidden = open;
        card.querySelector('.ml-ai-chevron').textContent = open ? '▸' : '▾';
      });
    }

    const html = narrative.innerHTML || '';
    const text = (narrative.innerText || narrative.textContent || '').trim();
    if (html.trim()) card.querySelector('.ml-ai-body').innerHTML = html;
    else if (text) card.querySelector('.ml-ai-body').textContent = text;

    saveSnapshot(narrative);
    narrative.style.display = 'none';
    return Boolean(html.trim() || text);
  }

  function style() {
    if (document.getElementById('ml-v21-intelligence-style')) return;
    const s = document.createElement('style');
    s.id = 'ml-v21-intelligence-style';
    s.textContent = `
      .ml-ai-market-card{margin:12px 0;border:1px solid #d9dee7;border-radius:12px;background:#fff;overflow:hidden;box-shadow:0 1px 2px rgba(15,23,42,.05)}
      .ml-ai-toggle{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;border:0;background:#f8fafc;color:#0f172a;padding:11px 13px;cursor:pointer;font:inherit;font-size:12px;font-weight:800;text-align:left}
      .ml-ai-toggle:hover{background:#f1f5f9}.ml-ai-chevron{font-size:14px;min-width:16px;text-align:center}.ml-ai-body{padding:12px 13px;color:#334155;font-size:12px;line-height:1.5}
      @media(max-width:520px){.ml-ai-market-card{margin:8px 0}.ml-ai-toggle{padding:10px 11px;font-size:11px}.ml-ai-body{padding:10px 11px;font-size:11px}}
    `;
    document.head.appendChild(s);
  }

  function boot() {
    style();
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      const narrative = findNarrative();
      if (narrative && render(narrative)) clearInterval(timer);
      else if (tries >= 30) clearInterval(timer);
    }, 500);

    const observer = new MutationObserver(() => {
      const narrative = findNarrative();
      if (narrative) render(narrative);
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
