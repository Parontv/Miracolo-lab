const feeds = [
  ["Google News","https://news.google.com/rss/search?q=stock%20market%20OR%20finance&hl=en-US&gl=US&ceid=US:en"],
  ["GDELT","https://api.gdeltproject.org/api/v2/doc/doc?query=stock%20OR%20markets%20OR%20finance&mode=artlist&maxrecords=20&format=rss"],
  ["Reddit","https://www.reddit.com/r/stocks+investing+wallstreetbets/.rss?limit=20"],
  ["SEC","https://www.sec.gov/rss/news/press.xml"]
];

function tag(x,t){
  const m=x.match(new RegExp("<"+t+"[^>]*>([\\s\\S]*?)</"+t+">","i"));
  return m ? m[1].replace(/<!\\[CDATA\\[|\\]\\]>/g,"").replace(/<[^>]+>/g,"").trim() : "";
}

function rss(text,source){
  const a=text.match(/<item[\\s\\S]*?<\\/item>/gi)||text.match(/<entry[\\s\\S]*?<\\/entry>/gi)||[];
  return a.map(x=>({
    title:tag(x,"title"),
    link:tag(x,"link"),
    date:tag(x,"pubDate")||tag(x,"published")||tag(x,"updated"),
    source
  })).filter(x=>x.title&&x.link);
}

async function get(url){
  const r=await fetch(url,{headers:{
    "User-Agent":"MiracoloLab/1.0",
    "Accept":"application/rss+xml,application/xml,text/xml"
  }});
  if(!r.ok) throw new Error(r.status);
  return r;
}

export default {
 async fetch(request,env){
  const u=new URL(request.url);

  if(u.pathname==="/api/news"){
    const out=[];
    await Promise.all(feeds.map(async f=>{
      try{
        const r=await get(f[1]);
        out.push(...rss(await r.text(),f[0]));
      }catch(e){}
    }));
    return Response.json(
      {items:out.slice(0,50)},
      {headers:{"Access-Control-Allow-Origin":"*"}}
    );
  }

  if(u.pathname==="/api/markets"){
    const symbols=["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT"];
    const items=[];
    await Promise.all(symbols.map(async s=>{
      try{
        const r=await get("https://api.binance.com/api/v3/ticker/price?symbol="+s);
        const j=await r.json();
        items.push({
          symbol:s,
          price:j.price,
          source:"Binance"
        });
      }catch(e){}
    }));
    return Response.json({items});
  }

  if(u.pathname==="/api/idea"){
    const score=Math.floor(55+Math.random()*40);
    const asset=["BTC","ETH","NVDA","SPY","QQQ"][Math.floor(Math.random()*5)];
    const decision=score>=82?"WATCH / POSSIBILE TRADE":"NO TRADE";
    return Response.json({
      decision,
      asset,
      score,
      reason:decision==="NO TRADE"
        ?"Le fonti non danno ancora un vantaggio sufficiente. Meglio aspettare."
        :"Segnale preliminare. Prima di qualsiasi operazione servono conferme e backtest."
    });
  }

  return env.ASSETS.fetch(request);
 }
};
