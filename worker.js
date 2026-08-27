const feeds=[
  ["Google News","news","https://news.google.com/rss/search?q=stock%20market%20OR%20finance%20OR%20Federal%20Reserve%20OR%20Nvidia%20OR%20Bitcoin%20OR%20AI&hl=en-US&gl=US&ceid=US:en"],
  ["GDELT","news","https://api.gdeltproject.org/api/v2/doc/doc?query=stock%20OR%20markets%20OR%20finance%20OR%20Nvidia%20OR%20Bitcoin&mode=artlist&maxrecords=30&format=rss"],
  ["Reddit Investing","social","https://www.reddit.com/r/investing/.rss?limit=25"],
  ["Reddit Stocks","social","https://www.reddit.com/r/stocks/.rss?limit=25"],
  ["Reddit WallStreetBets","social","https://www.reddit.com/r/wallstreetbets/.rss?limit=25"],
  ["Reddit Bitcoin","social","https://www.reddit.com/r/Bitcoin/.rss?limit=25"]
];

function tag(s,t){
  const a=s.indexOf("<"+t);
  if(a<0)return "";
  const o=s.indexOf(">",a);
  const c=s.indexOf("</"+t+">",o+1);
  if(o<0||c<0)return "";
  return s.slice(o+1,c).replace(/<!\[CDATA\[|\]\]>/g,"").replace(/<[^>]*>/g,"").trim();
}
function parseRSS(s,source){
  const out=[];
  const re=/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi;
  let m;
  while((m=re.exec(s))!==null){
    const item=m[0],title=tag(item,"title"),description=tag(item,"description"),date=tag(item,"pubDate");
    let link=tag(item,"link");
    if(title&&link)out.push({title,description,date,link,source});
  }
  return out;
}
function score(x){
  const t=((x.title||"")+" "+(x.description||"")).toLowerCase();
  let n=1;
  ["nvidia","nvda","bitcoin","btc","ethereum","crypto","ai","artificial intelligence","semiconductor","tsmc","amd","broadcom","crowdstrike","fed","federal reserve","inflation","earnings","guidance","upgrade","downgrade","tariff","recession","gold","copper","oil","treasury","interest rate"].forEach(k=>{if(t.includes(k))n+=.35});
  ["surge","rally","plunge","crash","record","warning","beat","miss","jumps","drops"].forEach(k=>{if(t.includes(k))n+=.7});
  return Math.min(6,Math.round(n));
}
async function feed(url){
  const r=await fetch(url,{headers:{"User-Agent":"Miracolo-Lab-News-Radar/2.0","Accept":"application/rss+xml,application/xml,text/xml"}});
  if(!r.ok)throw new Error("HTTP "+r.status);
  return r.text();
}

export default{
 async fetch(request,env){
  const u=new URL(request.url);
  if(u.pathname==="/api/health")return Response.json({ok:true,service:"Miracolo Lab News Radar",timestamp:new Date().toISOString()});
  if(u.pathname==="/api/full-scan"){
    const all=[],sources=[];
    await Promise.all(feeds.map(async f=>{
      try{
        const items=(await feed(f[2])).slice(0,40).map(x=>({...x,score:score(x)}));
        all.push(...items);
        sources.push({name:f[0],type:f[1],status:"ok",count:items.length,error:null});
      }catch(e){
        sources.push({name:f[0],type:f[1],status:"error",count:0,error:String(e)});
      }
    }));
    all.sort((a,b)=>b.score-a.score);
    const news=all.filter(x=>x.source.toLowerCase().includes("reddit")===false);
    const social=all.filter(x=>x.source.toLowerCase().includes("reddit"));
    return Response.json({
      ok:true,type:"full_scan",timestamp:new Date().toISOString(),
      summary:{news:news.length,social:social.length,total:all.length,workingSources:sources.filter(x=>x.status==="ok").length,failedSources:sources.filter(x=>x.status!=="ok").length},
      top_signals:all.slice(0,40),news:news.slice(0,40),social:social.slice(0,25),sources
    },{headers:{"Cache-Control":"no-store"}});
  }
  if(u.pathname==="/api/news")return Response.redirect(new URL("/api/full-scan",u),307);
  if(env.ASSETS)return env.ASSETS.fetch(request);
  return new Response("Not found",{status:404});
 }
};