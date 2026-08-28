/* Miracolo Lab v6 — preserve original dashboard, hide only deprecated controls */
(() => {
  const FIVE_MIN=300000;
  const css=`#scanBtn,.scan-btn,#refreshMarket,#scan,.auto-label,.header-actions,.price-ticker-wrap,#tickerWrap,.price-ticker{display:none!important}`;
  const s=document.createElement('style');s.id='mlUxV6';s.textContent=css;document.head.appendChild(s);
  function clean(){['scanBtn','scan','refreshMarket','tickerWrap'].forEach(id=>{const e=document.getElementById(id);if(e)e.remove()});document.querySelectorAll('.auto-label,.header-actions,.price-ticker-wrap,.price-ticker').forEach(e=>e.remove());}
  function boot(){clean();if(window.__mlAutoV6)return;window.__mlAutoV6=true;if(window.fetchCrypto)window.fetchCrypto();if(window.fetchAllPrices)window.fetchAllPrices();if(window.doScan)window.doScan();setInterval(()=>{if(window.fetchCrypto)window.fetchCrypto();if(window.fetchAllPrices)window.fetchAllPrices();if(window.doScan)window.doScan()},FIVE_MIN);}
  const t=setInterval(()=>{clean();if(typeof window.doScan==='function'){clearInterval(t);boot()}},50);setTimeout(()=>{clearInterval(t);boot()},6000);
})();
