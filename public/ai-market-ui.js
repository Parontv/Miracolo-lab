/* Miracolo Lab — AI Market Intelligence UI */
(() => {
  'use strict';
  const esc = (value) => String(value ?? '').replace(/[&<>\"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const hideLegacy = () => {
    document.querySelectorAll('.v1-market-card .v1-card-head > div:last-child strong, .v1-market-card .v1-market-label, .v1-market-card .v1-ai-foot').forEach((el) => { el.style.display = 'none'; });
  };
  const render = (ai) => {
    if (!ai || ai.status !== 'ok') return false;
    const box = document.getElementById('v1-market-content');
    if (!box) return false;
    hideLegacy();
    box.innerHTML = `<div class="v1-ai-headline">${esc(ai.headline || 'Lettura del mercato')}</div><div class="v1-ai-thesis"><b>Lettura del mercato</b><span>${esc(ai.thesis || '')}</span></div>${ai.summary ? `<p class="v1-ai-summary">${esc(ai.summary)}</p>` : ''}${ai.bullish ? `<div class="v1-ai-block v1-ai-positive"><b>Fattori favorevoli</b><span>${esc(ai.bullish)}</span></div>` : ''}${ai.bearish ? `<div class="v1-ai-block v1-ai-negative"><b>Rischi / fattori contrari</b><span>${esc(ai.bearish)}</span></div>` : ''}${ai.watch ? `<div class="v1-ai-block v1-ai-watch"><b>Da monitorare</b><span>${esc(ai.watch)}</span></div>` : ''}`;
    return true;
  };
  const applyState = (state) => {
    if (state?.ai?.status === 'ok') render(state.ai);
  };
  const load = async () => {
    try {
      const response = await fetch('/api/live?ai=1', { cache: 'no-store' });
      if (!response.ok) return;
      applyState(await response.json());
    } catch {}
  };
  const boot = () => {
    load();
    if (window.ML?.on) window.ML.on('state', applyState);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();
