from pathlib import Path
import re

p=Path('worker.js')
s=p.read_text()

if "async function chartData(symbol,period='5d')" not in s:
    marker="function rsi(a,n=14){"
    if marker not in s:
        raise SystemExit("chart patch: RSI marker not found")
    chart_fn="""async function chartData(symbol,period='5d'){
  const ranges={intraday:['1d','5m'],short:['5d','15m'],'5d':['5d','15m'],'1m':['1mo','1h'],'3m':['3mo','1d'],'1y':['1y','1d']};
  const [range,interval]=ranges[String(period||'5d').toLowerCase()]||ranges['5d'];
  let last='';
  for(const host of ['query1.finance.yahoo.com','query2.finance.yahoo.com']){
    try{
      const r=await get('https://'+host+'/v8/finance/chart/'+encodeURIComponent(symbol)+'?range='+range+'&interval='+interval+'&includePrePost=false');
      if(!r.ok){last='HTTP '+r.status;continue}
      const d=await r.json(),z=d.chart?.result?.[0],q=z?.indicators?.quote?.[0],ts=z?.timestamp||[];
      if(!q||!Array.isArray(ts))throw Error('chart data unavailable');
      const candles=[];
      for(let i=0;i<ts.length;i++){
        const o=Number(q.open?.[i]),h=Number(q.high?.[i]),l=Number(q.low?.[i]),c=Number(q.close?.[i]),v=Number(q.volume?.[i]||0);
        if([o,h,l,c].every(Number.isFinite)&&c>0)candles.push({time:Number(ts[i]),open:o,high:h,low:l,close:c,volume:Number.isFinite(v)?v:0});
      }
      if(candles.length)return{ok:true,symbol,period:range,interval,candles};
      last='no candles';
    }catch(e){last=String(e.message||e)}
  }
  return{ok:false,symbol,period:range,error:last||'chart unavailable',candles:[]};
}
"""
    s=s.replace(marker,chart_fn+marker,1)

route_old="if(u.pathname==='/api/market-monitor'){if(!(await rateLimit(req,env,'market',12)))return json({ok:false,error:'Rate limit exceeded'},429);return json(await market(env))}"
route_new=route_old+"if(u.pathname==='/api/chart'){if(!(await rateLimit(req,env,'chart',30)))return json({ok:false,error:'Rate limit exceeded'},429);const symbol=(u.searchParams.get('symbol')||'').trim();const period=(u.searchParams.get('period')||'5d').trim();if(!symbol||!/^[A-Za-z0-9_^.=\\-]{1,30}$/.test(symbol))return json({ok:false,error:'Invalid symbol'},400);return json(await chartData(symbol,period))}"
if "/api/chart" not in s:
    if route_old not in s:
        raise SystemExit("chart patch: market route not found")
    s=s.replace(route_old,route_new,1)

p.write_text(s)
print("Market chart patch: PASS")
