/* Miracolo Lab — Strategy Lab UI refinement v4.0 */
(()=>{
  'use strict';

  const LABELS={
    'Multi-Agent':'Ruoli degli agenti',
    'Backtest':'Cosa viene verificato',
    'Learning':'Cosa monitora',
    Jesse:'Come analizza i dati',
    WolfBot:'Come analizza i dati',
    Historical:'Come analizza i dati'
  };

  const esc=v=>String(v??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));

  function moduleName(root){
    const title=root.querySelector('.sl2-title');
    if(!title) return '';
    const text=title.textContent.trim();
    return text.replace(/^[^A-Za-zÀ-ÿ]+/,'').split(/\s+[—–-]\s+/)[0].trim();
  }

  function build(root,submenu){
    if(!submenu || submenu.dataset.mlReplaced==='1') return;
    const items=[...submenu.querySelectorAll('.sl2-subtab')].map(x=>x.textContent.trim()).filter(Boolean);
    if(!items.length) return;

    const name=moduleName(root);
    const label=LABELS[name]||'Come analizza i dati';

    submenu.dataset.mlReplaced='1';

    const wrap=document.createElement('div');
    wrap.className='ml-method-wrap';
    wrap.dataset.module=name;

    const button=document.createElement('button');
    button.type='button';
    button.className='ml-method-toggle';
    button.setAttribute('aria-expanded','false');
    button.innerHTML=`<span>${esc(label)}</span><span class="ml-method-chevron">⌄</span>`;

    const panel=document.createElement('div');
    panel.className='ml-method-panel';
    panel.hidden=true;
    panel.innerHTML=items.map(x=>`<span class="ml-method-item">${esc(x)}</span>`).join('');

    button.addEventListener('click',()=>{
      const open=button.getAttribute('aria-expanded')==='true';
      button.setAttribute('aria-expanded',String(!open));
      panel.hidden=open;
      wrap.classList.toggle('is-open',!open);
    });

    wrap.append(button,panel);
    submenu.replaceWith(wrap);
  }

  function scan(){
    const submenus=[...document.querySelectorAll('.sl2-submenu')];
    submenus.forEach(submenu=>{
      const root=submenu.closest('.sl2-content')||submenu.parentElement;
      if(root) build(root,submenu);
    });

    /* Defensive path: if a future engine version changes the wrapper but keeps
       the old section buttons, remove those buttons and keep the methodology
       compact instead of allowing the old submenu to return. */
    document.querySelectorAll('.sl2-subtab').forEach(btn=>{
      const submenu=btn.closest('.sl2-submenu');
      if(submenu) return;
      const root=btn.closest('.sl2-content');
      if(!root) btn.remove();
    });
  }

  function boot(){
    scan();
    const observer=new MutationObserver(()=>scan());
    observer.observe(document.documentElement,{childList:true,subtree:true});
    [50,200,500,1000,2000,4000].forEach(ms=>setTimeout(scan,ms));
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
