/* Miracolo Lab v5 UX layer: automatic refresh + top navigation + tab isolation */
(() => {
  const FIVE_MIN = 5 * 60 * 1000;
  const STYLE = `
    .scan-btn{display:none!important}
    .app-body{display:flex!important;flex-direction:column!important}
    .side-col{display:flex!important;flex-direction:column!important;width:100%!important;order:-1}
    .tab-rail{display:flex!important;flex-direction:row!important;gap:6px!important;overflow-x:auto!important;width:100%!important;order:0!important;padding:8px 10px!important;position:sticky!important;top:0!important;z-index:30!important}
    .rail-btn{flex:0 0 auto!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;min-width:72px!important}
    .side-panel{width:100%!important;order:1!important}
    .feed-col{width:100%!important;order:2!important}
    .ux-tab-hidden{display:none!important}
    .ux-panel-main .side-panel{width:100%!important;min-height:55vh!important}
    @media(max-width:700px){.rail-btn{min-width:64px!important}.rail-lbl{font-size:10px!important}.tab-rail{gap:3px!important;padding:6px!important}}
  `;
  function css(){ if(document.getElementById('mlUxStyle'))return; const s=document.createElement('style');s.id='mlUxStyle';s.textContent=STYLE;document.head.appendChild(s); }
  function applyLayout(){
    css();
    const scan=document.getElementById('scanBtn'); if(scan)scan.remove();
    const auto=document.getElementById('autoToggle'); if(auto){auto.checked=true;auto.disabled=true;}
    const label=document.querySelector('.auto-label'); if(label){const t=label.querySelector('.auto-text');if(t)t.textContent='Auto 5 min';}
  }
  function isolateTab(panel){
    const feed=document.getElementById('feedCol'),side=document.querySelector('.side-col'); if(!feed||!side)return;
    const dashboard=panel==='radar'; feed.classList.toggle('ux-dashboard-feed',dashboard);feed.classList.toggle('ux-tab-hidden',!dashboard);side.classList.toggle('ux-panel-main',!dashboard);
  }
  function installPanelHook(){
    if(typeof window.setPanel!=='function'||window.setPanel.__uxWrapped)return;
    const original=window.setPanel;
    function wrapped(panel){original(panel);isolateTab(panel);}
    wrapped.__uxWrapped=true;window.setPanel=wrapped;isolateTab(window.S?.activePanel||'radar');
  }
  function startAuto(){
    if(window.__miracoloAuto5)return; window.__miracoloAuto5=true; applyLayout(); installPanelHook();
    if(typeof window.fetchCrypto==='function')window.fetchCrypto();
    if(typeof window.fetchAllPrices==='function')window.fetchAllPrices();
    if(typeof window.doScan==='function')window.doScan();
    setInterval(()=>{
      if(typeof window.fetchCrypto==='function')window.fetchCrypto();
      if(typeof window.fetchAllPrices==='function')window.fetchAllPrices();
      if(typeof window.doScan==='function')window.doScan();
    },FIVE_MIN);
  }
  const timer=setInterval(()=>{applyLayout();installPanelHook();if(typeof window.doScan==='function'){clearInterval(timer);startAuto();}},50);
})();
