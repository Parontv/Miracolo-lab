/* Miracolo Lab compatibility layer — keeps the original app.js contract intact. */
(() => {
  const ids = ['autoToggle','scanBtn','scanIcon','statusDot','botBar','botBarStatus','botBarValue','botBarPnl','botBarAcc','botBarPending','bsScore','bsLevel','bsTriggers','bsAlert','tradeModal','tradeModalClose','tradeModalBody'];
  for (const id of ids) {
    if (document.getElementById(id)) continue;
    const el = document.createElement(id === 'scanBtn' ? 'button' : id === 'autoToggle' ? 'input' : 'div');
    el.id = id;
    if (id === 'autoToggle') { el.type='checkbox'; el.checked=false; }
    if (id === 'scanBtn') { el.type='button'; el.textContent='Scan'; el.disabled=false; }
    el.style.display='none';
    document.body.appendChild(el);
  }
})();
