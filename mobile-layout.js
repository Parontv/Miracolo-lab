(function(){
  const KEY='miracolo_lab_portfolio_v1',HIST='miracolo_lab_value_history_v1';
  const $=id=>document.getElementById(id);
  const money=v=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR',maximumFractionDigits:2}).format(Number(v)||0);
  function portfolioValue(){try{return JSON.parse(localStorage.getItem(KEY)||'[]').reduce((a,x)=>a+(Number(x.value)||0),0)}catch{return 0}}
  function history(){try{return JSON.parse(localStorage.getItem(HIST)||'[]')}catch{return[]}}
  function savePoint(){const v=portfolioValue();if(!v)return;let h=history(),now=Date.now();const last=h[h.length-1];if(last&&now-last.t<300000)return;h=h.filter(x=>now-x.t<90*86400000);h.push({t:now,v});localStorage.setItem(HIST,JSON.stringify(h.slice(-120)))}
  function renderChart(){const host=$('mlChart');if(!host)return;const h=history();if(h.length<2){host.innerHTML='<div class="ml-chart-empty">Il grafico si costruirà automaticamente con i dati del portafoglio.</div>';return}const w=720,hh=225,p=10,vals=h.map(x=>x.v),min=Math.min(...vals),max=Math.max(...vals),range=max-min||1;const pts=h.map((x,i)=>{const X=p+(i/(h.length-1))*(w-p*2),Y=hh-p-((x.v-min)/range)*(hh-p*2);return [X,Y]}),line=pts.map((q,i)=>(i?'L':'M')+q[0].toFixed(1)+' '+q[1].toFixed(1)).join(' '),area=line+' L '+pts.at(-1)[0].toFixed(1)+' '+(hh-p)+' L '+p+' '+(hh-p)+' Z';host.innerHTML='<svg viewBox="0 0 '+w+' '+hh" preserveAspectRatio="none" aria-label="Andamento patrimonio"><path d="'+area+'" fill="rgba(248,113,113,.08)"/><path d="'+line+'" fill="none" stroke="#f0443e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>'}
  function build(){
    if(document.querySelector('.ml-mobile-header'))return;
    const app=document.querySelector('.app');if(!app)return;
    const head=document.createElement('div');head.className='ml-mobile-header';head.innerHTML='<div class="ml-user"><div class="ml-avatar">R</div><div class="ml-home-title">Inizio</div></div><div class="ml-actions"><div class="ml-bell">♧<span class="ml-dot"></span></div><button class="ml-unlock">Sblocca</button></div>';
    const hero=document.createElement('section');hero.className='ml-hero';hero.innerHTML='<div class="ml-label">Patrimonio</div><div class="ml-total" id="mlTotal">€0<small>,00</small></div><div class="ml-change neutral" id="mlChange">— andamento</div><div class="ml-chart" id="mlChart"></div><div class="ml-range"><button class="active">1G</button><button>1S</button><button>1M</button><button>YTD</button><button>1Y</button><button>Max</button></div>';
    app.insertBefore(head,app.firstChild);app.insertBefore(hero,head.nextSibling);
    const link=document.createElement('link');link.rel='stylesheet';link.href='/mobile-layout.css?v=1.1';document.head.appendChild(link);
    const nav=app.querySelector('.navbar');if(nav){nav.querySelectorAll('.navbtn').forEach(b=>b.addEventListener('click',()=>{if(b.id==='portfolioNav'){$('portfolioAdd')?.click();return}}));}
    savePoint();update();renderChart();
  }
  function update(){const v=portfolioValue();const el=$('mlTotal');if(el)el.innerHTML=money(v).replace('€','€').replace(',00','<small>,00</small>');}
  function wire(){const nav=document.querySelector('.navbar');if(!nav)return;nav.querySelectorAll('.navbtn').forEach(b=>{b.addEventListener('click',()=>{const f=b.dataset.filter;if(f&&window.applyView)window.applyView(f);if(b.id==='portfolioNav'){$('portfolioAdd')?.click()}})});}
  document.addEventListener('DOMContentLoaded',()=>{build();setTimeout(wire,300);setInterval(()=>{savePoint();update();renderChart()},30000)});
})();