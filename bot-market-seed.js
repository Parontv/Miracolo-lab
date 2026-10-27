/* Lightweight public market-data fallback for the Bot. One Yahoo batch request. */
const SYMBOLS=['SPY','QQQ','IWM','DIA','EFA','XLE','XLI','XLY','^VIX','DX-Y.NYB','GC=F','BZ=F'];
const NAMES={SPY:'S&P 500 ETF',QQQ:'Nasdaq 100 ETF',IWM:'Russell 2000 ETF',DIA:'Dow Jones ETF',EFA:'MSCI EAFE ETF',XLE:'Energy ETF',XLI:'Industrials ETF',XLY:'Consumer Discretionary ETF','^VIX':'VIX','DX-Y.NYB':'DXY','GC=F':'Gold','BZ=F':'Brent'};
export async function seedBotMarket(){
 const failures=[];
 try{
  const u='https://query1.finance.yahoo.com/v7/finance/quote?symbols='+SYMBOLS.map(encodeURIComponent).join(',');
  const r=await fetch(u,{headers:{Accept:'application/json','User-Agent':'MiracoloLab/1.0'}});
  if(!r.ok)throw Error('Yahoo HTTP '+r.status);
  const j=await r.json();
  const rows=Array.isArray(j?.quoteResponse?.result)?j.quoteResponse.result:[];
  const bySymbol=new Map(rows.map(x=>[String(x?.symbol||''),x]));
  const indices=[];
  for(const symbol of SYMBOLS){
   const q=bySymbol.get(symbol),price=Number(q?.regularMarketPrice),previous=Number(q?.regularMarketPreviousClose??q?.previousClose);
   if(!Number.isFinite(price)){failures.push({symbol,error:'Yahoo quote unavailable'});continue}
   indices.push({ticker:symbol,name:NAMES[symbol]||symbol,price,previous:Number.isFinite(previous)?previous:null,changePct:Number.isFinite(previous)&&previous!==0?(price-previous)/previous*100:null,volume:Number(q?.regularMarketVolume)||null,ok:true,source:'Yahoo Finance',timestamp:new Date().toISOString()});
  }
  return{indices,crypto:[],timestamp:new Date().toISOString(),source:'Yahoo Finance batch',coverage:indices.length+'/'+SYMBOLS.length,failures,fetchCount:1};
 }catch(error){
  return{indices:[],crypto:[],timestamp:new Date().toISOString(),source:'Yahoo Finance batch',coverage:'0/'+SYMBOLS.length,failures:[{symbol:'*',error:String(error?.message||error)}],fetchCount:1};
 }
}
