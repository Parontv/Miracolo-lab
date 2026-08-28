/* Miracolo Lab — startup */
window.addEventListener('DOMContentLoaded',()=>{
  setTimeout(()=>{
    const badge=document.querySelector('.build-badge');
    if(badge) badge.title='Build identificativa: V4.0 · Investment Command Center · 28/08/2026';
    const nav=document.getElementById('portfolioNav');
    if(nav) nav.addEventListener('click',()=>document.getElementById('portfolioAdd')?.click());

    /* Restore the main section menu to the TOP on mobile. */
    const style=document.createElement('style');
    style.id='ml-top-nav-fix';
    style.textContent=`
      @media(max-width:700px){
        .navbar,.tabs,.top-nav,.main-nav,.section-nav{position:sticky!important;top:0!important;bottom:auto!important;left:auto!important;right:auto!important;width:100%!important;z-index:40!important;display:flex!important;flex-direction:row!important;overflow-x:auto!important;overflow-y:hidden!important;margin:8px 0 10px!important;padding:4px 0!important;background:#080b0f!important;border-top:0!important;border-bottom:1px solid #29333e!important}
        .navbar .navbtn,.tabs button,.top-nav button,.main-nav button,.section-nav button{flex:0 0 auto!important}
        .mobile-select{display:none!important}
        body{padding-bottom:0!important}
        .bottom-nav,.bottom-navigation,.mobile-bottom-nav,.app-bottom-nav,[class*="bottom-nav"]{position:sticky!important;top:0!important;bottom:auto!important;order:-1!important}
      }
    `;
    document.head.appendChild(style);

    function moveBottomMenu(){
      const root=document.querySelector('.app,main')||document.body;
      const candidates=[...document.querySelectorAll('nav, .bottom-nav, .bottom-navigation, .mobile-bottom-nav, .app-bottom-nav')];
      const target=candidates.find(el=>{
        const t=(el.textContent||'').toLowerCase();
        return t.includes('dashboard') && t.includes('investimenti') && t.includes('bot') && (t.includes('learning')||t.includes('alert'));
      });
      if(target && root && target.parentElement!==root){root.insertBefore(target,root.firstElementChild?.nextSibling||root.firstChild)}
      if(target) target.classList.add('ml-restored-top-nav');
    }
    moveBottomMenu();
    setTimeout(moveBottomMenu,500);
    setTimeout(moveBottomMenu,1500);

    const s=document.createElement('script');s.src='/app-enhancements.js?ts='+Date.now();document.head.appendChild(s);
  },100);
});
