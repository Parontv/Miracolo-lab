/* Miracolo Lab — startup */
window.addEventListener('DOMContentLoaded',()=>{
  setTimeout(()=>{
    const badge=document.querySelector('.build-badge');
    if(badge) badge.title='Build identificativa: V4.1 · Mobile investment layout · 28/08/2026';
    const nav=document.getElementById('portfolioNav');
    if(nav) nav.addEventListener('click',()=>document.getElementById('portfolioAdd')?.click());
    const layout=document.createElement('script');layout.src='/mobile-layout.js?v=1.1';document.body.appendChild(layout);
    const s=document.createElement('script');s.src='/app-enhancements.js?ts='+Date.now();document.head.appendChild(s);
  },100);
});
