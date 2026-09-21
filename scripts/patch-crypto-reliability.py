from pathlib import Path
import re

p=Path('worker.js')
s=p.read_text()
start=s.find('async function cryptoQuotes(){')
end=s.find('async function universe',start)
if start<0 or end<0:
    raise SystemExit('crypto function boundaries not found')
new=r'''async function cryptoQuotes(){
  const out=[];
  const add=(symbol,price,change24h,source)=>{
    price=Number(price||0);
    if(price>0&&!out.some(x=>x.symbol===symbol))out.push({symbol,price,change24h:Number(change24h||0),ok:true,source});
  };
  try{
    const r=await get('https://api.exchange.coinbase.com/products/BTC-EUR/ticker');
    if(r.ok){const d=await r.json();add('BTC',d?.price,0,'Coinbase');}
  }catch{}
  try{
    const r=await get('https://api.exchange.coinbase.com/products/ETH-EUR/ticker');
    if(r.ok){const d=await r.json();add('ETH',d?.price,0,'Coinbase');}
  }catch{}
  if(out.length<2)try{
    const r=await get('https://api.kraken.com/0/public/Ticker?pair=XBTEUR,ETHEUR');
    if(r.ok){
      const d=await r.json(),rs=d.result||{};
      for(const [pair,x] of Object.entries(rs)){
        const u=pair.toUpperCase(),symbol=u.includes('XBT')?'BTC':u.includes('ETH')?'ETH':'';
        if(symbol)add(symbol,x?.c?.[0],0,'Kraken');
      }
    }
  }catch{}
  if(out.length<2)try{
    const r=await get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=eur&include_24hr_change=true');
    if(r.ok){
      const d=await r.json();
      add('BTC',d.bitcoin?.eur,d.bitcoin?.eur_24h_change,'CoinGecko');
      add('ETH',d.ethereum?.eur,d.ethereum?.eur_24h_change,'CoinGecko');
    }
  }catch{}
  for(const symbol of ['BTC','ETH'])if(!out.some(x=>x.symbol===symbol)){
    for(const pair of [symbol+'EUR',symbol+'USDT']){
      if(out.some(x=>x.symbol===symbol))break;
      for(const base of ['https://data-api.binance.vision','https://api.binance.com']){
        try{
          const r=await get(base+'/api/v3/ticker/24hr?symbol='+pair);
          if(!r.ok)continue;
          const d=await r.json();let price=Number(d.lastPrice||0),chg=Number(d.priceChangePercent||0);
          if(pair.endsWith('USDT')&&price>0){
            try{
              const fx=await get(base+'/api/v3/ticker/price?symbol=EURUSDT');
              if(fx.ok){const f=Number((await fx.json()).price||0);if(f>0)price=price/f;}
            }catch{}
          }
          add(symbol,price,chg,'Binance');
          if(out.some(x=>x.symbol===symbol))break;
        }catch{}
      }
    }
  }
  for(const symbol of ['BTC','ETH'])if(!out.some(x=>x.symbol===symbol)){
    try{const q=await quote(symbol+'-EUR');add(symbol,q.price,q.previous?((q.price-q.previous)/q.previous)*100:0,'Yahoo');}catch{}
  }
  return{timestamp:new Date().toISOString(),crypto:out};
}
'''
s=s[:start]+new+s[end:]
p.write_text(s)
print('Crypto reliability patch: PASS')
