/* Miracolo Lab — Market tab V1
   Financial chart UI built around TradingView Lightweight Charts.
   Data stays on Miracolo Lab endpoints; the chart library is presentation only.
*/
(()=>{'use strict';
const PERIODS=[['1d','1D'],['5d','5D'],['1m','1M'],['3m','3M'],['1y','1Y']];
const ASSETS=[
['^GSPC','S&P 500','index'],['^NDX','Nasdaq 100','index'],['^DJI','Dow Jones','index'],['^VIX','VIX','index'],
['^RUT','Russell 2000','index'],['^IXIC','Nasdaq Composite','index'],['^GDAXI','DAX','index'],['^FCHI','CAC 40','index'],
['FTSEMIB.MI','FTSE MIB','index'],['^FTSE','FTSE 100','index'],['^N225','Nikkei 225','index'],['^STOXX50E','Euro Stoxx 50','index'],
['DX-Y.NYB','Dollar Index','fx'],['GC=F','Gold','commodity'],['BZ=F','Brent','commodity'],['CL=F','WTI Oil','commodity'],
['HG=F','Copper','commodity'],['EURUSD=X','EUR/USD','fx'],['JPY=X','USD/JPY','fx'],['GBPUSD=X','GBP/USD','fx'],['^TNX','US 10Y','rates'],
['BTC-EUR','Bitcoin','crypto'],['ETH-EUR','Ethereum','crypto']
];
let state={symbol:'^GSPC',period:'5d',market:null,chart:null,volume:null,rsi:null,resize:null,request:0};

function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function fmt(n,d=2){return Number(n||0).toLocaleString('it-IT',{minimumFractionDigits:d,maximumFractionDigits:d});}
function getAsset(){return ASSETS.find(x=>x[0]===state.symbol)||ASSETS[0];}
function findMarket(){const m=state.market||{};if(state.symbol==='BTC-EUR'||state.symbol==='ETH-EUR'){const sym=state.symbol.startsWith('BTC')?'BTC':'ETH';const c=(m.crypto||[]).find(x=>x.symbol===sym);return c?{name:sym,price:c.price,changePct:c.change24h,rsi:null,ok:c.ok,evaluation:null}:null}return(m.indices||[]).find(x=>x.ticker===state.symbol)||null;}
function calcRSI(candles,n=14){const out=[];if(candles.length<n+1)return out;let gain=0,loss=0;for(let i=1;i<=n;i++){const d=candles[i].close-candles[i-1].close;if(d>=0)gain+=d;else loss-=d}let avgGain=gain/n,avgLoss=loss/n;out.push({time:candles[n].time,value:avgLoss?100-(100/(1+avgGain/avgLoss)):100});for(let i=n+1;i<candles.length;i++){const d=candles[i].close-candles[i-1].close,g=d>0?d:0,l=d<0?-d:0;avgGain=(avgGain*(n-1)+g)/n;avgLoss=(avgLoss*(n-1)+l)/n;out.push({time:candles[i].time,value:avgLoss?100-(100/(1+avgGain/avgLoss)):100});}return out;}
function baseOptions(height){return{width:10,height,layout:{background:{type:'solid',color:'transparent'},textColor:'#64748b'},grid:{vertLines:{color:'rgba(100,116,139,.08)'},horzLines:{color:'rgba(100,116,139,.08)'}},rightPriceScale:{borderColor:'rgba(100,116,139,.12)'},timeScale:{borderColor:'rgba(100,116,139,.12)',timeVisible:true,secondsVisible:false},crosshair:{mode:0}}}
function clearCharts(){for(const key of ['chart','volume','rsi']){try{state[key]?.remove()}catch{}state[key]=null}if(state.resize){try{state.resize.disconnect()}catch{}state.resize=null}}
function renderShell(){
 const el=document.getElementById('sidePanel');if(!el)return;
 const opts=ASSETS.map(x=>'<option value="'+esc(x[0])+'"'+(x[0]===state.symbol?' selected':'')+'>'+esc(x[1])+'</option>').join('');
 el.innerHTML='<div class="market-wrap"><div class="panel-header"><div class="panel-title">📈 Market</div><div class="panel-sub">Grafici e indicatori dei mercati monitorati</div></div>'+
 '<div class="market-toolbar"><select id="marketAsset" class="market-select">'+opts+'</select><div class="market-periods">'+PERIODS.map(p=>'<button class="market-period '+(p[0]===state.period?'active':'')+'" data-period="'+p[0]+'">'+p[1]+'</button>').join('')+'</div></div>'+
 '<div id="marketContent"><div class="market-loading">Caricamento dati di mercato…</div></div>'+
 '<div class="market-attribution">Grafici con <a href="https://www.tradingview.com/" target="_blank" rel="noopener">TradingView Lightweight Charts</a>.</div></div>';
 document.getElementById('marketAsset').onchange=e=>{state.symbol=e.target.value;loadChart()};
 document.querySelectorAll('.market-period').forEach(b=>b.onclick=()=>{state.period=b.dataset.period;renderShell();loadChart()});
}
function renderContent(candles){
 const el=document.getElementById('marketContent');if(!el)return;
 const m=findMarket(),first=candles[0],last=candles[candles.length-1],chg=first?.close?((last.close-first.close)/first.close)*100:0;
 const cls=chg>0?'market-up':chg<0?'market-down':'market-neutral';
 const ev=m?.evaluation||null;
 el.innerHTML='<div class="market-head"><div><div class="market-title">'+esc(getAsset()[1])+'</div><div class="market-sub">'+esc(state.symbol)+' · '+esc(state.period.toUpperCase())+'</div></div><div><div class="market-price">'+fmt(last.close,last.close>=100?2:4)+'</div><div class="market-change '+cls+'">'+(chg>=0?'+':'')+fmt(chg,2)+'% periodo</div></div></div>'+
 '<div class="market-stats"><div class="market-stat"><div class="market-stat-label">Ultimo</div><div class="market-stat-value">'+fmt(last.close,last.close>=100?2:4)+'</div></div><div class="market-stat"><div class="market-stat-label">RSI</div><div id="marketRsiValue" class="market-stat-value">—</div></div><div class="market-stat"><div class="market-stat-label">Segnale</div><div class="market-stat-value">'+(ev?esc(ev.action):'—')+'</div></div><div class="market-stat"><div class="market-stat-label">Confidence</div><div class="market-stat-value">'+(ev?fmt(ev.confidence,0)+'%':'—')+'</div></div></div>'+
 (ev?'<div class="market-signal"><div><div class="market-signal-label">Market engine</div><div class="market-signal-action '+(ev.action==='BUY'?'market-up':ev.action==='SELL'?'market-down':'market-neutral')+'">'+esc(ev.action)+'</div><div class="market-sub">'+esc(ev.reason||'Segnali misti')+'</div></div><div class="market-signal-score">'+fmt(ev.score,0)+'/100</div></div>':'')+
 '<section class="market-card"><div class="market-card-head"><strong>Prezzo</strong><span>OHLC · zoom · crosshair</span></div><div id="marketChart" class="market-chart"></div></section>'+
 '<section class="market-card"><div class="market-card-head"><strong>Volume</strong><span>Volume per periodo</span></div><div id="marketVolume" class="market-volume"></div></section>'+
 '<section class="market-card"><div class="market-card-head"><strong>RSI 14</strong><span>30 oversold · 70 overbought</span></div><div id="marketRsi" class="market-rsi"></div></section>';
}
function renderCharts(candles){
 if(!window.LightweightCharts){document.getElementById('marketContent').innerHTML='<div class="market-error">Motore grafico non disponibile. Riprova tra qualche secondo.</div>';return}
 clearCharts();
 const LC=window.LightweightCharts,mainEl=document.getElementById('marketChart'),volEl=document.getElementById('marketVolume'),rsiEl=document.getElementById('marketRsi');
 if(!mainEl||!volEl||!rsiEl)return;
 state.chart=LC.createChart(mainEl,baseOptions(mainEl.clientHeight||390));
 const candle=state.chart.addSeries(LC.CandlestickSeries,{upColor:'#4ade80',downColor:'#fb7185',borderVisible:false,wickUpColor:'#4ade80',wickDownColor:'#fb7185'});
 candle.setData(candles.map(x=>({time:x.time,open:x.open,high:x.high,low:x.low,close:x.close})));
 state.chart.timeScale().fitContent();
 state.volume=LC.createChart(volEl,baseOptions(volEl.clientHeight||105));
 const volume=state.volume.addSeries(LC.HistogramSeries,{priceFormat:{type:'volume'},priceScaleId:''});
 volume.priceScale().applyOptions({scaleMargins:{top:.15,bottom:.05}});
 volume.setData(candles.map(x=>({time:x.time,value:x.volume||0,color:x.close>=x.open?'rgba(74,222,128,.45)':'rgba(251,113,133,.45)'})));
 state.volume.timeScale().fitContent();
 state.rsi=LC.createChart(rsiEl,baseOptions(rsiEl.clientHeight||130));
 const rsiSeries=state.rsi.addSeries(LC.LineSeries,{lineWidth:2,color:'#a78bfa'});
 const rsi=calcRSI(candles);rsiSeries.setData(rsi);
 state.rsi.timeScale().fitContent();
 const rv=rsi.at(-1)?.value;if(rv!=null){const x=document.getElementById('marketRsiValue');if(x)x.textContent=fmt(rv,1)}
 const ro=new ResizeObserver(()=>{if(state.chart){state.chart.applyOptions({width:mainEl.clientWidth});state.volume?.applyOptions({width:volEl.clientWidth});state.rsi?.applyOptions({width:rsiEl.clientWidth})}});ro.observe(mainEl);state.resize=ro;
}
async function loadMarket(){try{const r=await fetch('/api/market-monitor?ts='+Date.now(),{cache:'no-store'});if(r.ok)state.market=await r.json()}catch(e){console.warn('Market monitor:',e.message)}}
async function loadChart(){
 if(window.__mlPanel!=='market')return;
 const token=++state.request;renderShell();
 const content=document.getElementById('marketContent');if(content)content.innerHTML='<div class="market-loading">Caricamento '+esc(getAsset()[1])+'…</div>';
 try{
   await loadMarket();
   const r=await fetch('/api/chart?symbol='+encodeURIComponent(state.symbol)+'&period='+encodeURIComponent(state.period)+'&ts='+Date.now(),{cache:'no-store'});
   const d=await r.json();if(token!==state.request)return;
   if(!d.ok||!Array.isArray(d.candles)||d.candles.length<2)throw Error(d.error||'Dati grafico non disponibili');
   renderContent(d.candles);renderCharts(d.candles);
 }catch(e){if(token!==state.request)return;const x=document.getElementById('marketContent');if(x)x.innerHTML='<div class="market-error">Dati grafico non disponibili.<br><small>'+esc(e.message)+'</small></div>'}
}
function activate(id){if(id!=='market')return;window.__mlPanel='market';loadChart()}
function install(){if(window.__ML_MARKET_V1)return;window.__ML_MARKET_V1=true;window.addEventListener('miracolo:panelchange',e=>activate(e.detail?.panel));window.addEventListener('miracolo:panel-change',e=>activate(e.detail?.panel));if(window.__mlPanel==='market')activate('market');setInterval(()=>{if(window.__mlPanel==='market')loadChart()},300000)}
const st=document.createElement('style');st.textContent='';document.head.appendChild(st);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();