/* Miracolo Lab — Bot compact runtime v2.2 */
(()=>{'use strict';
function closeDetails(){document.querySelectorAll('#botResult details.bot-sources').forEach(x=>x.removeAttribute('open'));}
window.addEventListener('miracolo:botdecision',()=>setTimeout(closeDetails,0));
window.addEventListener('miracolo:botui',()=>setTimeout(closeDetails,80));
window.addEventListener('load',()=>setTimeout(closeDetails,120));
})();
