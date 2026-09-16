/* Miracolo Lab — Strategy Lab UI refinement v1.1
 * Keep methodology visible in one compact disclosure instead of many inactive buttons.
 */
(()=>{
  'use strict';

  const LABELS={
    'Multi-Agent':'Ruoli degli agenti',
    Backtest:'Cosa viene verificato',
    Learning:'Cosa monitora',
    Jesse:'Come analizza i dati',
    WolfBot:'Come analizza i dati',
    Historical:'Come analizza i dati'
  };

  function compactSubmenu(content){
    if(!content) return;
    const submenu=content.querySelector('.sl2-submenu');
    if(!submenu || submenu.dataset.compact==='1') return;

    const items=[...submenu.querySelectorAll('.sl2-subtab')]
      .map(x=>x.textContent.trim())
      .filter(Boolean);
    if(!items.length) return;

    submenu.dataset.compact='1';
    submenu.style.display='none';

    const title=(content.querySelector('.sl2-title')?.textContent||'').replace(/^\S+\s*/,'').trim();
    const label=LABELS[title]||'Metodo di analisi';

    const wrap=document.createElement('div');
    wrap.className='ml-method-wrap';

    const button=document.createElement('button');
    button.type='button';
    button.className='ml-method-toggle';
    button.setAttribute('aria-expanded','false');
    button.innerHTML=`<span>${label}</span><span class="ml-method-chevron">⌄</span>`;

    const panel=document.createElement('div');
    panel.className='ml-method-panel';
    panel.hidden=true;
    panel.innerHTML=items.map(x=>`<span class="ml-method-item">${escapeHtml(x)}</span>`).join('');

    button.addEventListener('click',()=>{
      const open=button.getAttribute('aria-expanded')==='true';
      button.setAttribute('aria-expanded',String(!open));
      panel.hidden=open;
      wrap.classList.toggle('is-open',!open);
    });

    wrap.append(button,panel);
    const actions=content.querySelector('.sl2-actions');
    content.insertBefore(wrap,actions||null);
  }

  function escapeHtml(value){
    return String(value).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  function scan(){
    document.querySelectorAll('.sl2-content').forEach(compactSubmenu);
  }

  let timer;
  const observer=new MutationObserver(()=>{
    clearTimeout(timer);
    timer=setTimeout(scan,40);
  });

  function boot(){
    scan();
    observer.observe(document.body,{childList:true,subtree:true});
    setTimeout(scan,100);
    setTimeout(scan,500);
    setTimeout(scan,1500);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot);
  else boot();
})();
