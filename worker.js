const HTML = `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Miracolo Lab</title><style>body{background:#080c11;color:#fff;font-family:Arial;padding:30px}a{color:#93c5fd}</style></head>
<body><h1>🪄 Miracolo Lab</h1><p>Caricamento dashboard…</p><p><a href="/index.html">Apri dashboard</a></p></body></html>`;

function getTagValue(text,tag){
 const re=new RegExp("<"+tag+"(?:\\\\s[^>]*)?>([\\\\s\\\\S]*?)</"+tag+">","i");
 const m=text.match(re); if(!m)return "";
 return m[1].replace(/<!\\[CDATA\\[|\\]\\]>/g,"").replace(/<[^>]*>/g,"").trim();
}
function parseRSS(text,source){
 const out=[]; const re=/<item(?:\\s[^>]*)?>[\\s\\S]*?<\\/item>/gi; let m;
 while((m=re.exec(text))){
  const item=m[0],title=getTagValue(item,"title"),description=getTagValue(item,"description"),date=getTagValue(item,"pubDate");
  let link=getTagValue(item,"link");
  if(title&&link)out.push({title,description,date,link,source});
 }
 return out;
}
async function fetchFeed(url){
 const r=await fetch(url,{headers:{"User-Agent":"Miracolo-Lab-News-Radar/1.0","Accept":"application/rss+xml,application/xml,text/xml"}});
 if(!r.ok)throw new Error("HTTP "+r.status);
 return r.text();
}
function score(x){
 const t=((x.title||"")+" "+(x.description||"")).toLowerCase(); let s=1;
 ["nvidia","nvda","bitcoin","btc","ethereum","crypto","ai","artificial intelligence","semiconductor","tsmc","amd","broadcom","crowdstrike","fed","federal reserve","inflation","earnings","guidance","upgrade","downgrade","tariff","recession","gold","copper","oil","treasury","interest rate"].forEach(k=>{if(t.includes(k))s+=.35});
 ["surge","rally","plunge","crash","record","warning","beat","miss","jumps","drops"].forEach(k=>{if(t.includes(k))s+=.7});
 return Math.min(6,Math.round(s));
}

async function fullScan(){
 const feeds=[
  ["Google News","https://news.google.com/rss/search?q=stock%20market%20OR%20finance%20OR%20Federal%20Reserve%20OR%20Nvidia%20OR%20Bitcoin%20OR%20AI&hl=en-US&gl=US&ceid=US:en"],
  ["GDELT","https://api.gdeltproject.org/api/v2/doc/doc?query=stock%20OR%20markets%20OR%20finance%20OR%20Nvidia%20OR%20Bitcoin&mode=artlist&maxrecords=30&format=rss"],
  ["Reddit Investing","https://www.reddit.com/r/investing/.rss?limit=25"],
  ["Reddit Stocks","https://www.reddit.com/r/stocks/.rss?limit=25"],
  ["Reddit WallStreetBets","https://www.reddit.com/r/wallstreetbets/.rss?limit=25"]
 ];
 const all=[],sources=[];
 await Promise.all(feeds.map(async ([name,url])=>{
  try{const items=parseRSS(await fetchFeed(url),name);items.forEach(x=>x.score=score(x));all.push(...items);sources.push({name,type:name.toLowerCase().includes("reddit")?"social":"news",status:"ok",count:items.length,error:null})}
  catch(e){sources.push({name,type:name.toLowerCase().includes("reddit")?"social":"news",status:"error",count:0,error:String(e)})}
 }));
 all.sort((a,b)=>(b.score||0)-(a.score||0));
 const news=all.filter(x=>!x.source.toLowerCase().includes("reddit")),social=all.filter(x=>x.source.toLowerCase().includes("reddit"));
 return {ok:true,type:"full_scan",timestamp:new Date().toISOString(),summary:{news:news.length,social:social.length,total:all.length,workingSources:sources.filter(x=>x.status==="ok").length,failedSources:sources.filter(x=>x.status!=="ok").length},top_signals:all.slice(0,40),news:news.slice(0,40),social:social.slice(0,25),sources};
}

export default {async fetch(request,env){
 const url=new URL(request.url);
 if(url.pathname==="/api/health")return Response.json({ok:true,service:"Miracolo Lab News Radar",timestamp:new Date().toISOString()});
 if(url.pathname==="/api/full-scan")return Response.json(await fullScan(),{headers:{"Cache-Control":"no-store"}});
 if(url.pathname==="/api/news")return Response.redirect(new URL("/api/full-scan",url),307);
 if(url.pathname==="/"||url.pathname==="/index.html"){
  if(env.ASSETS){const r=await env.ASSETS.fetch(new Request(new URL("/index.html",url)));if(r.ok)return r}
  return new Response(HTML,{headers:{"Content-Type":"text/html;charset=UTF-8","Cache-Control":"no-store"}});
 }
 if(env.ASSETS)return env.ASSETS.fetch(request);
 return new Response("Not found",{status:404});
}};