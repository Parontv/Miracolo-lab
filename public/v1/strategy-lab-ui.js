/* Miracolo Lab — Strategy Lab UI refinement
 * Keeps methodology visible without wasting vertical space on inactive section buttons.
 */
(()=>{
  'use strict';

  const METHODS={
    Jesse:{label:'Come analizza i dati',items:[
      'Market Structure','Trend Analysis','Momentum','RSI','MACD','EMA / SMA','Bollinger Bands',
      'Support & Resistance','Breakout Detection','Volume Analysis','Volatility','Multi-Timeframe',
      'Signal','Confidence','Historical Comparison','Strategy Performance'
    ]},
    WolfBot:{label:'Come analizza i dati',items:[
      'Trend','Momentum','RSI / MACD','Moving Averages','Bollinger Bands','Breakout','Volume',
      'Volatility','Support / Resistance','Signal','Risk / Reward','Confidence','Performance'
    ]},
    'Multi-Agent':{label:'Ruoli degli agenti',items:[
      'Bull Agent','Bear Agent','Trader Agent','Risk Agent','Evidence','Debate','Consensus','Confidence','Risk Flags'
    ]},
    Historical:{label:'Come analizza i dati',items:[
      'Data Quality','Analogues','Market Regimes','Similar Events','Outcome Distribution','Time Horizons','Reliability','Limitations'
    ]},
    Backtest:{label:'Cosa viene verificato',items:[
      'Returns','Trades','Win Rate','Drawdown','Profit Factor','Benchmark','Risk Adjusted','Robustness','Limitations'
    ]},
    Learning:{label:'Cosa monitora',items:[
      'Accuracy','Signal Quality','Strategy Performance','Error Analysis','Recent Outcomes','Drift','Reliability','Improvements','Limits'
    ]}
  };

  const LEGACY=new Set(['Overview',...Object.values(METHODS).flatMap(x=>x.items)]);
  const norm=s=>String(s||'').replace(/\s+/g,' ').trim();
  const exact=(root,text)=>Array.from(root.querySelectorAll('*')).filter(el=>norm(el.textContent)===text);

  function moduleBox(name){
    const title=exact(document,name)[0];
    if(!title) return null;
    let el=title;
    for(let i=0;i<7&&el;i++,el=el.parentElement){
      const count=Array.from(el.querySelectorAll('*')).filter(x=>LEGACY.has(norm(x.textContent))).length;
      if(count>=2) return el;
    }
    return null;
  }

  function render(name,box){
    if(!box || box.querySelector(':scope > .ml-method-toggle')) return;
    const cfg=METHODS[name];
    if(!cfg) return;

    const nodes=[];
    for(const item of cfg.items){
      exact(box,item).forEach(el=>{
        if(!nodes.includes(el)) nodes.push(el);
      });
    }
    exact(box,'Overview').forEach(el=>{if(!nodes.includes(el))nodes.push(el)});
    if(!nodes.length) return;

    nodes.forEach(el=>el.classList.add('ml-legacy-section-hidden'));

    const wrap=document.createElement('div');
    wrap.className='ml-method-wrap';

    const button=document.createElement('button');
    button.type='button';
    button.className='ml-method-toggle';
    button.setAttribute('aria-expanded','false');
    button.innerHTML=`<span>${cfg.label}</span><span class="ml-method-chevron">⌄</span>`;

    const panel=document.createElement('div');
    panel.className='ml-method-panel';
    panel.hidden=true;
    panel.innerHTML=cfg.items.map(x=>`<span class="ml-method-item">${x}</span>`).join('');

    button.addEventListener('click',()=>{
      const open=button.getAttribute('aria-expanded')==='true';
      button.setAttribute('aria-expanded',String(!open));
      panel.hidden=open;
      wrap.classList.toggle('is-open',!open);
    });

    wrap.append(button,panel);
    const first=nodes.slice().sort((a,b)=>{
      const p=a.compareDocumentPosition(b);
      return p&Node.DOCUMENT_POSITION_FOLLOWING?-1:1;
    })[0];
    first.parentNode.insertBefore(wrap,first);
  }

  function scan(){
    Object.keys(METHODS).forEach(name=>render(name,moduleBox(name)));
  }

  let timer;
  const observer=new MutationObserver(()=>{
    clearTimeout(timer);
    timer=setTimeout(scan,80);
  });

  document.addEventListener('DOMContentLoaded',()=>{
    scan();
    observer.observe(document.body,{childList:true,subtree:true});
    setTimeout(scan,250);
    setTimeout(scan,1000);
  });
})();
