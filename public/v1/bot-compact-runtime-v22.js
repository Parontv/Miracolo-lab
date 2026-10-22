/* Miracolo Lab — Bot compact runtime v2.3 */
(()=>{'use strict';
function closeDetails(){
  document.querySelectorAll('#botResult details.bot-sources, .bot-strategy-fold, .bot-operation-fold, .bot-unified > details:not(.bot-sources-fold)').forEach(x=>x.removeAttribute('open'));
}
window.addEventListener('miracolo:botdecision',()=>setTimeout(closeDetails,0));
window.addEventListener('miracolo:botui',()=>setTimeout(closeDetails,80));
window.addEventListener('load',()=>setTimeout(closeDetails,120));
})();
