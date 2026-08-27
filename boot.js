/* Miracolo Lab — startup: app.js owns the initial scan and 20-minute timer */
window.addEventListener('DOMContentLoaded',()=>{
  setTimeout(()=>{
    const badge=document.querySelector('.build-badge');
    if(badge) badge.title='Build identificativa: V3.5 · 27/08/2026';
  },100);
});
