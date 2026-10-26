/* Lightweight public market-data fallback for the Bot. No credentials required. */
const SYMBOLS=['SPY','QQQ','IWM','DIA','EFA','XLE','XLI','XLY','^VIX','DX-Y.NYB','GC=F','BZ=F'];
const NAMES={SPY:'S&P 500 ETF',QQQ:'Nasdaq 100 ETF',IWM:'Russell 2000 ETF',DIA:'Dow Jones ETF',EFA:'MSCI EAFE ETF',XLE:'Energy ETF',XLI:'Industrials ETF',XLY:'Consumer Discretionary ETF','^VIX':'VIX','DX-Y.NYB':'DXY','GC=F':'Gold','BZ=F':'Brent'};
async function quote(symbol){
 const u='https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(symbol)+'?range=2d&interval=1d&includePrePost=false';
 const r=await fetch(u,{headers:{Accept:'application/json','User-Agent':'MiracoloLab/1.0'}});
 if(!r.ok)throw Error('Yahoo HTTP '+r.status);
 const j=await r.json(),m=j?.chart?.result?.[0]?.meta||{},price=Number(m.regularMarketPrice??m.chartPreviousClose),previous=Number(m.previousClose??m.chartPreviousClose);
 if(!Number.isFinite(price)||!Number.isFinite(previous)||previous===0)throw Error('Yahoo quote unavailable');
 return{ticker:symbol,name:NAMES[symbol]||symbol,price,previous,changePct:(price-previous)/previous*100,ok:true,source:'Yahoo Finance'};
}
export async function seedBotMarket(){
 const failures=[];
 const results=await Promise.all(SYMBOLS.map(async s=>{try{return await quote(s)}catch(error){failures.push({symbol:s,error:String(error?.message||error)});return null}}));
 const indices=results.filter(Boolean);
 return{indices,crypto:[],timestamp:new Date().toISOString(),source:'Yahoo Finance fallback',coverage:indices.length+'/'+SYMBOLS.length,failures};
}
