/* Miracolo Lab — automatic startup */
window.addEventListener('DOMContentLoaded',()=>{
  setTimeout(()=>{
    if(typeof window.scan==='function') window.scan();
    else if(typeof scan==='function') scan();
  },450);
});
