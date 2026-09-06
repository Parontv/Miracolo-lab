/* Miracolo Lab V1 — minimal compatibility contract for the secondary application engine. */
(() => {
  const ids = ['autoToggle','scanBtn','scanIcon','statusDot','botBar','botBarStatus','botBarValue','botBarPnl','botBarAcc','botBarPending','bsScore','bsLevel','bsTriggers','bsAlert','tradeModal','tradeModalClose','tradeModalBody'];
  for (const id of ids) {
    if (document.getElementById(id)) continue;
    const el = document.createElement(id === 'scanBtn' ? 'button' : id === 'autoToggle' ? 'input' : 'div');
    el.id = id;
    if (id === 'autoToggle') { el.type='checkbox'; el.checked=false; }
    if (id === 'scanBtn') { el.type='button'; el.textContent='Scan'; el.disabled=false; }
    el.hidden = true;
    document.body.appendChild(el);
  }
})();
