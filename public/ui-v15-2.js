/* Miracolo Lab V15.2 — ETF-only P/L + unified Investments layout */
(()=>{'use strict';
const euro=v=>Number(v||0).toLocaleString('it-IT',{style:'currency',currency:'EUR',maximumFractionDigits:2});
const num=v=>{const n=Number(v);return Number.isFinite(n)&&n>=0?n:0};
const load=(k,f)=>{try{const x=JSON.parse(localStorage.getItem(k)||'null');return x??f}catch{return f}};
function price(map,s){const x=map?.[String(s||'').toUpperCase()];const p=Number(x?.price);return Number.isFinite(p)&&p>0?p:0}
function basis(x){const q=num(x.qty??x.quantity??x.units);if(num(x.avg)>0)return q*num(x.avg);if(num(x.averagePrice)>0)return q*num(x.averagePrice);if(num(x.invested)>0)return num(x.invested);if(num(x.cashValue)>0)return num(x.cashValue);return 0}
function patchInvestments(){if(window.__mlPanel!=='investimenti')return;const root=document.getElementById('sidePanel');if(!root)return;const total=root.querySelector('.iv13-total');if(!total)return;
  const etfs=load('ml_portfolio_v6.etf',[]),cryptos=load('ml_portfolio_v6.crypto',[]);const ep=window.__mlPrices||{},cp=window.__mlCryptoPrices||{};
  let etfCurrent=0,etfCost=0,missingEtfCost=false;
  for(const x of etfs){const q=num(x.qty??x.quantity??x.units),p=price(ep,x.symbol);if(q>0&&p>0)etfCurrent+=q*p;const b=basis(x);if(b>0)etfCost+=b;else if(q>0)missingEtfCost=true}
  let cryptoCurrent=0;
  for(const x of cryptos){const q=num(x.qty??x.quantity??x.units),p=price(cp,x.symbol);if(q>0&&p>0)cryptoCurrent+=q*p}
  const portfolioCurrent=etfCurrent+cryptoCurrent;
  if(portfolioCurrent<=0)return;
  const gain=etfCost>0?etfCurrent-etfCost:null;
  const pct=etfCost>0?(gain/etfCost)*100:null;
  let box=total.querySelector('.iv15-gain');if(!box){box=document.createElement('div');box.className='iv15-gain';total.appendChild(box)}
  if(gain===null){box.innerHTML='<span class="iv15-label">GUADAGNO / PERDITA ETF</span><strong class="iv15-na">Costo ETF non disponibile</strong>'}
  else{box.innerHTML=`<span class="iv15-label">GUADAGNO ETF</span><strong class="${gain>=0?'up':'down'}">${gain>=0?'+':''}${euro(gain)}</strong><small class="${gain>=0?'up':'down'}">${gain>=0?'+':''}${pct.toLocaleString('it-IT',{maximumFractionDigits:2})}%${missingEtfCost?' · alcune posizioni ETF senza costo':''}</small>`}
  root.querySelectorAll('.iv13-card').forEach(card=>card.querySelector('.iv15-crypto-pnl')?.remove())
}
function install(){if(document.getElementById('mlV152Style'))return;const s=document.createElement('style');s.id='mlV152Style';s.textContent=`.app-body{align-items:stretch!important;min-height:0!important}.side-col{align-self:stretch!important;align-items:flex-start!important;justify-content:flex-start!important;min-height:0!important;overflow:hidden!important}.side-panel{align-self:flex-start!important;display:block!important;width:100%!important;height:100%!important;min-height:0!important;max-height:none!important;overflow-y:auto!important;overflow-x:hidden!important;padding:0!important;margin:0!important}.iv13-wrap{width:100%!important;min-height:100%!important;padding:14px 18px 32px!important;box-sizing:border-box!important}.iv13-total{align-items:flex-start!important}.iv15-gain{display:flex;align-items:flex-end;gap:9px;flex-wrap:wrap;margin-top:8px}.iv15-label{font-size:9px;color:#64748b;letter-spacing:.3px}.iv15-gain strong{font-size:18px}.iv15-gain small{font-size:11px;font-weight:700}.iv15-na{color:#f59e0b!important;font-size:12px!important}.up{color:#4ade80!important}.down{color:#fb7185!important}`;document.head.appendChild(s)}
install();document.addEventListener('DOMContentLoaded',()=>{install();setTimeout(patchInvestments,250)});window.addEventListener('miracolo:investments-open',()=>setTimeout(patchInvestments,350));setInterval(()=>{if(window.__mlPanel==='investimenti'){install();patchInvestments()}},2000);
})();