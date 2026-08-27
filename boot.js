/* Miracolo Lab — startup */
window.addEventListener('DOMContentLoaded',()=>{
  setTimeout(()=>{
    const badge=document.querySelector('.build-badge');
    if(badge) badge.title='Build identificativa: V3.8 · Investment Command Center · 27/08/2026';
    const nav=document.getElementById('portfolioNav');
    if(nav) nav.addEventListener('click',()=>document.getElementById('portfolioAdd')?.click());
  },100);
});
