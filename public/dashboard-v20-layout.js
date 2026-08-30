/* Miracolo Lab V20.01.05 — dashboard layout: AI upper, source recap lower */
(()=>{'use strict';
function move(){
 const feed=document.getElementById('feedCol'); if(!feed)return;
 const ai=document.getElementById('indexAiEvaluation');
 const sources=document.getElementById('sourceGrid');
 const head=feed.querySelector('.feed-head'); const results=document.getElementById('results');
 if(ai&&head&&ai.parentElement!==feed){feed.insertBefore(ai,head.nextSibling)}
 if(sources&&results&&sources.parentElement!==feed){feed.appendChild(sources)}
 if(ai&&head&&ai.parentElement===feed&&ai.previousElementSibling!==head){feed.insertBefore(ai,head.nextSibling)}
 if(sources&&sources.parentElement===feed&&sources.previousElementSibling!==results){feed.appendChild(sources)}
 if(sources){sources.removeAttribute('aria-hidden');sources.style.display='grid'}
}
function install(){move();new MutationObserver(()=>setTimeout(move,80)).observe(document.getElementById('feedCol')||document.body,{childList:true,subtree:true});setInterval(move,1000)}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',install):install();
})();
