/* Miracolo Lab V21.1 — AI market intelligence presentation layer.
   Keeps the existing V20 AI engine as the source of truth and adds a stable,
   collapsible summary card above the source recap. */
(() => {
  'use strict';
  const VERSION = '21.1.0';
  const STORAGE_KEY = 'ml_ai_history_v21';
  const MAX_HISTORY = 500;

  const esc = (value) => String(value ?? '').replace(/[&<>\"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[ch]));

  function findNarrative() {
    return document.getElementById('aiMarketNarrative') || document.getElementById('indexAiEvaluation');
  }

  function getSnapshot() {
    const n = findNarrative();
    if (!n) return null;
    const text = n.innerText?.trim() || '';
    if (!text) return null;
    return {
      ts: new Date().toISOString(),
      text: text.slice(0, 4000),
      score: document.querySelector('[data-ai-score]')?.textContent?.trim() || null,
      sentiment: document.querySelector('[data-ai-sentiment]')?.textContent?.trim() || null
    };
  }

  function saveSnapshot(snapshot) {
    if (!snapshot) return;
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

  function installCard() {
    const sourceGrid = document.getElementById('sourceGrid');
    const narrative = findNarrative();
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
      sourceGrid.parentNode.insertBefore(card, sourceGrid);
      const toggle = card.querySelector('.ml-ai-toggle');
      toggle.addEventListener('click', () => {
        const open = card.dataset.open === 'true';
        card.dataset.open = open ? 'false' : 'true';
        toggle.setAttribute('aria-expanded', open ? 'false' : 'true');
        card.querySelector('.ml-ai-body').hidden = open;
        card.querySelector('.ml-ai-chevron').textContent = open ? '▸' : '▾';
      });
    }

    const body = card.querySelector('.ml-ai-body');
    const sourceText = narrative.innerHTML || narrative.innerText || '';
    if (sourceText.trim()) body.innerHTML = sourceText;
    narrative.style.display = 'none';
    saveSnapshot(getSnapshot());
    return true;
  }

  function style() {
    if (document.getElementById('ml-v21-intelligence-style')) return;
    const s = document.createElement('style');
    s.id = 'ml-v21-intelligence-style';
    s.textContent = `
      .ml-ai-market-card{margin:12px 0;border:1px solid #d9dee7;border-radius:12px;background:#fff;overflow:hidden;box-shadow:0 1px 2px rgba(15,23,42,.05)}
      .ml-ai-toggle{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;border:0;background:#f8fafc;color:#0f172a;padding:11px 13px;cursor:pointer;font:inherit;font-size:12px;font-weight:800;text-align:left}
      .ml-ai-toggle:hover{background:#f1f5f9}.ml-ai-chevron{font-size:14px;min-width:16px;text-align:center}.ml-ai-body{padding:12px 13px;color:#334155;font-size:12px;line-height:1.5}
      .ml-ai-body [style*="display:none"]{display:block!important}
      @media(max-width:520px){.ml-ai-market-card{margin:8px 0}.ml-ai-toggle{padding:10px 11px;font-size:11px}.ml-ai-body{padding:10px 11px;font-size:11px}}
    `;
    document.head.appendChild(s);
  }

  function boot() {
    style();
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (installCard() || tries >= 20) clearInterval(timer);
    }, 500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
