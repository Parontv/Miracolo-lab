/* Miracolo Lab — market intelligence & paper-trading engine */
const INDEXES = [
  ['S&P 500','^GSPC'],['Nasdaq Composite','^IXIC'],['Dow Jones','^DJI'],['Russell 2000','^RUT'],['VIX','^VIX'],
  ['FTSE 100','^FTSE'],['DAX','^GDAXI'],['CAC 40','^FCHI'],['Euro Stoxx 50','^STOXX50E'],['Nikkei 225','^N225'],
  ['Hang Seng','^HSI'],['Shanghai Composite','^SSEC'],['Nifty 50','^NSEI'],['Sensex','^BSESN'],['Bovespa','^BVSP'],['TSX','^GSPTSE']
];
const WATCHLIST = [
  ['NVIDIA','NVDA'],['Apple','AAPL'],['Microsoft','MSFT'],['Amazon','AMZN'],['Alphabet','GOOGL'],['Meta','META'],
  ['Tesla','TSLA'],['AMD','AMD'],['Broadcom','AVGO'],['ASML','ASML'],['TSMC','TSM'],['Palantir','PLTR'],['CrowdStrike','CRWD'],['ARM','ARM'],
  ['Berkshire Hathaway','BRK-B'],['JPMorgan','JPM'],['Eli Lilly','LLY'],['Novo Nordisk','NVO']
];
const MACRO = [['Gold','GC=F'],['Silver','SI=F'],['Crude Oil','CL=F'],['Copper','HG=F'],['10Y Treasury','^TNX'],['EUR/USD','EURUSD=X']];

async function yahoo(symbol, range='5d', interval='1d') {
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(symbol) + '?range=' + range + '&interval=' + interval + '&includePrePost=true';
  const r = await fetch(url, {headers:{'User-Agent':'Mozilla/5.0','Accept':'application/json'}});
  if (!r.ok) throw new Error('Yahoo '+r.status);
  const j = await r.json();
  const res = j?.chart?.result?.[0];
  if (!res) throw new Error('No data');
  const q = res.indicators?.quote?.[0] || {};
  const adj = res.indicators?.adjclose?.[0]?.adjclose || [];
  const ts = res.timestamp || [];
  const rows = ts.map((t,i)=>({time:t,open:q.open?.[i],high:q.high?.[i],low:q.low?.[i],close:q.close?.[i] ?? adj[i],volume:q.volume?.[i]})).filter(x=>Number.isFinite(x.close));
  const meta = res.meta || {};
  const last = rows.at(-1), prev = rows.at(-2);
  return {symbol,name:meta.longName||meta.shortName||symbol,currency:meta.currency||'',price:last?.close??meta.regularMarketPrice,change: last&&prev ? last.close-prev.close : null,changePct:last&&prev ? ((last.close/prev.close)-1)*100 : null,rows,marketState:meta.marketState||''};
}

function sma(rows,n){if(rows.length<n)return null;return rows.slice(-n).reduce((a,x)=>a+x.close,0)/n;}
function ema(rows,n){if(rows.length<n)return null;let e=rows.slice(0,n).reduce((a,x)=>a+x.close,0)/n;const k=2/(n+1);for(const x of rows.slice(n))e=x.close*k+e*(1-k);return e;}
function rsi(rows,n=14){if(rows.length<=n)return null;let gain=0,loss=0;for(let i=rows.length-n;i<rows.length;i++){const d=rows[i].close-rows[i-1].close;if(d>=0)gain+=d;else loss-=d;}if(loss===0)return 100;const rs=(gain/n)/(loss/n);return 100-(100/(1+rs));}
function atr(rows,n=14){if(rows.length<=n)return null;const trs=[];for(let i=1;i<rows.length;i++)trs.push(Math.max(rows[i].high-rows[i].low,Math.abs(rows[i].high-rows[i-1].close),Math.abs(rows[i].low-rows[i-1].close)));return trs.slice(-n).reduce((a,x)=>a+x,0)/n;}
function scoreAsset(m){
  const p=m.price,s20=sma(m.rows,20),s50=sma(m.rows,50),e20=ema(m.rows,20),r=rsi(m.rows), a=atr(m.rows);
  let score=50, reasons=[];
  if(p>s20){score+=8;reasons.push('prezzo sopra SMA20')}else{score-=8;reasons.push('prezzo sotto SMA20')}
  if(s20&&s50){if(s20>s50){score+=10;reasons.push('trend SMA20>SMA50')}else{score-=10;reasons.push('trend SMA20<SMA50')}}
  if(e20&&p>e20){score+=5;reasons.push('momentum sopra EMA20')}else if(e20){score-=5;reasons.push('momentum sotto EMA20')}
  if(r!==null){if(r>=55&&r<=70){score+=8;reasons.push('RSI costruttivo')}else if(r>75){score-=12;reasons.push('RSI ipercomprato')}else if(r<30){score+=4;reasons.push('RSI ipervenduto')}else if(r<45){score-=6;reasons.push('RSI debole')}}
  const action=score>=70?'BUY':score>=58?'WATCH':score<=38?'AVOID':'NEUTRAL';
  return {score:Math.max(0,Math.min(100,Math.round(score))),action,price,sma20:s20,sma50:s50,ema20:e20,rsi:r,atr:a,reasons};
}

function portfolioPlan(capital=2000, assets=[]){
  const candidates=assets.filter(x=>x.analysis?.action==='BUY').sort((a,b)=>b.analysis.score-a.analysis.score).slice(0,3);
  if(!candidates.length)return {capital,mode:'WAIT',cash:capital,positions:[],reason:'Nessun asset supera contemporaneamente i filtri di trend e momentum.'};
  const riskBudget=capital*0.02;
  const positions=candidates.map((x,i)=>{
    const atrValue=x.analysis.atr||x.price*.03;
    const stopDistance=Math.max(atrValue*1.5,x.price*.03);
    const riskPerUnit=stopDistance;
    const maxRiskUnits=Math.floor((riskBudget/Math.max(1,candidates.length))/riskPerUnit);
    const allocation=Math.min(Math.floor(capital*0.30),Math.max(0,Math.floor(maxRiskUnits*x.price)));
    return {symbol:x.symbol,name:x.name,allocation,entry:x.price,stop:Math.max(0,x.price-stopDistance),target:x.price+stopDistance*2,riskPct:allocation?Math.round((allocation/ capital)*1000)/10:0,score:x.analysis.score};
  }).filter(x=>x.allocation>0);
  const invested=positions.reduce((a,x)=>a+x.allocation,0);
  return {capital,mode:'PAPER_TRADE',cash:capital-invested,positions,invested,rule:'massimo 30% del capitale per posizione; rischio teorico ~2% del capitale complessivo; nessun ordine reale'};
}

export async function marketSnapshot(){
  const groups=[
    ['indices',INDEXES],['watchlist',WATCHLIST],['macro',MACRO]
  ];
  const out={timestamp:new Date().toISOString(),indices:[],watchlist:[],macro:[],errors:[]};
  for(const [group,list] of groups){
    const results=await Promise.all(list.map(async ([name,symbol])=>{try{const m=await yahoo(symbol,'3mo','1d');return {...m,name};}catch(e){out.errors.push({symbol,error:e.message});return null;}}));
    out[group]=results.filter(Boolean);
  }
  out.watchlist=out.watchlist.map(x=>({...x,analysis:scoreAsset(x)}));
  out.marketRegime={
    riskOn:out.indices.filter(x=>['^GSPC','^IXIC','^DJI','^RUT'].includes(x.symbol)).reduce((a,x)=>a+(x.changePct>0?1:-1),0)>=2,
    vix:out.indices.find(x=>x.symbol==='^VIX')?.price??null,
    breadth:out.indices.filter(x=>x.symbol!=='^VIX').filter(x=>x.changePct>0).length,
    total:out.indices.filter(x=>x.symbol!=='^VIX').length
  };
  out.strategy=portfolioPlan(2000,out.watchlist);
  return out;
}
